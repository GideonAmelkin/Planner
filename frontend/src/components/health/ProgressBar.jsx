import React from 'react';
import { track, fill } from '../../garminTheme';

// The 20px square-cornered bar from the Steps and Intensity Minutes cards.
export default function ProgressBar({ value, goal, color, style }) {
  const pct = goal ? (value / goal) * 100 : 0;
  return (
    <div style={{ ...track, ...style }} role="progressbar" aria-valuenow={value || 0} aria-valuemax={goal || 0}>
      <div style={fill(color, pct)} />
    </div>
  );
}
