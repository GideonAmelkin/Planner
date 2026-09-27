import React from 'react';
import { CHART } from './palette';

// One dot per day, size by magnitude, the current day filled with the accent color,
// days without data as the smallest faint dot. `values` = number | null per day.
export default function DotStrip({ values, currentIndex = values.length - 1, color = CHART.muted, accent = CHART.ink, minSize = 3, maxSize = 12, style }) {
  const nums = values.filter((v) => typeof v === 'number' && v > 0);
  const top = nums.length ? Math.max(...nums) : 0;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: maxSize + 2, ...style }}>
      {values.map((v, i) => {
        const has = typeof v === 'number' && v > 0;
        const size = has && top ? minSize + (v / top) * (maxSize - minSize) : minSize;
        const current = i === currentIndex;
        return <span key={i} style={{ width: current ? Math.max(size, 9) : size, height: current ? Math.max(size, 9) : size, borderRadius: '50%', background: current ? accent : has ? color : CHART.faint, opacity: has || current ? 1 : 0.6, flexShrink: 0 }} />;
      })}
    </div>
  );
}
