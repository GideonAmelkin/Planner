import React from 'react';
import { CHART } from './palette';

// A two-segment horizontal bar (a over a + b), rounded ends.
export default function SplitBar({ a, b, colorA = CHART.red, colorB = CHART.blue, height = 10, style }) {
  const total = (a || 0) + (b || 0);
  const pct = total ? ((a || 0) / total) * 100 : 0;
  return (
    <div style={{ display: 'flex', height, borderRadius: height / 2, overflow: 'hidden', background: CHART.track, ...style }}>
      <div style={{ width: `${pct}%`, background: colorA }} />
      <div style={{ flex: 1, background: total ? colorB : 'transparent', marginLeft: pct > 0 && pct < 100 ? 2 : 0 }} />
    </div>
  );
}
