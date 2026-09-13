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

export function todayISO() {
  return format(startOfDay(new Date()), 'yyyy-MM-dd');
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
