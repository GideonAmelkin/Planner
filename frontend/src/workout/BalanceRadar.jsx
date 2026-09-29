import React from 'react';
import { MUSCLE_GROUPS } from './muscles';
import { fmtVolume, muted, label } from './ptParts';
import { COLORS } from '../shared/styles';

// Volume per muscle group in the range (filled) against the same-length range right before it
// (dashed outline), so an under-trained group shows as a dent. The radius is the square root of
// the volume, so small groups stay visible next to leg days. `before` is null for Lifetime,
// which has nothing before it: then only the fill and the totals show.
const S = 340;
const C = S / 2;
const R = 118;

export default function BalanceRadar({ now, before, beforeLabel, unit, selected, onSelect }) {
  const n = MUSCLE_GROUPS.length;
  const max = Math.max(1, ...MUSCLE_GROUPS.map((g) => Math.max(now[g.key] || 0, before ? before[g.key] || 0 : 0)));
  const pt = (i, f) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f]; };
  const poly = (v) => MUSCLE_GROUPS.map((g, i) => pt(i, Math.sqrt((v[g.key] || 0) / max)).map((x) => x.toFixed(1)).join(',')).join(' ');
  const missing = MUSCLE_GROUPS.filter((g) => !now[g.key]);
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...label, marginBottom: 8 }}>Balance</div>
      <svg viewBox={`-34 -6 ${S + 68} ${S + 12}`} role="img" aria-label="Volume per muscle group" style={{ width: '100%', maxWidth: 400, height: 'auto', display: 'block', margin: '0 auto' }}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={MUSCLE_GROUPS.map((_, i) => pt(i, f).join(',')).join(' ')} fill="none" stroke={COLORS.hairline} />
        ))}
        {MUSCLE_GROUPS.map((g, i) => {
          const [x, y] = pt(i, 1);
          const [lx, ly] = pt(i, 1.16);
          const on = selected === g.key;
          return (
            <g key={g.key} onClick={() => onSelect(g.key)} style={{ cursor: 'pointer' }}>
              <line x1={C} y1={C} x2={x} y2={y} stroke={COLORS.hairline} />
              <text x={lx} y={ly + 4} fontSize={on ? 13 : 11} fontWeight={on ? 700 : 600} textAnchor="middle" fill={g.color} textDecoration={on ? 'underline' : 'none'}>{g.label}</text>
            </g>
          );
        })}
        {before ? <polygon points={poly(before)} fill="none" stroke={COLORS.muted} strokeWidth={1.5} strokeDasharray="4 3" /> : null}
        <polygon points={poly(now)} fill={COLORS.accent} fillOpacity={0.2} stroke={COLORS.accent} strokeWidth={2} strokeLinejoin="round" />
      </svg>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', marginTop: 4, ...muted }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 3, background: COLORS.accent, borderRadius: 2 }} />This range</span>
        {before ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, borderTop: `2px dashed ${COLORS.muted}` }} />Before: {beforeLabel}</span> : <span>Lifetime has no earlier range to compare</span>}
      </div>
      <div style={{ marginTop: 10, fontSize: 13 }}>
        {missing.length ? <><strong>Not trained in this range:</strong> {missing.map((g) => g.label).join(', ')}</> : <strong>Every group got work in this range.</strong>}
      </div>
      {before ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '2px 16px', marginTop: 8 }}>
          {MUSCLE_GROUPS.map((g) => {
            const d = (now[g.key] || 0) - (before[g.key] || 0);
            return (
              <div key={g.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                <span style={{ color: COLORS.muted }}>{g.label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: Math.abs(d) < 0.5 ? COLORS.muted : d > 0 ? COLORS.done : COLORS.danger }}>
                  {Math.abs(d) < 0.5 ? 'same' : `${d > 0 ? '+' : '-'}${fmtVolume(Math.abs(d), unit)} ${unit}`}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
