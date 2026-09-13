import React from 'react';
import { Link } from 'react-router-dom';
import {
  addDays, endOfMonth, format, getDate, isSameDay, isSameMonth,
  startOfMonth, startOfWeek,
} from 'date-fns';
import { dateToISO } from '../utils/dayInfo';

// Per-day task/appointment markers were intentionally removed (planned to
// rebuild later). When re-adding, restore the `summary` state + `getMonth`
// fetch and read counts per `iso`.

export default function MonthlyCalendar({ year, month }) {
  const y = Number(year);
  const m = Number(month);

  const monthStart = startOfMonth(new Date(y, m - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const today = new Date();

  const rows = [];
  let cursor = gridStart;
  while (cursor <= monthEnd || rows.length < 6) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    rows.push(week);
    if (rows.length >= 6) break;
  }

  const monthLabel = format(monthStart, 'MMMM yyyy');
  const sheet = (
    <div style={{ maxWidth: '100%', margin: '0 auto', padding: 0 }}>
      <div style={{ background: '#FBF6E7', border: '1px solid #2D3436' }}>
        <div style={{ padding: '18px 24px 12px 24px', borderBottom: '1px solid #2D3436' }}>
            <div style={{
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: 1,
              paddingTop: 4,
              lineHeight: 1.2,
              textTransform: 'uppercase',
            }}>{monthLabel}</div>
          </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #2D3436' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} style={{ padding: '8px 0', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#6B5B40', letterSpacing: 0.5 }}>{d}</div>
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
                      borderTop: ri === 0 ? 'none' : '1px solid #C9BB9A',
                      borderLeft: ci === 0 ? 'none' : '1px solid #C9BB9A',
                      padding: 8,
                      minHeight: 110,
                      display: 'flex', flexDirection: 'column',
                      background: isToday ? '#F4ECD2' : 'transparent',
                      textDecoration: 'none',
                      color: inMonth ? '#2D3436' : '#B5A88A',
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
