# services/

## `api.js`

Axios client. Base URL = `process.env.REACT_APP_API_URL ?? 'http://localhost:5002/api'`.

### Retry-once interceptor

If a request fails with **no HTTP response** (network error — backend restarting, sleep/wake, etc.), it sleeps 1.5s and retries the request once. Server-returned errors (4xx/5xx) are *not* retried so we never repeat side effects.

### Exports

| Function | Endpoint |
|---|---|
| `getDay(date)` | `GET /day/:date` |
| `pullForwardDay(date)` | `POST /day/:date/pull-forward` |
| `createTask` / `updateTask` / `deleteTask` / `reorderTasks(ids)` | `/tasks*` |
| `createAppointment` / `updateAppointment` / `deleteAppointment` | `/appointments*` |
| `createNote` / `updateNote` / `deleteNote` / `reorderNotes(ids)` | `/notes*` |
| `saveNotesText(date, content)` | `PUT /notes-text/:date` |
| `saveTracker(date, content)` | `PUT /tracker/:date` |
| `getMasterTasks(y, m)` / `createMasterTask` / `updateMasterTask` / `deleteMasterTask` | `/master-tasks*` |
| `getMonth(y, m)` | `GET /month/:y/:m` |
| `getCalendarAccounts()` / `disconnectCalendarAccount(id)` | `/calendar/accounts*` |
| `API_BASE` | the resolved base URL string (used by `SettingsPanel` to build connect-redirect URLs without going through axios) |
