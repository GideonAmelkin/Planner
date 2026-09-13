# Frontend

React 19, `react-scripts 5.0.1`, inline styles. Built on the server with
`REACT_APP_API_URL=/api npm run build` and served as static files (see `deploy/README.md`).
`api.js` falls back to `http://localhost:5002/api` when that variable is unset.

## Routes (`src/App.js`)

`/day/:date` renders `pages/DailyView`; `/` and unknown paths redirect to today. On a fresh
page load any `/day/:date` snaps back to today (`BootRedirectToToday`). `src/index.js` turns
`?connected=` / `?calendar_error=` query params from the OAuth callback into a toast in
`sessionStorage` (`plannerCalendarToast`) that `CalendarToast` shows once.

## Files

| File | Role |
|---|---|
| `pages/DailyView.jsx` | The single page: loads `GET /api/day/:date`, lays out the 4-cell spread, then the Monthly Goals and Calendar sections. Owns the cross-section movers (`movers.noteToTasks` etc.). |
| `components/TopNav.jsx` | Header bar: Prev / Today / Next, date picker, `NavLinks` (Recap, Settings). |
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
| `services/api.js` | Axios client with a retry-once interceptor for network errors (never for 4xx/5xx). One export per endpoint. `API_BASE` is used by Settings to build the connect URL. |
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
- Section vocabulary in conversation: Planner (the spread), Monthly Goals, Calendar.
- No em dashes anywhere.
