# Backend

Express 5 + `sqlite3`, port **5002**. Runs under pm2 as `planner-backend` on RT100
(`deploy/ecosystem.config.js`). `npm start` is plain `node server.js`.

One folder per tab: `agenda/`, `garmin/`, `workout/`, `social/`, `health/`. Each exports an express
`Router` from its `index.js` that `app.js` mounts at `/api`, and requires only `../db` and
`../lib/*`, never another tab. The one exception is `health/ingest.js`, which requires
`garmin/service.js` (the bridge's `callMany`) and listens on `lib/bus.js` for the bundle the
Garmin warm announces. `db.js`, `lib/`, `scripts/` and `test/` are shared. `node --test test/`
runs the suites against a throwaway database (`PLANNER_DB_PATH`).

## Files

| File | Role |
|---|---|
| `server.js` | The listener: `createApp()` from `app.js`, then `agenda.startScheduler()`, `startHealthScheduler()` (before the first warm), `startWarmCache()`, `startReviewScheduler()`. |
| `app.js` | `createApp()`: cors, json, the `GET /api/health` liveness probe (registered before the Health router so it keeps answering `{status:"ok"}`), the five tab routers under `/api`, the error middleware. Tests mount it on an ephemeral port. |
| `lib/bus.js` | One process-wide `EventEmitter`; `bus.announce(event, ...)` is emit with a throwing listener logged, not propagated. The Garmin warm announces `garmin:day` `{kind, date, results, fetched_at}`. |
| `health/metrics.js` | The Health store's declarations: one entry per metric naming the day-bundle calls it reads (plus the two static reads `get_heart_rate_zones` and `get_user_profile`), `derive(results, ctx)` for the small card value (goals from the same day's response, never constants), `takenAt`, and `absent()` for the card's reason. Every bundle call feeds at least one metric so its full response is kept. VO2 max label from Garmin's manual table (URL and read date in the file). |
| `health/ingest.js` | `ingestDays(dates, {kind, refresh, dryRun, bundles, maxCalls})`: writes `health_days` and `health_activities` under the store rules (below), records every run in `health_runs` (row inserted with `started_at` before any work), counts cached vs direct calls, stops before exceeding `MAX_CALLS_PER_RUN` (100) with `budget_stop`. A dry run uses `callMany(cacheOnly)` (never spawns the bridge) and touches no table. Read helpers `metricsForDate`, `history`, `activitiesBetween`, `recentRuns`. |
| `health/scheduler.js` | Listens for `garmin:day` and ingests the warm's own result objects (kind `today`, zero extra Garmin calls, detached so the warm never waits); 03:30 local refetches and finalizes yesterday; hourly catch-up of older days only when `HEALTH_CATCHUP_DAYS` is set (default off: history is fetched attended); scheduled runs pause after `mfa_required` / `auth` until a run succeeds again. |
| `health/index.js` | `GET /api/health/day/:date`, `/status`, `/runs`, `/metrics`; `POST /api/health/fetch` (manual refresh of today, one per 30 minutes, 409 while paused). Reads only the store. |
| `scripts/health-fetch.js` | Attended ingest: `--date D` or `--from A --to B` (at most `--max-days`, default 7, refused over 14), `--dry-run`, `--no-refresh`. Run it with the backend stopped so two bridge processes never refresh the token file at once. |
| `test/health.test.js` | 12 node:test cases: the warm guard, today writes, idempotency, never backwards, finality, dry run, the call ceiling, the run rows, the probe and router, the helpers. |
| `agenda/index.js` | The Agenda router: mounts every file in `agenda/routes/` and re-exports `startScheduler`. |
| `agenda/routes/day.js` | `GET /api/day/:date` (the whole spread in one payload) and pull-forward. |
| `agenda/routes/tasks.js`, `notes.js`, `ongoing.js`, `appointments.js`, `masterTasks.js` | CRUD per resource. Each declares its full `/api/...` paths. |
| `agenda/routes/summaries.js` | `GET /api/month/:y/:m` counts and `GET /api/recap`. |
| `agenda/routes/calendar.js` | Accounts list/disconnect plus connect/callback for every provider in the registry. |
| `agenda/queries.js` | Priority ordering expression, column lists, month and recap aggregations. |
| `lib/http.js` | `asyncHandler`, `isDate`/`isDateTime`/`isYearMonth`, and the generic `patchRow`, `reorderRows`, `deleteRow` handlers. |
| `lib/dates.js` | `localISO`, `nextDayISO`, `toLocalDateTime`, `dayWindow`, `monthPrefix`. Everything is local time. |
| `db.js` | Opens `planner.db`, creates tables, applies best-effort `ALTER TABLE` migrations. Exports `run / get / all`. |
| `agenda/rollover.js` | `pullForward(sourceDate)`: copy open tasks and notes to the next day with dedup. |
| `agenda/autoRollover.js` | Nightly 23:59 run, startup and hourly catch-up, `pull_forward_runs` bookkeeping. |
| `agenda/quoteService.js` | `getQuoteForDate(date)`: ZenQuotes + UNIQUE-index dedup + fallback list. |
| `agenda/calendarService.js` | `providers.{google,outlook}` registry plus provider-agnostic account storage, token refresh and per-day fetch. |
| `garmin/service.js` | Spawns `garmin/bridge.py` one run at a time, coerces params from `garmin/registry.json`, caches reads in `garmin_cache`, keeps today's Garmin bundle warm, holds the sign-in child during an MFA hand-off. |
| `garmin/bridge.py` | Python 3.12 CLI over the `garminconnect` client: `status`, `login` (reads the MFA code from stdin), `logout`, `call` (a batch of registry methods, one process). Tokens in `garmin-state/garmin_tokens.json`. |
| `garmin/registry.json` | One entry per garminconnect method: `name`, `group`, `kind` (read / write / unsupported), `params` with types. Read by both sides. |
| `workout/service.js` | Two sources, one reader: `workout-state/home_workouts.json` (the Mac snapshot, see `tools/homeworkouts/`, never written here) and `workout-state/health_workouts.json` (the phone's Apple Health workouts, written by `storeHealth` atomically, keyed by start time and type, never pruned). Both re-parse on mtime change. `allSessions` merges them: a Health workout within 10 minutes of a snapshot session on the same day is that session (the snapshot row stays and borrows the calories); only sources matching "Home Workout" become sessions, the rest count as `health.other_sources`. Tests: `node --test workout/`. |
| `workout/index.js` | `GET /api/workout/{status,day/:date,recent,catalog}` plus `POST /api/workout/health`, the one route on this API with a secret: `X-Workout-Token` must equal `WORKOUT_PUSH_TOKEN` (503 when unset, 401 when wrong, constant-time compare). The API has no auth otherwise, which is why nothing else writes from outside. |
| `garmin/index.js` | Status, login, MFA, logout, endpoints, `day/:date` bundle, batch, and GET/POST `/api/garmin/:name`. |
| `social/service.js` | Read-only reader of the TikTok tracker's `tiktok.db` (`TIKTOK_DB_PATH`, default `~/Documents/Social/TikTokAnalyzer/data/tiktok.db`): `OPEN_READONLY`, busy timeout, re-queries on mtime change, reopens if the inode changes. `rows` (every sheet column, no script), `video(id)` (with script), `summary`, `recentWindow` (last 30 days or the 20 most recent), `allTimeBest`. Never writes. |
| `social/review.js` | The Claude review: deterministic stats (rank by views, per-1k engagement, medians, `series` = where today sits in the current run of daily posts) + `claude-opus-5` with a JSON schema output, prompt v6, a writer's brief: `hook_types` (every window video's opening line named by its move, free text) and `hooks` (10 spoken opening lines grouped by move, 4 or 5 moves with at least 2 each, Relatable always one of them, at most 12 words, open loops, banned copywriter constructions); `trigger` carries the prompt version suffix; stored in `social_reviews` beside the numbers; em dashes stripped. Cap: five manual runs per local day (failed ones count, the scheduled run does not); the button greys out at the cap. |
| `social/index.js` | `GET /api/social/{status,videos,videos/:id,review}`, `POST /api/social/review/generate`. |
| `scripts/smoke.sh` | Exercises every non-OAuth route against `127.0.0.1:5002`; run after every restart. |
| `.env` | `PORT`, `FRONTEND_URL`, `BACKEND_URL`, four OAuth secrets, `GARMIN_EMAIL` / `GARMIN_PASSWORD`, `ANTHROPIC_API_KEY` (the Social review), optional `TIKTOK_DB_PATH`, optional `HEALTH_CATCHUP_DAYS` (0 / unset = the Health store never fetches history on its own). Gitignored; the server copy is the live one. |
| `garmin-state/` | Garmin session tokens (0700 dir, 0600 file). Gitignored; push.sh refuses it. |
| `workout-state/` | `home_workouts.json`, the Home Workouts snapshot rsynced from the Mac. Gitignored; push.sh refuses it. `media/thumbs/` holds the app's own thumbnails plus frames the Mac renders from the clips with `tools/homeworkouts/thumbs.swift`; the Templates card falls back to the clip's first frame for the few clips AVFoundation cannot decode. |
| `planner.db` | SQLite WAL database. Gitignored; the server copy is the real data. |

## Schema (15 tables)

```
tasks                Action Items: priority A/B/C + number, status in_process|completed|forwarded,
                     parent_id for one level of sub-items. forwarded_from/forwarded_to are legacy.
appointments         Manual timeline blocks, start_at/end_at as 'YYYY-MM-DDTHH:MM' local. hour is legacy.
daily_note_entries   The "Tasks" section rows, per date, parent_id for sub-items.
daily_notes          Free-form textarea per date ("Notes").
ongoing_items        The "Ongoing" section: nested items with no date.
master_tasks         Monthly Goals, category personal|business, status open|done.
quotes               PRIMARY KEY date, UNIQUE(text).
calendar_accounts    One row per connected account: provider, email, tokens, expires_at (epoch ms).
pull_forward_runs    Which dates were pulled forward and by what trigger (manual|auto).
daily_tracker        Legacy; no route reads or writes it.
garmin_cache         Garmin read results: (name, params JSON) -> payload, fetched_at epoch ms.
social_reviews       One row per Claude review run (also failed ones, with error): generated_at, trigger,
                     window, video_count, newest_video_id, model, tokens, stats_json, result_json.
health_days          The Health store: (date = Garmin calendarDate, metric) -> value JSON (the card value,
                     goals inside it), payload JSON (the full response of every call the metric read,
                     keyed by call), taken_at (Garmin's timestamp for the reading), fetched_at, final.
health_activities    One row per Garmin activity: type, name, start, duration, distance, calories, HR,
                     sets, reps, polyline [[lat, lon]], payload (activity + details_geo + exercise_sets).
health_runs          One row per ingest run: started_at (written first), finished_at, kind
                     (today|finalize|catchup|manual|dry), dates, ok, failed, written, unchanged, stale,
                     errors JSON, calls_total / calls_cached / calls_garmin.
```

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{status:"ok"}` |
| GET | `/api/day/:date` | `{date, tasks, appointments, notes, ongoing, notes_text, quote, external_events, calendar_errors}` |
| POST | `/api/day/:date/pull-forward` | `{rolledTasks, movedNotes, targetDate}`; records a manual run |
| POST / PATCH / DELETE | `/api/tasks[/:id]` | PATCH allows text, priority, priority_num, status, order_index, parent_id |
| POST | `/api/tasks/reorder` | `{ids}` -> `order_index = position`, one UPDATE |
| POST / PATCH / DELETE | `/api/notes[/:id]` | DELETE cascades to children |
| POST | `/api/notes/reorder` | |
| PUT | `/api/notes-text/:date` | upsert `daily_notes` |
| POST / PATCH / DELETE | `/api/ongoing[/:id]` | DELETE cascades to children |
| POST | `/api/ongoing/reorder` | |
| POST / PATCH / DELETE | `/api/appointments[/:id]` | start_at and end_at validated as local datetimes |
| GET / POST / PATCH / DELETE | `/api/master-tasks[/:id]` | `?year=&month=` on GET |
| POST | `/api/master-tasks/reorder` | |
| GET | `/api/month/:year/:month` | per-day task and appointment counts |
| GET | `/api/recap` | completed tasks grouped by date, newest first |
| GET | `/api/calendar/accounts` | `{accounts, providers: {google, outlook}}` |
| DELETE | `/api/calendar/accounts/:id` | |
| GET | `/api/calendar/{google\|outlook}/connect` | 302 to the provider consent page |
| GET | `/api/calendar/{google\|outlook}/callback` | registered with Google and Microsoft; never rename |
| GET | `/api/garmin/status` | `{configured, python_ok, token_file, connected, signing_in, needs_mfa, profile}` |
| POST | `/api/garmin/login` | starts the sign-in; `{ok:true}` or `{needs_mfa:true}` |
| POST | `/api/garmin/login/mfa` | `{code}` finishes a sign-in that asked for a code |
| POST | `/api/garmin/logout` | deletes the token file and the cache |
| GET | `/api/garmin/endpoints` | the registry |
| GET | `/api/garmin/day/:date` | the Garmin tab bundle (18 endpoints, cached per endpoint); `?refresh=1` |
| POST | `/api/garmin/batch` | `{calls:[{key, name, params}], refresh}` for read endpoints |
| GET | `/api/garmin/:name` | any read endpoint; query params are validated against the registry |
| POST | `/api/garmin/:name` | any write endpoint; JSON body is validated against the registry |
| GET | `/api/workout/status` | `{available, exported_at, received_at, app_version, counts, profile, awards, last_session, snapshot_last_session, health:{available, received_at, device, count, other_sources, last_workout}}`; `available` is true when either source exists; `last_session` is the newest across both |
| POST | `/api/workout/health` | header `X-Workout-Token`; body `{device, sent_at, workouts:[{type, start, end, duration_s, calories, distance_m, source}]}` (at most 500, `start` must parse); `{stored, new, total, received_at}`; idempotent |
| GET | `/api/workout/day/:date` | `{sessions, plan_day, weights, exported_at, health_received_at}` for that local date; 404 `{available:false}` when neither source exists |
| GET | `/api/workout/recent?end=&days=` | sessions (sets stripped, `via: 'health'` for phone-only ones, `'both'` when matched) in the window, newest first, plus every weigh-in |
| GET | `/api/workout/catalog` | `{templates, plan}` |
| GET | `/api/social/status` | `{available, videos, total_views, views_30d, posts_30d, last_post, newest_video_id, updated_at, review:{has_key, running}}` |
| GET | `/api/social/videos` | `{summary, videos, updated_at}`: every column of the tracker's `videos` table except `script`, newest first; 404 `{available:false}` without the db |
| GET | `/api/social/videos/:id` | one video with `script` and `script_summary`; 400 non-numeric id, 404 unknown |
| GET | `/api/social/review` | the latest successful review: `{review, stats, window, generated_at, usage, running, stale:{new_videos}, throttle, last_error}`; 404 `{available:false, running, throttle}` before the first run |
| POST | `/api/social/review/generate` | starts a run in the background: 202 `{running}`; 409 already running; 429 `{error, next_allowed_at, retry_after_seconds}`; 503 no `ANTHROPIC_API_KEY` |
| GET | `/api/health/day/:date` | `{date, metrics: {key: {value, taken_at, fetched_at, final, absent}}, activities, history: {start, end, days, activities}}` (28 days, series stripped from history) |
| GET | `/api/health/status` | `{level, paused, stuck, failed_streak, last_run, today, last_24h (calls and the direct-call budget), caps, next_finalize, catchup_days}` |
| GET | `/api/health/runs` | the last 50 `health_runs` rows |
| POST | `/api/health/fetch` | manual refresh of today: 202 started, 429 within 30 min of the last, 409 while a sign-in is needed |
| GET | `/api/workout/media/{video\|thumb}/:id` | the app's own exercise clip / thumbnail for an action id, from `workout-state/media/` (shipped by `tools/homeworkouts/sync.py`: the app's cached clips plus the rest fetched from its CDN by `fetch_media.py`); Range supported; `catalog.media` lists what exists |

Garmin endpoint responses are `{endpoint, params, ok, cached, fetched_at, data}` or
`{endpoint, params, ok:false, error, code}` with status 502; `code` is one of `auth`,
`mfa_required`, `rate_limited`, `not_found`, `connection`, `garmin`, `bad_request`.

Errors are always `{error}` JSON. Anything thrown inside an `asyncHandler` becomes a 500 via
the middleware in `server.js`.

## Health store (`health/`)

Rules the writer enforces, all covered by `test/health.test.js`:

- **One source per metric.** `metrics.js` names the call and field; goals are stored in the
  same row as the value from the same day's response.
- **Never backwards.** A metric that reads the daily summary takes the summary's
  `lastSyncTimestampGMT` as its `taken_at` (it moves forward with every watch sync); the
  others use their own window timestamp. An incoming reading with an older `taken_at`, or a
  null where a value exists, is counted `stale` and not written. Same day twice: every row
  `unchanged`, nothing rewritten, counters show it.
- **Finality.** A day is marked final only by a run that is not the 30-minute `today` pass,
  for a date before today, when the newest Garmin sync the store knows of (today's summary,
  written by the warm; past-day summaries carry `lastSyncTimestampGMT: null`) is at or after
  the end of that local day. A final row is never replaced except by the script's `--force`.
  `/api/health/status` lists `never_final` days (older than two days, not final) and goes
  amber on any, because a finality rule that stops firing is otherwise silent.
- **Field presence on past days, audited 2026-09-27 over 27 days:** summary totals and goals
  present on 25 (the two days before the watch was set up carry an empty summary);
  `dailyStepGoal` varies daily (3,440 to 7,990), `weekGoal` 150 and `weeklyTotal` returned by
  Garmin on every day; `lastSyncTimestampGMT` null on every past day (hence the rule above);
  `wellnessEndTimeGmt` present and equal to the day's end on past days; VO2 max present on
  1 day only (carried forward by the ingest); sleep, HRV, pulse ox, training readiness and
  training status null on every day (the watch is not worn at night); hydration on 4.
- **Full payloads.** Every call in the 18-call day bundle plus the two static reads is kept
  in `health_days.payload`, including sleep, body battery, pulse ox, respiration and
  hydration, so a new card never needs a backfill.
- **Caps.** `MAX_CALLS_PER_RUN = 100` for every kind including manual; the script's
  `--max-days` defaults to 7 and refuses over 14; catch-up is off unless
  `HEALTH_CATCHUP_DAYS` is set and then takes at most 2 days per hour. History is fetched
  attended in weekly stages with the backend stopped (see deploy/README.md).
- **Visibility.** Every run is a `health_runs` row inserted with `started_at` before any
  work; `/api/health/status` turns amber when the last 24 hours exceed 60 direct calls, red
  after three failed runs in a row, a run older than 10 minutes without `finished_at`, or an
  `mfa_required` / `auth` error, which also pauses the scheduled runs.
- **Zero extra calls for today.** The warm's own result objects are what the today ingest
  writes, so the Health tab and the Garmin tab can never hold different bytes for the same
  minute (checked side by side on 2026-09-27: 13 of 13 numbers equal).

## Pull-forward (`agenda/rollover.js`)

`pullForward(sourceDate)` runs `pushTasksForward` then `pushNotesForward`. Each reads the
eligible source rows (tasks: status not completed or forwarded; notes: all), builds a
`text|parent_id` lookup of what already exists on the target day, and inserts only missing
keys, parents first so children re-parent onto the new (or pre-existing) target parent.
Returns the number of rows actually inserted.

## Calendars (`agenda/calendarService.js`)

Each provider implements `configured`, `authUrl`, `exchangeCode`, `refresh`, `fetchEvents`.
`connectAccount` upserts on `(provider, email)`. `freshAccessToken` refreshes when the token
has under a minute left and writes the new credentials back. `listEventsForDate` fetches every
account in parallel with `Promise.allSettled`; one account's failure lands in
`calendar_errors` without blocking the rest. Events are normalized to
`{id, provider, account_id, calendar_email, title, location, start_at, end_at, all_day, organizer, link}`.

## Garmin (`garmin/service.js`)

`spawnBridge(command, payload)` runs `bridge.py` (same folder) with `GARMIN_PYTHON` (default
`garmin/.venv/bin/python`) and streams JSON lines; every run goes through one promise
queue so two processes never refresh the token file at once. `login()` resolves early with
`{needs_mfa:true}` when the bridge prints that event and keeps the child alive for
`submitMfa(code)`. `callMany(calls)` answers reads from `garmin_cache` first (today 30 min,
past days 24 h) and sends the rest to Garmin in one bridge run; `dayBundle(date)` is the
fixed 18-call set behind `/api/garmin/day/:date`. `startWarmCache()` re-fetches today's
bundle every 30 minutes while a token file exists.
