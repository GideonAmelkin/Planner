import React, { useRef, useState } from 'react';
import { CHART } from './palette';

// Single-series line or bars. `points` = [[x, y], ...] with nulls dropped (x is any
// number: epoch ms, or a day index). A copy of the Garmin tab's Sparkline with the
// colors as props, the hover readout optional (`format`), a trailing dot on the last
// point (`dot`), and `height` adjustable. `domain` fixes the x range; `min` / `max` the y.
export default function Sparkline({ points, color = CHART.blue, bars = false, min, max, domain, height = 64, stroke = 2, dot = false, baseline = true, format = null, style }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const H = height;
  const PAD = dot ? 5 : 2;
  if (!points || points.length === 0) return <div style={{ color: CHART.muted, fontSize: 12 }}>No readings.</div>;
  const W = 600;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x0 = domain ? domain[0] : Math.min(...xs);
  const x1 = domain ? domain[1] : Math.max(...xs);
  const yMin = min !== undefined ? min : Math.min(...ys);
  const yMax = max !== undefined ? max : Math.max(...ys);
  const sx = (x) => (x1 === x0 ? W / 2 : PAD + ((x - x0) / (x1 - x0)) * (W - 2 * PAD));
  const sy = (y) => (yMax === yMin ? H / 2 : H - PAD - ((y - yMin) / (yMax - yMin)) * (H - 2 * PAD));
  const onMove = (e) => {
    if (!format || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const fx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0; let bestD = Infinity;
    points.forEach((p, i) => { const d = Math.abs(sx(p[0]) - fx); if (d < bestD) { bestD = d; best = i; } });
    setHover(best);
  };
  const path = bars ? null : points.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ');
  const barW = bars ? Math.max(1, ((W - 2 * PAD) / points.length) - 1) : 0;
  const hp = hover !== null ? points[hover] : null;
  const last = points[points.length - 1];
  return (
    <div style={{ position: 'relative', ...style }}>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block', cursor: format ? 'crosshair' : 'default' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)} aria-hidden="true">
        {baseline ? <line x1={0} x2={W} y1={H - PAD} y2={H - PAD} stroke={CHART.track} strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
        {bars ? points.map((p, i) => (
          <rect key={i} x={sx(p[0]) - barW / 2} y={sy(p[1])} width={barW} height={Math.max(0, H - PAD - sy(p[1]))} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />
        )) : (
          <path d={path} fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        )}
        {dot && !bars ? <circle cx={sx(last[0])} cy={sy(last[1])} r={4} fill={color} vectorEffect="non-scaling-stroke" /> : null}
        {hp ? (
          <>
            <line x1={sx(hp[0])} x2={sx(hp[0])} y1={0} y2={H} stroke={CHART.muted} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
            {!bars ? <circle cx={sx(hp[0])} cy={sy(hp[1])} r={4} fill={color} stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null}
          </>
        ) : null}
      </svg>
      {format ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: CHART.muted, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
          <span>{format(points[0], 'start')}</span>
          <span>{hp ? format(hp, 'hover') : format(null, 'range', { yMin, yMax })}</span>
          <span>{format(last, 'end')}</span>
        </div>
      ) : null}
    </div>
  );
}
