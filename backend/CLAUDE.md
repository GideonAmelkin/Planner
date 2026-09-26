# Backend

Express 5 + `sqlite3`, port **5002**. Runs under pm2 as `planner-backend` on RT100
(`deploy/ecosystem.config.js`). `npm start` is plain `node server.js`.

## Files

| File | Role |
|---|---|
| `server.js` | Setup, mounts every router under `/api`, error middleware, `startScheduler()`. |
| `routes/day.js` | `GET /api/day/:date` (the whole spread in one payload) and pull-forward. |
| `routes/tasks.js`, `notes.js`, `ongoing.js`, `appointments.js`, `masterTasks.js` | CRUD per resource. Each declares its full `/api/...` paths. |
| `routes/summaries.js` | `GET /api/month/:y/:m` counts and `GET /api/recap`. |
| `routes/calendar.js` | Accounts list/disconnect plus connect/callback for every provider in the registry. |
| `queries.js` | Priority ordering expression, column lists, month and recap aggregations. |
| `lib/http.js` | `asyncHandler`, `isDate`/`isDateTime`/`isYearMonth`, and the generic `patchRow`, `reorderRows`, `deleteRow` handlers. |
| `lib/dates.js` | `localISO`, `nextDayISO`, `toLocalDateTime`, `dayWindow`, `monthPrefix`. Everything is local time. |
| `db.js` | Opens `planner.db`, creates tables, applies best-effort `ALTER TABLE` migrations. Exports `run / get / all`. |
| `rollover.js` | `pullForward(sourceDate)`: copy open tasks and notes to the next day with dedup. |
| `autoRollover.js` | Nightly 23:59 run, startup and hourly catch-up, `pull_forward_runs` bookkeeping. |
| `quoteService.js` | `getQuoteForDate(date)`: ZenQuotes + UNIQUE-index dedup + fallback list. |
| `calendarService.js` | `providers.{google,outlook}` registry plus provider-agnostic account storage, token refresh and per-day fetch. |
| `garminService.js` | Spawns `garmin/bridge.py` one run at a time, coerces params from `garmin/registry.json`, caches reads in `garmin_cache`, keeps today's Garmin bundle warm, holds the sign-in child during an MFA hand-off. |
| `garmin/bridge.py` | Python 3.12 CLI over the `garminconnect` client: `status`, `login` (reads the MFA code from stdin), `logout`, `call` (a batch of registry methods, one process). Tokens in `garmin-state/garmin_tokens.json`. |
| `garmin/registry.json` | One entry per garminconnect method: `name`, `group`, `kind` (read / write / unsupported), `params` with types. Read by both sides. |
| `routes/garmin.js` | Status, login, MFA, logout, endpoints, `day/:date` bundle, batch, and GET/POST `/api/garmin/:name`. |
| `scripts/smoke.sh` | Exercises every non-OAuth route against `127.0.0.1:5002`; run after every restart. |
| `.env` | `PORT`, `FRONTEND_URL`, `BACKEND_URL`, four OAuth secrets, `GARMIN_EMAIL` / `GARMIN_PASSWORD`. Gitignored; the server copy is the live one. |
| `garmin-state/` | Garmin session tokens (0700 dir, 0600 file). Gitignored; push.sh refuses it. |
| `planner.db` | SQLite WAL database. Gitignored; the server copy is the real data. |

## Schema (11 tables)

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

Garmin endpoint responses are `{endpoint, params, ok, cached, fetched_at, data}` or
`{endpoint, params, ok:false, error, code}` with status 502; `code` is one of `auth`,
`mfa_required`, `rate_limited`, `not_found`, `connection`, `garmin`, `bad_request`.

Errors are always `{error}` JSON. Anything thrown inside an `asyncHandler` becomes a 500 via
the middleware in `server.js`.

## Pull-forward (`rollover.js`)

`pullForward(sourceDate)` runs `pushTasksForward` then `pushNotesForward`. Each reads the
eligible source rows (tasks: status not completed or forwarded; notes: all), builds a
`text|parent_id` lookup of what already exists on the target day, and inserts only missing
keys, parents first so children re-parent onto the new (or pre-existing) target parent.
Returns the number of rows actually inserted.

## Calendars (`calendarService.js`)

Each provider implements `configured`, `authUrl`, `exchangeCode`, `refresh`, `fetchEvents`.
`connectAccount` upserts on `(provider, email)`. `freshAccessToken` refreshes when the token
has under a minute left and writes the new credentials back. `listEventsForDate` fetches every
account in parallel with `Promise.allSettled`; one account's failure lands in
`calendar_errors` without blocking the rest. Events are normalized to
`{id, provider, account_id, calendar_email, title, location, start_at, end_at, all_day, organizer, link}`.

## Garmin (`garminService.js`)

`spawnBridge(command, payload)` runs `garmin/bridge.py` with `GARMIN_PYTHON` (default
`garmin/.venv/bin/python`) and streams JSON lines; every run goes through one promise
queue so two processes never refresh the token file at once. `login()` resolves early with
`{needs_mfa:true}` when the bridge prints that event and keeps the child alive for
`submitMfa(code)`. `callMany(calls)` answers reads from `garmin_cache` first (today 30 min,
past days 24 h) and sends the rest to Garmin in one bridge run; `dayBundle(date)` is the
fixed 18-call set behind `/api/garmin/day/:date`. `startWarmCache()` re-fetches today's
bundle every 30 minutes while a token file exists.
