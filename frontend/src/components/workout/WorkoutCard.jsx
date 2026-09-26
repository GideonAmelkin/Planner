import React from 'react';
import { COLORS, card, pill, sectionDot, sectionHeader } from '../../styles';

// One card in the Workout App grid, in the Agenda's card look: dotted title,
// optional aside as a pill. `span` lets a card take the full row.
// `aside` is a pill on the right; `actions` are controls rendered next to it.
export default function WorkoutCard({ title, dot = COLORS.workout, children, span = 1, aside = null, actions = null, empty = false, emptyText = 'Nothing on this day.' }) {
  return (
    <div style={{
      ...card,
      gridColumn: span > 1 ? '1 / -1' : 'auto',
      minWidth: 0,
    }}>
      <div style={{ ...sectionHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <span style={sectionDot(dot)} />
          {title}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {aside ? <span style={pill}>{aside}</span> : null}
          {actions}
        </span>
      </div>
      {empty ? <div style={{ color: COLORS.muted, fontSize: 13 }}>{emptyText}</div> : children}
    </div>
  );
}
