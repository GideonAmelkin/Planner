#!/usr/bin/env bash
# Starts the Planner backend (port 5002) and frontend (port 3001) in the background.
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="$ROOT/logs"
mkdir -p "$LOG_DIR"

# Stop any existing processes on these ports.
"$ROOT/stop.sh" >/dev/null 2>&1 || true

cd "$ROOT/backend"
nohup node server.js > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" > "$LOG_DIR/backend.pid"
echo "Backend  → pid $BACKEND_PID  log $LOG_DIR/backend.log  port 5002"

cd "$ROOT/frontend"
nohup npm start > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" > "$LOG_DIR/frontend.pid"
echo "Frontend → pid $FRONTEND_PID log $LOG_DIR/frontend.log port 3001"

echo ""
echo "Wait ~10s, then open: http://localhost:3001"
echo "Stop with: bash $ROOT/stop.sh"
