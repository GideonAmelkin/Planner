import React from 'react';
import { CHART } from './palette';

// A thick open ring: `value` over `goal` fills clockwise from the top, or explicit
// `segments` [{value, color}] share the ring in proportion. Whatever goes in the middle
// is passed as children. A copy of the Garmin tab's RingGauge with the colors as props.
export default function RingGauge({ value, goal, color = CHART.blue, segments = null, size = 120, stroke = 10, track = CHART.track, children, style }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const parts = segments
    ? (() => { const total = segments.reduce((n, s) => n + (s.value || 0), 0) || 1; let acc = 0; return segments.map((s) => { const len = (s.value || 0) / total * c; const el = { color: s.color, len, off: acc }; acc += len; return el; }); })()
    : [{ color, len: goal ? Math.min(1, Math.max(0, value || 0) / goal) * c : 0, off: 0 }];
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, ...style }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', display: 'block' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {parts.map((p, i) => (p.len > 0 ? (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={stroke} strokeDasharray={`${p.len} ${c - p.len}`} strokeDashoffset={-p.off} strokeLinecap="butt" />
        ) : null))}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.1 }}>
        {children}
      </div>
    </div>
  );
}
