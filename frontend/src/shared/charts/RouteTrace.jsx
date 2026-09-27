import React from 'react';
import { CHART } from './palette';

// A run's route as one muted stroke: no tiles, no labels. `points` = [[lat, lon], ...].
// Longitude is scaled by cos(latitude) so the shape is not squashed.
export default function RouteTrace({ points, width = 96, height = 72, color = CHART.faint, stroke = 3, style }) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const lat0 = points.reduce((s, p) => s + p[0], 0) / points.length;
  const k = Math.cos((lat0 * Math.PI) / 180);
  const xs = points.map((p) => p[1] * k);
  const ys = points.map((p) => p[0]);
  const minX = Math.min(...xs); const maxX = Math.max(...xs);
  const minY = Math.min(...ys); const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-9; const spanY = maxY - minY || 1e-9;
  const pad = stroke + 1;
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offX = (width - spanX * scale) / 2; const offY = (height - spanY * scale) / 2;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${(offX + (p[1] * k - minX) * scale).toFixed(1)},${(offY + (maxY - p[0]) * scale).toFixed(1)}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', flexShrink: 0, ...style }} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={stroke} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
