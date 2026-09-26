#!/usr/bin/env python3
"""Export the Home Workouts app's data on this Mac and ship the snapshot to the
Planner backend on RT100.

Runs from launchd every 6 hours (com.gideon.planner.homeworkouts.plist) and
by hand:  python3 tools/homeworkouts/sync.py

Besides the JSON it ships the app's own exercise clips and thumbnails (the app
downloads a clip the first time an exercise is started, into its cache, named by
action id) to backend/workout-state/media/{videos,thumbs}/ on the server, and
fetches the clips the app has not cached yet straight from its CDN (fetch_media.py),
a capped batch per run so launchd catches up over a few runs.

The transport is rsync over the existing SSH key. There is no push endpoint on
the server (its API has no auth), so the server only ever reads a file. This is
a Python entry point on purpose: launchd runs python3 directly, so python3 is
the one binary that needs Full Disk Access to read the app container and this
repo under ~/Documents (both are guarded for background processes).
"""
import glob
import json
import os
import shutil
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import export  # noqa: E402
import fetch_media  # noqa: E402

HOST = 'gamelkin@70.42.223.139'
REMOTE_DIR = '/home/gamelkin/apps/planner/backend/workout-state'
STATE_DIR = os.path.expanduser('~/Library/Application Support/PlannerHomeWorkouts')
SNAPSHOT = os.path.join(STATE_DIR, 'home_workouts.json')
LOG = os.path.join(STATE_DIR, 'sync.log')
# The app keeps every exercise clip it has downloaded (only after the exercise was
# started in the app) and the thumbnails of exercises it has shown, both named by
# action id. They are staged under STATE_DIR/media and shipped next to the snapshot.
MEDIA_STAGE = os.path.join(STATE_DIR, 'media')
CLIPS_DIR = os.path.join(export.DEFAULT_CONTAINER, 'Library', 'cacheImv', 'mg', 'tl')
THUMBS_DIR = os.path.join(export.DEFAULT_CONTAINER, 'Library', 'Caches', 'Images')
FETCH_CAP = 80   # CDN downloads per run; the 6-hourly launchd runs finish the rest
# Thumbnails for clips the app never opened come from the clips themselves: thumbs.swift
# (AVFoundation) is compiled once into STATE_DIR/bin and run over every clip without one.
THUMBS_SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'thumbs.swift')
THUMBS_BIN = os.path.join(STATE_DIR, 'bin', 'thumbs')
SWIFTC = '/usr/bin/swiftc'


def stage_media():
    """Copy new or changed clips and thumbnails into the staging dir. Returns (clips, thumbs)."""
    videos = os.path.join(MEDIA_STAGE, 'videos')
    thumbs = os.path.join(MEDIA_STAGE, 'thumbs')
    os.makedirs(videos, exist_ok=True)
    os.makedirs(thumbs, exist_ok=True)

    def copy_if_changed(src, dst):
        try:
            st = os.stat(src)
        except OSError:
            return False
        try:
            dt = os.stat(dst)
            if dt.st_size == st.st_size and int(dt.st_mtime) == int(st.st_mtime):
                return False
        except OSError:
            pass
        shutil.copy2(src, dst)
        return True

    n_clips = n_thumbs = 0
    for src in glob.glob(os.path.join(CLIPS_DIR, '*.mp4')):
        stem = os.path.basename(src)[:-4]
        if stem.isdigit() and copy_if_changed(src, os.path.join(videos, stem + '.mp4')):
            n_clips += 1
    for src in glob.glob(os.path.join(THUMBS_DIR, '*_thumb')):
        stem = os.path.basename(src)[:-len('_thumb')]
        if stem.isdigit() and copy_if_changed(src, os.path.join(thumbs, stem + '.jpg')):
            n_thumbs += 1
    return n_clips, n_thumbs


def make_thumbs():
    """Generate a JPEG frame for every staged clip that has no thumbnail yet.
    Returns the tool's summary line."""
    videos = os.path.join(MEDIA_STAGE, 'videos')
    thumbs = os.path.join(MEDIA_STAGE, 'thumbs')
    os.makedirs(thumbs, exist_ok=True)
    todo = [c for c in sorted(glob.glob(os.path.join(videos, '*.mp4')))
            if not os.path.exists(os.path.join(thumbs, os.path.basename(c)[:-4] + '.jpg'))]
    if not todo:
        return 'thumbnails: 0 made, all present'
    if not os.path.exists(THUMBS_BIN) or os.stat(THUMBS_BIN).st_mtime < os.stat(THUMBS_SRC).st_mtime:
        os.makedirs(os.path.dirname(THUMBS_BIN), exist_ok=True)
        subprocess.run([SWIFTC, '-O', '-o', THUMBS_BIN, THUMBS_SRC], check=True, timeout=600, capture_output=True)
    out = subprocess.run([THUMBS_BIN, thumbs] + todo, check=True, timeout=1800, capture_output=True, text=True).stdout
    lines = [l for l in out.splitlines() if l.strip()]
    for l in lines[:-1]:
        print('   ' + l)
    return lines[-1] if lines else 'thumbnails: no output'


def snapshot_action_ids(path):
    """Every exercise id the snapshot references: templates, sessions and plan days."""
    with open(path) as f:
        snap = json.load(f)
    ids = set()
    for t in snap.get('templates') or []:
        ids.update(str(e.get('action_id')) for e in t.get('exercises') or [])
    for s in snap.get('sessions') or []:
        ids.update(str(e.get('action_id')) for e in s.get('exercises') or [])
    for d in (snap.get('plan') or {}).get('days') or []:
        ids.update(str(e.get('action_id')) for e in d.get('exercises') or [])
    return {i for i in ids if i.isdigit()}


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
        new_clips, new_thumbs = stage_media()
        print('== %s media staged: %d new clip(s), %d new thumbnail(s)' % (stamp(), new_clips, new_thumbs))
    except OSError as e:
        print('== %s media staging skipped: %s' % (stamp(), e))
    try:
        ids = snapshot_action_ids(SNAPSHOT)
        fetched, had, failed = fetch_media.fetch_missing(ids, os.path.join(MEDIA_STAGE, 'videos'), limit=FETCH_CAP, log=lambda m: print('   ' + m))
        print('== %s clips fetched from the CDN: %d new, %d already present, %d failed' % (stamp(), fetched, had, failed))
    except Exception as e:  # never let the clip fetch block the snapshot shipping
        print('== %s clip fetch skipped: %s' % (stamp(), e))
    try:
        print('== %s %s' % (stamp(), make_thumbs()))
    except Exception as e:  # same for the thumbnails
        print('== %s thumbnails skipped: %s' % (stamp(), e))
    try:
        subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', HOST, "mkdir -p '%s/media'" % REMOTE_DIR], check=True, timeout=60)
        subprocess.run(['rsync', '-a', '--timeout=60', SNAPSHOT, '%s:%s/home_workouts.json' % (HOST, REMOTE_DIR)], check=True, timeout=120)
        # Clips are only ever added, so no --delete: nothing outside media/ is touched.
        if os.path.isdir(MEDIA_STAGE):
            subprocess.run(['rsync', '-a', '--timeout=300', MEDIA_STAGE + '/', '%s:%s/media/' % (HOST, REMOTE_DIR)], check=True, timeout=1800)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
        print('== %s sync failed: %s' % (stamp(), e))
        return 1
    print('== %s sync done' % stamp())
    return 0


if __name__ == '__main__':
    sys.exit(main())
