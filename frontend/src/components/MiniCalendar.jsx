import React from 'react';
import { getDate, isSameDay, isSameMonth, startOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { dateToISO, isoToDate, monthGrid } from '../utils/dayInfo';
import { COLORS } from '../styles';

const cellSize = 22;

function MonthGrid({ monthDate, todayDate, compact = false, section = 'agenda', marks = null }) {
  const monthStart = startOfMonth(monthDate);
  const rows = monthGrid(monthDate, { minRows: 5 }).map((week) => week.map((d) => ({
    date: d,
    inMonth: isSameMonth(d, monthStart),
    isToday: isSameDay(d, todayDate),
    iso: dateToISO(d),
    day: getDate(d),
    marked: !!(marks && marks.has(dateToISO(d))),
  })));

  const labelStyle = {
    fontSize: compact ? 9 : 10,
    color: COLORS.faint,
    fontWeight: 600,
    textAlign: 'center',
    width: compact ? cellSize - 6 : cellSize,
    padding: '2px 0',
    letterSpacing: 0.5,
  };
  const cellStyle = (c) => ({
    width: compact ? cellSize - 6 : cellSize,
    height: compact ? cellSize - 6 : cellSize,
    fontSize: compact ? 10 : 12,
    fontVariantNumeric: 'tabular-nums',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: c.inMonth ? COLORS.ink : COLORS.faint,
    fontWeight: c.isToday ? 700 : (c.inMonth ? 500 : 400),
    background: c.isToday ? COLORS.accent : 'transparent',
    borderRadius: '50%',
  });

  return (
    <table style={{ borderCollapse: 'collapse', margin: 0 }}>
      <thead>
        <tr>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <th key={i} style={labelStyle}>{d}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri}>
            {row.map((c, ci) => (
              <td key={ci} style={{ padding: 0, textAlign: 'center' }}>
                <Link
                  to={`/${section}/${c.iso}`}
                  title={c.marked ? 'Workout logged' : undefined}
                  style={{ ...cellStyle(c), position: 'relative', textDecoration: 'none', color: c.isToday ? 'white' : cellStyle(c).color }}
                >
                  {c.day}
                  {c.marked ? (
                    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" style={{ position: 'absolute', top: -2, right: -2 }}>
                      <circle cx="5" cy="5" r="5" fill={COLORS.done} />
                      <path d="M2.8 5.2 L4.3 6.7 L7.3 3.5" fill="none" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : null}
                </Link>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// `section` is the route the day links open; `marks` is a Set of ISO dates that
// get a small green check (the Workout tab uses it for days with a session).
export default function MiniCalendar({ dateISO, section = 'agenda', marks = null }) {
  const today = isoToDate(dateISO);
  return <MonthGrid monthDate={today} todayDate={today} section={section} marks={marks} />;
}
