import {
  differenceInDays,
  endOfYear,
  format,
  getDayOfYear,
  getISOWeek,
  parseISO,
  startOfDay,
  addDays,
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
    headlineDate: format(d, 'EEEE, MMMM do yyyy').toUpperCase(),
  };
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
