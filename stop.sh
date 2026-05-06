#!/usr/bin/env bash
# Stops the Planner backend and frontend.
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT/logs"

stop_pidfile() {
  local pidfile="$1"
  local name="$2"
  if [ -f "$pidfile" ]; then
    local pid
    pid="$(cat "$pidfile")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 0.4
      kill -9 "$pid" 2>/dev/null || true
      echo "$name stopped (pid $pid)"
    fi
    rm -f "$pidfile"
  fi
}

stop_pidfile "$LOG_DIR/backend.pid" Backend
stop_pidfile "$LOG_DIR/frontend.pid" Frontend

# Belt-and-suspenders: kill anything still listening on our ports.
for port in 5002 3001; do
  pid="$(lsof -ti tcp:$port 2>/dev/null || true)"
  if [ -n "$pid" ]; then
    kill $pid 2>/dev/null || true
    sleep 0.2
    kill -9 $pid 2>/dev/null || true
    echo "Killed leftover process on port $port (pid $pid)"
  fi
done
