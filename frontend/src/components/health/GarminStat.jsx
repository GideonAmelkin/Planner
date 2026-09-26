import React from 'react';
import { headline, headlineUnit, statValue, statLabel, statRow } from '../../garminTheme';

const show = (v) => (v === null || v === undefined || v === '' ? '--' : v);

// 48px thin number with a small unit or caption beside it ("67 /100", "57 bpm").
export function Headline({ value, unit = '', caption = null, size = 48 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', minWidth: 0 }}>
      <span style={{ ...headline, fontSize: size }}>{show(value)}{unit && show(value) !== '--' ? <span style={{ fontSize: Math.round(size * 0.55), fontWeight: 300, marginLeft: 4 }}>{unit}</span> : null}</span>
      {caption ? <span style={headlineUnit}>{caption}</span> : null}
    </div>
  );
}

// 18px thin value over a 12px gray label.
export function Stat({ label, value, unit = '' }) {
  const v = show(value);
  return (
    <div style={{ minWidth: 0 }}>
      <div style={statValue}>{v}{unit && v !== '--' ? <span style={{ fontSize: 13, marginLeft: 3 }}>{unit}</span> : null}</div>
      <div style={statLabel}>{label}</div>
    </div>
  );
}

// Headline on the left, stats on the right, wrapping on narrow screens.
export function HeadlineRow({ headline: head, stats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) minmax(0, 2fr)', gap: '8px 20px', alignItems: 'center' }}>
      <div>{head}</div>
      <div style={statRow}>{stats}</div>
    </div>
  );
}
