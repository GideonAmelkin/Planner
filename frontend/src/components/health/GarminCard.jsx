import React, { useState } from 'react';
import GarminIcon from './GarminIcon';
import { G, card, cardHeader, cardTitle, cardBody, cardFooter, footerLink } from '../../garminTheme';

// A connect.garmin.com daily-summary card: icon + tracked uppercase title, a body,
// and a VIEW DETAILS footer. With `details` (a node) the footer toggles it inline
// (chevron down); otherwise it links out to `href` (chevron right), like Garmin.
export default function GarminCard({ id, icon, title, aside = null, children, details = null, href = null, detailsLabel = 'View details', style }) {
  const [open, setOpen] = useState(false);
  return (
    <section id={id} style={{ ...card, scrollMarginTop: 70, ...style }}>
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
          {details ? (
            <button type="button" onClick={() => setOpen((o) => !o)} style={footerLink}>
              {detailsLabel} <span aria-hidden="true" style={{ fontSize: 12 }}>{open ? '⌃' : '⌄'}</span>
            </button>
          ) : (
            <a href={href} target="_blank" rel="noreferrer" style={footerLink}>{detailsLabel} <span aria-hidden="true">›</span></a>
          )}
        </div>
      ) : null}
    </section>
  );
}
