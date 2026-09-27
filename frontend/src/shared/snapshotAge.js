// How current the Home Workouts snapshot is, judged by its newest session rather
// than by when the file arrived: the Mac ships the same bytes every 6 hours whether
// or not the app on the Mac has pulled new history from the phone, so "synced 2 h
// ago" says nothing about the data. The Workout tab's status line and the Settings
// row both use this so the two screens agree.
import { COLORS } from './styles';

export const STALE_AFTER_DAYS = 3;   // amber past this
export const DEAD_AFTER_DAYS = 7;    // red past this

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);

// "Sep 27, 11:32 AM" from an ISO timestamp with offset; "Sep 9" (or "Sep 9, 2025"
// when the year differs from `asOfISO`) from a calendar date.
const stamp = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null);
const day = (iso, asOfISO) => {
  const d = new Date(`${iso}T12:00:00`);
  const sameYear = iso.slice(0, 4) === asOfISO.slice(0, 4);
  return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
};

// status is GET /api/workout/status; asOfISO is the day being looked at (the
// viewed date on the tab, today in Settings). Returns { level, days, text, color }
// where level is 'ok' | 'warn' | 'danger'.
export function snapshotAge(status, asOfISO) {
  if (!status || !status.available) {
    return { level: 'danger', days: null, color: COLORS.danger, text: 'Workouts: no snapshot on the server' };
  }
  const exported = stamp(status.exported_at);
  const newest = status.last_session && status.last_session.date;
  if (!newest) {
    return { level: 'danger', days: null, color: COLORS.danger, text: `Workouts: snapshot exported ${exported}, no sessions in it` };
  }
  // Looking at a day before the newest session is not staleness.
  const days = Math.max(0, daysBetween(newest, asOfISO));
  const level = days > DEAD_AFTER_DAYS ? 'danger' : days > STALE_AFTER_DAYS ? 'warn' : 'ok';
  const color = level === 'danger' ? COLORS.danger : level === 'warn' ? COLORS.warn : COLORS.muted;
  const age = days > STALE_AFTER_DAYS ? ` (${days} days)` : '';
  return { level, days, color, text: `Workouts: snapshot exported ${exported}, newest session ${day(newest, asOfISO)}${age}` };
}
