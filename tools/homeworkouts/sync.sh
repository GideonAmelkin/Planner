#!/usr/bin/env bash
# Export the Home Workouts app's data on this Mac and ship the snapshot to the
# Planner backend on RT100. Runs from launchd every 30 minutes (see
# com.gideon.planner.homeworkouts.plist) and by hand:
#   bash tools/homeworkouts/sync.sh
# The transport is rsync over the existing SSH key. There is no push endpoint
# on the server (its API has no auth), so the server only ever reads a file.
set -euo pipefail

HOST=gamelkin@70.42.223.139
REMOTE_DIR=/home/gamelkin/apps/planner/backend/workout-state
STATE_DIR="$HOME/Library/Application Support/PlannerHomeWorkouts"
SNAPSHOT="$STATE_DIR/home_workouts.json"
LOG="$STATE_DIR/sync.log"
HERE="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$STATE_DIR"
exec >>"$LOG" 2>&1
echo "== $(date '+%Y-%m-%d %H:%M:%S') sync start"

# launchd gives a minimal PATH; ssh and rsync live in /usr/bin.
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

/usr/bin/python3 "$HERE/export.py" --out "$SNAPSHOT"
ssh -o BatchMode=yes -o ConnectTimeout=15 "$HOST" "mkdir -p '$REMOTE_DIR'"
rsync -a --timeout=60 "$SNAPSHOT" "$HOST:$REMOTE_DIR/home_workouts.json"
echo "== $(date '+%Y-%m-%d %H:%M:%S') sync done"
