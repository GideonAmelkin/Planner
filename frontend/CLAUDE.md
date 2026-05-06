# Frontend

React 19 single-page app, `react-scripts 5.0.1` dev server on **port 3001**. **Use Node 20** — `react-scripts` hangs silently on Node 24.

## Run

`start.sh` does this for you. Manually:

```bash
cd ~/Documents/Planner/frontend
PORT=3001 BROWSER=none npm start
```

`api.js` defaults to `http://localhost:5002/api` — overrideable via `REACT_APP_API_URL`.

## Routes (`src/App.js`)

| Path | Component |
|---|---|
| `/` | redirect → today's `DailyView` |
| `/day/:date` | [`pages/DailyView`](src/pages/DailyView.jsx) |
| `/master/:y/:m` | [`pages/MasterTaskList`](src/pages/MasterTaskList.jsx) |
| `/calendar/:y/:m` | [`pages/MonthlyCalendar`](src/pages/MonthlyCalendar.jsx) |

`src/index.js` parses `?connected=google` / `?calendar_error=...` query params on app boot, stashes a toast in `sessionStorage`, and rewrites the URL — `CalendarToast` (rendered by `App.js`) reads it on mount.

## DailyView layout

A 4-cell CSS grid (2 columns × 2 rows). Top row is the headline date + mini-calendar (left) and quote + day-info badge (right); the grid forces both top cells to share a row height so the bottom-row content (Appointment Schedule on the left; Action Items + Tasks/Notes + free-form notes on the right) starts at the same Y on both pages.

## Conventions

- **Inline styles only.** No Tailwind classes in markup; the dep is not installed.
- **Auto-save:** inputs commit on blur; textareas are debounced 800ms.
- **Cream paper palette.** Page bg `#F0EAD6`, page surface `#FBF6E7`, ink `#2D3436`, hairlines `#C9BB9A`, dim text `#6B5B40` / `#A89368`. Provider accents Google `#1565C0`, Outlook `#00695C`.
- **Drag-and-drop MIME types:** `application/x-planner-task` and `application/x-planner-note`. Wrappers accept the *opposite* type for cross-section moves; rows accept their *own* type for within-section reordering. Cross-level (top-level ↔ child) reorder via drag is intentionally blocked — use `Tab` / `Shift+Tab` keyboard shortcuts in the row instead.
- **`api.js` retry-once interceptor** absorbs backend restart windows so the UI doesn't flash on `bash stop.sh && bash start.sh`.

## Folder map

```
frontend/
  public/index.html         ← Inter + EB Garamond from Google Fonts
  src/
    index.js, index.css     ← entry, ?connected= toast plumbing, ruled-bg helpers
    App.js                  ← BrowserRouter, redirects
    services/               ← see services/CLAUDE.md
    utils/                  ← see utils/CLAUDE.md
    pages/                  ← see pages/CLAUDE.md
    components/             ← see components/CLAUDE.md
```
