import {
  addDays,
  differenceInDays,
  endOfMonth,
  endOfYear,
  format,
  getDayOfYear,
  getISOWeek,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

// The server's local day (GET /api/today, set by shared/today.js): the date and the
// moment it ends on this machine's clock. Until it is known, or if it is hours stale,
// the browser's own day stands in.
const DAY_MS = 24 * 60 * 60 * 1000;
let serverDay = null;
const dayListeners = new Set();

function browserTodayISO() {
  return format(startOfDay(new Date()), 'yyyy-MM-dd');
}

// Today: the server's day, rolled forward past each midnight it reported, so a page that
// stays open turns over on time even before the next fetch.
export function todayISO() {
  if (!serverDay) return browserTodayISO();
  const now = Date.now();
  if (now < serverDay.endsAt) return serverDay.date;
  const days = 1 + Math.floor((now - serverDay.endsAt) / DAY_MS);
  return days > 1 ? browserTodayISO() : shiftISO(serverDay.date, days);
}

// Record the server's answer and tell subscribers when that changes what today is.
export function setServerDay({ date, msUntilMidnight }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !(msUntilMidnight >= 0)) return;
  const before = todayISO();
  serverDay = { date, endsAt: Date.now() + msUntilMidnight };
  if (todayISO() !== before) dayListeners.forEach((fn) => fn());
}

// The end of the current day on this machine's clock (ms timestamp).
export function todayEndsAt() {
  if (serverDay && Date.now() < serverDay.endsAt) return serverDay.endsAt;
  const d = startOfDay(new Date());
  return addDays(d, 1).getTime();
}

export function onTodayChange(fn) {
  dayListeners.add(fn);
  return () => dayListeners.delete(fn);
}

export function notifyTodayChange() {
  dayListeners.forEach((fn) => fn());
}

export function isoToDate(iso) {
  return startOfDay(parseISO(iso));
}

export function dateToISO(date) {
  return format(date, 'yyyy-MM-dd');
}

export function shiftISO(iso, deltaDays) {
  return dateToISO(addDays(isoToDate(iso), deltaDays));
}

export function dayInfo(iso) {
  const d = isoToDate(iso);
  return {
    dayOfYear: getDayOfYear(d),
    week: getISOWeek(d),
    daysLeft: differenceInDays(endOfYear(d), d),
    weekday: format(d, 'EEEE').toUpperCase(),
    monthYear: format(d, 'MMMM yyyy'),
    dayNum: format(d, 'd'),
    headlineDate: longDate(iso).toUpperCase(),
  };
}

// 'Saturday, September 26' (the Agenda headline; the year lives in the date field)
export function headlineLong(iso) {
  try {
    return format(isoToDate(iso), 'EEEE, MMMM d');
  } catch (_) {
    return iso;
  }
}

// 'Saturday, September 12th 2026'
export function longDate(iso) {
  try {
    return format(isoToDate(iso), 'EEEE, MMMM do yyyy');
  } catch (_) {
    return iso;
  }
}

// Stable sort comparator for rows carrying order_index (ties broken by id).
export const sortByOrder = (a, b) =>
  (a.order_index || 0) - (b.order_index || 0) || a.id - b.id;

// Weeks (Sunday-first) covering the month that contains monthDate, as rows of
// Date objects. Emits at least minRows rows and never more than maxRows; once
// minRows is reached it stops as soon as the month is fully covered.
export function monthGrid(monthDate, { minRows = 5, maxRows = 6 } = {}) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthStart);
  let cursor = startOfWeek(monthStart, { weekStartsOn: 0 });
  const rows = [];
  while (rows.length < maxRows) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    rows.push(week);
    if (rows.length >= minRows && cursor > monthEnd) break;
  }
  return rows;
}

export function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}
