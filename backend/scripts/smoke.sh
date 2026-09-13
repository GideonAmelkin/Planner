#!/usr/bin/env bash
# Smoke test for the Planner backend. Run on the box after `pm2 restart planner-backend`:
#   bash ~/apps/planner/backend/scripts/smoke.sh            # against 127.0.0.1:5002
#   BASE=http://127.0.0.1:5002/api bash smoke.sh
# Exercises every non-OAuth route: reads today's spread, then creates, patches, reorders
# and deletes one task, note, ongoing item, master task and appointment (all tagged
# SMOKE-TEST) so the database is left as it was found. Exit status is non-zero on the
# first failed check.
set -uo pipefail
BASE="${BASE:-http://127.0.0.1:5002/api}"
TODAY="$(date +%F)"
Y="$(date +%Y)"; M="$(date +%-m)"
fail=0
check() {  # check <label> <expected-status> <method> <path> [json-body]
  local label="$1" want="$2" method="$3" path="$4" body="${5:-}"
  local out code
  if [ -n "$body" ]; then
    out=$(curl -s -o /tmp/smoke-body -w '%{http_code}' -X "$method" -H 'Content-Type: application/json' -d "$body" "$BASE$path")
  else
    out=$(curl -s -o /tmp/smoke-body -w '%{http_code}' -X "$method" "$BASE$path")
  fi
  code="$out"
  if [ "$code" = "$want" ]; then echo "ok   $label ($code)"; else echo "FAIL $label: got $code, want $want"; cat /tmp/smoke-body; echo; fail=1; fi
}
id() { python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])' < /tmp/smoke-body; }

check health            200 GET  /health
check day               200 GET  "/day/$TODAY"
check day-bad-date      400 GET  /day/not-a-date
check month             200 GET  "/month/$Y/$M"
check recap             200 GET  /recap
check calendar-accounts 200 GET  /calendar/accounts
check master-list       200 GET  "/master-tasks?year=$Y&month=$M"

check task-create 200 POST  /tasks "{\"date\":\"$TODAY\",\"text\":\"SMOKE-TEST task\",\"priority\":\"C\"}"; TID=$(id)
check task-patch    200 PATCH "/tasks/$TID" '{"text":"SMOKE-TEST task edited","status":"completed"}'
check task-reorder  200 POST  /tasks/reorder "{\"ids\":[$TID]}"
check task-delete 200 DELETE "/tasks/$TID"

check note-create 200 POST  /notes "{\"date\":\"$TODAY\",\"text\":\"SMOKE-TEST note\"}"; NID=$(id)
check note-patch    200 PATCH "/notes/$NID" '{"text":"SMOKE-TEST note edited"}'
check note-reorder  200 POST  /notes/reorder "{\"ids\":[$NID]}"
check note-delete 200 DELETE "/notes/$NID"

check ongoing-create 200 POST  /ongoing '{"text":"SMOKE-TEST ongoing"}'; OID=$(id)
check ongoing-patch   200 PATCH "/ongoing/$OID" '{"text":"SMOKE-TEST ongoing edited"}'
check ongoing-reorder 200 POST  /ongoing/reorder "{\"ids\":[$OID]}"
check ongoing-delete 200 DELETE "/ongoing/$OID"

check master-create 200 POST  /master-tasks "{\"year\":$Y,\"month\":$M,\"category\":\"personal\",\"text\":\"SMOKE-TEST goal\"}"; MID=$(id)
check master-patch   200 PATCH "/master-tasks/$MID" '{"text":"SMOKE-TEST goal edited"}'
check master-reorder 200 POST  /master-tasks/reorder "{\"ids\":[$MID]}"
check master-delete 200 DELETE "/master-tasks/$MID"

check appt-create 200 POST  /appointments "{\"date\":\"$TODAY\",\"start_at\":\"${TODAY}T23:00:00\",\"end_at\":\"${TODAY}T23:30:00\",\"text\":\"SMOKE-TEST appt\"}"; AID=$(id)
check appt-patch  200 PATCH "/appointments/$AID" '{"text":"SMOKE-TEST appt edited"}'
check appt-delete 200 DELETE "/appointments/$AID"

check notes-text 200 PUT "/notes-text/$TODAY" "$(curl -s "$BASE/day/$TODAY" | python3 -c 'import json,sys; print(json.dumps({"content": json.load(sys.stdin)["notes_text"]}))')"

if [ "$fail" = 0 ]; then echo "SMOKE: all checks passed"; else echo "SMOKE: FAILURES"; exit 1; fi
