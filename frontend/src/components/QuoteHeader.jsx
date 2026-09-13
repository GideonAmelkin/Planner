import React from 'react';
import { dayInfo, ordinal } from '../utils/dayInfo';
import { COLORS } from '../styles';

export default function QuoteHeader({ dateISO, quote }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 24,
      alignItems: 'flex-start',
      padding: '4px 4px',
    }}>
      <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif", fontStyle: 'normal', fontSize: 14, lineHeight: 1.4, color: COLORS.ink }}>
        {quote ? (
          <>
            <div>{quote.text}</div>
            <div style={{ marginTop: 6, fontStyle: 'normal', fontSize: 14, color: COLORS.ink }}>
              — {quote.author || 'Unknown'}
            </div>
          </>
        ) : (
          <span style={{ color: COLORS.accent }}>Loading quote…</span>
        )}
      </div>
      <DayInfoBadge dateISO={dateISO} />
    </div>
  );
}

export function DayInfoBadge({ dateISO }) {
  const info = dayInfo(dateISO);
  return (
    <div style={{
      display: 'flex',
      gap: 14,
      fontSize: 12,
      color: COLORS.muted,
      fontVariantNumeric: 'tabular-nums',
      letterSpacing: 0.4,
      whiteSpace: 'nowrap',
    }}>
      <span>{ordinal(info.dayOfYear)} Day</span>
      <span>{info.daysLeft} Left</span>
      <span>Week {info.week}</span>
    </div>
  );
}
