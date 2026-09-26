import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MiniCalendar from './MiniCalendar';
import { DayInfoBadge, QuoteCallout } from './QuoteHeader';
import { headlineLong, shiftISO, todayISO } from '../utils/dayInfo';
import { COLORS, card, navButton } from '../styles';

// The header card across the top of the spread: headline, day controls and
// pills on the left, the quote callout in the middle, the mini calendar right.
export default function DateCard({ dateISO, quote }) {
  const navigate = useNavigate();
  const onPickDate = (e) => {
    if (e.target.value) navigate(`/agenda/${e.target.value}`);
  };
  const arrowStyle = { ...navButton, width: 32, padding: '5px 0', textAlign: 'center', fontSize: 16, lineHeight: 1.2 };

  return (
    <div style={{
      ...card,
      gridColumn: '1 / -1',
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      gap: 24,
      alignItems: 'center',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
        <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: -0.5, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
          {headlineLong(dateISO)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link to={`/agenda/${shiftISO(dateISO, -1)}`} style={arrowStyle} title="Previous day">‹</Link>
          <Link to={`/agenda/${todayISO()}`} style={navButton}>Today</Link>
          <Link to={`/agenda/${shiftISO(dateISO, 1)}`} style={arrowStyle} title="Next day">›</Link>
          <input
            type="date"
            value={dateISO}
            onChange={onPickDate}
            style={{
              background: COLORS.paper,
              color: COLORS.ink,
              border: `1px solid ${COLORS.hairline}`,
              padding: '4px 8px',
              borderRadius: 8,
              fontSize: 13,
              colorScheme: 'light',
            }}
          />
        </div>
        <DayInfoBadge dateISO={dateISO} />
      </div>
      <QuoteCallout quote={quote} />
      <MiniCalendar dateISO={dateISO} />
    </div>
  );
}
