# Frontend

React 19, `react-scripts 5.0.1`, inline styles. Built on the server with
`REACT_APP_API_URL=/api npm run build` and served as static files (see `deploy/README.md`).
`api.js` falls back to `http://localhost:5002/api` when that variable is unset.

## Routes (`src/App.js`)

`/agenda/:date` renders `pages/DailyView`, `/health/:date` renders `pages/HealthView` and
`/workout/:date` renders `pages/WorkoutView`;
`/`, the legacy `/day/:date` and unknown paths redirect to today's agenda. On a fresh page
load any `/<section>/:date` snaps back to today in that section (`BootRedirectToToday`). `src/index.js` turns
`?connected=` / `?calendar_error=` query params from the OAuth callback into a toast in
`sessionStorage` (`plannerCalendarToast`) that `CalendarToast` shows once.

## Files

| File | Role |
|---|---|
| `pages/DailyView.jsx` | The Agenda tab: loads `GET /api/day/:date`, renders `AgendaRail` + main, the `DateCard` across the top, the schedule card and one card holding the four lists (hairline dividers between sections), then Monthly Goals and Calendar side by side. Owns the cross-section movers (`movers.noteToTasks` etc.). |
| `components/AgendaRail.jsx` | The Agenda's 240px sticky left rail: wordmark, the `TABS` from TopNav as stacked links, `NavLinks direction="column"` at the bottom. Exports `RAIL_WIDTH`. The round button hides it to a 44px strip; remembered in localStorage `plannerNavCollapsed`, shared with the Garmin sidebar. |
| `components/DateCard.jsx` | The Agenda's header card: `headlineLong` date, Prev / Today / Next + date field (navigate within `/agenda/`), `DayInfoBadge` pills, `QuoteCallout`, `MiniCalendar`. |
| `pages/HealthView.jsx` | The Garmin tab: loads `GET /api/garmin/day/:date` and `GET /api/garmin/status`, renders the cards inside `GarminShell`, the failed-endpoint line and the collapsed endpoint explorer. Shows a sign-in notice when Garmin is not connected. |
| `garminNav.js` | The sidebar tree copied from connect.garmin.com (Home, Challenges, Calendar, News Feed; Activities, Health Stats, Nutrition, Performance Stats, Training & Planning groups; Gear, Insights, Reports; Friends, Groups; Badges, Personal Records, Goals; Activity Tracking Accuracy) plus, per slug, the page: title, Garmin URL, supported ranges and the registry calls to batch. Items Garmin keeps off its API have no calls. |
| `components/health/GarminShell.jsx` | The connect.garmin.com frame: 268px dark sidebar built from `garminNav.js` (collapsible groups, active row and group outline, Agenda / Workout at the top, All Endpoints at the bottom), white 60px top bar (round button that hides or shows the sidebar, remembered in localStorage `plannerNavCollapsed`, shared with `AgendaRail`; sync / recap / settings icons), the DAILY SUMMARY header or a sub-page's `header`, and the gray content area. Under 900px the sidebar is a drawer behind a hamburger. Owns the Recap and Settings modals on that tab. |
| `components/garmin/` | The primitives every Garmin sub-page is built from, measured on connect.garmin.com: `Frame.jsx` (PageContainer 1280/56px, PageTitle 44px, DateControls, RangeControl, TabStrip, SectionHeading, Banner, SideIndex, TwoCol), `Widgets.jsx` (EmptyState, RingGauge, ArcGauge, StatPair, Bar, DataTable, TileCard, HexBadge, Illustration, buttons, Avatar) and `MapView.jsx` (Leaflet from cdnjs, OSM tiles, polyline). |
| `components/health/pages/` | One bespoke page per Garmin sidebar item, grouped by file: `HealthStats.jsx`, `Activities.jsx` (All Activities + the activity detail at `/health/:date/activity/:id`), `Nutrition.jsx`, `Performance.jsx` (Reports frame), `Home.jsx`, `Training.jsx` (map pages), `More.jsx` (Gear, Social, Achievements). `index.js` maps slug to component; `common.jsx` has `MetricFrame`, `DailyTimeline`, `DailyBars`. Each receives `{ dateISO, range, setRange, results, slug }`; `results` are keyed by the short keys set in `garminNav.js`. |
| `components/health/MetricPage.jsx` | Loads a sub-page's registry calls in one `POST /api/garmin/batch` (plus a prelude call for pages that need the profile id) and dispatches to the bespoke component from `pages/index.js`; the generic `MetricHeader` + AutoData cards remain as the fallback for any slug without one. |
| `components/health/AutoData.jsx` | Renders any endpoint payload Garmin-style: `[[ts, v]]` -> sparkline, arrays of objects -> table, objects -> key / value grid with nested sections; ids hidden; raw JSON behind a toggle. |
| `pages/WorkoutView.jsx` | The Workout tab: loads `GET /api/workout/status`, `recent` and `catalog`, renders `AgendaRail` plus one header card (date headline with the day controls inline, `MiniCalendar` with green circles top right from a 45-day `recent` fetch, six tiles Height / Weight with the change over the range / Workouts / Duration / Streak / Last workout next to the range select 1 / 7 / 30 / 90 / 180 / 365 days / Lifetime / Custom, `RangeBars` by day up to 31 days then week / month / quarter with the count over each bar, and a collapsed "N workouts <range>" log with one row per day: types joined, durations and counts summed, empty columns hidden, the shown day tinted) and the Templates card (app banners from `workoutArt`, detail panel below the grid). |
| `components/workout/WorkoutCard.jsx`, `WorkoutTile.jsx` | Card in the Agenda look (dotted title via `dot`, aside as a pill, `actions` slot for controls) and label-over-number tile for the Workout App tab, plus the shared table styles (`tileGrid`, `table`, `th`, `td`, `tableLink`). |
| `components/TopNav.jsx` | Light header bar (tabs, Prev / Today / Next, date picker, `NavLinks`). No tab renders it any more: Agenda and Workout use `AgendaRail`, Garmin uses `GarminShell`. Kept because it exports `TABS`. |
| `components/NavLinks.jsx` | Recap and Settings buttons plus their modals; `direction="column"` stacks them for the rail. |
| `workoutArt.js`, `public/workout-art/` | The Home Workouts app's own template banners and detail headers (ids 101..113), copied once from the app bundle on the Mac; helpers `templateBanner`, `templateHeader`, `titleLines`, plus the app's blue and the Poppins stack used only on art overlays. Never load from the bundle path at runtime. |
| `components/ConnectionRow.jsx` | One row of Settings > Connections: status dot (green ok, red error, grey off), name, detail line, action on the right. |
| `components/GarminSettings.jsx` | The Garmin row in Settings > Connections: dot from `/api/garmin/status`, Sign In / Sign Out, the verification-code box, the setup notice. |
| `garminTheme.js` | Tokens and style objects measured from connect.garmin.com (Open Sans, `#efefef` page, white 8px cards, blue `#1265c2`, per-metric colors). Only the Garmin tab uses it. |
| `components/health/GarminCard.jsx` | Daily-summary card: colored icon + tracked uppercase title, body, and a footer link (`details` toggles a hidden block, `href` links out). |
| `components/health/GarminStat.jsx` | `Headline` (48px thin number + caption), `Stat` (18px value over a 12px gray label), `HeadlineRow` (headline left, stats right). |
| `components/health/ProgressBar.jsx` | The 20px square progress bar (steps, intensity minutes, floors, hydration). |
| `components/health/ActivityCard.jsx` | The solid green activity block with distance, time, pace, HR, calories and a "View activity" footer. |
| `components/health/GarminIcon.jsx` | 16px inline SVG glyphs per metric, filled with the metric color. |
| `components/health/Sparkline.jsx` | Inline SVG single-series line (with area fill) or bars over a day with a hover crosshair and value readout. |
| `components/health/EndpointExplorer.jsx` | Every registry endpoint grouped and collapsible, params as inputs (dates prefilled), Fetch / Refresh / Send, raw JSON below. Writes ask for confirmation. |
| `utils/garminFormat.js` | `num`, `metersToMiles`, `gramsToLbs`, `mlToOz`, `secondsToHm`, `clock` (Garmin local timestamps read as UTC), `localOffset`, `series`, `titleCase`. |
| `components/MiniCalendar.jsx` | Month grid in the Agenda's date card and the Workout header; the viewed day is the filled indigo circle. `section` picks the route the days link to; `marks` (a Set of ISO dates) fills those days with a green circle, the same shape as the selected day. |
| `components/QuoteHeader.jsx` | `QuoteCallout` (the quote in an indigo-tinted box with a large quote mark) and `DayInfoBadge` (`269th Day  96 Left  Week 39` as pills). |
| `components/TimelineSchedule.jsx` | Appointment Schedule, 7am to 8pm at 60 px/hour. Solid rounded blocks (provider colour, ink for manual), greedy column packing for overlaps, all-day pills, an indigo current-time line on today, click-to-add with 15-minute snap. |
| `components/PrioritizedTaskList.jsx` | Action Items: A/B/C priority sort with chips, `CheckMark` done toggle, sub-items, reorder. No manual pull-forward; the backend rolls open items at 23:59. |
| `components/NestedListSection.jsx` | Generic one-level nested list with inline edit, Tab/Shift+Tab indent, reorder and external drops. |
| `components/DailyNotes.jsx`, `Ongoing.jsx` | Thin wrappers around `NestedListSection` for the "Tasks" (per date) and "Ongoing" (no date) sections. |
| `components/DailyNotesText.jsx` | Free-form textarea ("Notes") on a grey rounded field, debounced save. |
| `components/MonthlyGoals.jsx` | Monthly Goals: Personal | Business cards with tinted headers, reorder within a card. |
| `components/CalendarSection.jsx` | Calendar card: 6-row month grid of rounded cells, today as an indigo circle, each day links to its spread. |
| `components/CheckMark.jsx` | The rounded-square check (indigo when done) used by Action Items, Monthly Goals and Recap. |
| `components/RecapPanel.jsx`, `SettingsPanel.jsx` | Modals, portalled to `document.body`: completed items by date; Settings > Connections lists Google / Outlook accounts (dot red when today's `calendar_errors` names the account, Connect / Disconnect), Garmin (Sign In / Sign Out) and the Home Workouts snapshot (Mac sync, red when older than 48 h). |
| `components/CalendarToast.jsx` | The post-OAuth toast. |
| `services/api.js` | Axios client with a retry-once interceptor for network errors (never for 4xx/5xx). One export per endpoint, including the Garmin calls (`getGarminDay`, `callGarmin`, `postGarmin`, sign-in) and the Workout App reads (`getWorkoutStatus`, `getWorkoutDay`, `getWorkoutRecent`, `getWorkoutCatalog`; 404 means no snapshot yet). `API_BASE` is used by Settings to build the connect URL. |
| `utils/dayInfo.js` | `todayISO`, `isoToDate`, `dateToISO`, `shiftISO`, `dayInfo`, `headlineLong`, `longDate`, `ordinal`, `sortByOrder`, `monthGrid`. |
| `styles.js` | `COLORS` tokens (card look: white cards, `#F5F4F0` canvas, indigo accent; every key is also read by the Workout tab and the shared modals, so keep the keys), `card`, `pill`, `PRIORITY_CHIPS`, `GOAL_WASH`, `SECTION_DOTS`, `sectionDot`, `INDENT_PX`, and the shared style objects (section header, row input, nav button, outline button, modal shell, drop-zone borders). |

## Conventions

- Inline styles only. Colors come from `COLORS` in `styles.js`; do not add hex literals to
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
  sidebar, top bar and card styles come from `garminTheme.js`, never from `COLORS` in
  `styles.js`. The page root carries the `garmin-page` class (Open Sans). The daily summary's
  cards sit in a left-aligned 932px column; sub-pages sit in the centered 1280px white
  container. The reference screenshots of every Garmin page taken on 2026-09-26 are listed
  in the plan file for that day's session (`~/.claude/plans/lets-add-another-tab-crispy-book.md`). Sleep stages use Garmin's deep / light / REM / awake
  colors and are always labeled; text never takes a series color.
- No em dashes anywhere.
