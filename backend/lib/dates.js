// Local-timezone date helpers. The planner keys everything off the server's
// local day ("11:59 PM local", "today"), never UTC.

const pad = (n) => String(n).padStart(2, '0');

// Date -> 'YYYY-MM-DD' in local time.
function localISO(dt = new Date()) {
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// 'YYYY-MM-DD' -> the following day, also 'YYYY-MM-DD'.
function nextDayISO(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  return localISO(new Date(y, m - 1, d + 1));
}

// Date or ISO string -> 'YYYY-MM-DDTHH:MM' in local time; null when unparseable.
function toLocalDateTime(dt) {
  if (!dt) return null;
  const d = typeof dt === 'string' ? new Date(dt) : dt;
  if (isNaN(d.getTime())) return null;
  return `${localISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// [start, end) Date boundaries of a local calendar day.
function dayWindow(dateISO) {
  const [y, m, d] = dateISO.split('-').map(Number);
  return { start: new Date(y, m - 1, d, 0, 0, 0), end: new Date(y, m - 1, d + 1, 0, 0, 0) };
}

// SQL LIKE prefix matching every date in a month: '2026-09-%'.
function monthPrefix(year, month) {
  return `${year}-${pad(month)}-%`;
}

module.exports = { pad, localISO, nextDayISO, toLocalDateTime, dayWindow, monthPrefix };
