import React from 'react';
import WorkoutCard from './WorkoutCard';
import { tableWrap, table, th, headRow, td, tdNum } from './WorkoutTile';
import { shiftISO } from '../shared/dayInfo';
import { num, secondsToHm } from '../shared/format';
import { COLORS, pill } from '../shared/styles';
import { toUnit } from './strength';

// The Log view: workouts per bucket over the range, then one row per day (types joined,
// durations and counts added up, empty columns hidden, the shown day tinted).
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
// Every date on this tab reads 'Mon, Sep 8, 2026'.
const shortDate = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '-');
// A session the phone reported through Apple Health and the Mac snapshot does not have yet.
const kindLabel = (s) => (s.via === 'health' ? 'Home (phone)' : s.kind === 'gym' ? 'Gym' : 'Home');

// Workouts per bucket over the range: by day up to 31 days, then week / month / quarter.
function RangeBars({ sessions, startISO, endISO }) {
  // Bucket size follows the span so there are never more than about 53 bars,
  // which keeps the count printed over each bar from touching its neighbours.
  const totalDays = daysBetween(startISO, endISO) + 1;
  const unit = totalDays <= 31 ? 'day' : totalDays <= 366 ? 'week' : totalDays <= 4 * 366 ? 'month' : 'quarter';
  const monthKey = (iso) => iso.slice(0, 7);
  const quarterKey = (iso) => `${iso.slice(0, 4)}-Q${Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1}`;
  const keys = [];
  if (unit === 'day') {
    for (let d = 0; d < totalDays; d++) keys.push(shiftISO(startISO, d));
  } else if (unit === 'week') {
    for (let w = Math.ceil(totalDays / 7) - 1; w >= 0; w--) keys.push(String(w));
  } else {
    const step = unit === 'month' ? 1 : 3;
    const keyOf = unit === 'month' ? monthKey : quarterKey;
    const cur = new Date(`${startISO.slice(0, 7)}-01T12:00:00`);
    if (unit === 'quarter') cur.setMonth(Math.floor(cur.getMonth() / 3) * 3);
    const endKey = keyOf(endISO);
    while (keys.length < 400) {
      const k = keyOf(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-01`);
      keys.push(k);
      if (k === endKey) break;
      cur.setMonth(cur.getMonth() + step);
    }
  }
  const counts = new Map(keys.map((k) => [k, 0]));
  const end = Date.parse(`${endISO}T12:00:00`);
  for (const sess of sessions) {
    if (sess.date < startISO || sess.date > endISO) continue;
    const k = unit === 'day' ? sess.date
      : unit === 'week' ? String(Math.floor((end - Date.parse(`${sess.date}T12:00:00`)) / (7 * 86400000)))
      : unit === 'month' ? monthKey(sess.date) : quarterKey(sess.date);
    if (counts.has(k)) counts.set(k, counts.get(k) + 1);
  }
  const values = keys.map((k) => counts.get(k));
  const max = Math.max(1, ...values);
  const H = 40;
  const monthLabel = (ym) => new Date(`${ym}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const edgeLabel = (k, iso) => {
    if (unit === 'day' || unit === 'week') return shortDate(iso);
    if (unit === 'month') return monthLabel(k);
    return monthLabel(`${k.slice(0, 4)}-${String((Number(k.slice(6)) - 1) * 3 + 1).padStart(2, '0')}`);
  };
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${keys.length}, 1fr)`, gap: keys.length > 40 ? 4 : 6, alignItems: 'end', height: H, marginTop: 24 }}>
        {values.map((c, i) => (
          <div key={keys[i]} title={`${c} session${c === 1 ? '' : 's'}`} style={{
            position: 'relative',
            height: c ? Math.max(6, Math.round((c / max) * H)) : 4,
            background: c ? COLORS.accent : COLORS.faint,
            borderRadius: 3,
            opacity: c ? 1 : 0.5,
          }}>
            {c ? <span style={{ position: 'absolute', top: -15, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 600, color: COLORS.accent }}>{c}</span> : null}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLORS.muted, marginTop: 6 }}>
        <span>{edgeLabel(keys[0], startISO)}</span>
        <span>workouts per {unit}</span>
        <span>{edgeLabel(keys[keys.length - 1], endISO)}</span>
      </div>
    </div>
  );
}

export default function LogView({ date, sessions, unit, rangeSub, chartStart, rangeEnd, customValid }) {
  const hasCalories = sessions.some((s) => s.calories);
  const hasExercises = sessions.some((s) => s.exercise_count);
  const hasLifted = sessions.some((s) => s.total_weight_kg);
  const dayRows = [];
  const byDate = new Map();
  for (const s of sessions) {
    let r = byDate.get(s.date);
    if (!r) { r = { date: s.date, focus: [], kinds: [], duration_s: 0, calories: 0, exercise_count: 0, lifted_kg: 0, n: 0 }; byDate.set(s.date, r); dayRows.push(r); }
    const f = s.focus || s.title || 'Workout';
    if (!r.focus.includes(f)) r.focus.push(f);
    const k = kindLabel(s);
    if (!r.kinds.includes(k)) r.kinds.push(k);
    r.duration_s += s.duration_s || 0;
    r.calories += s.calories || 0;
    r.exercise_count += s.exercise_count || 0;
    r.lifted_kg += s.total_weight_kg || 0;
    r.n += 1;
  }
  const aside = `${sessions.length} workout${sessions.length === 1 ? '' : 's'} ${rangeSub}`;
  return (
    <WorkoutCard title="Log" icon="log" sub="Every workout in the range, one row per day" aside={aside}>
      {customValid ? <RangeBars sessions={sessions} startISO={chartStart} endISO={rangeEnd} /> : <div style={{ fontSize: 12, color: COLORS.muted }}>Pick a start date on or before the end date.</div>}
      {dayRows.length ? (
        <div style={{ ...tableWrap, marginTop: 18 }}>
          <table style={table}>
            <thead>
              <tr style={headRow}>
                {['Date', 'Workout', 'Type', 'Duration', ...(hasCalories ? ['Calories'] : []), ...(hasLifted ? [`Lifted (${unit})`] : []), ...(hasExercises ? ['Exercises'] : [])].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {dayRows.map((r) => {
                const mine = r.date === date;
                const cell = (extra) => ({ ...extra, background: mine ? COLORS.calloutBg : undefined });
                return (
                  <tr key={r.date}>
                    <td style={cell(td)}>{shortDate(r.date)}</td>
                    <td style={cell(td)}>{r.focus.join(', ')}{r.n > 1 ? <span style={{ color: COLORS.muted, fontSize: 11, marginLeft: 6 }}>{r.n} workouts</span> : null}</td>
                    <td style={cell(td)}><span style={{ ...pill, color: COLORS.workout, fontSize: 11 }}>{r.kinds.join(', ')}</span></td>
                    <td style={cell(tdNum)}>{secondsToHm(r.duration_s) || '-'}</td>
                    {hasCalories ? <td style={cell(tdNum)}>{r.calories ? num(r.calories) : '-'}</td> : null}
                    {hasLifted ? <td style={cell(tdNum)}>{r.lifted_kg ? num(toUnit(r.lifted_kg, unit)) : '-'}</td> : null}
                    {hasExercises ? <td style={cell(tdNum)}>{r.exercise_count || '-'}</td> : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <div style={{ marginTop: 14, fontSize: 13, color: COLORS.muted }}>No workouts in this range.</div>}
    </WorkoutCard>
  );
}
