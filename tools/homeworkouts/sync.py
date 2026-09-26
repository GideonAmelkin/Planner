#!/usr/bin/env python3
"""Export the Home Workouts app's data on this Mac and ship the snapshot to the
Planner backend on RT100.

Runs from launchd every 6 hours (com.gideon.planner.homeworkouts.plist) and
by hand:  python3 tools/homeworkouts/sync.py

The transport is rsync over the existing SSH key. There is no push endpoint on
the server (its API has no auth), so the server only ever reads a file. This is
a Python entry point on purpose: launchd runs python3 directly, so python3 is
the one binary that needs Full Disk Access to read the app container and this
repo under ~/Documents (both are guarded for background processes).
"""
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export  # noqa: E402

HOST = 'gamelkin@70.42.223.139'
REMOTE_DIR = '/home/gamelkin/apps/planner/backend/workout-state'
STATE_DIR = os.path.expanduser('~/Library/Application Support/PlannerHomeWorkouts')
SNAPSHOT = os.path.join(STATE_DIR, 'home_workouts.json')
LOG = os.path.join(STATE_DIR, 'sync.log')


def main():
    os.makedirs(STATE_DIR, exist_ok=True)
    log = open(LOG, 'a')
    os.dup2(log.fileno(), sys.stdout.fileno())
    os.dup2(log.fileno(), sys.stderr.fileno())
    os.environ['PATH'] = '/usr/bin:/bin:/usr/sbin:/sbin:' + os.environ.get('PATH', '')
    stamp = lambda: time.strftime('%Y-%m-%d %H:%M:%S')
    print('== %s sync start' % stamp())
    rc = export.main(['--out', SNAPSHOT])
    if rc != 0:
        print('== %s sync failed: export exit %d' % (stamp(), rc))
        return rc
    sys.stderr.flush()
    try:
        subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', HOST, "mkdir -p '%s'" % REMOTE_DIR], check=True, timeout=60)
        subprocess.run(['rsync', '-a', '--timeout=60', SNAPSHOT, '%s:%s/home_workouts.json' % (HOST, REMOTE_DIR)], check=True, timeout=120)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        print('== %s sync failed: %s' % (stamp(), e))
        return 1
    print('== %s sync done' % stamp())
    return 0


if __name__ == '__main__':
    sys.exit(main())
