# Frontend

React 19, `react-scripts 5.0.1`, inline styles. Built on the server with
`REACT_APP_API_URL=/api npm run build` and served as static files (see `deploy/README.md`).
`api.js` falls back to `http://localhost:5002/api` when that variable is unset.

## Routes (`src/App.js`)

`/agenda/:date` renders `agenda/AgendaView`, `/garmin/:date` renders `garmin/GarminView` (the tab lived at `/health` until 2026-09-27; `/health/:date/<page>` and `/health/:date/activity/:id` redirect to `/garmin` for good), `/health/:date` renders `health/HealthView`,
`/workout/:date` renders `workout/WorkoutView` and `/social/:date` renders `social/SocialView`;
`/`, the legacy `/day/:date` and unknown paths redirect to today's agenda. On a fresh page
load any `/<section>/:date` snaps back to today in that section (`BootRedirectToToday`). `src/index.js` turns
`?connected=` / `?calendar_error=` query params from the OAuth callback into a toast in
`sessionStorage` (`plannerCalendarToast`) that `CalendarToast` shows once.

## Layout

One folder per tab plus `shared/`:

- `agenda/`: `AgendaView.jsx`, the spread's components, `api.js`.
- `garmin/`: `GarminView.jsx`, the daily-summary cards, `GarminShell`, `MetricPage`, `pages/`
  (one bespoke page per sidebar item), `primitives/` (the connect.garmin.com building blocks),
  `nav.js`, `theme.js`, `format.js`, `api.js`, `GarminSettings.jsx`.
- `workout/`: `WorkoutView.jsx`, `WorkoutCard`, `WorkoutTile`, `art.js`, `api.js`.
- `social/`: `SocialView.jsx`, `ReviewSection`, `DataSection`, `SocialCard`, `SocialTable`, `format.js`, `api.js`.
- `health/`: `HealthView.jsx`, `sections.jsx` (Today's Activity, In Focus, Glance, Last 7 Days), `HealthCard.jsx` (the card shell, the four shapes, the empty state), `cards.js` (the declared card array), `format.js`, `api.js`.
- `shared/`: the axios client, `dayInfo`, `format`, `styles`, `AgendaRail`, `TopNav`,
  `NavLinks`, `RecapPanel`, `SettingsPanel`, `ConnectionRow`, `MiniCalendar`, `CheckMark`,
  `CalendarToast`, `snapshotAge`, `Glyph` (glyph paths copied from the Garmin icon set) and
  `charts/` (theme-agnostic SVG charts: copies of the Garmin tab's `RingGauge`, `ArcGauge` and
  `Sparkline`, extended, plus `LetterStrip`, `DotStrip`, `SplitBar`, `RouteTrace`, `WeekBars`;
  colors in `palette.js`, every mark at least 3:1 on white).

A tab folder imports from `shared/` and from itself, never from another tab. `shared/`
imports only `shared/`, with one exception: `SettingsPanel.jsx` renders
`garmin/GarminSettings.jsx` and reads the snapshot status from `workout/api.js`, because
Settings is where the connections live. Relative imports only; there is no `jsconfig.json`.

## Files

| File | Role |
|---|---|
| `agenda/AgendaView.jsx` | The Agenda tab: loads `GET /api/day/:date`, renders `AgendaRail` + main, the `DateCard` across the top, the schedule card and one card holding the four lists (hairline dividers between sections), then Monthly Goals and Calendar side by side. Owns the cross-section movers (`movers.noteToTasks` etc.). |
| `shared/AgendaRail.jsx` | The Agenda's 240px sticky left rail: wordmark, the `TABS` from TopNav as stacked links, `NavLinks direction="column"` at the bottom. Exports `RAIL_WIDTH`. The round button hides it to a 44px strip; remembered in localStorage `plannerNavCollapsed`, shared with the Garmin sidebar. |
| `agenda/DateCard.jsx` | The Agenda's header card: `headlineLong` date, Prev / Today / Next + date field (navigate within `/agenda/`), `DayInfoBadge` pills, `QuoteCallout`, `MiniCalendar`. |
| `garmin/GarminView.jsx` | The Garmin tab: loads `GET /api/garmin/day/:date` and `GET /api/garmin/status`, renders the cards inside `GarminShell`, the failed-endpoint line and the collapsed endpoint explorer. Shows a sign-in notice when Garmin is not connected. |
| `garmin/nav.js` | The sidebar tree copied from connect.garmin.com (Home, Challenges, Calendar, News Feed; Activities, Health Stats, Nutrition, Performance Stats, Training & Planning groups; Gear, Insights, Reports; Friends, Groups; Badges, Personal Records, Goals; Activity Tracking Accuracy) plus, per slug, the page: title, Garmin URL, supported ranges and the registry calls to batch. Items Garmin keeps off its API have no calls. |
| `garmin/GarminShell.jsx` | The connect.garmin.com frame: 268px dark sidebar built from `garmin/nav.js` (collapsible groups, active row and group outline, Agenda / Workout at the top, All Endpoints at the bottom), white 60px top bar (round button that hides or shows the sidebar, remembered in localStorage `plannerNavCollapsed`, shared with `AgendaRail`; sync / recap / settings icons), the DAILY SUMMARY header or a sub-page's `header`, and the gray content area. Under 900px the sidebar is a drawer behind a hamburger. Owns the Recap and Settings modals on that tab. |
| `garmin/primitives/` | The primitives every Garmin sub-page is built from, measured on connect.garmin.com: `Frame.jsx` (PageContainer 1280/56px, PageTitle 44px, DateControls, RangeControl, TabStrip, SectionHeading, Banner, SideIndex, TwoCol), `Widgets.jsx` (EmptyState, RingGauge, ArcGauge, StatPair, Bar, DataTable, TileCard, HexBadge, Illustration, buttons, Avatar) and `MapView.jsx` (Leaflet from cdnjs, OSM tiles, polyline). |
| `garmin/pages/` | One bespoke page per Garmin sidebar item, grouped by file: `HealthStats.jsx`, `Activities.jsx` (All Activities + the activity detail at `/garmin/:date/activity/:id`), `Nutrition.jsx`, `Performance.jsx` (Reports frame), `Home.jsx`, `Training.jsx` (map pages), `More.jsx` (Gear, Social, Achievements). `index.js` maps slug to component; `common.jsx` has `MetricFrame`, `DailyTimeline`, `DailyBars`. Each receives `{ dateISO, range, setRange, results, slug }`; `results` are keyed by the short keys set in `garmin/nav.js`. |
| `garmin/MetricPage.jsx` | Loads a sub-page's registry calls in one `POST /api/garmin/batch` (plus a prelude call for pages that need the profile id) and dispatches to the bespoke component from `garmin/pages/index.js`; the generic `MetricHeader` + AutoData cards remain as the fallback for any slug without one. |
| `garmin/AutoData.jsx` | Renders any endpoint payload Garmin-style: `[[ts, v]]` -> sparkline, arrays of objects -> table, objects -> key / value grid with nested sections; ids hidden; raw JSON behind a toggle. |
| `workout/WorkoutView.jsx` | The Workout tab: loads `GET /api/workout/status`, `recent` and `catalog`, renders `AgendaRail` plus one header card (date headline with the day controls inline, `MiniCalendar` with green circles top right from a 45-day `recent` fetch, six tiles Height / Weight with the change over the range / Workouts / Duration / Streak / Last workout next to the range select 1 / 7 / 30 / 90 / 180 / 365 days / Lifetime / Custom (opens on 30 days), `RangeBars` by day up to 31 days then week / month / quarter with the count over each bar, and a collapsed "N workouts <range>" log with one row per day: types joined, durations and counts summed, empty columns hidden, the shown day tinted) and the Templates card (app banners from `workoutArt`, detail panel below the grid). |
| `social/SocialView.jsx` | The Social tab: `AgendaRail` plus four stacked cards. A reserved empty top card; `ReviewSection` (the card titled Summary; loads `GET /api/social/review`, polls every 3 s while `running`; a Refresh button posts `/api/social/review/generate` and greys out once the day's five refreshes are used (`throttle` in the GET): Top performers from `stats` with each opening line's hook type from `hook_types`, and Hooks to consider, ten numbered hook lines in the model's grouped order, each ending in its move in italics); `DataSection` (tiles from `summary`, every sheet column in sheet order, search over caption / hook / id / date, click a header to sort, click a row to expand it and fetch the transcript from `GET /api/social/videos/:id`, 100 rows at a time, Open in Google Sheets); an empty Competitors card. |
| `health/HealthView.jsx` | The Health tab: `AgendaRail` plus a header card (date headline, Prev / Today / Next + date field within `/health/`, a Fetch now button that posts `/api/health/fetch`, and the store's status line: muted normally, amber when the 24-hour direct-call count exceeds the design budget, red after three failed runs, a needed sign-in code or a run that never finished), then the four sections. Reads `GET /api/health/day/:date` and `/status` only; never Garmin live. |
| `health/sections.jsx` | `TodayActivity` (one card per activity: name, filled glyph, duration for strength or distance for a run, dot-separated facts, a `RouteTrace` for runs, link to the Garmin activity page), `InFocus` (this Mon-Sun week's active time, `WeekBars` with hollow bars for non-final days, a 28-dot `DotStrip` only once 28 days are stored, else a muted note), `Glance` (the grid: 4 across from 1100px of viewport, 2 below, via matchMedia) and `LastSeven` (literal counts, "Avg" spelled out, "of N days" when fewer than 7 have data). |
| `health/cards.js` | The At a Glance cards as data: metric key, shape (`RING`, `GAUGE`, `SPLIT`, `STACK`), label, glyph, color, footer variant (`letters`, `spark`, `series`), a `build(value, ctx)` that turns the stored value into shape props, and a `caption` naming the Garmin call, field and reading date. Ten cards in the phone's order, then the stored metrics with no phone card (sleep, body battery, pulse ox, respiration, hydration, training readiness) as stack cards. Pruning the grid is an edit to this array. |
| `health/HealthCard.jsx` | `CardShell` (glyph, title, body, caption), `EmptyCard` (full height and slot kept: muted glyph disc, the metric name, one sentence why) and the four shapes: ring with the goal under it and a Last 7d footer, three-quarter zone gauge with a knob, split bar with labelled ends, stacked numbers with an updated line. |
| `social/SocialCard.jsx`, `SocialTable.jsx`, `format.js` | Card (dotted title, aside pill, `actions` slot) and tile plus the table styles, copies of the Workout tab's because tabs do not import each other; `shortDate`, `monthDay`, `dateTime`, `multipleText`, `count`. |
| `workout/WorkoutCard.jsx`, `WorkoutTile.jsx` | Card in the Agenda look (dotted title via `dot`, aside as a pill, `actions` slot for controls) and label-over-number tile for the Workout App tab, plus the shared table styles (`tileGrid`, `table`, `th`, `td`, `tableLink`). |
| `shared/TopNav.jsx` | Light header bar (tabs, Prev / Today / Next, date picker, `NavLinks`). No tab renders it any more: Agenda, Workout and Social use `AgendaRail`, Garmin uses `GarminShell`. Kept because it exports `TABS`. |
| `shared/NavLinks.jsx` | Recap and Settings buttons plus their modals; `direction="column"` stacks them for the rail. |
| `workout/art.js`, `public/workout-art/` | The Home Workouts app's own template banners and detail headers (ids 101..113), copied once from the app bundle on the Mac; helpers `templateBanner`, `templateHeader`, `titleLines`, plus the app's blue and the Poppins stack used only on art overlays. Never load from the bundle path at runtime. |
| `shared/ConnectionRow.jsx` | One row of Settings > Connections: status dot (green ok, red error, grey off), name, detail line, action on the right. |
| `garmin/GarminSettings.jsx` | The Garmin row in Settings > Connections: dot from `/api/garmin/status`, Sign In / Sign Out, the verification-code box, the setup notice. |
| `garmin/theme.js` | Tokens and style objects measured from connect.garmin.com (Open Sans, `#efefef` page, white 8px cards, blue `#1265c2`, per-metric colors). Only the Garmin tab uses it. |
| `garmin/GarminCard.jsx` | Daily-summary card: colored icon + tracked uppercase title, body, and a footer link (`details` toggles a hidden block, `href` links out). |
| `garmin/GarminStat.jsx` | `Headline` (48px thin number + caption), `Stat` (18px value over a 12px gray label), `HeadlineRow` (headline left, stats right). |
| `garmin/ProgressBar.jsx` | The 20px square progress bar (steps, intensity minutes, floors, hydration). |
| `garmin/ActivityCard.jsx` | The solid green activity block with distance, time, pace, HR, calories and a "View activity" footer. |
| `garmin/GarminIcon.jsx` | 16px inline SVG glyphs per metric, filled with the metric color. |
| `garmin/Sparkline.jsx` | Inline SVG single-series line (with area fill) or bars over a day with a hover crosshair and value readout. |
| `garmin/EndpointExplorer.jsx` | Every registry endpoint grouped and collapsible, params as inputs (dates prefilled), Fetch / Refresh / Send, raw JSON below. Writes ask for confirmation. |
| `shared/snapshotAge.js` | The Workout tab's one staleness rule, shared with Settings. Two halves: the phone report (age = days since `health.received_at`, colours the line: amber past 3, red past 7) and the Mac snapshot (age = days from its newest session to the viewed date; once the phone reports it is the detail source and only says its age in words). Returns `{level, days, color, text, phone, snapshot}`. |
| `shared/format.js` | `num`, `secondsToHm`, `titleCase`: the generic formatters the Garmin and Workout tabs both use. |
| `garmin/format.js` | Garmin-only: `metersToMiles`, `gramsToLbs`, `mlToOz`, `clock` (Garmin local timestamps read as UTC), `parseNaive`, `localOffset`, `series`. |
| `shared/MiniCalendar.jsx` | Month grid in the Agenda's date card and the Workout header; the viewed day is the filled indigo circle. `section` picks the route the days link to; `marks` (a Set of ISO dates) fills those days with a green circle, the same shape as the selected day. |
| `agenda/QuoteHeader.jsx` | `QuoteCallout` (the quote in an indigo-tinted box with a large quote mark) and `DayInfoBadge` (`269th Day  96 Left  Week 39` as pills). |
| `agenda/TimelineSchedule.jsx` | Appointment Schedule, 7am to 8pm at 60 px/hour. Solid rounded blocks (provider colour, ink for manual), greedy column packing for overlaps, all-day pills, an indigo current-time line on today, click-to-add with 15-minute snap. |
| `agenda/PrioritizedTaskList.jsx` | Action Items: A/B/C priority sort with chips, `CheckMark` done toggle, sub-items, reorder. No manual pull-forward; the backend rolls open items at 23:59. |
| `agenda/NestedListSection.jsx` | Generic one-level nested list with inline edit, Tab/Shift+Tab indent, reorder and external drops. |
| `agenda/DailyNotes.jsx`, `Ongoing.jsx` | Thin wrappers around `NestedListSection` for the "Tasks" (per date) and "Ongoing" (no date) sections. |
| `agenda/DailyNotesText.jsx` | Free-form textarea ("Notes") on a grey rounded field, debounced save. |
| `agenda/MonthlyGoals.jsx` | Monthly Goals: Personal | Business cards with tinted headers, reorder within a card. |
| `agenda/CalendarSection.jsx` | Calendar card: 6-row month grid of rounded cells, today as an indigo circle, each day links to its spread. |
| `shared/CheckMark.jsx` | The rounded-square check (indigo when done) used by Action Items, Monthly Goals and Recap. |
| `shared/RecapPanel.jsx`, `SettingsPanel.jsx` | Modals, portalled to `document.body`: completed items by date; Settings > Connections lists Google / Outlook accounts (dot red when today's `calendar_errors` names the account, Connect / Disconnect), Garmin (Sign In / Sign Out) and Home Workouts (Phone push and Mac sync pills; dot and text from `shared/snapshotAge.js`, the same rule as the Workout tab's status line). |
| `shared/CalendarToast.jsx` | The post-OAuth toast. |
| `shared/api.js` | Axios client with a retry-once interceptor for network errors (never for 4xx/5xx), `API_BASE` (used by Settings to build the connect URL and by the Workout tab for media URLs), and the calls more than one tab makes: `getDay`, `getRecap`, the calendar accounts. |
| `agenda/api.js`, `garmin/api.js`, `workout/api.js`, `social/api.js` | One export per endpoint of that tab, built on the shared client: the list / appointment / Monthly Goals calls; the Garmin calls (`getGarminDay`, `callGarmin`, `garminBatch`, `postGarmin`, sign-in); the Workout reads (`getWorkoutStatus`, `getWorkoutRecent`, `getWorkoutCatalog`; 404 means no snapshot yet); the Social reads (`getSocialStatus`, `getSocialVideos`, `getSocialVideo`, `getReview`; 404 means no tracker db or no review yet) and `generateReview` (202 / 409 / 429 / 503 resolved, not thrown). |
| `shared/dayInfo.js` | `todayISO`, `isoToDate`, `dateToISO`, `shiftISO`, `dayInfo`, `headlineLong`, `longDate`, `ordinal`, `sortByOrder`, `monthGrid`. |
| `shared/styles.js` | `COLORS` tokens (card look: white cards, `#F5F4F0` canvas, indigo accent; every key is also read by the Workout tab and the shared modals, so keep the keys), `card`, `pill`, `PRIORITY_CHIPS`, `GOAL_WASH`, `SECTION_DOTS`, `sectionDot`, `INDENT_PX`, and the shared style objects (section header, row input, nav button, outline button, modal shell, drop-zone borders). |

## Conventions

- Inline styles only. Colors come from `COLORS` in `shared/styles.js`; do not add hex literals to
  components unless the value is a one-off (the setup notice). The one CSS class the Agenda
  relies on is `.row-hover` in `index.css` (row hover fill); `.ruled-bg` is no longer used
  by the Agenda.
- Agenda look: white `card`s (12px radius) on the canvas, section titles with a `SECTION_DOTS`
  dot, 36px rows, rounded-square checks, solid provider-coloured event blocks. The Agenda has
  no top header; `AgendaRail` is the navigation.
- Inputs commit on blur; Enter blurs a top-level row and adds a sibling to a child row;
  Tab / Shift+Tab indent and unindent. Textareas save after 800 ms.
- Drag-and-drop MIME types: `application/x-planner-task`, `-note`, `-ongoing`,
  `-master-task`. A row accepts its own type (reorder within the same level); a section accepts
  the other sections' types (move across, children come along). Cross-level reorder by drag is
  intentionally blocked; use the keyboard.
- Section vocabulary in conversation: Agenda tab = Planner (the spread), Monthly Goals,
  Calendar; Garmin tab = the Garmin cards.
- The Garmin tab mirrors connect.garmin.com's daily summary, frame included: colors, type,
  sidebar, top bar and card styles come from `garmin/theme.js`, never from `COLORS` in
  `shared/styles.js`. The page root carries the `garmin-page` class (Open Sans). The daily summary's
  cards sit in a left-aligned 932px column; sub-pages sit in the centered 1280px white
  container. The reference screenshots of every Garmin page taken on 2026-09-26 are listed
  in the plan file for that day's session (`~/.claude/plans/lets-add-another-tab-crispy-book.md`). Sleep stages use Garmin's deep / light / REM / awake
  colors and are always labeled; text never takes a series color.
- The Health tab is a standalone tab in the Agenda dialect. It keeps the four sections and
  components of the dark mobile layout it was specified from (the Garmin phone app's home
  screen, screenshots of 2026-09-27) but renders in the light theme: white cards, `RADIUS`,
  DM Sans, chart colors from `shared/charts/palette.js`, goal met in `COLORS.done`. That is
  intentional, not a regression. Every number on it comes from a `health_days` or
  `health_activities` row; a metric with no row shows its reason in place of the number.

## Known app-vs-API discrepancies (Garmin phone app vs what the API returns)

Recorded so two of the user's screens never disagree silently. Every At a Glance card
carries a caption naming its call, field and date.

| Metric | Phone shows | API returns | Card shows | Checked |
|---|---|---|---|---|
| Weight | 175.0 lbs, 0.0 change, BMI 23.7 | `get_user_profile.userData.weight` 79378 g (the phone reads the profile weight); `get_weigh_ins` has one entry, 2025-10-02, `USER_SETTING` | profile weight, change against the last weigh-in, BMI from the profile height, "last weighed Oct 2, 2025 (entered by hand)"; a muted line when profile and weigh-in diverge | 2026-09-27 |
| Fitness age target | 26.5 | `achievableFitnessAge` 26.967086641406862, stable across days and a forced refresh; no other endpoint carries a target | 27.0 (the API value, one decimal) with the caption noting the phone reading; the store keeps the raw value | 2026-09-27; re-check when the API value changes |
| Fitness age | 31 | `fitnessAge` 30.6077 | 31 (`Math.round`) | 2026-09-27 |
| VO2 max label | "Excellent" | no label from any endpoint (`maxMetCategory` is 0); computed from Garmin's manual table "VO2 Max. Standard Ratings" by sex and age | "Excellent" with the table named in the caption | 2026-09-27 |
| VO2 max on days without an estimate | the latest estimate every day | `get_max_metrics` returns a row only on the day an estimate was made (1 of 27 past days) | the newest earlier estimate, carried forward with its own date in the caption | 2026-09-27 |
| Last 7 Days averages | 3,130 steps, 59 resting, 2,284 calories at 4:44 PM | the means of Sep 21 to 26: the phone averages the window's completed days and excludes today; its counts (1 Workout, 1 Run) include today | the same rule: averages over final days, "of 6 completed days" shown, counts include today | 2026-09-27 |
| Last 7 Days rounding | 3,130 steps, 59 resting, 2,284 calories | the same six days give 3,130.5, 58.67 and 2,284.8 | 3,131, 59, 2,285 (`Math.round`); the phone's three figures fit no single round-or-truncate rule (steps and calories look truncated, resting HR rounded), so its inputs likely differ by a few units from the API's, as its live totals did by 1 to 2 kcal; left as is | 2026-09-27 |
| Heart rate "latest" | 99 at 4:44 PM | the last non-null 2-minute sample in `heartRateValues` as of the last watch sync (98 at 4:42 PM) | the sample with its time in the caption | 2026-09-27 |
| Today's totals after the last sync | calories 2,142 at 4:44 PM | Garmin's data is as of the watch's last sync (4:43 PM: 2,140); the phone syncs the watch when opened | the synced values; the status line says when they were fetched | 2026-09-27 |

- No em dashes anywhere.
