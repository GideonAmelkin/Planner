import React from 'react';

// Line icons for the Workout tab's top nav, cards and day strip (24px grid, currentColor stroke).
const PATHS = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  dumbbell: 'M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  log: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  home: 'M4 11l8-7 8 7v9H4zM10 20v-6h4v6',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  clock: 'M12 4a8 8 0 1 0 0 16a8 8 0 1 0 0-16M12 8v4l3 2',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8',
  pie: 'M12 4a8 8 0 1 0 8 8h-8zM15 3.5A8 8 0 0 1 20.5 9H15z',
  calendar: 'M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 10h16M9 3v4M15 3v4',
};

export default function Icon({ name, size = 16, style }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'block', flexShrink: 0, ...style }}>
      <path d={PATHS[name]} />
    </svg>
  );
}
