#!/usr/bin/env python3
"""Answer the Workout tab's Refresh button.

The Planner server cannot reach this Mac, so the button (POST /api/workout/refresh) leaves a
request on the server and this script, run by launchd every 15 seconds
(com.gideon.planner.homeworkouts-refresh.plist), polls GET /api/workout/refresh. A request newer
than the last one handled here starts sync.py --app-sync --refresh-request <requested_at> with
APP_SYNC_FORCE=1 (the user is at the keyboard: they just pressed the button). The request is
recorded as handled BEFORE the sync runs, so a failing sync is not retried every 15 seconds; the
hourly job carries on as usual.

Run by hand:  python3 tools/homeworkouts/refresh_watch.py
"""
import calendar
import json
import os
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

URL = 'https://70-42-223-139.sslip.io/api/workout/refresh'
STATE_DIR = os.path.expanduser('~/Library/Application Support/PlannerHomeWorkouts')
STATE = os.path.join(STATE_DIR, 'refresh_state.json')
# A request older than this is not answered (the Mac was asleep; the hourly run covers it).
MAX_AGE_S = 15 * 60


def parse_iso(s):
    """Epoch seconds from the server's toISOString() ('2026-10-03T21:50:00.000Z'), or None."""
    try:
        return calendar.timegm(time.strptime(s.split('.')[0].rstrip('Z'), '%Y-%m-%dT%H:%M:%S'))
    except (AttributeError, ValueError):
        return None


def to_answer(requested_at, last_handled, now):
    """True when requested_at is a new, recent request (the one decision this script makes)."""
    if not requested_at or requested_at == last_handled:
        return False
    t = parse_iso(requested_at)
    if t is None:
        return False
    last = parse_iso(last_handled) if last_handled else None
    if last is not None and t <= last:
        return False
    return now - t <= MAX_AGE_S


def read_state():
    try:
        with open(STATE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def write_state(data):
    os.makedirs(STATE_DIR, exist_ok=True)
    tmp = STATE + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(data, f)
    os.replace(tmp, STATE)


def main():
    try:
        with urllib.request.urlopen(urllib.request.Request(URL, headers={'User-Agent': 'PlannerHomeWorkouts/1.0'}), timeout=10) as r:
            requested_at = json.load(r).get('requested_at')
    except (urllib.error.URLError, OSError, ValueError):
        return 0  # offline or the server is restarting: the next poll tries again
    state = read_state()
    if not to_answer(requested_at, state.get('last_handled'), time.time()):
        return 0
    write_state({'last_handled': requested_at, 'started_at': time.strftime('%Y-%m-%dT%H:%M:%S%z')})
    os.environ['APP_SYNC_FORCE'] = '1'
    import sync  # noqa: E402  (imported late: it pulls in the exporter, only needed when answering)
    return sync.main(['--app-sync', '--refresh-request', requested_at])


if __name__ == '__main__':
    sys.exit(main())
