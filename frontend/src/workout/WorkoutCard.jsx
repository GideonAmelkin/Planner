import React from 'react';
import { COLORS, pill, sectionDot, sectionHeader } from '../shared/styles';
import { glassCard, W } from './theme';

// One card in the Workout App grid, in the tab's frosted look (theme.js): dotted title,
// optional aside as a pill. `span` lets a card take the full row.
// `aside` is a pill on the right; `actions` are controls rendered next to it.
// `collapsible` turns the title into a toggle with the tab's ▾ / ▸ chevron and hides the body
// while `open` is false; the caller owns `open` (and may persist it). Other cards are unchanged.
export default function WorkoutCard({ title, dot = COLORS.workout, children, span = 1, aside = null, actions = null, empty = false, emptyText = 'Nothing on this day.', collapsible = false, open = true, onToggle = null }) {
  const shown = !collapsible || open;
  const titleRow = (
    <span style={{ display: 'flex', alignItems: 'center' }}>
      <span style={sectionDot(dot)} />
      {title}
      {collapsible ? <span style={{ color: COLORS.accent, marginLeft: 8, fontSize: 12 }} aria-hidden="true">{open ? '▾' : '▸'}</span> : null}
    </span>
  );
  return (
    <div style={{
      ...glassCard,
      gridColumn: span > 1 ? '1 / -1' : 'auto',
      minWidth: 0,
    }}>
      <div style={{ ...sectionHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: shown ? sectionHeader.padding : 0 }}>
        {collapsible ? (
          <button type="button" onClick={onToggle} aria-expanded={open} style={{ ...sectionHeader, padding: 0, display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: COLORS.ink, font: 'inherit', fontWeight: 600 }}>
            {titleRow}
          </button>
        ) : titleRow}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: 0 }}>
          {aside ? <span style={{ ...pill, background: W.chip }}>{aside}</span> : null}
          {actions}
        </span>
      </div>
      {shown ? (empty ? <div style={{ color: COLORS.muted, fontSize: 13 }}>{emptyText}</div> : children) : null}
    </div>
  );
}
