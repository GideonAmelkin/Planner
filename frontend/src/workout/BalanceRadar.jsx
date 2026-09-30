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

// `mini` is the Overview tile: no text labels (a coloured dot ends each spoke, the name on hover), sized
// to sit beside the Volume and Balance tiles.
export default function BalanceRadar({ now, before, selected, onSelect, mini = false }) {
  const n = MUSCLE_GROUPS.length;
  const max = Math.max(1, ...MUSCLE_GROUPS.map((g) => Math.max(now[g.key] || 0, before ? before[g.key] || 0 : 0)));
  const pt = (i, f) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; return [C + Math.cos(a) * R * f, C + Math.sin(a) * R * f]; };
  const poly = (v) => MUSCLE_GROUPS.map((g, i) => pt(i, Math.sqrt((v[g.key] || 0) / max)).map((x) => x.toFixed(1)).join(',')).join(' ');
  return (
    <div style={{ minWidth: 0 }}>
      <svg viewBox={mini ? `-30 -30 ${S + 60} ${S + 60}` : `-52 -14 ${S + 104} ${S + 28}`} role="img" aria-label="Volume per muscle group" style={mini ? { width: '100%', maxWidth: 96, height: 'auto', display: 'block', margin: '0 auto' } : { width: '100%', maxWidth: 360, height: 'auto', display: 'block', margin: '0 auto' }}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={MUSCLE_GROUPS.map((_, i) => pt(i, f).join(',')).join(' ')} fill="none" stroke="rgba(30,50,110,.1)" strokeWidth={mini ? 3 : 1} />
        ))}
        {MUSCLE_GROUPS.map((g, i) => {
          const [x, y] = pt(i, 1);
          const [lx, ly] = pt(i, 1.16);
          const [dx, dy] = pt(i, 1.08);
          const on = selected === g.key;
          return (
            <g key={g.key} onClick={() => onSelect(g.key)} style={{ cursor: 'pointer' }}>
              <title>{g.label}</title>
              <line x1={C} y1={C} x2={x} y2={y} stroke="rgba(30,50,110,.1)" strokeWidth={mini ? 3 : 1} />
              {mini ? (
                <>
                  <circle cx={dx} cy={dy} r={on ? 26 : 20} fill={g.color} stroke="#FFFFFF" strokeWidth={6} />
                  <circle cx={dx} cy={dy} r={40} fill="transparent" />
                </>
              ) : <text x={lx} y={ly + 4} fontSize={on ? 19 : 17} fontWeight={on ? 700 : 600} textAnchor="middle" fill={g.color} textDecoration={on ? 'underline' : 'none'}>{g.label}</text>}
            </g>
          );
        })}
        {before ? <polygon points={poly(before)} fill="none" stroke={COLORS.muted} strokeWidth={mini ? 5 : 1.5} strokeDasharray={mini ? '12 9' : '4 3'} pointerEvents="none" /> : null}
        <polygon points={poly(now)} fill={W.blue} fillOpacity={0.2} stroke={W.blue} strokeWidth={mini ? 6 : 2} strokeLinejoin="round" pointerEvents="none" />
      </svg>
    </div>
  );
}
