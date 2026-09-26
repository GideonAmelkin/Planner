import React from 'react';
import { dayInfo, ordinal } from '../shared/dayInfo';
import { COLORS, pill } from '../shared/styles';

// The daily quote in an indigo-tinted callout with a large opening quote mark.
export function QuoteCallout({ quote }) {
  return (
    <div style={{
      position: 'relative',
      background: COLORS.calloutBg,
      color: COLORS.calloutText,
      borderRadius: 12,
      padding: '16px 20px 16px 52px',
      minHeight: 72,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignSelf: 'stretch',
    }}>
      <span aria-hidden="true" style={{
        position: 'absolute', left: 16, top: 8,
        fontFamily: "Georgia, 'Times New Roman', serif",
        fontSize: 48, lineHeight: 1, color: COLORS.accent,
      }}>
        {'“'}
      </span>
      {quote ? (
        <>
          <div style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.45 }}>{quote.text}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: COLORS.accent }}>{quote.author || 'Unknown'}</div>
        </>
      ) : (
        <span style={{ color: COLORS.accent }}>Loading quote...</span>
      )}
    </div>
  );
}

// "269th Day  96 Left  Week 39" as three grey pills.
export function DayInfoBadge({ dateISO }) {
  const info = dayInfo(dateISO);
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <span style={pill}>{ordinal(info.dayOfYear)} Day</span>
      <span style={pill}>{info.daysLeft} Left</span>
      <span style={pill}>Week {info.week}</span>
    </div>
  );
}

export default function QuoteHeader({ dateISO, quote }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'flex-start' }}>
      <QuoteCallout quote={quote} />
      <DayInfoBadge dateISO={dateISO} />
    </div>
  );
}
