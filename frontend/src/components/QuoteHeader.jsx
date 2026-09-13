import React from 'react';
import { dayInfo, ordinal } from '../utils/dayInfo';

export default function QuoteHeader({ dateISO, quote }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 24,
      alignItems: 'flex-start',
      padding: '4px 4px',
    }}>
      <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif", fontStyle: 'normal', fontSize: 14, lineHeight: 1.4, color: '#2D3436' }}>
        {quote ? (
          <>
            <div>{quote.text}</div>
            <div style={{ marginTop: 6, fontStyle: 'normal', fontSize: 14, color: '#2D3436' }}>
              — {quote.author || 'Unknown'}
            </div>
          </>
        ) : (
          <span style={{ color: '#A89368' }}>Loading quote…</span>
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
      color: '#6B5B40',
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
