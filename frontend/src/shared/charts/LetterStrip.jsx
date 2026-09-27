import React from 'react';
import { CHART } from './palette';

// Seven weekday letters; a day that met its goal shows a check in place of the letter,
// the current day is bold, a day with no data is faint. `days` = [{letter, met, current,
// hasData}] in display order.
export default function LetterStrip({ days, checkColor = CHART.goal, style }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, letterSpacing: 1, color: CHART.muted, fontVariantNumeric: 'tabular-nums', ...style }}>
      {days.map((d, i) => (
        <span key={i} title={d.title || ''} style={{ width: 18, textAlign: 'center', fontWeight: d.current ? 700 : 500, color: d.met ? checkColor : d.hasData ? (d.current ? CHART.ink : CHART.muted) : CHART.faint }}>
          {d.met ? '✓' : d.letter}
        </span>
      ))}
    </div>
  );
}
