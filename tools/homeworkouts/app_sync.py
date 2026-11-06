#!/usr/bin/env python3
"""Press Me > Sync Data in the Home Workouts Mac app, so the hourly export sees what the
phone has backed up. Stdlib only: the macOS accessibility API through ctypes, no osascript.

Why this exists: the app's Sync downloads the account's cloud backup (one JSON on Firebase
Storage) with the app's own login, whose token lives in the app's private keychain. Nothing
outside the app can fetch that file, so the app's button is the only lever.

Why ctypes and not AppleScript: macOS checks Accessibility on the process that makes the
calls. `osascript` as a child of python3 is refused (-25211) even though python3 has the
grant (learned 2026-09-27); python3 calling AXUIElement* itself is trusted. The iOS app on
the Mac exposes its whole UIAccessibility tree: buttons "BackNew", "History", "Me", the
static text "Sync Data" with its "Synced just now" subtitle, and so on.

Permission (once): System Settings > Privacy & Security > Accessibility > "+" > Cmd+Shift+G >
/Library/Developer/CommandLineTools/usr/bin/python3 (the launchd job's program).

Outcomes returned by trigger(): synced, skipped_active, skipped_locked, app_missing,
no_permission, timeout. The sync runs while the user is at the keyboard as long as it can stay
invisible (AXPress does not raise the window). It is skipped only when it would have to take the
screen: activating a sleeping app, or a coordinate click. (Until 2026-09-28 any activity skipped
it, and a day at the Mac meant no sync at all.) A locked screen is skipped too: the app does not
answer accessibility then, and every overnight run used to end in a timeout. When the app stops
answering with the screen unlocked, it is quit and relaunched, once. APP_SYNC_FORCE=1
ignores the activity rule (attended runs and the 10:00 / 21:00 schedule). Afterwards the app is
QUIT on every outcome, unless it was the frontmost app when the run started, and the app that
was in front is brought back (2026-10-30: windows of failed runs were left on screen).
"""
import ctypes
import os
import signal
import subprocess
import sys
import time

BUNDLE_ID = 'com.abishkking.maleworkout'
IDLE_MIN_S = 120         # never take the screen if the user touched the keyboard or mouse more recently
WINDOW_WAIT_S = 30
SYNC_WAIT_S = 60
MAX_BACK = 4             # sub-pages to leave before the tab bar shows

# -- accessibility through ctypes ------------------------------------------------------------

CF = ctypes.cdll.LoadLibrary('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
AX = ctypes.cdll.LoadLibrary('/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices')
c_void_p = ctypes.c_void_p
UTF8 = 0x08000100


class CGPoint(ctypes.Structure):
    _fields_ = [('x', ctypes.c_double), ('y', ctypes.c_double)]


class CGSize(ctypes.Structure):
    _fields_ = [('w', ctypes.c_double), ('h', ctypes.c_double)]


for fn, res, args in (
    (CF.CFStringCreateWithCString, c_void_p, [c_void_p, ctypes.c_char_p, ctypes.c_uint32]),
    (CF.CFStringGetCString, ctypes.c_bool, [c_void_p, ctypes.c_char_p, ctypes.c_long, ctypes.c_uint32]),
    (CF.CFGetTypeID, ctypes.c_ulong, [c_void_p]),
    (CF.CFStringGetTypeID, ctypes.c_ulong, []),
    (CF.CFArrayGetTypeID, ctypes.c_ulong, []),
    (CF.CFBooleanGetTypeID, ctypes.c_ulong, []),
    (CF.CFBooleanGetValue, ctypes.c_bool, [c_void_p]),
    (CF.CFArrayGetCount, ctypes.c_long, [c_void_p]),
    (CF.CFArrayGetValueAtIndex, c_void_p, [c_void_p, ctypes.c_long]),
    (CF.CFRelease, None, [c_void_p]),
    (AX.AXIsProcessTrusted, ctypes.c_bool, []),
    (AX.AXUIElementCreateApplication, c_void_p, [ctypes.c_int]),
    (AX.AXUIElementCopyAttributeValue, ctypes.c_int, [c_void_p, c_void_p, ctypes.POINTER(c_void_p)]),
    (AX.AXUIElementSetAttributeValue, ctypes.c_int, [c_void_p, c_void_p, c_void_p]),
    (AX.AXUIElementPerformAction, ctypes.c_int, [c_void_p, c_void_p]),
    (AX.AXValueGetValue, ctypes.c_bool, [c_void_p, ctypes.c_uint32, c_void_p]),
    (AX.CGEventCreateMouseEvent, c_void_p, [c_void_p, ctypes.c_uint32, CGPoint, ctypes.c_uint32]),
    (AX.CGEventPost, None, [ctypes.c_uint32, c_void_p]),
    (AX.CGSessionCopyCurrentDictionary, c_void_p, []),
    (CF.CFDictionaryGetValue, c_void_p, [c_void_p, c_void_p]),
):
    fn.restype = res
    fn.argtypes = args

kCFBooleanTrue = c_void_p.in_dll(CF, 'kCFBooleanTrue')
kCFBooleanFalse = c_void_p.in_dll(CF, 'kCFBooleanFalse')


def cfs(s):
    return CF.CFStringCreateWithCString(None, s.encode('utf-8'), UTF8)


def pystr(ref):
    if not ref or CF.CFGetTypeID(ref) != CF.CFStringGetTypeID():
        return None
    buf = ctypes.create_string_buffer(4096)
    return buf.value.decode('utf-8', 'replace') if CF.CFStringGetCString(ref, buf, 4096, UTF8) else None


def attr(el, name):
    out = c_void_p()
    key = cfs(name)
    rc = AX.AXUIElementCopyAttributeValue(el, key, ctypes.byref(out))
    CF.CFRelease(key)
    return out if rc == 0 and out.value else None


def attr_str(el, name):
    return pystr(attr(el, name))


def attr_bool(el, name):
    v = attr(el, name)
    return bool(CF.CFBooleanGetValue(v)) if v and CF.CFGetTypeID(v) == CF.CFBooleanGetTypeID() else None


def attr_list(el, name):
    v = attr(el, name)
    if not v or CF.CFGetTypeID(v) != CF.CFArrayGetTypeID():
        return []
    return [CF.CFArrayGetValueAtIndex(v, i) for i in range(CF.CFArrayGetCount(v))]


def geom(el):
    p, s = CGPoint(), CGSize()
    vp, vs = attr(el, 'AXPosition'), attr(el, 'AXSize')
    if vp and vs and AX.AXValueGetValue(vp, 1, ctypes.byref(p)) and AX.AXValueGetValue(vs, 2, ctypes.byref(s)):
        return p.x, p.y, s.w, s.h
    return None


def label(el):
    return ' '.join(x for x in (attr_str(el, 'AXTitle'), attr_str(el, 'AXDescription'), attr_str(el, 'AXValue')) if x)


def find(el, pred, depth=0, max_depth=16):
    """Depth-first: the first element for which pred(role, label) is true."""
    if depth > max_depth:
        return None
    if pred(attr_str(el, 'AXRole'), label(el)):
        return el
    for kid in attr_list(el, 'AXChildren'):
        hit = find(kid, pred, depth + 1, max_depth)
        if hit:
            return hit
    return None


def press(el):
    """AXPress when the element supports it; else a real click at its centre. Returns how."""
    action = cfs('AXPress')
    rc = AX.AXUIElementPerformAction(el, action)
    CF.CFRelease(action)
    if rc == 0:
        return 'pressed'
    g = geom(el)
    if not g:
        return 'no geometry'
    x, y = g[0] + g[2] / 2, g[1] + g[3] / 2
    for kind in (5, 1, 2):  # moved, left down, left up
        ev = AX.CGEventCreateMouseEvent(None, kind, CGPoint(x, y), 0)
        AX.CGEventPost(0, ev)
        CF.CFRelease(ev)
        time.sleep(0.08)
    return 'clicked at %d,%d' % (x, y)


def find_back(win):
    """The sub-page's back button: named "BackNew" on most pages, unnamed on a session's detail
    page, where it is the button sitting in the window's top-left corner under the title bar."""
    named = find(win, lambda r, t: r == 'AXButton' and t == 'BackNew')
    if named:
        return named
    wg = geom(win)
    if not wg:
        return None
    wx, wy = wg[0], wg[1]

    def corner(el):
        g = geom(el)
        return bool(g) and g[0] - wx < 40 and 25 < g[1] - wy < 90 and g[2] <= 60 and g[3] <= 60

    return _find_el(win, lambda el: attr_str(el, 'AXRole') == 'AXButton' and not label(el) and corner(el))


def _find_el(el, pred, depth=0, max_depth=16):
    """Like find() but the predicate sees the element itself."""
    if depth > max_depth:
        return None
    if pred(el):
        return el
    for kid in attr_list(el, 'AXChildren'):
        hit = _find_el(kid, pred, depth + 1, max_depth)
        if hit:
            return hit
    return None


def set_bool(el, name, value):
    key = cfs(name)
    rc = AX.AXUIElementSetAttributeValue(el, key, kCFBooleanTrue if value else kCFBooleanFalse)
    CF.CFRelease(key)
    return rc == 0


def dump(el, depth=0, out=None, limit=80):
    out = [] if out is None else out
    if len(out) >= limit or depth > 14:
        return out
    role, text = attr_str(el, 'AXRole'), label(el)
    if text or role not in ('AXGroup', None):
        out.append('  ' * depth + '%s %r' % (role, text[:50]))
    for kid in attr_list(el, 'AXChildren'):
        dump(kid, depth + 1, out, limit)
    return out


# -- the app ----------------------------------------------------------------------------------

def hid_idle_seconds():
    out = subprocess.run(['/usr/sbin/ioreg', '-c', 'IOHIDSystem'], capture_output=True, text=True).stdout
    for line in out.splitlines():
        if 'HIDIdleTime' in line:
            try:
                return int(line.split('=')[-1].strip()) / 1e9
            except ValueError:
                return None
    return None


def screen_locked():
    """True when the login session's screen is locked (CGSSessionScreenIsLocked)."""
    d = AX.CGSessionCopyCurrentDictionary()
    if not d:
        return False
    key = cfs('CGSSessionScreenIsLocked')
    v = CF.CFDictionaryGetValue(d, key)
    CF.CFRelease(key)
    locked = bool(v) and CF.CFGetTypeID(v) == CF.CFBooleanGetTypeID() and bool(CF.CFBooleanGetValue(v))
    CF.CFRelease(d)
    return locked


def front_bundle_id():
    """Bundle id of the frontmost app, from lsappinfo (works when the app's AX tree does not)."""
    asn = subprocess.run(['/usr/bin/lsappinfo', 'front'], capture_output=True, text=True).stdout.strip()
    if not asn:
        return None
    out = subprocess.run(['/usr/bin/lsappinfo', 'info', '-only', 'bundleid', asn], capture_output=True, text=True).stdout
    return out.split('=')[-1].strip().strip('"') or None


def app_pid():
    """The app's pid by bundle id. Not pgrep -f: that also matched any shell whose command line
    held the pattern, and _quit() then killed it (2026-10-30)."""
    out = subprocess.run(['/usr/bin/lsappinfo', 'info', '-only', 'pid', '-app', BUNDLE_ID], capture_output=True, text=True).stdout
    val = out.split('=')[-1].strip()
    return int(val) if val.isdigit() and int(val) > 0 else None


def wait_window(app, seconds):
    deadline = time.time() + seconds
    while time.time() < deadline:
        wins = attr_list(app, 'AXWindows')
        if wins:
            return wins[0]
        time.sleep(1)
    return None


def trigger(log=print):
    """Sync, then quit the app whatever the outcome (since 2026-10-30: a window left open by a
    failed run sat on the user's screen). The app stays open only if the user had it in front
    when the run started; otherwise the app that was in front is brought back."""
    idle = hid_idle_seconds()
    # APP_SYNC_FORCE=1 is for attended and scheduled runs: take the screen even though someone is at the keyboard.
    active = idle is not None and idle < IDLE_MIN_S and not os.environ.get('APP_SYNC_FORCE')
    if not AX.AXIsProcessTrusted():
        log('app sync: no permission: grant Accessibility to %s (System Settings > Privacy & Security > Accessibility)' % sys.executable)
        return 'no_permission'
    if screen_locked():
        log('app sync: skipped, screen locked (the app does not answer accessibility then)')
        return 'skipped_locked'
    front = front_bundle_id()
    in_use = front == BUNDLE_ID
    try:
        return _run(active, idle, in_use, log)
    finally:
        if not in_use:
            pid = app_pid()
            if pid is not None:
                _quit(pid)
                log('app sync: quit the app')
            if front:
                subprocess.run(['/usr/bin/open', '-b', front], capture_output=True)


def _run(active, idle, in_use, log):
    pid = app_pid()
    launched = False
    if pid is None:
        pid = _launch(log)
        if pid in ('app_missing', 'timeout'):
            return pid
        launched = True
    outcome = _attempt(pid, active, launched, idle, log)
    if outcome != 'unresponsive':
        return outcome
    # Unlocked and still silent: the app is wedged. Relaunch it, once, unless the user is looking at it.
    if in_use:
        log('app sync: timeout: the app is frontmost but does not answer; left alone')
        return 'timeout'
    log('app sync: relaunching the app (pid %d does not answer)' % pid)
    _quit(pid)
    pid = _launch(log)
    if pid in ('app_missing', 'timeout'):
        return pid
    outcome = _attempt(pid, active, True, idle, log)
    return 'timeout' if outcome == 'unresponsive' else outcome


def _launch(log):
    """Start the app; its pid, or 'app_missing' / 'timeout'. Launched in front: a background
    launch (open -g) often never got a window, and the run is quit right after anyway."""
    if subprocess.run(['/usr/bin/open', '-b', BUNDLE_ID], capture_output=True).returncode != 0:
        log('app sync: app missing (open -b %s failed)' % BUNDLE_ID)
        return 'app_missing'
    deadline = time.time() + WINDOW_WAIT_S
    pid = None
    while pid is None and time.time() < deadline:
        time.sleep(1)
        pid = app_pid()
    if pid is None:
        log('app sync: timeout waiting for the app to start')
        return 'timeout'
    return pid


def _quit(pid):
    # The app may exit on its own between lookup and kill (2026-11-03: Errno 3).
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    deadline = time.time() + 15
    while app_pid() == pid and time.time() < deadline:
        time.sleep(0.5)
    if app_pid() == pid:
        try:
            os.kill(pid, signal.SIGKILL)
        except ProcessLookupError:
            return
        time.sleep(1)


def _answers(app, seconds):
    deadline = time.time() + seconds
    while attr_str(app, 'AXRole') is None and time.time() < deadline:
        time.sleep(1)
    return attr_str(app, 'AXRole') is not None


def _attempt(pid, active, launched, idle, log):
    """One pass at Me > Sync Data. Returns an outcome, or 'unresponsive' when the app's
    accessibility tree is missing or broken (the caller may relaunch and try once more)."""
    app = AX.AXUIElementCreateApplication(pid)
    # A hidden iOS-on-Mac app stops answering accessibility after a few minutes in the background
    # (kAXErrorCannotComplete, -25204); activating it wakes it, but activating raises it.
    if not _answers(app, WINDOW_WAIT_S if launched else 0):
        if active:
            log('app sync: skipped, user active (%d s idle) and the app is asleep (waking it would raise it)' % idle)
            return 'skipped_active'
        subprocess.run(['/usr/bin/open', '-b', BUNDLE_ID], capture_output=True)
        if not _answers(app, WINDOW_WAIT_S):
            log('app sync: the app does not answer accessibility even after activation')
            return 'unresponsive'
        log('app sync: woke the app (it had gone to sleep in the background)')
    was_front = attr_bool(app, 'AXFrontmost') is True
    if attr_bool(app, 'AXHidden'):
        set_bool(app, 'AXHidden', False)
    win = wait_window(app, WINDOW_WAIT_S)
    if not win:
        log('app sync: no window (pid %d%s)' % (pid, ', just launched' if launched else ''))
        return 'unresponsive'
    # Right after a launch the window holds only its title bar for a few seconds.
    has_content = lambda: find(win, lambda r, t: r == 'AXButton' and t in ('Me', 'BackNew')) or find_back(win)
    deadline = time.time() + WINDOW_WAIT_S
    while not has_content() and time.time() < deadline:
        time.sleep(1)
    # Leave any sub-page (History, a session's detail, Settings) so the tab bar is reachable.
    for _ in range(MAX_BACK):
        back = find_back(win)
        if not back:
            break
        log('app sync: back: %s' % press(back))
        time.sleep(1.2)
    me = find(win, lambda r, t: r == 'AXButton' and t == 'Me')
    if not me:
        # Seen 2026-09-28 15:20: the window answered with a tree of nested AXApplication nodes.
        log('app sync: no Me tab; elements: ' + ' | '.join(dump(win, limit=12)))
        _finish(app, was_front)
        return 'unresponsive'
    row = open_me_tab(app, win, me, active, log)
    if not row:
        log('app sync: no Sync Data row; elements: ' + ' | '.join(dump(win)))
        _finish(app, was_front)
        return 'timeout'
    action = cfs('AXPress')
    pressed = AX.AXUIElementPerformAction(row, action) == 0
    CF.CFRelease(action)
    if pressed:
        how = 'pressed'
    elif active:
        # A coordinate click needs the window on screen; not while the user is working.
        log('app sync: skipped, user active (%d s idle) and Sync Data needs a click' % idle)
        _finish(app, was_front)
        return 'skipped_active'
    else:
        # A coordinate click needs the window on screen: raise, click, hide later.
        set_bool(app, 'AXFrontmost', True)
        time.sleep(0.8)
        how = press(row)
    log('app sync: Sync Data: %s' % how)
    outcome = 'timeout'
    deadline = time.time() + SYNC_WAIT_S
    while time.time() < deadline:
        time.sleep(2)
        if find(win, lambda r, t: 'Synced just now' in t or 'Sync Successful' in t):
            outcome = 'synced'
            break
    log('app sync: %s' % outcome)
    _finish(app, was_front)
    return outcome


def _sync_row(win, seconds):
    deadline = time.time() + seconds
    while True:
        row = find(win, lambda r, t: t.startswith('Sync Data'))
        if row or time.time() >= deadline:
            return row
        time.sleep(0.5)


def _me_radio(win):
    """The unlabelled AXRadioButton that follows the 'Me' button in the Tab Bar group. Since
    2026-10-30 AXPress on the 'Me' AXButton succeeds but no longer switches the tab."""
    bar = find(win, lambda r, t: t == 'Tab Bar')
    if not bar:
        return None
    kids = attr_list(bar, 'AXChildren')
    for i, kid in enumerate(kids):
        if attr_str(kid, 'AXRole') == 'AXButton' and label(kid) == 'Me':
            for nxt in kids[i + 1:i + 2]:
                if attr_str(nxt, 'AXRole') == 'AXRadioButton':
                    return nxt
    return None


def open_me_tab(app, win, me, active, log):
    """Switch to the Me tab; the Sync Data row, or None. Tries, in order: AXPress on the 'Me'
    button, AXPress on its radio button, a real click at the button's centre (window raised;
    not while the user is working)."""
    log('app sync: Me: %s' % press(me))
    row = _sync_row(win, 6)
    if row:
        return row
    radio = _me_radio(win)
    if radio:
        log('app sync: Me radio: %s' % press(radio))
        row = _sync_row(win, 6)
        if row:
            return row
    if active:
        log('app sync: skipped the Me click, user active')
        return None
    set_bool(app, 'AXFrontmost', True)
    time.sleep(0.8)
    g = geom(me)
    if g:
        x, y = g[0] + g[2] / 2, g[1] + g[3] / 2
        for kind in (5, 1, 2):
            ev = AX.CGEventCreateMouseEvent(None, kind, CGPoint(x, y), 0)
            AX.CGEventPost(0, ev)
            CF.CFRelease(ev)
            time.sleep(0.08)
        log('app sync: Me: clicked at %d,%d' % (x, y))
    return _sync_row(win, 6)


def _finish(app, was_front):
    if not was_front:
        set_bool(app, 'AXHidden', True)


if __name__ == '__main__':
    print(trigger())
    sys.exit(0)
