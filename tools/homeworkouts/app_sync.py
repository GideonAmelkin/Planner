#!/usr/bin/env python3
"""Press Me > Sync Data in the Home Workouts Mac app, so the hourly export sees what the
phone has backed up. Stdlib only; driven through System Events (AppleScript).

Why this exists: the app's Sync downloads the account's cloud backup (one JSON on Firebase
Storage) with the app's own login, whose token lives in the app's private keychain. Nothing
outside the app can fetch that file, so the app's button is the only lever.

Permissions (once): the launchd job runs /Library/Developer/CommandLineTools/usr/bin/python3,
which needs Accessibility (System Settings > Privacy & Security > Accessibility > "+" >
Cmd+Shift+G > that path). The osascript children inherit it. The first run also asks once
for permission to control System Events.

Outcomes returned by trigger(): synced, skipped_active, app_missing, no_permission, timeout.
A skip while the user is active is deliberate: the app must come to the front for a few
seconds to be clicked, and that is not acceptable mid-keystroke; the next hourly run tries
again. On success the previous frontmost app is put back and the Home Workouts window hidden.
"""
import os
import subprocess
import sys
import time

BUNDLE_ID = 'com.abishkking.maleworkout'
PROCESS = 'Home Workouts'
IDLE_MIN_S = 120         # do nothing if the user touched the keyboard or mouse more recently
WINDOW_WAIT_S = 30
SYNC_WAIT_S = 60


def osascript(script, timeout=30):
    """Run AppleScript; (rc, stdout, stderr)."""
    p = subprocess.run(['/usr/bin/osascript', '-e', script], capture_output=True, text=True, timeout=timeout)
    return p.returncode, p.stdout.strip(), p.stderr.strip()


def hid_idle_seconds():
    out = subprocess.run(['/usr/sbin/ioreg', '-c', 'IOHIDSystem'], capture_output=True, text=True).stdout
    for line in out.splitlines():
        if 'HIDIdleTime' in line:
            try:
                return int(line.split('=')[-1].strip()) / 1e9
            except ValueError:
                return None
    return None


SE = 'tell application "System Events" to tell process "%s" to ' % PROCESS


def frontmost_app():
    rc, out, _ = osascript('tell application "System Events" to get name of first process whose frontmost is true')
    return out if rc == 0 else None


def click_named(name, roles=('button', 'static text', 'group', 'menu item', 'radio button', 'UI element')):
    """Click the first UI element whose name or description contains `name`, anywhere in the window.
    Returns (ok, detail). Tries a direct click on the element, then a click at its centre."""
    script = (SE + 'set els to (every UI element of entire contents of window 1 whose name contains "%s" or description contains "%s")\n' % (name, name)
              + 'if (count of els) is 0 then return "none"\n'
              + 'set el to item 1 of els\n'
              + 'try\n  click el\n  return "clicked " & (class of el as text)\non error\nend try\n'
              + 'set {x, y} to position of el\nset {w, h} to size of el\n'
              + 'click at {x + (w div 2), y + (h div 2)}\nreturn "clicked at " & (x + (w div 2)) & "," & (y + (h div 2))')
    rc, out, err = osascript(script)
    if rc != 0:
        return False, err
    return out != 'none', out


def text_present(fragment):
    script = SE + 'count of (every UI element of entire contents of window 1 whose name contains "%s" or value contains "%s")' % (fragment, fragment)
    rc, out, err = osascript(script)
    if rc != 0:
        return None
    try:
        return int(out) > 0
    except ValueError:
        return None


def element_dump(limit=120):
    """Class, name and position of the window's elements, for the log on the first runs."""
    script = SE + 'get {class, name, position} of every UI element of entire contents of window 1'
    rc, out, err = osascript(script, timeout=60)
    return (out if rc == 0 else err)[:4000]


def trigger(log=print):
    idle = hid_idle_seconds()
    # APP_SYNC_FORCE=1 is for attended runs: click even though someone is at the keyboard.
    if idle is not None and idle < IDLE_MIN_S and not os.environ.get('APP_SYNC_FORCE'):
        log('app sync: skipped, user active (%d s idle)' % idle)
        return 'skipped_active'
    previous = frontmost_app()
    if previous is None:
        rc, _, err = osascript('tell application "System Events" to get name of first process')
        if '-1719' in err or 'assistive' in err:
            log('app sync: no permission: grant Accessibility to /Library/Developer/CommandLineTools/usr/bin/python3'
                ' (System Settings > Privacy & Security > Accessibility), then run again')
            return 'no_permission'
    if subprocess.run(['/usr/bin/open', '-b', BUNDLE_ID], capture_output=True).returncode != 0:
        log('app sync: app missing (open -b %s failed)' % BUNDLE_ID)
        return 'app_missing'
    deadline = time.time() + WINDOW_WAIT_S
    while time.time() < deadline:
        rc, out, err = osascript(SE + 'count of windows')
        if rc != 0 and ('-1719' in err or 'assistive' in err):
            log('app sync: no permission: %s' % err)
            return 'no_permission'
        if rc == 0 and out.isdigit() and int(out) > 0:
            break
        time.sleep(1)
    else:
        log('app sync: timeout waiting for the %s window' % PROCESS)
        return 'timeout'
    osascript(SE + 'set frontmost to true')
    time.sleep(1.5)
    ok, detail = click_named('Me')
    log('app sync: Me tab: %s' % detail)
    time.sleep(1.5)
    ok, detail = click_named('Sync Data')
    log('app sync: Sync Data: %s' % detail)
    if not ok:
        log('app sync: elements seen: %s' % element_dump())
        _restore(previous)
        return 'timeout'
    deadline = time.time() + SYNC_WAIT_S
    outcome = 'timeout'
    while time.time() < deadline:
        time.sleep(2)
        if text_present('Synced just now') or text_present('Sync Successful'):
            outcome = 'synced'
            break
    log('app sync: %s' % outcome)
    _restore(previous)
    return outcome


def _restore(previous):
    osascript(SE + 'set visible to false')
    if previous and previous != PROCESS:
        osascript('tell application "System Events" to set frontmost of process "%s" to true' % previous)


if __name__ == '__main__':
    print(trigger())
    sys.exit(0)
