// Formatting helpers for Garmin Connect payloads. The account is on US units.

export const num = (v, digits = 0) =>
  (v === null || v === undefined || Number.isNaN(Number(v))) ? null : Number(v).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });

export const metersToMiles = (m) => (m === null || m === undefined) ? null : m / 1609.344;
export const gramsToLbs = (g) => (g === null || g === undefined) ? null : g / 453.59237;
export const mlToOz = (ml) => (ml === null || ml === undefined) ? null : ml / 29.5735;

// 25620 -> "7h 07m"
export function secondsToHm(sec) {
  if (sec === null || sec === undefined) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

// Garmin "Local" timestamps are epoch ms already shifted to wall time; read them as UTC.
export function clock(ms) {
  if (!ms) return null;
  const d = new Date(ms);
  let h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// '2026-02-26T05:00:00.0' (no zone) -> ms as if UTC.
export const parseNaive = (s) => (s ? Date.parse(`${String(s).replace(' ', 'T').replace(/\.\d+$/, '')}Z`) : null);

// Offset to add to a GMT epoch so `clock()` shows local wall time for that payload.
export function localOffset(payload) {
  const g = parseNaive(payload && payload.startTimestampGMT);
  const l = parseNaive(payload && payload.startTimestampLocal);
  return (g && l) ? l - g : 0;
}

// [[ts, value], ...] -> points with nulls dropped.
export const series = (arr) => (Array.isArray(arr) ? arr.filter((p) => Array.isArray(p) && p[1] !== null && p[1] !== undefined) : []);

export const titleCase = (s) => (s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : s);
