# Frontend

React 19, `react-scripts 5.0.1`, inline styles. Built on the server with
`REACT_APP_API_URL=/api npm run build` and served as static files (see `deploy/README.md`).
`api.js` falls back to `http://localhost:5002/api` when that variable is unset.

## Routes (`src/App.js`)

`/agenda/:date` renders `agenda/AgendaView`, `/garmin/:date` renders `garmin/GarminView` (the tab lived at `/health` until 2026-09-27; `/health/:date/<page>` and `/health/:date/activity/:id` redirect to `/garmin` for good), `/health/:date` renders `health/HealthView`,
`/workout/:date` renders `workout/WorkoutView` and `/social/:date` renders `social/SocialView`;
`/`, the legacy `/day/:date` and unknown paths redirect to `/agenda/today`. `:date` is an ISO
date or the literal `today` (the current day, resolved by `useViewDate()` from
`shared/today.js`; views never read `useParams().date` directly); `Dated` rewrites a dated URL
that names today to `/today`. `SnapToToday` moves a tab on another day back to today (see the
root CLAUDE.md), `ServerClock` keeps `todayISO()` on the server's day. `src/index.js` turns
`?connected=` / `?calendar_error=` query params from the OAuth callback into a toast in
`sessionStorage` (`plannerCalendarToast`) that `CalendarToast` shows once.

## Layout

One folder per tab plus `shared/`:

- `agenda/`: `AgendaView.jsx`, the spread's components, `api.js`.
- `garmin/`: `GarminView.jsx`, the daily-summary cards, `GarminShell`, `MetricPage`, `pages/`
  (one bespoke page per sidebar item), `primitives/` (the connect.garmin.com building blocks),
  `nav.js`, `theme.js`, `format.js`, `api.js`, `GarminSettings.jsx`.
- `workout/`: `WorkoutView.jsx` (top bar + the four sections on one scrolling page), `WorkoutTopNav.jsx`, `overview/` (the Overview: `OverviewView`, `BodyViewer` + `BodyImage` + `figureSpots.js`, `BodyFigure` + `figure.js` (fallback), `SideCards`, `DayStrip`, `select.js` + test), `PersonalTrainer.jsx` (+ `BodyMap`, `BalanceRadar`, `ExerciseTicker`, `ptParts`), `TemplatesView.jsx`, `LogView.jsx`, `strength.js` and `muscles.js` (+ tests), `ranges.js`, `theme.js`, `icons.jsx`, `WorkoutCard`, `WorkoutTile`, `art.js`, `api.js`.
- `social/`: `SocialView.jsx`, `ReviewSection`, `DataSection`, `CompetitorsSection`, `SocialCard`, `SocialTable`, `format.js`, `api.js`.
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
| `agenda/DateCard.jsx` | The Agenda's header card: `headlineLong` date, ‹ date field › (navigate within `/agenda/`), `DayInfoBadge` pills, `QuoteCallout`, `MiniCalendar`. |
| `garmin/GarminView.jsx` | The Garmin tab: loads `GET /api/garmin/day/:date` and `GET /api/garmin/status`, renders the cards inside `GarminShell`, the failed-endpoint line and the collapsed endpoint explorer. Shows a sign-in notice when Garmin is not connected. |
| `garmin/nav.js` | The sidebar tree copied from connect.garmin.com (Home, Challenges, Calendar, News Feed; Activities, Health Stats, Nutrition, Performance Stats, Training & Planning groups; Gear, Insights, Reports; Friends, Groups; Badges, Personal Records, Goals; Activity Tracking Accuracy) plus, per slug, the page: title, Garmin URL, supported ranges and the registry calls to batch. Items Garmin keeps off its API have no calls. |
| `garmin/GarminShell.jsx` | The connect.garmin.com frame: 268px dark sidebar built from `garmin/nav.js` (collapsible groups, active row and group outline, Agenda / Workout at the top, All Endpoints at the bottom), white 60px top bar (round button that hides or shows the sidebar, remembered in localStorage `plannerNavCollapsed`, shared with `AgendaRail`; sync / recap / settings icons), the DAILY SUMMARY header or a sub-page's `header`, and the gray content area. Under 900px the sidebar is a drawer behind a hamburger. Owns the Recap and Settings modals on that tab. |
| `garmin/primitives/` | The primitives every Garmin sub-page is built from, measured on connect.garmin.com: `Frame.jsx` (PageContainer 1280/56px, PageTitle 44px, DateControls, RangeControl, TabStrip, SectionHeading, Banner, SideIndex, TwoCol), `Widgets.jsx` (EmptyState, RingGauge, ArcGauge, StatPair, Bar, DataTable, TileCard, HexBadge, Illustration, buttons, Avatar) and `MapView.jsx` (Leaflet from cdnjs, OSM tiles, polyline). |
| `garmin/pages/` | One bespoke page per Garmin sidebar item, grouped by file: `HealthStats.jsx`, `Activities.jsx` (All Activities + the activity detail at `/garmin/:date/activity/:id`), `Nutrition.jsx`, `Performance.jsx` (Reports frame), `Home.jsx`, `Training.jsx` (map pages), `More.jsx` (Gear, Social, Achievements). `index.js` maps slug to component; `common.jsx` has `MetricFrame`, `DailyTimeline`, `DailyBars`. Each receives `{ dateISO, range, setRange, results, slug }`; `results` are keyed by the short keys set in `garmin/nav.js`. |
| `garmin/MetricPage.jsx` | Loads a sub-page's registry calls in one `POST /api/garmin/batch` (plus a prelude call for pages that need the profile id) and dispatches to the bespoke component from `garmin/pages/index.js`; the generic `MetricHeader` + AutoData cards remain as the fallback for any slug without one. |
| `garmin/AutoData.jsx` | Renders any endpoint payload Garmin-style: `[[ts, v]]` -> sparkline, arrays of objects -> table, objects -> key / value grid with nested sections; ids hidden; raw JSON behind a toggle. |
| `workout/WorkoutView.jsx` | The Workout tab since 2026-09-29, one scrolling dashboard (the user asked to scroll, not toggle): loads `GET /api/workout/status`, `recent` (the range, plus a seven-week window for the day strip), `strength` and `catalog`; renders `AgendaRail`, then a top bar (`WorkoutTopNav`: no tab mark or title since 2026-10-04, the section pills left-aligned, one pill per section that smooth-scrolls to it and is highlighted while that section is on screen, ‹ date field ›, and the one range select that drives every section; sticky with a frosted background from 900px of viewport, scrolls away on a phone), then four `<section id="workout-<key>">` blocks in order: Overview, Trainer (`PersonalTrainer`, fed the page's range and the muscle filter held here), Workouts (`TemplatesView`), Log (`LogView`). The Overview popover's Open in Trainer sets that muscle filter and scrolls to Trainer. No `?view=` any more. |
| `workout/overview/` | The Overview view, mockup A picked by the user on 2026-09-29 (artifact https://claude.ai/artifact/EgVG5xnUgNbrvZ12DAvUEG): left, the profile card (the last gym workout's app art, stat pills sex / weight with the range's change / height / age, the date headline, Workouts / Hours / Streak) and Session length (avg, range, one bar per session up to 40, the longest hatched with a bubble); centre, `BodyViewer` -> `BodyImage` (since 2026-09-29 the user's own body render, `public/workout-body/figure.webp`, shown as it is with the heat painted on: soft radial glows per spot from `figureSpots.js`, yellow -> orange -> red by share of the busiest group, masked by the image's alpha, `hard-light` blended; one dot per trained group opening `MusclePopover` (pounds, share, top exercise, change vs the same-length window before only when that window has gym sessions, Open in Trainer); a back render too (`figure-back.webp`): < Front / Back > or a sideways drag turns him around as a card flip (crossfade under reduced motion), each side with its own spots and dots and a "+N trained on the other side" pill (no zoom since 2026-10-04); the header row carries the `snapshotAge` status line (or Refresh's progress) on the left, the pill and the range select on the right; the SVG `BodyFigure` only if the image fails to load. `Body3D.jsx`, `heatMaterial.js` and `anchors.js` are a three.js version kept unimported for the later animated figure: the mesh generated from the image was rejected); right, `SideCards` (Last session with the app's art or a home tile, Highlights = new records in range from `select.recordsInRange` else Longest streak + Workouts, Volume area over gym sessions, Balance top-3 pies, and Muscles: groups trained of nine plus a mini radar (this range filled, the window before dashed, a spoke's dot selects the group for the page), three equal tiles in one grid); bottom, `DayStrip` (seven Sunday-start weeks, dumbbell tinted by the session's main muscle group, house for home, the range's last 7 days on a white band, a day click opens that date). Three columns from 1060px of content width, two from 660px, one below. Pure data in `select.js` (+ `select.test.js`). |
| `social/SocialView.jsx` | The Social tab: `AgendaRail` plus three stacked cards: `ReviewSection` (the card titled Summary; loads `GET /api/social/review`, polls every 3 s while `running`; a Refresh button posts `/api/social/review/generate` and greys out once the day's five refreshes are used (`throttle` in the GET): Top performers from `stats` with each opening line's hook type from `hook_types`, and Hooks to consider, ten numbered hook lines in the model's grouped order, each ending in its move in italics); `DataSection` (header: the search box over caption / hook / id / date, then a Drive button that opens the Google Sheet, no count pill or status line; tiles from `summary`, every sheet column in sheet order, click a header to sort, click a row to expand it and fetch the transcript from `GET /api/social/videos/:id`, 100 rows at a time); `CompetitorsSection` (header: Niche and Tags editors, Add handle; winning moves and formats across accounts, rising sounds; one pill per account (band shown) plus Proposed and Saved, the pick in localStorage `planner.social.competitorPick`; per account the stat line with off-niche hidden count, Top outliers table (hook ending in its move, recipe line, sound, sortable Multiple / Saves/1k / Shares/1k / Views, star), Rising, Ideas from comments, All-time hits, collapsed Adjacent; staleness line at the bottom). |
| `health/HealthView.jsx` | The Health tab: `AgendaRail` plus a header card (date headline, ‹ date field › within `/health/`, a Fetch now button that posts `/api/health/fetch`, and the store's status line: muted normally, amber when the 24-hour direct-call count exceeds the design budget, red after three failed runs, a needed sign-in code or a run that never finished), then the four sections. Reads `GET /api/health/day/:date` and `/status` only; never Garmin live. |
| `health/sections.jsx` | `TodayActivity` (one card per activity: name, filled glyph, duration for strength or distance for a run, dot-separated facts, a `RouteTrace` for runs, link to the Garmin activity page), `InFocus` (this Mon-Sun week's active time, `WeekBars` with hollow bars for non-final days, a 28-dot `DotStrip` only once 28 days are stored, else a muted note), `Glance` (the grid: 4 across from 1100px of viewport, 2 below, via matchMedia) and `LastSeven` (literal counts, "Avg" spelled out, "of N days" when fewer than 7 have data). |
| `health/cards.js` | The At a Glance cards as data: metric key, shape (`RING`, `GAUGE`, `SPLIT`, `STACK`), label, glyph, color, footer variant (`letters`, `spark`, `series`), a `build(value, ctx)` that turns the stored value into shape props, and a `caption` naming the Garmin call, field and reading date. Ten cards in the phone's order, then the stored metrics with no phone card (sleep, body battery, pulse ox, respiration, hydration, training readiness) as stack cards. Pruning the grid is an edit to this array. |
| `health/HealthCard.jsx` | `CardShell` (glyph, title, body, caption), `EmptyCard` (full height and slot kept: muted glyph disc, the metric name, one sentence why) and the four shapes: ring with the goal under it and a Last 7d footer, three-quarter zone gauge with a knob, split bar with labelled ends, stacked numbers with an updated line. |
| `social/SocialCard.jsx`, `SocialTable.jsx`, `format.js` | Card (dotted title, aside pill, `actions` slot) and tile plus the table styles, copies of the Workout tab's because tabs do not import each other; `shortDate`, `monthDay`, `dateTime`, `multipleText`, `count`. |
| `workout/PersonalTrainer.jsx`, `strength.js`, `muscles.js`, `BodyMap.jsx`, `BalanceRadar.jsx`, `MuscleChart.jsx`, `ExerciseTicker.jsx`, `ptParts.jsx` | The Personal Trainer card, the page's Trainer section (range and muscle filter come from `WorkoutView`; it has no range picker of its own since 2026-09-29; since 2026-10-04 the workouts-per-day chart, `RangeBars` in `logParts.jsx`, tops out at 70% of its panel and a bar with workouts selects its day, week, month or quarter: the Workouts dropdown, `DayTable`, opens with those rows tinted and scrolled to, a second click clears it) (layout picked by the user 2026-09-28 from ten prototypes): one summary line (sessions, exercises, volume, dates; the delta vs the previous session from session two), then `BodyMap` (front/back silhouettes shaded by each muscle group's share of the range's volume) left of `BalanceRadar` (volume per group, square-root radius, this range filled against the same-length range before it dashed; none for Lifetime), then `MuscleChart` full width, the one data chart for both figures (per group: this range as a solid bar, the range before as a dashed ghost on the same scale, pounds, change; the legend and the "Not trained" line), then `ExerciseTicker` full width (one row per exercise: name with the last session's compressed sets and PR pills, muscle chip, last date, sessions, best set, est. 1RM, change vs the first time in the range or, with one session in range, vs the previous time ever, trend sparkline from two sessions, volume; sortable, sort in localStorage `plannerWorkoutTickerSort`; a row click opens `ExerciseDetail` from `ptParts.jsx`: rep-max table, records grid, session rows, metric chart). Picking a muscle on the body map, the radar or the chart selects it on all three and filters the ticker. `muscles.js` (`homeGroups` / `homeLabel` since 2026-10-04: a home session's groups from the app's area, else from `exercise_names` in `/api/workout/recent`; the Workouts table shows `homeLabel`, Abs as Core; `MuscleChart` takes them as `homeTrained`, "0 lb" and not "Not trained") maps exercise names to nine groups by ordered rules (the app has no muscle data for gym exercises) and sums volume per group; `muscles.test.js` pins every gym name in the snapshot and the per-group sum against the export's total. Open rows persist in localStorage `plannerWorkoutExerciseOpen`. `strength.js` is the pure math (Epley capped at 12 reps, inverse Epley, e10RM, set compression, history, records, new records, rep-max table, weekly volume, unit round-trip to the nearest 0.5); session volume is always the export's `total_weight_kg`; tests: `CI=true npx react-scripts test --watchAll=false src/workout`. |
| `workout/WorkoutCard.jsx`, `WorkoutTile.jsx` | Card in the tab's frosted look from `theme.js` (glass card, 24px radius) (dotted title via `dot`, aside as a pill, `actions` slot for controls; `collapsible` / `open` / `onToggle` turn the title into a chevron toggle that hides the body, used by the Workouts card with its state in localStorage `plannerWorkoutTemplatesOpen`, closed by default) and label-over-number tile for the Workout App tab, plus the shared table styles (`tileGrid`, `table`, `th`, `td`, `tableLink`). |
| `workout/theme.js`, `icons.jsx`, `TemplatesView.jsx`, `LogView.jsx` | The Workout tab's own tokens (page gradient, `glassCard`, `roundButton`, `statPill`, `iconDisc`, pastel tiles, `hatch`; `shared/styles.js` untouched) and line icons; the Workouts view (the templates card, always open now) and the Log view (`RangeBars` + the per-day table), both moved out of `WorkoutView` unchanged. |
| `shared/TopNav.jsx` | Light header bar (tabs, ‹ date picker ›, `NavLinks`). No tab renders it any more: Agenda, Workout and Social use `AgendaRail`, Garmin uses `GarminShell`. Kept because it exports `TABS`. |
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
| `shared/today.js` | `TODAY` (the `today` path segment), `ServerClock` (asks `GET /api/today` on load, focus, shown again and every 10 minutes; re-renders subscribers at the day's end), `useToday()`, `useViewDate()`. |
| `shared/clientEvent.js` | `reportClientEvent(event, fields)`: one sendBeacon line to `POST /api/client-event` with path, bundle, visibility, browser day and today. |
| `shared/dayInfo.js` | `todayISO` (the server's day once known, rolled past its midnight; `setServerDay`, `onTodayChange`, `todayEndsAt`), `isoToDate`, `dateToISO`, `shiftISO`, `dayInfo`, `headlineLong`, `longDate`, `ordinal`, `sortByOrder`, `monthGrid`. |
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
