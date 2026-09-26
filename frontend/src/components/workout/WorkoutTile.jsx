import React from 'react';
import { COLORS } from '../../styles';

// Headline number + label. `value` null renders a dash so the grid keeps its shape.
export default function WorkoutTile({ label, value, unit = '', sub = null, size = 22 }) {
  const shown = value === null || value === undefined || value === '' ? '-' : value;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.muted }}>{label}</div>
      <div style={{ fontSize: size, fontWeight: 700, color: COLORS.ink, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
        {shown}{shown !== '-' && unit ? <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.muted, marginLeft: 3 }}>{unit}</span> : null}
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

// Table styles shared by the session and history cards.
export const tableWrap = { overflowX: 'auto' };
export const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
export const th = { padding: '4px 8px 6px 0', borderBottom: `1px solid ${COLORS.hairline}`, fontWeight: 600, textAlign: 'left' };
export const headRow = { color: COLORS.muted, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.6 };
export const td = { padding: '6px 8px 6px 0', borderBottom: `1px solid ${COLORS.hairline}`, verticalAlign: 'top' };
export const tdNum = { ...td, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
