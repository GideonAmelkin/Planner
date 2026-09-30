import React from 'react';
import { COLORS } from '../shared/styles';

// Headline number + label. `value` null renders a dash so the grid keeps its shape.
export default function WorkoutTile({ label, value, unit = '', sub = null, size = 22 }) {
  const shown = value === null || value === undefined || value === '' ? '-' : value;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.muted }}>{label}</div>
      <div style={{ fontSize: size, fontWeight: 600, letterSpacing: -0.3, color: COLORS.ink, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums', marginTop: 2, whiteSpace: 'nowrap' }}>
        {shown}{shown !== '-' && unit ? <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.muted, marginLeft: 3, letterSpacing: 0 }}>{unit}</span> : null}
      </div>
      {sub ? <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

export const tileGrid = (min = 110) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
  gap: '12px 16px',
});

// Table styles shared by every table on the tab, in the Overview's look: a frosted rounded panel,
// small uppercase muted heads, airy rows on faint dividers, tabular numbers.
export const tableWrap = { overflowX: 'auto', background: 'rgba(255,255,255,.55)', border: '1px solid rgba(255,255,255,.9)', borderRadius: 16, padding: '6px 14px' };
export const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
export const th = { padding: '8px 10px 10px 0', borderBottom: '1px solid rgba(30,50,110,.08)', fontWeight: 600, textAlign: 'left' };
export const headRow = { color: COLORS.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 };
export const td = { padding: '11px 10px 11px 0', borderBottom: '1px solid rgba(30,50,110,.06)', verticalAlign: 'top' };
export const tdNum = { ...td, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
export const tableLink = { color: '#4F7BF7', fontWeight: 600, textDecoration: 'none' };
