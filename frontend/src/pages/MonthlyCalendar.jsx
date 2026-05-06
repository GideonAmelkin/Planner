import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  addDays, endOfMonth, format, getDate, isSameDay, isSameMonth,
  startOfMonth, startOfWeek,
} from 'date-fns';
import { dateToISO, todayISO } from '../utils/dayInfo';
import { getMonth } from '../services/api';
import NavLinks from '../components/NavLinks';

export default function MonthlyCalendar() {
  const { year, month } = useParams();
  const y = Number(year);
  const m = Number(month);
  const [summary, setSummary] = useState({});

  useEffect(() => {
    let alive = true;
    setSummary({});
    getMonth(y, m).then((data) => {
      if (alive) setSummary(data.days || {});
    }).catch(() => {});
    return () => { alive = false; };
  }, [y, m]);

  const monthStart = startOfMonth(new Date(y, m - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const today = new Date();
  const todayIso = todayISO();

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
  const navBtn = {
    border: '1px solid white', color: 'white', background: 'transparent',
    padding: '4px 12px', fontSize: 12, fontWeight: 600, letterSpacing: 0.5, borderRadius: 2,
  };

  const prevMonth = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  const nextMonth = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 };

  return (
    <div>
      <div style={{ background: '#2D3436', color: 'white', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '4px double #C9BB9A' }}>
        <div className="serif" style={{ fontSize: 22, fontWeight: 500, letterSpacing: 1, marginRight: 16 }}>Planner</div>
        <Link to={`/calendar/${prevMonth.y}/${prevMonth.m}`} style={navBtn}>◀ Prev</Link>
        <Link to={`/day/${todayIso}`} style={navBtn}>Today</Link>
        <Link to={`/calendar/${nextMonth.y}/${nextMonth.m}`} style={navBtn}>Next ▶</Link>
        <div style={{ flex: 1 }} />
        <NavLinks dateISO={`${y}-${String(m).padStart(2, '0')}-01`} />
      </div>
      <div style={{ maxWidth: 1200, margin: '24px auto', padding: '0 24px' }}>
        <div className="serif" style={{ textAlign: 'center', fontSize: 26, fontWeight: 500, marginBottom: 12 }}>{monthLabel}</div>
        <div style={{ background: '#FBF6E7', border: '1px solid #2D3436' }}>
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
                  const s = summary[iso] || { tasks: 0, appts: 0 };
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
                      <div style={{ marginTop: 4, display: 'flex', gap: 6, fontSize: 11, color: '#6B5B40' }}>
                        {s.tasks > 0 && <span>● {s.tasks}</span>}
                        {s.appts > 0 && <span>◆ {s.appts}</span>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: '#6B5B40', display: 'flex', gap: 14 }}>
          <span>● tasks</span>
          <span>◆ appointments</span>
        </div>
      </div>
    </div>
  );
}
