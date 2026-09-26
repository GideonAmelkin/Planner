import React, { useState } from 'react';
import GarminIcon from './GarminIcon';
import { G, card, cardHeader, cardTitle, cardBody, cardFooter, footerLink } from '../../garminTheme';

// A connect.garmin.com daily-summary card: icon + tracked uppercase title, a body,
// and a footer link. `details` (a node) is collapsed behind "VIEW DETAILS"; `href`
// makes the footer an external "VIEW ON GARMIN" link instead.
export default function GarminCard({ icon, title, aside = null, children, details = null, href = null, detailsLabel = 'View details', style }) {
  const [open, setOpen] = useState(false);
  return (
    <section style={{ ...card, ...style }}>
      <div style={cardHeader}>
        <div style={cardTitle}>
          {icon ? <GarminIcon name={icon} /> : null}
          <span>{title}</span>
        </div>
        {aside ? <span style={{ fontSize: 12, color: G.muted }}>{aside}</span> : <GarminIcon name="chart" color={G.muted} size={14} />}
      </div>
      <div style={cardBody}>{children}</div>
      {open && details ? <div style={{ padding: '0 16px 16px' }}>{details}</div> : null}
      {details || href ? (
        <div style={cardFooter}>
          {href ? (
            <a href={href} target="_blank" rel="noreferrer" style={footerLink}>View on Garmin <span aria-hidden="true">›</span></a>
          ) : (
            <button type="button" onClick={() => setOpen((o) => !o)} style={footerLink}>
              {detailsLabel} <span aria-hidden="true" style={{ fontSize: 12 }}>{open ? '⌃' : '⌄'}</span>
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
