// Generic number and text formatters. The account is on US units.

export const num = (v, digits = 0) =>
  (v === null || v === undefined || Number.isNaN(Number(v))) ? null : Number(v).toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });

// 25620 -> "7h 07m"
export function secondsToHm(sec) {
  if (sec === null || sec === undefined) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export const titleCase = (s) => (s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : s);
