# pages/

| File | Path | Role |
|---|---|---|
| `DailyView.jsx` | `/day/:date` | The two-page spread. Owns the day payload state, the pull-forward toast, and the cross-section drop handlers (`handleDropNoteOnTasks`, `handleDropTaskOnNotes`) that convert items between Action Items and Tasks/Notes. Routes data into `TimelineSchedule`, `PrioritizedTaskList`, `DailyNotes`, and `DailyNotesText`. |
| `MasterTaskList.jsx` | `/master/:year/:month` | Personal \| Business two-column running list for a month. Each side has its own auto-save row + an "Add item…" input. |
| `MonthlyCalendar.jsx` | `/calendar/:year/:month` | Month grid. Each day cell is a `<Link>` to its `DailyView`; dot + count markers indicate days with tasks / appointments via `GET /api/month/:year/:month`. Today's cell is `#F4ECD2`. |

The two list pages share `NavLinks.jsx` for the right-side nav cluster (so they look like the daily view's `TopNav` without re-importing it).
