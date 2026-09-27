// Health tab formatters and date helpers. US units, like the Garmin account.
import { shiftISO } from '../shared/dayInfo';

const MILE_M = 1609.344;

export const miles = (m, digits = 2) => (m === null || m === undefined ? null : (m / MILE_M).toFixed(digits));
export const lbs = (grams, digits = 1) => (grams === null || grams === undefined ? null : (grams / 453.592).toFixed(digits));

// 1912.7 -> "31:53"; 5400 -> "1:30:00"
export function clockDuration(sec) {
  if (sec === null || sec === undefined) return null;
  const s = Math.round(sec);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

// m/s -> "9:53 /mi"
export function pacePerMile(speedMs) {
  if (!speedMs || speedMs <= 0) return null;
  const secPerMile = MILE_M / speedMs;
  const m = Math.floor(secPerMile / 60); const s = Math.round(secPerMile % 60);
  return `${m}:${String(s).padStart(2, '0')} /mi`;
}

export const dayLetter = (iso) => 'SMTWTFS'[new Date(`${iso}T12:00:00`).getDay()];
export const monthDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const longMonthDay = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
export const timeOfDay = (ms) => (ms ? new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null);
// "2026-09-27T20:43:30.41" (GMT, no zone) -> "4:43 PM"
export const gmtStampTime = (s) => (s ? timeOfDay(Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`)) : null);

// The n dates ending on `end`, oldest first.
export const lastDays = (end, n) => Array.from({ length: n }, (_, i) => shiftISO(end, -(n - 1 - i)));

// Monday..Sunday of the week containing `iso` (Garmin's intensity week).
export function weekOf(iso) {
  const dow = new Date(`${iso}T12:00:00`).getDay();           // 0 Sun .. 6 Sat
  const monday = shiftISO(iso, -((dow + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => shiftISO(monday, i));
}

// "Sep 21-27" or "Sep 28 - Oct 4"
export function rangeLabel(start, end) {
  const a = new Date(`${start}T12:00:00`); const b = new Date(`${end}T12:00:00`);
  const ma = a.toLocaleDateString('en-US', { month: 'short' }); const mb = b.toLocaleDateString('en-US', { month: 'short' });
  return ma === mb ? `${ma} ${a.getDate()}-${b.getDate()}` : `${ma} ${a.getDate()} - ${mb} ${b.getDate()}`;
}

export const intNum = (v) => (v === null || v === undefined ? null : Math.round(v).toLocaleString('en-US'));
