#!/usr/bin/env bash
# Push source from this Mac repo to the Planner checkout on RT100.
#   bash deploy/push.sh backend/server.js frontend/src/agenda/AgendaView.jsx ...   # named files
#   bash deploy/push.sh --delete frontend/src/agenda/Old.jsx                       # remove on the server
#   bash deploy/push.sh --dir frontend/src backend/agenda                          # mirror whole folders
#   DRY=1 bash deploy/push.sh --dir frontend/src                                   # preview a mirror
#
# Named files move one by one. --dir mirrors the folders you name (adds, updates and
# deletes on the server side). Neither mode ever touches the server's backend/.env,
# backend/planner.db, backend/garmin-state, backend/garmin/.venv or backend/workout-state,
# which hold live secrets and real data; --dir also refuses whole backend/ or frontend/.
# Build + restart are separate steps (see deploy/README.md) so a bad build never
# replaces a good one.
set -euo pipefail

HOST=gamelkin@70.42.223.139
REMOTE=/home/gamelkin/apps/planner
REPO="$(cd "$(dirname "$0")/.." && pwd)"

if [ $# -eq 0 ]; then
  echo "usage: bash deploy/push.sh <repo-relative file>...   |   --delete <file>...   |   --dir <folder>..." >&2
  exit 1
fi

protected() {
  case "$1" in backend/.env|backend/planner.db*|backend/garmin-state*|backend/garmin/.venv*|backend/workout-state*|backend/social-state*) return 0;; esac
  return 1
}

if [ "$1" = "--delete" ]; then
  shift
  for f in "$@"; do
    protected "$f" && { echo "refusing to delete $f" >&2; exit 1; }
  done
  ssh "$HOST" "cd '$REMOTE' && rm -rfv $(printf "'%s' " "$@")"
  exit 0
fi

if [ "$1" = "--dir" ]; then
  shift
  dirs=()
  for d in "$@"; do
    d="${d%/}"
    protected "$d" && { echo "refusing to sync $d" >&2; exit 1; }
    case "$d" in .|backend|frontend|deploy|tools) echo "refusing to mirror $d whole; name a folder inside it" >&2; exit 1;; esac
    [ -d "$REPO/$d" ] || { echo "no such directory: $d" >&2; exit 1; }
    dirs+=("$d/")
  done
  cd "$REPO"
  # One rsync per folder, source and destination both scoped to it, so --delete can only
  # touch that folder (with -R the implied parents would be in scope too).
  for d in "${dirs[@]}"; do
    rsync -av --delete ${DRY:+--dry-run} \
      --exclude node_modules --exclude build --exclude .env --exclude 'planner.db*' \
      --exclude garmin-state --exclude .venv --exclude workout-state --exclude .DS_Store \
      "$d" "$HOST:$REMOTE/$d"
  done
  exit 0
fi

for f in "$@"; do
  protected "$f" && { echo "refusing to push $f" >&2; exit 1; }
  [ -e "$REPO/$f" ] || { echo "no such file: $f" >&2; exit 1; }
done

cd "$REPO"
rsync -avR "$@" "$HOST:$REMOTE/"
