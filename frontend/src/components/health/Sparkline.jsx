import React, { useRef, useState } from 'react';
import { G } from '../../garminTheme';
import { clock } from '../../utils/garminFormat';

const H = 64;
const PAD = 2;

// Single-series line (or bars) over a day. `points` = [[epochMs, value], ...] with
// nulls already dropped; `offset` shifts GMT to local for the hover label.
// Hover shows a crosshair and the value; the title above the chart names the series.
export default function Sparkline({ points, offset = 0, color = G.blue, unit = '', bars = false, min, max, domain, area = true }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  if (!points || points.length === 0) {
    return <div style={{ color: G.muted, fontSize: 12 }}>No readings.</div>;
  }
  const W = 600;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const x0 = domain ? domain[0] : Math.min(...xs);
  const x1 = domain ? domain[1] : Math.max(...xs);
  const yMin = min !== undefined ? min : Math.min(...ys);
  const yMax = max !== undefined ? max : Math.max(...ys);
  const sx = (x) => x1 === x0 ? W / 2 : PAD + ((x - x0) / (x1 - x0)) * (W - 2 * PAD);
  const sy = (y) => yMax === yMin ? H / 2 : H - PAD - ((y - yMin) / (yMax - yMin)) * (H - 2 * PAD);

  const onMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const fx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bestD = Infinity;
    points.forEach((p, i) => { const d = Math.abs(sx(p[0]) - fx); if (d < bestD) { bestD = d; best = i; } });
    setHover(best);
  };

  const path = bars ? null : points.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ');
  const barW = bars ? Math.max(1, ((W - 2 * PAD) / points.length) - 1) : 0;
  const hp = hover !== null ? points[hover] : null;

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: H, display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <line x1={0} x2={W} y1={H - PAD} y2={H - PAD} stroke={G.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {bars ? points.map((p, i) => (
          <rect key={i} x={sx(p[0]) - barW / 2} y={sy(p[1])} width={barW} height={Math.max(0, H - PAD - sy(p[1]))} fill={color} opacity={hover === null || hover === i ? 1 : 0.55} />
        )) : (
          <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        )}
        {hp ? (
          <>
            <line x1={sx(hp[0])} x2={sx(hp[0])} y1={0} y2={H} stroke={G.muted} strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />
            {!bars ? <circle cx={sx(hp[0])} cy={sy(hp[1])} r={4} fill={color} stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" /> : null}
          </>
        ) : null}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: G.muted, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        <span>{clock(x0 + offset)}</span>
        <span>{hp ? `${clock(hp[0] + offset)}  ${Math.round(hp[1])}${unit}` : `${Math.round(yMin)} to ${Math.round(yMax)}${unit}`}</span>
        <span>{clock(x1 + offset)}</span>
      </div>
    </div>
  );
}
