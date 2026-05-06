# Planner

A local two-page-per-day digital agenda modeled after a Franklin Planner Compass-Monarch paper book. Single user, runs entirely on `localhost`, persists to SQLite. Pulls events from Google Calendar and Outlook so the daily timeline shows your real meetings alongside whatever you typed by hand.

## CRITICAL: Use Node 20

`react-scripts 5.0.1` hangs silently on Node 24. Node 20 is installed at `/Users/gideonamelkin/.local/bin/node` and should already be first on PATH on the dev machine — no prefix needed.

## Quick start

```bash
bash ~/Documents/Planner/start.sh   # backend (5002) + frontend (3001), both backgrounded
bash ~/Documents/Planner/stop.sh
# open http://localhost:3001 — redirects to today's spread
```

Logs at `logs/backend.log` and `logs/frontend.log`. Both servers exit cleanly via `stop.sh` (kills pidfiles + anything left on the ports).

Calendar OAuth is optional. The Settings panel (cog icon, top-right) has Connect buttons that stay disabled until `backend/.env` has the credentials. See [CALENDAR_SETUP.md](CALENDAR_SETUP.md) for the one-time Google Cloud Console + Azure portal walkthrough.

## Architecture (one-pager)

```
                 ZenQuotes (random)
                       |
                       v
+------------------------------------------------+
|  Express backend (port 5002, Node 20)          |
|                                                 |
|  routes -- server.js                            |
|  rollover -- rollover.js (pull-forward dedup)   |
|  quotes  -- quoteService.js (unique per date)   |
|  calendars -- calendarService.js (Google + MS)  |
|                                                 |
|  +---------------------+                        |
|  |  planner.db (SQLite)|                        |
|  +---------------------+                        |
+------------------------------------------------+
                       ^
                       | REST + axios + retry-once
                       |
+------------------------------------------------+
|  React 19 frontend (port 3001, react-scripts)   |
|                                                 |
|  /day/:date      -> DailyView                   |
|  /master/:y/:m   -> MasterTaskList              |
|  /calendar/:y/:m -> MonthlyCalendar             |
+------------------------------------------------+
```

## Routes (frontend)

| Path | Component | What it shows |
|---|---|---|
| `/` | redirect → `/day/{today}` | |
| `/day/:date` | `pages/DailyView.jsx` | Two-page spread — date + mini calendar + appointment timeline on the left; quote + day-info badge + Action Items + Tasks/Notes + free-form notes on the right |
| `/master/:year/:month` | `pages/MasterTaskList.jsx` | Personal \| Business two-column running list for a month |
| `/calendar/:year/:month` | `pages/MonthlyCalendar.jsx` | Month grid; click a day → DailyView |

Settings is a modal opened from `TopNav.jsx` — manages connected Google / Outlook calendars.

## Endpoints (backend, port 5002)

Day payload, tasks, notes, appointments, master tasks, calendar — all under `/api/...`. Full table in [backend/CLAUDE.md](backend/CLAUDE.md). Two endpoints worth flagging here:

- **`GET /api/day/:date`** — returns everything that renders on the daily spread, including external_events from connected calendars (parallel-fetched, errors quarantined per account so one bad token doesn't block the day).
- **`POST /api/day/:date/pull-forward`** — duplicates incomplete tasks and all notes onto `:date + 1` day. Idempotent via duplicate detection (skips when an item with the same `text` and effective `parent_id` already exists on the target). Completed tasks are never copied.

## Schema

8 tables in `backend/planner.db` (gitignored). Full details in [backend/CLAUDE.md](backend/CLAUDE.md). Two non-obvious invariants:

- **`quotes.text` has a UNIQUE index.** ZenQuotes can return duplicates over time; the unique index is what prevents the same quote landing on two dates. The fetch retries up to 5 times on collision before falling back to a small bundled list.
- **`tasks.parent_id` and `daily_note_entries.parent_id`** support 1-level nesting (sub-items). The pull-forward logic re-parents children to the new copy of their parent on the target day, so the hierarchy survives.

## Conventions

- **All styling is inline JS objects.** Tailwind is *not* in the dep tree. The two design tokens that really matter: ink `#2D3436`, page surface `#FBF6E7`, page background `#F0EAD6`, hairlines `#C9BB9A`. Provider colors for calendar events: Google blue `#1565C0`, Outlook teal `#00695C`, manual cream/black.
- **Auto-save on blur for inputs, debounced 800ms for textareas.** Patterns repeated in `PrioritizedTaskList`, `DailyNotes`, `DailyNotesText`, `AppointmentSchedule` / `TimelineSchedule`.
- **Axios interceptor retries network errors once after 1.5s.** Lets backend restarts mid-edit not flash an error in the UI. See `frontend/src/services/api.js`.
- **Drag-and-drop uses `application/x-planner-task` and `application/x-planner-note` MIME types** to distinguish source. Cross-section drop converts (task → note or vice versa). Within-section drop reorders by writing new `order_index` values.

## Folder map

```
Planner/
  CLAUDE.md                 ← you are here
  CALENDAR_SETUP.md         ← Google Cloud + Azure setup walkthrough
  start.sh / stop.sh        ← service control
  logs/                     ← gitignored runtime logs
  backend/                  ← see backend/CLAUDE.md
  frontend/                 ← see frontend/CLAUDE.md
```

## Reviewing the code

If a future agent picks this up: the most "load-bearing" files are
`backend/server.js` (one Express app, ~500 lines), `backend/rollover.js`
(pull-forward dedup), `backend/calendarService.js` (OAuth + Graph/Calendar
fetchers), `frontend/src/pages/DailyView.jsx` (cell layout for the spread),
`frontend/src/components/PrioritizedTaskList.jsx` and
`frontend/src/components/DailyNotes.jsx` (drag, sub-items, reorder),
`frontend/src/components/TimelineSchedule.jsx` (time-block calendar grid).
