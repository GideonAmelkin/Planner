import React from 'react';
import { Link } from 'react-router-dom';
import { format, getDate, isSameDay, isSameMonth, startOfMonth } from 'date-fns';
import { dateToISO, monthGrid } from '../shared/dayInfo';
import { COLORS, card, uppercaseHeading } from '../shared/styles';

// Per-day task/appointment markers were intentionally removed (planned to
// rebuild later). When re-adding, restore the `summary` state + `getMonth`
// fetch and read counts per `iso`.

// The "Calendar" section: month grid; clicking a day opens that day's spread.
export default function CalendarSection({ year, month }) {
  const y = Number(year);
  const m = Number(month);

  const monthStart = startOfMonth(new Date(y, m - 1, 1));
  const today = new Date();
  const rows = monthGrid(monthStart, { minRows: 6 });

  const monthLabel = format(monthStart, 'MMMM yyyy');
  const sheet = (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...uppercaseHeading, padding: '0 0 12px' }}>{monthLabel}</div>
      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} style={{ padding: '4px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: COLORS.faint, letterSpacing: 0.6, textTransform: 'uppercase' }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateRows: `repeat(${rows.length}, minmax(96px, auto))`, gap: 4 }}>
          {rows.map((week, ri) => (
            <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {week.map((d, ci) => {
                const inMonth = isSameMonth(d, monthStart);
                const isToday = isSameDay(d, today);
                const iso = dateToISO(d);
                return (
                  <Link
                    key={ci}
                    to={`/agenda/${iso}`}
                    style={{
                      padding: '8px 10px',
                      minHeight: 96,
                      display: 'flex', flexDirection: 'column',
                      background: inMonth ? COLORS.page : 'transparent',
                      borderRadius: 6,
                      textDecoration: 'none',
                      color: inMonth ? COLORS.ink : COLORS.faint,
                    }}
                  >
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, margin: '-4px 0 0 -6px', borderRadius: '50%',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: isToday ? 700 : 500,
                      fontSize: 14,
                      background: isToday ? COLORS.accent : 'transparent',
                      color: isToday ? '#FFFFFF' : 'inherit',
                    }}>
                      {getDate(d)}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return sheet;
}
