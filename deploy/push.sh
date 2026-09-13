#!/usr/bin/env bash
# Push specific source files from this Mac repo to the Planner checkout on RT100.
#   bash deploy/push.sh backend/server.js frontend/src/pages/DailyView.jsx ...
#   bash deploy/push.sh --delete frontend/src/components/Old.jsx   # remove on the server
#
# Only the named files move. This script never touches the server's backend/.env or
# backend/planner.db, which hold the live OAuth config and real data. Build + restart
# are separate steps (see deploy/README.md) so a bad build never replaces a good one.
set -euo pipefail

HOST=gamelkin@70.42.223.139
REMOTE=/home/gamelkin/apps/planner
REPO="$(cd "$(dirname "$0")/.." && pwd)"

if [ $# -eq 0 ]; then
  echo "usage: bash deploy/push.sh <repo-relative file>...   |   --delete <file>..." >&2
  exit 1
fi

if [ "$1" = "--delete" ]; then
  shift
  for f in "$@"; do
    case "$f" in backend/.env|backend/planner.db*) echo "refusing to delete $f" >&2; exit 1;; esac
  done
  ssh "$HOST" "cd '$REMOTE' && rm -fv $(printf "'%s' " "$@")"
  exit 0
fi

for f in "$@"; do
  case "$f" in backend/.env|backend/planner.db*) echo "refusing to push $f" >&2; exit 1;; esac
  [ -e "$REPO/$f" ] || { echo "no such file: $f" >&2; exit 1; }
done

cd "$REPO"
rsync -avR "$@" "$HOST:$REMOTE/"
