import React from 'react';
import { MUSCLE_GROUPS, groupOf } from './muscles';
import { fmtVolume, label } from './ptParts';
import { COLORS } from '../shared/styles';

// Front and back silhouettes, each muscle group shaded by its share of the range's volume
// (darker = more). The numbers live in MuscleChart under both figures. Clicking a region selects
// that group (the radar, the chart and the ticker follow); clicking it again clears.
const REGIONS = {
  front: [
    ['shoulders', [['e', 58, 72, 14, 12], ['e', 142, 72, 14, 12]]],
    ['chest', [['e', 84, 92, 19, 15], ['e', 116, 92, 19, 15]]],
    ['arms', [['e', 49, 112, 9, 22], ['e', 151, 112, 9, 22]]],
    ['core', [['r', 87, 110, 26, 62, 8]]],
    ['quads', [['e', 83, 244, 14, 44], ['e', 117, 244, 14, 44]]],
  ],
  back: [
    ['shoulders', [['e', 58, 72, 14, 12], ['e', 142, 72, 14, 12]]],
    ['back', [['p', 'M72 66 L128 66 L124 158 L100 170 L76 158 Z']]],
    ['arms', [['e', 49, 108, 9, 22], ['e', 151, 108, 9, 22]]],
    ['glutes', [['e', 85, 200, 16, 15], ['e', 115, 200, 16, 15]]],
    ['hamstrings', [['e', 83, 256, 13, 36], ['e', 117, 256, 13, 36]]],
    ['calves', [['e', 83, 330, 11, 26], ['e', 117, 330, 11, 26]]],
  ],
};

function Figure({ side, volumes, max, selected, onSelect, unit }) {
  const shape = (s, i) => (s[0] === 'e' ? <ellipse key={i} cx={s[1]} cy={s[2]} rx={s[3]} ry={s[4]} />
    : s[0] === 'r' ? <rect key={i} x={s[1]} y={s[2]} width={s[3]} height={s[4]} rx={s[5]} /> : <path key={i} d={s[1]} />);
  return (
    <svg viewBox="0 0 200 400" role="img" aria-label={`Muscles trained, ${side}`} style={{ width: '100%', maxWidth: 170, maxHeight: 340, height: 'auto', display: 'block' }}>
      <g fill={COLORS.hairline}>
        <circle cx="100" cy="28" r="18" />
        <rect x="92" y="44" width="16" height="14" rx="4" />
        <rect x="62" y="58" width="76" height="136" rx="22" />
        <rect x="38" y="62" width="22" height="84" rx="11" />
        <rect x="140" y="62" width="22" height="84" rx="11" />
        <rect x="34" y="140" width="20" height="62" rx="10" />
        <rect x="146" y="140" width="20" height="62" rx="10" />
        <rect x="68" y="186" width="30" height="196" rx="14" />
        <rect x="102" y="186" width="30" height="196" rx="14" />
      </g>
      {REGIONS[side].map(([key, shapes]) => {
        const v = volumes[key] || 0;
        const g = groupOf(key);
        return (
          <g key={key} onClick={() => onSelect(key)} style={{ cursor: 'pointer' }}
            fill={v ? g.color : COLORS.faint} fillOpacity={v ? (0.35 + (0.65 * v) / max).toFixed(2) : 0.45}
            stroke={selected === key ? COLORS.ink : COLORS.paper} strokeWidth={selected === key ? 2.5 : 1.5}>
            <title>{`${g.label}: ${v ? `${fmtVolume(v, unit)} ${unit}` : 'not trained'}`}</title>
            {shapes.map(shape)}
          </g>
        );
      })}
      <text x="100" y="396" textAnchor="middle" fontSize="11" fill={COLORS.muted}>{side === 'front' ? 'Front' : 'Back'}</text>
    </svg>
  );
}

export default function BodyMap({ volumes, unit, selected, onSelect }) {
  const max = Math.max(1, ...MUSCLE_GROUPS.map((g) => volumes[g.key] || 0));
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...label, marginBottom: 8 }}>Muscles worked</div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <Figure side="front" volumes={volumes} max={max} selected={selected} onSelect={onSelect} unit={unit} />
        <Figure side="back" volumes={volumes} max={max} selected={selected} onSelect={onSelect} unit={unit} />
      </div>
    </div>
  );
}
