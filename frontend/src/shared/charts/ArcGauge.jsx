import React from 'react';
import { CHART } from './palette';

// Three-quarter arc (270 degrees, open at the bottom) with colored zone segments and a
// knob at the current value. `zones` = [{from, to, color}] in value units over
// [min, max]; the parts of the range no zone covers are drawn in the track color. Whatever
// goes in the middle is passed as children. Extends the Garmin tab's ArcGauge, which had
// fixed color stops and no knob.
export default function ArcGauge({ value, min, max, zones = [], size = 140, stroke = 9, track = CHART.track, knob = true, children, style }) {
  const cx = 60; const cy = 60; const r = 60 - stroke / 2 - 1;
  const A0 = -135; const A1 = 135;
  const pt = (a) => [cx + r * Math.cos((a - 90) * Math.PI / 180), cy + r * Math.sin((a - 90) * Math.PI / 180)];
  const ang = (v) => A0 + Math.max(0, Math.min(1, (v - min) / (max - min))) * (A1 - A0);
  const arc = (a0, a1, colr, key) => {
    if (a1 - a0 < 0.5) return null;
    const [x0, y0] = pt(a0); const [x1, y1] = pt(a1);
    return <path key={key} d={`M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`} fill="none" stroke={colr} strokeWidth={stroke} strokeLinecap="butt" />;
  };
  const sorted = [...zones].filter((z) => z.to > z.from).sort((a, b) => a.from - b.from);
  const pieces = [];
  let cursor = min;
  sorted.forEach((z, i) => {
    const from = Math.max(min, z.from); const to = Math.min(max, z.to);
    if (from > cursor) pieces.push(arc(ang(cursor), ang(from), track, `gap${i}`));
    pieces.push(arc(ang(from), ang(to), z.color, `z${i}`));
    cursor = Math.max(cursor, to);
  });
  if (cursor < max) pieces.push(arc(ang(cursor), ang(max), track, 'tail'));
  const has = value !== null && value !== undefined && Number.isFinite(value);
  const [kx, ky] = has ? pt(ang(value)) : [0, 0];
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, ...style }}>
      <svg viewBox="0 0 120 120" width={size} height={size} style={{ display: 'block' }} aria-hidden="true">
        {pieces}
        {has && knob ? <circle cx={kx} cy={ky} r={stroke * 0.8} fill="white" stroke={CHART.ink} strokeWidth={2} /> : null}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1 }}>
        {children}
      </div>
    </div>
  );
}
