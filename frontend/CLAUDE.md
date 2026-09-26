# Frontend

React 19, `react-scripts 5.0.1`, inline styles. Built on the server with
`REACT_APP_API_URL=/api npm run build` and served as static files (see `deploy/README.md`).
`api.js` falls back to `http://localhost:5002/api` when that variable is unset.

## Routes (`src/App.js`)

`/agenda/:date` renders `pages/DailyView` and `/health/:date` renders `pages/HealthView`;
`/`, the legacy `/day/:date` and unknown paths redirect to today's agenda. On a fresh page
load any `/<section>/:date` snaps back to today in that section (`BootRedirectToToday`). `src/index.js` turns
`?connected=` / `?calendar_error=` query params from the OAuth callback into a toast in
`sessionStorage` (`plannerCalendarToast`) that `CalendarToast` shows once.

## Files

| File | Role |
|---|---|
| `pages/DailyView.jsx` | The Agenda tab: loads `GET /api/day/:date`, lays out the 4-cell spread, then the Monthly Goals and Calendar sections. Owns the cross-section movers (`movers.noteToTasks` etc.). |
| `pages/HealthView.jsx` | The Garmin tab: loads `GET /api/garmin/day/:date` and `GET /api/garmin/status`, renders the cards, the failed-endpoint line and the collapsed endpoint explorer. Shows a sign-in notice when Garmin is not connected. |
| `components/TopNav.jsx` | Header bar: Agenda / Garmin tabs, Prev / Today / Next, date picker (all scoped to the active `section`), `NavLinks` (Recap, Settings). `theme="garmin"` swaps in the near-black thin-type Garmin look. |
| `components/GarminSettings.jsx` | The Garmin Connect block in Settings: status, Sign in, verification-code box, Sign out. |
| `garminTheme.js` | Tokens and style objects measured from connect.garmin.com (Open Sans, `#efefef` page, white 8px cards, blue `#1265c2`, per-metric colors). Only the Garmin tab uses it. |
| `components/health/GarminCard.jsx` | Daily-summary card: colored icon + tracked uppercase title, body, and a footer link (`details` toggles a hidden block, `href` links out). |
| `components/health/GarminStat.jsx` | `Headline` (48px thin number + caption), `Stat` (18px value over a 12px gray label), `HeadlineRow` (headline left, stats right). |
| `components/health/ProgressBar.jsx` | The 20px square progress bar (steps, intensity minutes, floors, hydration). |
| `components/health/ActivityCard.jsx` | The solid green activity block with distance, time, pace, HR, calories and a "View activity" footer. |
| `components/health/GarminIcon.jsx` | 16px inline SVG glyphs per metric, filled with the metric color. |
| `components/health/Sparkline.jsx` | Inline SVG single-series line (with area fill) or bars over a day with a hover crosshair and value readout. |
| `components/health/EndpointExplorer.jsx` | Every registry endpoint grouped and collapsible, params as inputs (dates prefilled), Fetch / Refresh / Send, raw JSON below. Writes ask for confirmation. |
| `utils/garminFormat.js` | `num`, `metersToMiles`, `gramsToLbs`, `mlToOz`, `secondsToHm`, `clock` (Garmin local timestamps read as UTC), `localOffset`, `series`, `titleCase`. |
| `components/MiniCalendar.jsx` | Month grid in the date headline; the viewed day is the filled circle. |
| `components/QuoteHeader.jsx` | Quote plus the day-info badge (`255th Day  110 Left  Week 37`). |
| `components/TimelineSchedule.jsx` | Appointment Schedule, 7am to 8pm at 60 px/hour. Manual and external blocks, greedy column packing for overlaps, all-day pills, click-to-add with 15-minute snap. |
| `components/PrioritizedTaskList.jsx` | Action Items: A/B/C priority sort, `CheckMark` done toggle, sub-items, reorder, pull-forward button. |
| `components/NestedListSection.jsx` | Generic one-level nested list with inline edit, Tab/Shift+Tab indent, reorder and external drops. |
| `components/DailyNotes.jsx`, `Ongoing.jsx` | Thin wrappers around `NestedListSection` for the "Tasks" (per date) and "Ongoing" (no date) sections. |
| `components/DailyNotesText.jsx` | Free-form ruled textarea ("Notes"), debounced save. |
| `components/MonthlyGoals.jsx` | Monthly Goals section: Personal | Business columns, reorder within a column. |
| `components/CalendarSection.jsx` | Calendar section: 6-row month grid, each day links to its spread. |
| `components/CheckMark.jsx` | The circular check used by Action Items, Monthly Goals and Recap. |
| `components/RecapPanel.jsx`, `SettingsPanel.jsx` | Modals: completed items by date; connected calendar accounts and Connect buttons. |
| `components/CalendarToast.jsx` | The post-OAuth toast. |
| `services/api.js` | Axios client with a retry-once interceptor for network errors (never for 4xx/5xx). One export per endpoint, including the Garmin calls (`getGarminDay`, `callGarmin`, `postGarmin`, sign-in). `API_BASE` is used by Settings to build the connect URL. |
| `utils/dayInfo.js` | `todayISO`, `isoToDate`, `dateToISO`, `shiftISO`, `dayInfo`, `longDate`, `ordinal`, `sortByOrder`, `monthGrid`. |
| `styles.js` | `COLORS` tokens, `INDENT_PX`, and the shared style objects (section header, row input, nav button, outline button, modal shell, drop-zone borders). |

## Conventions

- Inline styles only. Colors come from `COLORS` in `styles.js`; do not add hex literals to
  components unless the value is a one-off (provider event tints, the setup notice).
- Inputs commit on blur; Enter blurs a top-level row and adds a sibling to a child row;
  Tab / Shift+Tab indent and unindent. Textareas save after 800 ms.
- Drag-and-drop MIME types: `application/x-planner-task`, `-note`, `-ongoing`,
  `-master-task`. A row accepts its own type (reorder within the same level); a section accepts
  the other sections' types (move across, children come along). Cross-level reorder by drag is
  intentionally blocked; use the keyboard.
- Section vocabulary in conversation: Agenda tab = Planner (the spread), Monthly Goals,
  Calendar; Garmin tab = the Garmin cards.
- The Garmin tab mirrors connect.garmin.com's daily summary: colors, type and card styles
  come from `garminTheme.js`, never from `COLORS` in `styles.js`. The page root carries the
  `garmin-page` class (Open Sans). Sleep stages use Garmin's deep / light / REM / awake
  colors and are always labeled; text never takes a series color.
- No em dashes anywhere.
