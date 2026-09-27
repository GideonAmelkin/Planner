import React from 'react';
import { CHART } from './palette';

// Seven rounded bars with a letter under each. `days` = [{letter, value, current,
// hollow}]: a hollow day (no final data yet) draws an outline instead of a fill.
export default function WeekBars({ days, color = CHART.blue, height = 120, style }) {
  const nums = days.map((d) => (typeof d.value === 'number' ? d.value : 0));
  const top = Math.max(...nums, 0) || 1;
  return (
    <div style={{ ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height }}>
        {days.map((d, i) => {
          const h = Math.max(typeof d.value === 'number' && d.value > 0 ? (d.value / top) * height : 0, 0);
          return (
            <div key={i} style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: '100%' }}>
              <div title={d.title || ''} style={{ width: '100%', height: Math.max(h, d.hollow ? 6 : 3), borderRadius: 8, background: d.hollow ? 'transparent' : h > 0 ? color : CHART.track, border: d.hollow ? `2px dashed ${CHART.faint}` : 'none', boxSizing: 'border-box' }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        {days.map((d, i) => <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: 13, color: d.current ? CHART.ink : CHART.muted, fontWeight: d.current ? 700 : 500 }}>{d.letter}</span>)}
      </div>
    </div>
  );
}
