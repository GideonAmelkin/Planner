import React from 'react';
import { COLORS, navButton } from '../shared/styles';

// The range choices every card on the Workout tab offers (the top summary card and Personal
// Trainer), so the two dropdowns always list the same options in the same order. Fixed windows
// end on the shown date; Custom uses its own From/To.
export const RANGES = [
  { key: 'd1', label: '1 day', days: 1, sub: 'this day' },
  { key: 'd7', label: '7 days', days: 7, sub: 'last 7 days' },
  { key: 'd30', label: '30 days', days: 30, sub: 'last 30 days' },
  { key: 'd90', label: '90 days', days: 90, sub: 'last 90 days' },
  { key: 'd180', label: '180 days', days: 180, sub: 'last 180 days' },
  { key: 'y365', label: '365 days', days: 365, sub: 'last 365 days' },
  { key: 'lifetime', label: 'Lifetime', days: 3660, sub: 'lifetime' },
  { key: 'custom', label: 'Custom', days: null, sub: 'custom range' },
];
export const MAX_RANGE_DAYS = 3660;

const controlStyle = { ...navButton, fontSize: 12, padding: '4px 8px', cursor: 'pointer' };
const dateInputStyle = { background: COLORS.paper, color: COLORS.ink, border: `1px solid ${COLORS.hairline}`, borderRadius: 8, colorScheme: 'light', fontSize: 12, padding: '3px 6px' };

// The select, plus From/To date inputs while Custom is picked.
export function RangePicker({ rangeKey, onRangeKey, customFrom, customTo, onCustomFrom, onCustomTo }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <select value={rangeKey} onChange={(e) => onRangeKey(e.target.value)} style={controlStyle} title="Range">
        {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
      </select>
      {rangeKey === 'custom' ? (
        <>
          <input type="date" value={customFrom} max={customTo} onChange={(e) => e.target.value && onCustomFrom(e.target.value)} style={dateInputStyle} title="From" />
          <span style={{ fontSize: 12, color: COLORS.muted }}>to</span>
          <input type="date" value={customTo} min={customFrom} onChange={(e) => e.target.value && onCustomTo(e.target.value)} style={dateInputStyle} title="To" />
        </>
      ) : null}
    </span>
  );
}
