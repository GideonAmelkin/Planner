# Deploying the Planner to RT100

RT100 = Rocky Linux 9 box at `70.42.223.139` (`ssh gamelkin@70.42.223.139`), already
running the Real Estate Analyzer (`rea-api` on pm2 / port 5001, nginx `rea.conf` on
port 80). The Planner is deployed **alongside** it, fully isolated:

- UI (primary): `https://70-42-223-139.sslip.io/`  (nginx + Let's Encrypt, port 443)
- UI (fallback): `http://70.42.223.139:8080/`       (raw-IP, no TLS)
- API: nginx proxies `/api/` -> `127.0.0.1:5002` (backend stays internal)
- Backend: pm2 process `planner-backend`, port 5002

`70-42-223-139.sslip.io` is a free wildcard-DNS hostname (sslip.io) that resolves to the
IP with no signup. It exists so Google OAuth has a real HTTPS host to redirect to (Google
rejects raw-IP / plain-HTTP redirect URIs).

## Day-to-day redeploy (source-only)

The Mac repo (`~/Documents/Planner`, git) is the source of truth. The server checkout at
`~/apps/planner` is a plain copy with no git. **Never rsync the whole tree**: the server's
`backend/.env` (live HTTPS/OAuth config and Garmin credentials), `backend/planner.db` (real
data), `backend/garmin-state/` (Garmin session) and `backend/workout-state/` (the Home
Workouts snapshot) must never be overwritten by the Mac copies. Push only the files you changed.

```bash
# 1. Mac: push the changed source files (and delete removed ones by name)
bash deploy/push.sh backend/server.js frontend/src/agenda/AgendaView.jsx
bash deploy/push.sh --delete frontend/src/agenda/Old.jsx
# ...or mirror whole source folders (adds, updates and deletes; the protected server
# files are excluded; DRY=1 previews)
bash deploy/push.sh --dir frontend/src backend/agenda backend/garmin backend/workout

# 2. Server: install deps only when a package.json changed
ssh gamelkin@70.42.223.139 'cd ~/apps/planner/backend  && npm ci --omit=dev'
ssh gamelkin@70.42.223.139 'cd ~/apps/planner/frontend && npm ci'

# 3. Server: build the frontend and publish it (web root is user-owned, no sudo,
#    no nginx reload; rsync INTO the existing dir so SELinux context is inherited)
ssh gamelkin@70.42.223.139 '
  cd ~/apps/planner/frontend && REACT_APP_API_URL=/api npm run build \
  && rsync -a --delete build/ /var/www/planner/build/
'

# 4. Server: restart the backend (only if backend files changed) and smoke-test
ssh gamelkin@70.42.223.139 'pm2 restart planner-backend && bash ~/apps/planner/backend/scripts/smoke.sh'

# 5. Verify the live bundle changed
curl -s https://70-42-223-139.sslip.io/index.html | grep -o 'main\.[a-z0-9]*\.js'
```

Rollback = `git checkout <previous commit> -- <files>` on the Mac, then the same push.

## Health store: attended history fetch

The Health tab reads `health_days`; today is written by the Garmin warm every 30 minutes and
the 03:30 pass finalizes yesterday plus any older day in the last 28 that is still not final
(up to 5 days a night). Days older than that are never fetched on their own. To backfill,
run the script with the backend running: a day costs 18 calls and `MAX_CALLS_PER_RUN` is 100
(only calls that reach Garmin count), so use 4-day stages. Measured 2026-09-27: 529 direct
calls over ten stages in 62 seconds of script time, Garmin answered every one, no
`rate_limited`. Stopping the backend is not needed: SQLite waits up to 5 s for the lock
(`busyTimeout` in db.js), and the only other shared thing is the Garmin token file, which
two bridge processes would both rewrite only if a token refresh fell inside the same few
seconds as a warm; that window is minutes a year, and a lost refresh recovers by a password
sign-in, so it is accepted rather than paid for with downtime.

```bash
ssh gamelkin@70.42.223.139
cd ~/apps/planner/backend
node scripts/health-fetch.js --from 2026-09-08 --to 2026-09-11 --dry-run   # what it would write, no Garmin calls
node scripts/health-fetch.js --from 2026-09-08 --to 2026-09-11             # about 75 direct calls, 10 s
curl -s http://127.0.0.1:5002/api/health/status | python3 -m json.tool      # level ok, never_final empty
```

`--force` is the one way past a final row: run it when a day's numbers on connect.garmin.com
no longer match ours (Garmin corrected the day) or after a rule change that alters stored
values. It is logged loudly, recorded on the run row, and nothing scheduled can pass it:

```bash
node scripts/health-fetch.js --date 2026-09-20 --force                # refetch and replace
node scripts/health-fetch.js --from 2026-09-14 --to 2026-09-27 --max-days 14 --force --no-refresh   # re-derive from cache, no Garmin calls
```

The status line (and `never_final` on `/api/health/status`) goes amber when a day older than
two days is stored but not final, which is how a finality rule that stopped firing shows up.

## First-time install

Steps 3 to 6 below were run once on 2026-06-20 and do not need repeating. They are kept
for rebuilding the box from scratch. Copy the source with `deploy/push.sh` (or a
`rsync --exclude` list that excludes `backend/.env` and `backend/planner.db*`), then create
`backend/.env` on the server by hand from `backend/.env.example`.

```bash
# 0. (first time) SSH key
ssh-copy-id gamelkin@70.42.223.139

# 3. Install + build on the server (Node 20)
ssh gamelkin@70.42.223.139 '
  cd ~/apps/planner/backend  && npm install --omit=dev
  cd ~/apps/planner/frontend && npm install && REACT_APP_API_URL=/api npm run build
'

# 4. Backend env (server values):
#    backend/.env -> FRONTEND_URL=https://70-42-223-139.sslip.io
#                    BACKEND_URL=https://70-42-223-139.sslip.io
#                    GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET = the Personal Planner client

# 5. Publish build + nginx + pm2 + firewall (sudo; needs an interactive password)
ssh gamelkin@70.42.223.139 '
  sudo mkdir -p /var/www/planner/build && sudo chown -R gamelkin:gamelkin /var/www/planner
  rsync -a ~/apps/planner/frontend/build/ /var/www/planner/build/
  sudo restorecon -Rv /var/www/planner
  sudo cp ~/apps/planner/deploy/nginx-planner.conf /etc/nginx/conf.d/planner.conf
  sudo nginx -t && sudo systemctl reload nginx
  sudo firewall-cmd --permanent --add-port=8080/tcp && sudo firewall-cmd --reload
  pm2 start ~/apps/planner/deploy/ecosystem.config.js || pm2 restart planner-backend
  pm2 save
'

# 6. HTTPS (one-time; certbot edits planner.conf to add listen 443 + 80->443 redirect)
ssh gamelkin@70.42.223.139 '
  sudo dnf install -y epel-release && sudo dnf install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d 70-42-223-139.sslip.io --non-interactive --agree-tos \
       -m gideonamelkin@gmail.com --redirect
  sudo systemctl enable --now certbot-renew.timer
'
```

Ports 80/443 are already open in firewalld; only 8080 needed adding. Auto-renewal runs via
`certbot-renew.timer` (verify with `sudo certbot renew --dry-run` - note it inserts a random
delay of up to ~8 min on non-interactive runs, so give it time).

## Garmin Connect (Garmin tab)

One-time, done 2026-09-26. No sudo: `uv` lives in `~/.local/bin` and downloads its own
Python 3.12 (`garminconnect` needs 3.12; the box only ships 3.9).

```bash
ssh gamelkin@70.42.223.139 '
  curl -LsSf https://astral.sh/uv/install.sh | sh
  cd ~/apps/planner/backend/garmin
  ~/.local/bin/uv venv --python 3.12 .venv
  ~/.local/bin/uv pip install --python .venv/bin/python -r requirements.txt
  mkdir -p ~/apps/planner/backend/garmin-state && chmod 700 ~/apps/planner/backend/garmin-state
'
# backend/.env on the server: GARMIN_EMAIL=... GARMIN_PASSWORD=...  then chmod 600 backend/.env
ssh gamelkin@70.42.223.139 'pm2 restart planner-backend --update-env'
```

Then open Settings in the app and click **Sign in** under Garmin Connect (enter the
verification code if Garmin sends one). The token file refreshes itself afterwards; the
password is only used again if Garmin revokes the session. Fallback when uv cannot fetch a
Python: run `sudo dnf install -y python3.12` in Terminal.app, then
`python3.12 -m venv .venv && .venv/bin/pip install -r requirements.txt` in `backend/garmin`.

Upgrading the client: bump `backend/garmin/requirements.txt`, push it, rerun the `uv pip
install` line, restart the backend. If sign-in starts failing with a Cloudflare 429 or an
auth error after Garmin changes something, check the `python-garminconnect` project for a
release before touching the bridge.

Quick checks on the box:

```bash
cd ~/apps/planner/backend/garmin && .venv/bin/python bridge.py status
curl -s http://127.0.0.1:5002/api/garmin/status
curl -s "http://127.0.0.1:5002/api/garmin/get_user_summary?cdate=$(date +%F)" | head -c 300
```

## Home Workouts (Workout App tab)

The "Workout App" tab shows data from the Home Workouts iPhone app
(`com.abishkking.maleworkout`). Two feeds, because neither alone is enough:

- **The phone push (timing).** The app writes every session to Apple Health. Apple Health has
  no cloud API and macOS has no Health app, so the phone itself posts its recent workouts to
  `POST /api/workout/health` through a Shortcut that runs whenever the Home Workout app is
  closed (plus a nightly heartbeat). This is what makes a workout appear on the tab within
  seconds. It carries type, start, end, duration, calories and the source app, no exercises.
- **The Mac snapshot (detail).** The app is also installed on the Mac as an iPhone-on-Mac app;
  its SQLite files live in the app container, so the Mac exports them and rsyncs one JSON
  snapshot to the server over the existing SSH key. This carries the exercise list and sets.
  It only moves when the Mac app has synced from the account's cloud backup, so since
  2026-09-27 the hourly launchd job presses Me > Sync Data itself first (`app_sync.py`, below).
  And the cloud backup only holds what the phone app has uploaded: as of 2026-09-27 the backup
  ended at Sep 9 while the phone's Health app had newer sessions, so the phone side is a tap
  too (Me > Sync Data on the phone) unless the app turns out to back up on its own.

```
Phone: Apple Health  --Shortcut "Send workouts to Planner" (on app close, 9 PM)-->
RT100: POST /api/workout/health (X-Workout-Token)  --> backend/workout-state/health_workouts.json
Mac:   ~/Library/Containers/com.abishkking.maleworkout/Data  --tools/homeworkouts/export.py-->
       ~/Library/Application Support/PlannerHomeWorkouts/home_workouts.json  --rsync-->
RT100: ~/apps/planner/backend/workout-state/home_workouts.json
Both:  --> GET /api/workout/* (merged: a Health workout within 10 minutes of a snapshot session
       is that session; other Health sources such as the watch are stored but shown on the Garmin tab)
```

### Phone push setup (once)

Server: the API has no auth, so this one route checks a token.

```bash
# on RT100
T=$(openssl rand -hex 32); echo "WORKOUT_PUSH_TOKEN=$T" >> ~/apps/planner/backend/.env; echo $T
pm2 restart planner-backend --update-env && bash ~/apps/planner/backend/scripts/smoke.sh
```

Phone (Shortcuts app), a shortcut named "Send workouts to Planner":

1. **Find Workouts** where Start Date is in the last 14 days, sorted by Start Date.
2. **Repeat with Each** item in Workouts:
   **Dictionary** with keys `type` = Workout Type, `start` = Start Date formatted ISO 8601,
   `end` = End Date formatted ISO 8601, `duration_s` = Duration in seconds, `calories` =
   Total Energy (kcal), `distance_m` = Total Distance (m), `source` = Source Name.
   (Use the workout's magic variables for each value; Format Date with the ISO 8601 format.)
3. **Dictionary** with keys `device` = `iphone`, `sent_at` = Current Date formatted ISO 8601,
   `workouts` = Repeat Results.
4. **Get Contents of URL**: `https://70-42-223-139.sslip.io/api/workout/health`, Method POST,
   Headers `X-Workout-Token` = the token from the server and `Content-Type` =
   `application/json`, Request Body = File, pass the Dictionary from step 3.
5. Nothing else (no Show Result).

Automations (Shortcuts > Automation > +), both set to Run Immediately with Notify When Run
off: **App** > Home Workout > **Is Closed** > run the shortcut; **Time of Day** > 9:00 PM daily
> run the shortcut (the heartbeat: on a rest week the tab's status line still knows the phone
is reporting). Run the shortcut by hand once and check `GET /api/workout/status` shows
`health.received_at`. If Health shows no Home Workout sessions (Health > Browse > Activity >
Workouts), turn on the app's Apple Health sync first; the shortcut sends whatever Health has.

Fallback if automations prove unreliable on the phone: the Health Auto Export app can post
Health data to a REST URL on a schedule; its payload differs, so a second parser would be
added to `workout/service.js` then.

### Hourly app sync on the Mac (since 2026-09-27)

`tools/homeworkouts/app_sync.py` presses Me > Sync Data in the Mac app through the macOS
accessibility API (ctypes from python3 itself: macOS checks the grant on the calling process,
and an `osascript` child of python3 is refused even when python3 is trusted) before every
export (`sync.py --app-sync`, the launchd job's argument). The app exposes its whole UI tree
("BackNew", "Me", "Sync Data", "Synced just now"), so the presses are by name, no coordinates. What the app's Sync
does: it downloads the account's cloud backup (one JSON on Firebase Storage: `allWorkOut`,
`gymData`, weights, profile; left on disk as `Documents/remote_backup.json`) with the app's
own login and rebuilds its databases. The login token lives in the app's private keychain,
so nothing outside the app can fetch that file; the button is the only lever. Rules: the
press runs while the user is at the Mac as long as it stays invisible (AXPress does not raise
the window); it is skipped (`skipped_active`) only when it would take the screen, i.e. waking
an app that went to sleep in the background or a coordinate click, while the keyboard or
mouse was used in the last 2 minutes. A locked screen is `skipped_locked` (the app does not
answer then). An app that does not answer with the screen unlocked is quit and relaunched
hidden, once, then `timeout`. The window is hidden again afterwards unless it was in front.
The outcome goes to `sync.log` and into the snapshot's `source.app_sync` as `{at, outcome,
last_synced_at}` (the last success is kept in `app_sync_state.json` next to the log); the
tab's status line says "app synced <time>", or "app sync stalled since <time>" in amber once
the last success is over 6 hours old. (Until 2026-09-28 any activity skipped the press and a
locked screen timed out, so from Sep 27 19:20 to Sep 28 20:48 nothing synced.) Attended run that ignores the idle rule:
`APP_SYNC_FORCE=1 python3 tools/homeworkouts/sync.py --app-sync`.

One more grant for the same python3, once: System Settings > Privacy & Security >
Accessibility > "+" > Cmd+Shift+G > `/Library/Developer/CommandLineTools/usr/bin/python3`.

Gym sessions (first real one 2026-09-27): a session's exercises are `exercise_record` rows
(`workoutTimeStamp` = the session's `workout_record.timeStamp`, ordered by `orderIndex`), and its
sets are the `set_record` rows whose `exercisePk` is that exercise record's pk (a uuid) and whose
`workoutTimeStamp` is the session, all written at session end. `set_record` rows with a bare
exercise id and `workoutTimeStamp` 0 are the exercise's in-progress working sets, not session
records; `workout_action` / `workout_action_set` belong to templates only. Weights are in the gym
module's unit (`user.weightUnit` -> `user_unit` row: 1 = lb, 0 = kg; converted to kg in the
snapshot), durations and rest are milliseconds, and the lifted total comes from the sets when
`totalSIWeight` is 0. Checked against the app's own session detail on 2026-09-27 (Volume 11970 lbs,
4 sets per exercise) and it matches. Ids with no name on disk get one from `LEARNED_NAMES`
(1071 = Cable Pull Through, read off the app).

One-time setup on the Mac (done 2026-09-26; the plist now runs hourly with `--app-sync`):

```bash
# 1. Full Disk Access for python3, or the background job can read neither the app
#    container (macOS "App Data" protection) nor this repo under ~/Documents.
#    System Settings > Privacy & Security > Full Disk Access > "+" > Cmd+Shift+G >
#    /Library/Developer/CommandLineTools/usr/bin/python3 > Open, then toggle it on.
# 2. Install the launchd agent (every hour, also at login)
cp tools/homeworkouts/com.gideon.planner.homeworkouts.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.gideon.planner.homeworkouts.plist
# 3. Run it once now and read the log
launchctl kickstart -k gui/$(id -u)/com.gideon.planner.homeworkouts
tail -20 ~/Library/Application\ Support/PlannerHomeWorkouts/sync.log
```

By hand at any time: `python3 tools/homeworkouts/sync.py` (same log). Tests:
`python3 -m unittest tools/homeworkouts/test_export.py`. The exporter prints a per-table
reconciliation and exits non-zero if a source row was neither emitted nor counted as
excluded.

Freshness: the tab's status line reads "phone reported <time>, newest workout <day> · app
detail: snapshot exported <time>, newest session <day>". Its colour follows the phone (amber
past 3 days without a report, red past 7); the snapshot part only says how old it is. The Mac
copy of the app only has what it last synced from the app's own cloud backup: open the app on
the Mac (Me tab, same account as the phone) to pull new history. `backend/workout-state/`
(both JSON files and the media) is never pushed or deleted by `deploy/push.sh`. Runs and walks
(a Realm file) are not exported.

## OAuth (calendar sync)

The Google client lives in its own dedicated `Personal Planner` Google Cloud project
(project number `684800270191`), separate from the Real Estate project. Authorized redirect
URI (Google Auth Platform -> Clients -> Personal Planner):

- Google: `https://70-42-223-139.sslip.io/api/calendar/google/callback`
- Outlook (optional, Azure): `https://70-42-223-139.sslip.io/api/calendar/outlook/callback`

Also required in the Google project: **Data Access** scopes `calendar.readonly` +
`userinfo.email`, and **Audience** in Testing with your account added as a Test user.
Test-mode refresh tokens expire ~weekly, so expect to re-click Connect Google periodically.

## Rollback (zero impact on rea)

```bash
ssh gamelkin@70.42.223.139 '
  sudo certbot delete --cert-name 70-42-223-139.sslip.io --non-interactive
  sudo rm /etc/nginx/conf.d/planner.conf && sudo systemctl reload nginx
  pm2 delete planner-backend && pm2 save
  sudo firewall-cmd --permanent --remove-port=8080/tcp && sudo firewall-cmd --reload
'
```
