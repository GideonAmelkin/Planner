import React from 'react';
import { MUSCLE_GROUPS } from './muscles';
import { COLORS } from '../shared/styles';
import { W } from './theme';

// Volume per muscle group in the range (filled) against the same-length range right before it
// (dashed outline), so an under-trained group shows as a dent. The radius is the square root of
// the volume, so small groups stay visible next to leg days. `before` is null for Lifetime,
// which has nothing before it: then only the fill shows. Lives in the Overview's right column since
// 2026-09-29 (it was in the Trainer); a label click selects that group for the whole page.
const S = 340;
const C = S / 2;
const R = 118;

export default function BalanceRadar({ now, before, selected, onSelect }) {
  const n = MUSCLE_GROUPS.length;
  const max = Math.max(1, ...MUSCLE_GROUPS.map((g) => Math.max(now[g.key] || 0, before ? before[g.key] || 0 : 0)));
  const pt = (i, f) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f]; };
  const poly = (v) => MUSCLE_GROUPS.map((g, i) => pt(i, Math.sqrt((v[g.key] || 0) / max)).map((x) => x.toFixed(1)).join(',')).join(' ');
  return (
    <div style={{ minWidth: 0 }}>
      <svg viewBox={`-34 -6 ${S + 68} ${S + 12}`} role="img" aria-label="Volume per muscle group" style={{ width: '100%', maxWidth: 360, height: 'auto', display: 'block', margin: '0 auto' }}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={MUSCLE_GROUPS.map((_, i) => pt(i, f).join(',')).join(' ')} fill="none" stroke="rgba(30,50,110,.1)" />
        ))}
        {MUSCLE_GROUPS.map((g, i) => {
          const [x, y] = pt(i, 1);
          const [lx, ly] = pt(i, 1.16);
          const on = selected === g.key;
          return (
            <g key={g.key} onClick={() => onSelect(g.key)} style={{ cursor: 'pointer' }}>
              <line x1={C} y1={C} x2={x} y2={y} stroke="rgba(30,50,110,.1)" />
              <text x={lx} y={ly + 4} fontSize={on ? 13 : 11} fontWeight={on ? 700 : 600} textAnchor="middle" fill={g.color} textDecoration={on ? 'underline' : 'none'}>{g.label}</text>
            </g>
          );
        })}
        {before ? <polygon points={poly(before)} fill="none" stroke={COLORS.muted} strokeWidth={1.5} strokeDasharray="4 3" /> : null}
        <polygon points={poly(now)} fill={W.blue} fillOpacity={0.2} stroke={W.blue} strokeWidth={2} strokeLinejoin="round" />
      </svg>
    </div>
  );
}
