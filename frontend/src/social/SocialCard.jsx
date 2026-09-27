import React from 'react';
import { COLORS, card, pill, sectionDot, sectionHeader } from '../shared/styles';

// One card on the Social tab, in the Agenda's card look: dotted title, optional aside
// pill and controls on the right. A copy of the Workout tab's card (tabs do not import
// each other).
export default function SocialCard({ title, dot = COLORS.social, children, aside = null, actions = null, empty = false, emptyText = 'Nothing here yet.' }) {
  return (
    <div style={{ ...card, minWidth: 0 }}>
      <div style={{ ...sectionHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          <span style={sectionDot(dot)} />
          {title}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {aside ? <span style={{ ...pill, whiteSpace: 'normal' }}>{aside}</span> : null}
          {actions}
        </span>
      </div>
      {empty ? <div style={{ color: COLORS.muted, fontSize: 13 }}>{emptyText}</div> : children}
    </div>
  );
}
