import React from 'react';
import { Link } from 'react-router-dom';
import { format, getDate, isSameDay, isSameMonth, startOfMonth } from 'date-fns';
import { dateToISO, monthGrid } from '../utils/dayInfo';
import { COLORS, uppercaseHeading } from '../styles';

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
    <div style={{ maxWidth: '100%', margin: '0 auto', padding: 0 }}>
      <div style={{ background: COLORS.paper, border: `1px solid ${COLORS.ink}` }}>
        <div style={{ padding: '18px 24px 12px 24px', borderBottom: `1px solid ${COLORS.ink}` }}>
            <div style={uppercaseHeading}>{monthLabel}</div>
          </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: `1px solid ${COLORS.ink}` }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: COLORS.muted, letterSpacing: 0.5 }}>{d}</div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateRows: `repeat(${rows.length}, minmax(110px, auto))` }}>
          {rows.map((week, ri) => (
            <div key={ri} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {week.map((d, ci) => {
                const inMonth = isSameMonth(d, monthStart);
                const isToday = isSameDay(d, today);
                const iso = dateToISO(d);
                return (
                  <Link
                    key={ci}
                    to={`/day/${iso}`}
                    style={{
                      borderTop: ri === 0 ? 'none' : `1px solid ${COLORS.hairline}`,
                      borderLeft: ci === 0 ? 'none' : `1px solid ${COLORS.hairline}`,
                      padding: 8,
                      minHeight: 110,
                      display: 'flex', flexDirection: 'column',
                      background: isToday ? COLORS.todayCell : 'transparent',
                      textDecoration: 'none',
                      color: inMonth ? COLORS.ink : COLORS.faint,
                    }}
                  >
                    <div style={{
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: isToday ? 700 : 500,
                      fontSize: 14,
                      alignSelf: 'flex-end',
                    }}>
                      {getDate(d)}
                    </div>
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
