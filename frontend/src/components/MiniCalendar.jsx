import React from 'react';
import { getDate, isSameDay, isSameMonth, startOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { dateToISO, isoToDate, monthGrid } from '../utils/dayInfo';
import { COLORS } from '../styles';

const cellSize = 22;

function MonthGrid({ monthDate, todayDate, compact = false }) {
  const monthStart = startOfMonth(monthDate);
  const rows = monthGrid(monthDate, { minRows: 5 }).map((week) => week.map((d) => ({
    date: d,
    inMonth: isSameMonth(d, monthStart),
    isToday: isSameDay(d, todayDate),
    iso: dateToISO(d),
    day: getDate(d),
  })));

  const labelStyle = {
    fontSize: compact ? 9 : 10,
    color: COLORS.muted,
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
    background: c.isToday ? COLORS.ink : 'transparent',
    borderRadius: c.isToday ? '50%' : 0,
    boxShadow: c.isToday ? `inset 0 0 0 1px ${COLORS.ink}` : 'none',
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
                  to={`/day/${c.iso}`}
                  style={{ ...cellStyle(c), textDecoration: 'none', color: c.isToday ? 'white' : cellStyle(c).color }}
                >
                  {c.day}
                </Link>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function MiniCalendar({ dateISO }) {
  const today = isoToDate(dateISO);
  return <MonthGrid monthDate={today} todayDate={today} />;
}
