# Planner

A day-per-page digital agenda (the structure of a Franklin Planner Compass-Monarch, drawn
as a card app since 2026-09-26), plus a Garmin tab fed by Garmin Connect and a Workout App
tab fed by the Home Workouts iPhone app. Single user, persists to SQLite, pulls events
from Google Calendar and Outlook so the daily timeline shows real meetings next to whatever
was typed by hand, and pulls the same day's steps, sleep, heart rate and the rest from the
user's Garmin account.

## Where it runs

The app lives on RT100 and that is where all work happens. There is no localhost workflow.

- Live: `https://70-42-223-139.sslip.io/` (nginx + Let's Encrypt). Fallback `http://70.42.223.139:8080/`.
- Server checkout: `~/apps/planner` on `gamelkin@70.42.223.139` (plain copy, no git).
- Backend: pm2 process `planner-backend`, port 5002, proxied at `/api/` by nginx.
- Frontend: static build served from `/var/www/planner/build`.
- Source of truth: this Mac repo (git, `origin` on GitHub). Push files with
  `deploy/push.sh`, build and restart on the server. Runbook: [deploy/README.md](deploy/README.md).
- Never copy `backend/.env`, `backend/planner.db`, `backend/garmin-state/` or
  `backend/workout-state/` to the server; the server's copies hold the live OAuth config, the
  real data, the Garmin session and the Home Workouts snapshot.
- Garmin needs Python 3.12 in `backend/garmin/.venv` on the server (installed with `uv`, no
  sudo). Setup steps are in [deploy/README.md](deploy/README.md).

Use Node 20 on both machines; `react-scripts 5.0.1` hangs silently on Node 24.

## What is on the page

Three tabs, each with its own route: **Agenda** at `/agenda/:date`, **Garmin** at
`/health/:date` and **Workout App** at `/workout/:date` (`/`, `/day/:date` and anything else
redirect to today's agenda). Prev / Today / Next and the date picker stay inside the current tab.
The Agenda and Workout App tabs share a fixed 240px left rail (`AgendaRail`: wordmark, the
three tab links, Recap / Settings at the bottom) and the same header card; the Garmin tab has
its own connect.garmin.com frame.

The Agenda is white cards on a warm grey canvas, in three parts referred to by these names:

1. **Planner**: the daily spread. A header card across the top (`DateCard`: headline
   "Saturday, September 26", Prev / Today / Next + date field, the day pills, the quote in an
   indigo callout, the mini calendar), then the Appointment Schedule card on the left and one
   card each for Action Items, Tasks, Ongoing and free-form Notes on the right.
2. **Monthly Goals**: Personal | Business cards for the month (`MonthlyGoals.jsx`).
3. **Calendar**: the month grid card; clicking a day opens that day's spread (`CalendarSection.jsx`).

Monthly Goals and Calendar sit side by side under the spread.

Recap and Settings are modals opened from the header. Settings holds the calendar
connections and the Garmin Connect sign-in.

The Garmin tab mirrors connect.garmin.com's daily summary (Open Sans, white cards on gray,
blue actions; tokens in `frontend/src/garminTheme.js`) and shows the day's data as cards: Day Summary (steps, distance,
calories, floors, intensity minutes, resting HR, stress, Body Battery, active time, a
steps-per-15-minutes chart), Sleep (duration, score, stages), Heart Rate, Stress, Body
Battery (sparklines behind "View details"), Intensity Minutes, Floors, Calories, Pulse Ox,
Respiration, Hydration, HRV, Training, Weight, green activity blocks, and a collapsed
"All Garmin Endpoints" explorer that lists every mapped endpoint with its parameters and
the raw JSON it returns. Its sidebar is Garmin's own navigation tree; every item opens a
sub-page at `/health/:date/<slug>` fed by the mapped endpoints (`frontend/src/garminNav.js`),
each laid out like the matching Garmin page (rings, timelines, tables, badges, maps), and items Garmin keeps off its API render Garmin's empty state with a link out.

The Workout App tab shows the Home Workouts app (Leap Health, bundle
`com.abishkking.maleworkout`), which runs on the Mac as an iPhone app. The Mac exports its
SQLite files to one JSON snapshot and rsyncs it to `backend/workout-state/` every 6 hours
(`tools/homeworkouts/`, launchd); the server only reads that file. Cards: Sessions for the
day (exercises and sets), Totals (streak, count, active minutes), Body Weight, Last 30 Days,
and a collapsed Plan and Templates catalog. Only what the Mac copy of the app has synced is
shown, and the header says when the snapshot was taken. Runs and walks are not exported.

## Architecture

```
ZenQuotes (random)    Google Calendar    Microsoft Graph    Garmin Connect
        |                    |                 |                 |
        |                    |                 |     garmin/bridge.py (Python 3.12,
        |                    |                 |     garminconnect, one run at a time)
+-------v--------------------v-----------------v-----------------v---+
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
|    garminService.js  bridge queue, read cache, warm  |
|    workoutService.js  Home Workouts snapshot reader   |
|    garmin/registry.json  every Garmin endpoint       |
|    planner.db (SQLite, WAL)                           |
+----------------------------^--------------------------+
                             | axios, retry-once
+----------------------------v--------------------------+
|  React 19 frontend (react-scripts build)              |
|    pages/DailyView.jsx      the Agenda tab            |
|    pages/HealthView.jsx     the Garmin tab            |
|    pages/WorkoutView.jsx    the Workout App tab       |
|    components/*             sections and widgets      |
|    styles.js                design tokens             |
+-------------------------------------------------------+
```

Details: [backend/CLAUDE.md](backend/CLAUDE.md), [frontend/CLAUDE.md](frontend/CLAUDE.md).

## Three invariants worth knowing

- **`quotes.text` has a UNIQUE index.** That index, not application logic, guarantees a quote
  never repeats. The fetch retries ZenQuotes a few times on collision, then falls back to a
  bundled list. Once a date has a quote it is locked (`date` is the primary key).
- **Pull-forward is idempotent by content.** `POST /api/day/:date/pull-forward` copies open
  tasks and all notes to the next day, skipping any row whose `(text, parent)` already exists
  there. The nightly scheduler in `autoRollover.js` runs the same function at 23:59 local and
  catches up missed days on startup and hourly; `pull_forward_runs` records what was done.
- **Garmin is unofficial and serialized.** There is no personal Garmin API; the
  `garminconnect` Python client replays the mobile app's sign-in and Garmin can break it
  without notice. Only one bridge process talks to Garmin at a time, reads are cached in
  `garmin_cache` (today 30 min, past days 24 h, `?refresh=1` bypasses) and today's bundle
  is re-warmed every 30 minutes, so the tab opens from cache.

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
  backend/garmin/         bridge.py, registry.json, requirements.txt (+ .venv on the server)
  tools/homeworkouts/     Mac-side Home Workouts exporter, sync job, launchd plist, tests
  frontend/               React app, see frontend/CLAUDE.md
```
