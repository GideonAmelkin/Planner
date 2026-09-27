import React from 'react';
import { COLORS } from '../shared/styles';

// Headline number + label, and the table styles the Social cards share. Copied from the
// Workout tab's tile file because tabs do not import each other.
export default function SocialTile({ label, value, sub = null, size = 22 }) {
  const shown = value === null || value === undefined || value === '' ? '-' : value;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.muted }}>{label}</div>
      <div style={{ fontSize: size, fontWeight: 600, letterSpacing: -0.3, color: COLORS.ink, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums', marginTop: 2, whiteSpace: 'nowrap' }}>{shown}</div>
      {sub ? <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

export const tileGrid = (min = 120) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`,
  gap: '12px 16px',
});

export const tableWrap = { overflowX: 'auto' };
export const table = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
export const th = { padding: '4px 10px 8px 0', borderBottom: `1px solid ${COLORS.hairline}`, fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' };
export const headRow = { color: COLORS.faint, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 };
export const td = { padding: '8px 10px 8px 0', borderBottom: `1px solid ${COLORS.hairline}`, verticalAlign: 'top' };
export const tdNum = { ...td, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', textAlign: 'right' };
export const thNum = { ...th, textAlign: 'right' };
export const tableLink = { color: COLORS.accent, fontWeight: 600, textDecoration: 'none' };
// Muted uppercase label above a block inside a card.
export const blockLabel = { fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.muted, margin: '18px 0 8px' };
