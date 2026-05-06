# Backend

Express 5 + `sqlite3`, port **5002**. One process, no nodemon (avoids restart-window ECONNREFUSED). Loaded by `start.sh`.

## Files

| File | Role |
|---|---|
| `server.js` | The Express app — every route lives here, ~500 lines. |
| `db.js` | SQLite open + `CREATE TABLE IF NOT EXISTS` schema + `ALTER TABLE ADD COLUMN` migrations + a `db.serialize` rebuild for the legacy `appointments.hour NOT NULL` constraint. Exports `run / get / all / exec` promise wrappers. |
| `rollover.js` | `pullForward(sourceDate)` — duplicate-with-dedup logic for the **Pull forward →** button. |
| `quoteService.js` | `getQuoteForDate(date)` — ZenQuotes random + UNIQUE-index dedup + fallback list. |
| `calendarService.js` | OAuth and event-fetching for Google Calendar (`googleapis`) and Microsoft Graph (`node-fetch`). |
| `.env` | `PORT`, `FRONTEND_URL`, `BACKEND_URL`, four OAuth secrets. **Gitignored.** Use `.env.example` as a template. |
| `planner.db` | SQLite WAL-mode database. **Gitignored.** Lost data = run the app, type stuff in. |

## Schema

```
tasks                  -- Action Items (the priority A/B/C list)
                          parent_id allows 1-level sub-items
                          forwarded_from / forwarded_to historical only
                          (no longer used for idempotency since the dedup
                           refactor — kept for human inspection)

appointments           -- Manual appointments on the timeline (start_at / end_at
                          ISO strings 'YYYY-MM-DDTHH:MM' — local time, no TZ).
                          Legacy `hour` column kept; nullable.

daily_note_entries     -- Tasks/Notes section on the right page.
                          parent_id for sub-items. forwarded_to historical only.

daily_notes            -- Free-form per-date textarea (the lined "Notes" block
                          at the bottom of the right page). One row per date.

daily_tracker          -- Older tracker textarea per date. Kept as a column
                          but the UI has folded it into Daily Notes.

master_tasks           -- Per-month Personal/Business running list.

quotes                 -- ZenQuotes cache. PRIMARY KEY date, UNIQUE index on
                          text — the latter is what enforces "one quote per
                          date, never repeated across the whole planner".

calendar_accounts      -- One row per connected Google or Outlook account.
                          provider, email, access_token, refresh_token,
                          expires_at (epoch ms). Tokens refreshed lazily.
```

## API surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | `{status:"ok"}` |
| GET | `/api/day/:date` | Full day payload — tasks, appointments, notes, notes_text, tracker, quote, external_events, calendar_errors |
| POST | `/api/day/:date/pull-forward` | Duplicate incomplete tasks and all notes from `:date` to `:date + 1` (dedup by text+parent) |
| POST/PATCH/DELETE | `/api/tasks[/:id]` | CRUD; PATCH accepts `text/priority/priority_num/status/order_index/parent_id` |
| POST | `/api/tasks/reorder` | `{ids: [int]}` → writes `order_index = i` for each id |
| POST/PATCH/DELETE | `/api/notes[/:id]` | Same shape, against `daily_note_entries` |
| POST | `/api/notes/reorder` | as above |
| POST/PATCH/DELETE | `/api/appointments[/:id]` | start_at / end_at, hour 7..20 legacy |
| PUT | `/api/notes-text/:date` | upsert into `daily_notes` |
| PUT | `/api/tracker/:date` | upsert into `daily_tracker` |
| GET/POST/PATCH/DELETE | `/api/master-tasks[/:id]` | category: `personal` \| `business` |
| GET | `/api/month/:year/:month` | per-day counts for the calendar grid (excludes `forwarded`) |
| GET | `/api/calendar/accounts` | `{accounts, providers: {google, outlook}}` |
| DELETE | `/api/calendar/accounts/:id` | drop a connected account |
| GET | `/api/calendar/{google\|outlook}/connect` | 302 → provider consent URL |
| GET | `/api/calendar/{google\|outlook}/callback` | exchanges code → stores account → 302 → frontend `?connected=...` |

## Pull-forward logic (`rollover.js`)

`pullForward(sourceDate)` is the source-of-truth for the **Pull forward →** button. It runs `pushTasksForward` and `pushNotesForward` in series. Each:

1. Pulls eligible source rows on `sourceDate` (`status != 'completed' AND status != 'forwarded'` for tasks; everything for notes).
2. Pre-fetches existing rows on `targetDate` (`sourceDate + 1`) and builds a `\`${text}|${parent_id ?? 'null'}\`` lookup map.
3. For each candidate (parents-first ordering so children's `parent_id` can be re-mapped via an `idMap`), checks the lookup; **inserts only when the key is missing**. The newly-inserted id is added to the lookup so subsequent same-key candidates also dedupe.
4. Returns the count of rows actually inserted (so the toast reports `0/0` honestly when nothing was missing).

Sub-item integrity: when a parent already exists on the target, the lookup hit still records `idMap[oldParent.id] = existingTargetParent.id`, so children re-parent under the existing target parent rather than creating an orphan.

## Calendar service (`calendarService.js`)

Provider-agnostic shape returned to the UI:

```ts
{ id, provider: 'google'|'outlook', account_id, calendar_email,
  title, location, start_at, end_at, all_day, organizer, link }
```

`listEventsForDate(dateISO)` calls all stored accounts in parallel via `Promise.allSettled`. Per-account failures populate a `calendar_errors[]` array on the day payload (the UI renders a per-account reconnect banner) without breaking other accounts.

Token refresh is lazy: a getter wraps each provider's API client and refreshes 60s before `expires_at`. Updated tokens are written back to the row in place.

Google: `googleapis` library, `events.list({ calendarId: 'primary', singleEvents: true, orderBy: 'startTime' })`. Outlook: raw `fetch` to `/v1.0/me/calendarView`, sending `Prefer: outlook.timezone="<local IANA>"` so times come back in the user's timezone.

## Quote pipeline (`quoteService.js`)

`getQuoteForDate(date)`:
1. SELECT the date row — return if found.
2. Else fetch `https://zenquotes.io/api/random`. INSERT; UNIQUE-on-text index aborts dupes — retry up to 5x.
3. On exhaustion / network failure, return one of `FALLBACK_QUOTES` (a small embedded stoic/business list) without inserting, so a future request still tries the live API.

This means: refreshing the page never changes the quote, and no quote ever appears twice across the whole planner's lifetime.
