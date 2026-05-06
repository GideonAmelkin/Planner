# components/

| File | Role |
|---|---|
| `TopNav.jsx` | Dark header bar — Prev / Today / Next, date picker, Agenda / Goals / Calendar links, Settings button (opens the modal). |
| `MiniCalendar.jsx` | Current-month grid in the date headline. Today is the dark filled circle; every other day is a `<Link>` to its DailyView. |
| `QuoteHeader.jsx` | The italic ZenQuotes line + day-info badge (`126th Day · 239 Left · Week 19`) on the right page. |
| `TimelineSchedule.jsx` | The Appointment Schedule — 7am–8pm vertical timeline (60px / hour). Renders manual appointments and external Google/Outlook events as colored blocks. Greedy column-packing for overlaps. All-day external events show as pills above the timeline. Click empty area to add a manual appointment with a 15-min snap. |
| `PrioritizedTaskList.jsx` | Action Items — tasks with priority (A/B/C + number), check-circle done toggle, sub-items via Tab indent, drag-reorder within section, drag-and-drop *to* the Notes section to convert a task into a note. Pull-forward button + transient toast. |
| `DailyNotes.jsx` | Tasks/Notes section — running list with sub-items, drag-reorder, drag *to* Action Items to convert a note into a task. |
| `DailyNotesText.jsx` | Free-form lined textarea at the very bottom of the right page (the "Notes" block). |
| `CalendarToast.jsx` | Renders the toast triggered by `?connected=...` / `?calendar_error=...` from the OAuth callback. |
| `SettingsPanel.jsx` | Modal listing connected Google / Outlook accounts. The Connect buttons are disabled with a tooltip when the corresponding `_CLIENT_ID/SECRET` is missing on the backend. |
| `NavLinks.jsx` | Shared nav-link group used by Master and Calendar pages so they don't have to copy `TopNav`'s right-side cluster. |
| `StatusIcon.jsx` | Legacy 5-state status cycler (Completed/Forwarded/Deleted/Delegated/InProcess from the paper book). The current UI doesn't render this — kept for reference / potential reuse. |

## Drag protocol

Both `PrioritizedTaskList` and `DailyNotes` are drag containers and drop targets. The wrapper accepts the *opposite* MIME type (cross-section move). Each row accepts its *own* MIME type (within-section reorder). Within-section drops include a top/bottom indicator computed from the cursor's Y position relative to the row's midpoint.

Cross-section drop calls `onDropTask` / `onDropNote` on `DailyView`, which deletes the original and creates a fresh row in the destination type. Children come along with the parent.

Within-section drop calls `reorderTasks(ids)` / `reorderNotes(ids)` on the backend — the server sequentially writes `order_index = position` on each id.
