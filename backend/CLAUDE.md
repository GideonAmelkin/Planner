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
| `scripts/smoke.sh` | Exercises every non-OAuth route against `127.0.0.1:5002`; run after every restart. |
| `.env` | `PORT`, `FRONTEND_URL`, `BACKEND_URL`, four OAuth secrets. Gitignored; the server copy is the live one. |
| `planner.db` | SQLite WAL database. Gitignored; the server copy is the real data. |

## Schema (10 tables)

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
