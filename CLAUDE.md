# Planner

A two-page-per-day digital agenda modeled after a Franklin Planner Compass-Monarch paper
book. Single user, persists to SQLite, pulls events from Google Calendar and Outlook so the
daily timeline shows real meetings next to whatever was typed by hand.

## Where it runs

The app lives on RT100 and that is where all work happens. There is no localhost workflow.

- Live: `https://70-42-223-139.sslip.io/` (nginx + Let's Encrypt). Fallback `http://70.42.223.139:8080/`.
- Server checkout: `~/apps/planner` on `gamelkin@70.42.223.139` (plain copy, no git).
- Backend: pm2 process `planner-backend`, port 5002, proxied at `/api/` by nginx.
- Frontend: static build served from `/var/www/planner/build`.
- Source of truth: this Mac repo (git, `origin` on GitHub). Push files with
  `deploy/push.sh`, build and restart on the server. Runbook: [deploy/README.md](deploy/README.md).
- Never copy `backend/.env` or `backend/planner.db` to the server; the server's copies hold
  the live OAuth config and the real data.

Use Node 20 on both machines; `react-scripts 5.0.1` hangs silently on Node 24.

## What is on the page

One route, `/day/:date` (`/` and anything else redirect to today). Three stacked sections,
referred to by these names:

1. **Planner**: the daily spread. Date headline + mini calendar, quote + day-info badge,
   Appointment Schedule timeline, and the right-hand column of Action Items, Tasks,
   Ongoing and free-form Notes. The dark bar above it (Prev / Today / Next / date picker /
   Recap / Settings) is the header, not part of the spread.
2. **Monthly Goals**: Personal | Business running lists for the month (`MonthlyGoals.jsx`).
3. **Calendar**: the month grid; clicking a day opens that day's spread (`CalendarSection.jsx`).

Recap and Settings are modals opened from the header.

## Architecture

```
ZenQuotes (random)    Google Calendar    Microsoft Graph
        |                    |                 |
+-------v--------------------v-----------------v--------+
|  Express backend (port 5002)                          |
|    server.js        setup, mounts, error middleware   |
|    routes/*.js      one file per resource             |
|    queries.js       shared SQL fragments + aggregates |
|    lib/http.js      asyncHandler, patch/reorder/delete|
|    lib/dates.js     local-day helpers                 |
|    rollover.js      pull-forward with dedup           |
|    autoRollover.js  nightly + catch-up scheduler      |
|    quoteService.js  one unique quote per date         |
|    calendarService.js  provider registry (google/outlook)
|    planner.db (SQLite, WAL)                           |
+----------------------------^--------------------------+
                             | axios, retry-once
+----------------------------v--------------------------+
|  React 19 frontend (react-scripts build)              |
|    pages/DailyView.jsx      the single page           |
|    components/*             sections and widgets      |
|    styles.js                design tokens             |
+-------------------------------------------------------+
```

Details: [backend/CLAUDE.md](backend/CLAUDE.md), [frontend/CLAUDE.md](frontend/CLAUDE.md).

## Two invariants worth knowing

- **`quotes.text` has a UNIQUE index.** That index, not application logic, guarantees a quote
  never repeats. The fetch retries ZenQuotes a few times on collision, then falls back to a
  bundled list. Once a date has a quote it is locked (`date` is the primary key).
- **Pull-forward is idempotent by content.** `POST /api/day/:date/pull-forward` copies open
  tasks and all notes to the next day, skipping any row whose `(text, parent)` already exists
  there. The nightly scheduler in `autoRollover.js` runs the same function at 23:59 local and
  catches up missed days on startup and hourly; `pull_forward_runs` records what was done.

## Conventions

- Styling is inline JS objects; tokens and shared objects live in `frontend/src/styles.js`.
- Inputs save on blur, textareas after an 800 ms debounce.
- Drag-and-drop uses four MIME types (`application/x-planner-task`, `-note`, `-ongoing`,
  `-master-task`). A row accepts its own type to reorder; a section accepts the other
  sections' types to move an item across.
- No em dashes in code, copy, or docs.

## Folder map

```
Planner/
  CLAUDE.md               this file
  CALENDAR_SETUP.md       Google Cloud + Azure one-time setup
  deploy/                 push.sh, README.md runbook, nginx + pm2 configs
  backend/                Express API, see backend/CLAUDE.md
  frontend/               React app, see frontend/CLAUDE.md
```
