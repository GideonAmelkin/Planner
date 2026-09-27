// Date and number helpers for the Social tab.
import { num } from '../shared/format';

// '2026-09-26' -> 'Fri, Sep 26, 2026'
export const shortDate = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '-');
// '2026-09-26' -> 'Sep 26'
export const monthDay = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-');
// ISO datetime -> 'Sat, Sep 27, 7:15 AM'
export const dateTime = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};
// The tracker's baseline multiple, with the sheet's asterisk when the baseline spans a gap.
export const multipleText = (m, gap) => (m === null || m === undefined ? '-' : `${num(m, 1)}x${gap ? '*' : ''}`);
export const count = (v) => (v === null || v === undefined ? '-' : num(v));
