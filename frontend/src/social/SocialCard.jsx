import React from 'react';
import { COLORS, card, pill, sectionDot, sectionHeader } from '../shared/styles';

// One card on the Social tab, in the Agenda's card look: dotted title, optional aside
// pill and controls on the right. A copy of the Workout tab's card (tabs do not import
// each other). `collapsible` turns the title into a chevron toggle; the body hides while `open`
// is false and the header's controls stay; the caller owns `open`.
export default function SocialCard({ title, dot = COLORS.social, children, aside = null, actions = null, empty = false, emptyText = 'Nothing here yet.', collapsible = false, open = true, onToggle = null }) {
  const shown = !collapsible || open;
  return (
    <div style={{ ...card, minWidth: 0 }}>
      <div style={{ ...sectionHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        {collapsible ? (
          <button type="button" onClick={onToggle} aria-expanded={open}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' }}>
            <span style={sectionDot(dot)} />
            {title}
            <span aria-hidden="true" style={{ color: COLORS.muted, fontSize: 12, display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>{'\u25B8'}</span>
          </button>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <span style={sectionDot(dot)} />
            {title}
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {aside ? <span style={{ ...pill, whiteSpace: 'normal' }}>{aside}</span> : null}
          {actions}
        </span>
      </div>
      {!shown ? null : empty ? <div style={{ color: COLORS.muted, fontSize: 13 }}>{emptyText}</div> : children}
    </div>
  );
}
