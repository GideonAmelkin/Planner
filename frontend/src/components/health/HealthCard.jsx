import React from 'react';
import { COLORS, sectionHeader } from '../../styles';

// One paper card in the Health grid. `span` lets a card take the full row.
export default function HealthCard({ title, children, span = 1, aside = null, empty = false }) {
  return (
    <div style={{
      background: COLORS.paper,
      border: `1px solid ${COLORS.ink}`,
      padding: '12px 16px 16px 16px',
      gridColumn: span > 1 ? '1 / -1' : 'auto',
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, ...sectionHeader, textAlign: 'left', marginBottom: 12 }}>
        <span>{title}</span>
        {aside ? <span style={{ fontStyle: 'normal', fontSize: 11, color: COLORS.muted }}>{aside}</span> : null}
      </div>
      {empty ? <div style={{ color: COLORS.muted, fontSize: 12, fontStyle: 'italic' }}>No data for this day.</div> : children}
    </div>
  );
}
