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
check garmin-status     200 GET  /garmin/status
check garmin-endpoints  200 GET  /garmin/endpoints
check garmin-unknown    404 GET  /garmin/no_such_endpoint
check garmin-bad-date   400 GET  /garmin/day/not-a-date
check workout-media-missing 404 GET /workout/media/video/999999999
check workout-status    200 GET  /workout/status
check workout-bad-date  400 GET  /workout/day/not-a-date
check workout-bad-days  400 GET  "/workout/recent?days=0"
check workout-push-auth 401 POST /workout/health
# 200 once the Mac has shipped a snapshot, 404 before that; both are healthy
WCODE=$(curl -s -o /tmp/smoke-body -w '%{http_code}' "$BASE/workout/day/$TODAY")
if [ "$WCODE" = 200 ] || [ "$WCODE" = 404 ]; then echo "ok   workout-day ($WCODE)"; else echo "FAIL workout-day: got $WCODE"; cat /tmp/smoke-body; echo; fail=1; fi
WCODE=$(curl -s -o /tmp/smoke-body -w '%{http_code}' "$BASE/workout/catalog")
if [ "$WCODE" = 200 ] || [ "$WCODE" = 404 ]; then echo "ok   workout-catalog ($WCODE)"; else echo "FAIL workout-catalog: got $WCODE"; cat /tmp/smoke-body; echo; fail=1; fi
check social-status     200 GET  /social/status
check social-bad-id     400 GET  /social/videos/not-an-id
# 200 with the tracker db on this box, 404 without it; the review is 404 until the first run
for p in videos review; do
  SCODE=$(curl -s -o /tmp/smoke-body -w '%{http_code}' "$BASE/social/$p")
  if [ "$SCODE" = 200 ] || [ "$SCODE" = 404 ]; then echo "ok   social-$p ($SCODE)"; else echo "FAIL social-$p: got $SCODE"; cat /tmp/smoke-body; echo; fail=1; fi
done

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
