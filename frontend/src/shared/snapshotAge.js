// How current the Workout tab's data is. Two sources, one rule, used by the tab's status
// line and by Settings so the two screens agree:
//   the phone report (POST /api/workout/health, pushed by the Shortcut as workouts happen):
//     judged by when the phone last reported, since a rest week has no workouts to show;
//   the Mac snapshot: judged by its newest session rather than by when the file arrived,
//     because the Mac ships the same bytes every 6 hours whether or not the app on the Mac
//     has pulled new history from the phone.
// Once the phone reports, its age colours the line; the snapshot is then the detail source
// and only says how old it is in words.
import { COLORS } from './styles';

export const STALE_AFTER_DAYS = 3;   // amber past this
export const DEAD_AFTER_DAYS = 7;    // red past this
export const APP_SYNC_STALE_HOURS = 6;   // amber when the Mac's press on the app's Sync button has not worked for this long

const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
const localDay = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const todayLocal = () => localDay(new Date().toISOString());

// "Sep 27, 11:32 AM" from an ISO timestamp with offset; "Sep 9" (or "Sep 9, 2025"
// when the year differs from `asOfISO`) from a calendar date.
const stamp = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null);
const day = (iso, asOfISO) => {
  const d = new Date(`${iso}T12:00:00`);
  const sameYear = iso.slice(0, 4) === asOfISO.slice(0, 4);
  return d.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
};

const levelOf = (days) => (days > DEAD_AFTER_DAYS ? 'danger' : days > STALE_AFTER_DAYS ? 'warn' : 'ok');
const colorOf = (level) => (level === 'danger' ? COLORS.danger : level === 'warn' ? COLORS.warn : COLORS.muted);
const ageSuffix = (days) => (days > STALE_AFTER_DAYS ? ` (${days} days)` : '');

// The snapshot half: { level, days, text } with text like "snapshot exported Sep 27, 5:32 PM,
// newest session Sep 9 (18 days)". Null when there is no snapshot.
function snapshotPart(status, asOfISO) {
  if (!status || !status.exported_at) return null;
  // The Mac presses the app's own Sync button before each hourly export; say when that last
  // worked, and flag it once it has not worked for APP_SYNC_STALE_HOURS (the export keeps
  // shipping the same old data on time, so the export time alone hides a stalled sync).
  const a = status.app_sync;
  const lastSync = a ? a.last_synced_at || (a.outcome === 'synced' ? a.at : null) : null;
  const syncStalled = Boolean(a) && (!lastSync || Date.now() - Date.parse(lastSync) > APP_SYNC_STALE_HOURS * 3600000);
  const synced = !a ? '' : syncStalled
    ? ` (app sync stalled${lastSync ? ` since ${stamp(lastSync)}` : ''}: ${a.outcome.replace('_', ' ')})`
    : ` (app synced ${stamp(lastSync)})`;
  const exported = `${stamp(status.exported_at)}${synced}`;
  const last = status.snapshot_last_session || status.last_session;
  const newest = last && last.date;
  if (!newest) return { level: 'danger', days: null, text: `snapshot exported ${exported}, no sessions in it` };
  // Looking at a day before the newest session is not staleness.
  const days = Math.max(0, daysBetween(newest, asOfISO));
  const level = syncStalled && levelOf(days) === 'ok' ? 'warn' : levelOf(days);
  return { level, days, text: `snapshot exported ${exported}, newest session ${day(newest, asOfISO)}${ageSuffix(days)}` };
}

// The phone half: { level, days, reported, text }. Age is days since the phone last reported,
// against the real today (the pipe's health does not depend on the day being viewed).
function phonePart(status, asOfISO) {
  const h = status && status.health;
  if (!h || !h.available || !h.received_at) return null;
  const days = Math.max(0, daysBetween(localDay(h.received_at), todayLocal()));
  const newest = h.last_workout && h.last_workout.date;
  const newestText = newest ? `newest workout ${day(newest, asOfISO)}` : 'no workouts reported yet';
  return { level: levelOf(days), days, reported: stamp(h.received_at), text: `phone reported ${stamp(h.received_at)}${ageSuffix(days)}, ${newestText}` };
}

// status is GET /api/workout/status; asOfISO is the day being looked at (the viewed date on
// the tab, today in Settings). Returns { level, days, text, color, phone, snapshot } where level
// is 'ok' | 'warn' | 'danger' and phone / snapshot are the halves above (null when absent).
export function snapshotAge(status, asOfISO) {
  if (!status || !status.available) {
    return { level: 'danger', days: null, color: COLORS.danger, text: 'Workouts: no snapshot and no phone report on the server', phone: null, snapshot: null };
  }
  const phone = phonePart(status, asOfISO);
  const snapshot = snapshotPart(status, asOfISO);
  if (!phone) {
    const s = snapshot || { level: 'danger', days: null, text: 'no snapshot on the server' };
    return { level: s.level, days: s.days, color: colorOf(s.level), text: `Workouts: ${s.text}`, phone: null, snapshot };
  }
  const detail = snapshot ? ` · app detail: ${snapshot.text}` : '';
  return { level: phone.level, days: phone.days, color: colorOf(phone.level), text: `Workouts: ${phone.text}${detail}`, phone, snapshot };
}
