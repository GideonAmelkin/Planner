import React from 'react';
import { COLORS } from '../../styles';

// Headline number + label. `value` null renders a dash so the grid keeps its shape.
export default function WorkoutTile({ label, value, unit = '', sub = null, size = 22 }) {
  const shown = value === null || value === undefined || value === '' ? '-' : value;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.muted }}>{label}</div>
      <div style={{ fontSize: size, fontWeight: 600, letterSpacing: -0.3, color: COLORS.ink, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
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

// Table styles shared by the session and history cards.
export const tableWrap = { overflowX: 'auto' };
export const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
export const th = { padding: '4px 8px 8px 0', borderBottom: `1px solid ${COLORS.hairline}`, fontWeight: 600, textAlign: 'left' };
export const headRow = { color: COLORS.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 };
export const td = { padding: '8px 8px 8px 0', borderBottom: `1px solid ${COLORS.hairline}`, verticalAlign: 'top' };
export const tdNum = { ...td, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
export const tableLink = { color: COLORS.accent, fontWeight: 600, textDecoration: 'none' };
