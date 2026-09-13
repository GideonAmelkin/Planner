import React from 'react';
import { COLORS } from '../styles';

// Circular check used by Action Items, Monthly Goals and the Recap list.
// With no onClick it renders as a static indicator.
export default function CheckMark({ done, onClick, size = 20 }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={onClick ? (done ? 'Mark not done' : 'Mark done') : undefined}
      tabIndex={onClick ? 0 : -1}
      style={{
        width: size + 2, height: size + 2,
        border: 'none', background: 'transparent',
        padding: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
        <circle
          cx="10" cy="10" r="9"
          fill={done ? COLORS.done : 'transparent'}
          stroke={done ? COLORS.done : COLORS.accent}
          strokeWidth="1.5"
        />
        <path
          d="M5.6 10.4 L8.6 13.4 L14.4 7.2"
          fill="none"
          stroke={done ? 'white' : COLORS.accent}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={done ? 1 : 0.55}
        />
      </svg>
    </button>
  );
}
