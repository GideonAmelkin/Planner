# utils/

## `dayInfo.js`

Pure date helpers built on `date-fns`.

| Export | What it does |
|---|---|
| `todayISO()` | `'YYYY-MM-DD'` for the local current day. |
| `isoToDate(iso)` / `dateToISO(date)` | Convert between the ISO string format and `Date` (with `startOfDay` normalization). |
| `shiftISO(iso, deltaDays)` | Date arithmetic in ISO space. |
| `dayInfo(iso)` | Returns `{ dayOfYear, week (ISO), daysLeft (until 31 Dec), weekday (UPPER), monthYear, dayNum, headlineDate }`. `headlineDate` is the single-line uppercase form like `TUESDAY, MAY 5TH 2026` rendered on the daily view. |
| `ordinal(n)` | `1 → '1st'`, `2 → '2nd'`, etc. — used by the day-info badge (`126th Day`). |
