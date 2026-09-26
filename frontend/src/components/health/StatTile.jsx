import React from 'react';
import { COLORS } from '../../styles';

// Headline number + label. `value` null renders a dash so the grid keeps its shape.
export default function StatTile({ label, value, unit = '', sub = null, size = 22 }) {
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
