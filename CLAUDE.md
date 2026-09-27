# Planner

A day-per-page digital agenda (the structure of a Franklin Planner Compass-Monarch, drawn
as a card app since 2026-09-26), plus a Garmin tab fed by Garmin Connect, a Workout App
tab fed by the Home Workouts iPhone app and a Social tab fed by the TikTok tracker's database. Single user, persists to SQLite, pulls events
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

Five tabs, each with its own route: **Agenda** at `/agenda/:date`, **Garmin** at
`/garmin/:date`, **Workout** at `/workout/:date`, **Social** at `/social/:date` and **Health**
at `/health/:date` (`/`,
`/day/:date` and anything else redirect to today's agenda). Prev / Today / Next and the date picker stay inside the current tab.
The Agenda, Workout App, Social and Health tabs share a fixed 240px left rail (`AgendaRail`: wordmark,
the five tab links, Recap / Settings at the bottom) and the card look; each has its own header
card. The Garmin tab has its own connect.garmin.com frame.

The Agenda is white cards on a warm grey canvas, in three parts referred to by these names:

1. **Planner**: the daily spread. A header card across the top (`DateCard`: headline
   "Saturday, September 26", Prev / Today / Next + date field, the day pills, the quote in an
   indigo callout, the mini calendar), then the Appointment Schedule card on the left and one
   card on the right holding Action Items, Tasks, Ongoing and free-form Notes, separated by
   hairlines.
2. **Monthly Goals**: Personal | Business cards for the month (`MonthlyGoals.jsx`).
3. **Calendar**: the month grid card; clicking a day opens that day's spread (`CalendarSection.jsx`).

Monthly Goals and Calendar sit side by side under the spread.

Recap and Settings are modals opened from the header. Settings holds the calendar
connections and the Garmin Connect sign-in.

The Garmin tab mirrors connect.garmin.com's daily summary (Open Sans, white cards on gray,
blue actions; tokens in `frontend/src/garmin/theme.js`) and shows the day's data as cards: Day Summary (steps, distance,
calories, floors, intensity minutes, resting HR, stress, Body Battery, active time, a
steps-per-15-minutes chart), Sleep (duration, score, stages), Heart Rate, Stress, Body
Battery (sparklines behind "View details"), Intensity Minutes, Floors, Calories, Pulse Ox,
Respiration, Hydration, HRV, Training, Weight, green activity blocks, and a collapsed
"All Garmin Endpoints" explorer that lists every mapped endpoint with its parameters and
the raw JSON it returns. Its sidebar is Garmin's own navigation tree; every item opens a
sub-page at `/garmin/:date/<slug>` fed by the mapped endpoints (`frontend/src/garmin/nav.js`),
each laid out like the matching Garmin page (rings, timelines, tables, badges, maps), and items Garmin keeps off its API render Garmin's empty state with a link out.

The Workout App tab shows the Home Workouts app (Leap Health, bundle
`com.abishkking.maleworkout`) from two feeds: the phone posts its Apple Health workouts to
`POST /api/workout/health` as they happen (a Shortcut on app close and nightly, token in the
server `.env`; this is what makes a session appear within seconds), and the Mac, where the
app also runs as an iPhone app, exports its SQLite files to one JSON snapshot and rsyncs it
to `backend/workout-state/` every 6 hours (`tools/homeworkouts/`, launchd; the exercise
detail, only what the Mac copy has synced). The header's status line says when the phone
last reported and how old the snapshot's newest session is. Runs and walks are not exported.

The Social tab shows the user's TikTok account from TikTokAnalyzer's database
(`~/Documents/Social/TikTokAnalyzer/data/tiktok.db` on RT100, override `TIKTOK_DB_PATH`).
That tracker's 06:15 cron writes the db and then rewrites the "Tik Tok" Google Sheet from it;
the Planner is a second, read-only reader of the same file and never writes it, so the sheet
and the tab always show the same rows. Four stacked cards: a reserved top card, **Next Video
Hooks & Ideas** (a Claude Opus 5 review of the last 30 days of posts: top performers with the
backend's own numbers and the model's "why it worked", patterns, 6 to 8 next hooks; rows in
`social_reviews`; one run per 30 minutes and twelve per day because `/api/` is public; a 07:15
scheduler refreshes once a day when new videos arrived; needs `ANTHROPIC_API_KEY` in the server
`.env`), **TikTok Data** (every sheet column, search, sort, click a row for the transcript, Open
in Google Sheets) and an empty **Competitors** card.

The Health tab (since 2026-09-27) is the dashboard the Garmin phone app shows on its home
screen, rebuilt over a local store that the backend fills from Garmin: Today's Activity (one
card per activity, runs with a route trace), In Focus (this week's active time, seven bars,
a 28-day dot strip once history covers it), At a Glance (a card grid declared in
`frontend/src/health/cards.js`: ring, gauge, split and stack cards, every card with a source
caption and a full-height empty state that says why there is no value) and Last 7 Days.
It never fetches Garmin on page load: `GET /api/health/day/:date` reads `health_days` and
`health_activities`, which the ingest writes from the very result objects the Garmin warm
fetched (see `backend/health/`). The dashboard keeps the four sections and components of the
dark mobile layout it was specified from, but renders in the planner's light Agenda theme.
That is intentional, not a regression. The Garmin tab is the raw mirror and stays as it is.

## Architecture

```
ZenQuotes (random)    Google Calendar    Microsoft Graph    Garmin Connect
        |                    |                 |                 |
        |                    |                 |     garmin/bridge.py (Python 3.12,
        |                    |                 |     garminconnect, one run at a time)
+-------v--------------------v-----------------v-----------------v---+
|  Express backend (port 5002)                          |
|    server.js        setup, one router per tab, errors |
|    db.js            planner.db (SQLite, WAL), tables  |
|    lib/http.js      asyncHandler, patch/reorder/delete|
|    lib/dates.js     local-day helpers                 |
|    agenda/          routes/*.js, queries, rollover,   |
|                     autoRollover, quotes, calendars   |
|    garmin/          index.js router, service.js,      |
|                     bridge.py, registry.json          |
|    workout/         index.js router, service.js       |
|    social/          index.js router, service.js       |
|                     (reads tiktok.db), review.js      |
|    health/          metrics.js, ingest.js, index.js,  |
|                     scheduler.js (store fed by the    |
|                     Garmin warm through lib/bus.js)   |
+----------------------------^--------------------------+
                             | axios, retry-once
+----------------------------v--------------------------+
|  React 19 frontend (react-scripts build)              |
|    App.js           routes, one view per tab          |
|    agenda/          AgendaView + the spread's cards   |
|    garmin/          GarminView, cards, pages, theme   |
|    workout/         WorkoutView, card, tile, art      |
|    social/          SocialView, review, data table    |
|    health/          HealthView, cards, sections       |
|    shared/          api client, dayInfo, styles, rail,|
|                     modals, mini calendar             |
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
  Since 2026-09-26 the nightly run is the only trigger: the Agenda has no Pull forward button
  (checked action items stay where they are, open ones move).
- **Garmin is unofficial and serialized.** There is no personal Garmin API; the
  `garminconnect` Python client replays the mobile app's sign-in and Garmin can break it
  without notice. Only one bridge process talks to Garmin at a time, reads are cached in
  `garmin_cache` (today 30 min, past days 24 h, `?refresh=1` bypasses) and today's bundle
  is re-warmed every 30 minutes, so the tab opens from cache.

## Conventions

- Styling is inline JS objects; tokens and shared objects live in `frontend/src/shared/styles.js`.
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
    agenda/               the Agenda tab: routes/, queries, rollover, quotes, calendars
    garmin/               the Garmin tab: router, service, bridge.py, registry.json (+ .venv on the server)
    workout/              the Workout tab: router, snapshot reader
    social/               the Social tab: router, read-only tiktok.db reader, Claude review
    health/               the Health tab: metric declarations, the store writer, router, scheduler
    test/                 node --test suites (health.test.js)
    lib/                  http + date helpers used by every tab
  frontend/src/           React app, see frontend/CLAUDE.md
    agenda/ garmin/ workout/ social/ health/   one folder per tab: its view, its components, its api.js
    shared/               what every tab uses: api client, dayInfo, format, styles, rail, modals, charts/, Glyph
  tools/homeworkouts/     Mac-side Home Workouts exporter, sync job, launchd plist, tests
```

One folder per tab on both sides. A tab folder imports from `shared/` (frontend) or
`../db` and `../lib` (backend), never from another tab. The exceptions:
`frontend/src/shared/SettingsPanel.jsx` renders `garmin/GarminSettings.jsx` and reads the
snapshot status from `workout/api.js`, because Settings is where the connections live; and
`backend/health/ingest.js` requires `garmin/service.js` (its `callMany`) and the Garmin warm
announces its bundle on `lib/bus.js`, because the Health store is a consumer of the Garmin
bridge by design (one bridge process, one set of result objects).
The server-only data (`backend/planner.db`, `backend/garmin-state/`, `backend/workout-state/`,
`backend/garmin/.venv`) stays where it is; the services reach it with `..`.
