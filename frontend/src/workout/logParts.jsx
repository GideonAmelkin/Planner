import React from 'react';
import { tableWrap, table, th, headRow, td, tdNum } from './WorkoutTile';
import { shiftISO } from '../shared/dayInfo';
import { num, secondsToHm } from '../shared/format';
import { COLORS } from '../shared/styles';
import { W, hatch } from './theme';
import { Chip, figureLabel } from './ui';
import { toUnit } from './strength';

// The workout log's pieces (the Log section until 2026-10-03, now inside the Personal Trainer card, the
// user's pick of five layouts): RangeBars, workouts per bucket over the range, and DayTable, one row per
// day (types joined, durations and counts added up, empty columns hidden, the shown day tinted). Both
// count every workout, gym and home.
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
// Every date on this tab reads 'Mon, Sep 8, 2026'.
const shortDate = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '-');
// A session the phone reported through Apple Health and the Mac snapshot does not have yet.
const kindLabel = (s) => (s.via === 'health' ? 'Home (phone)' : s.kind === 'gym' ? 'Gym' : 'Home');

// Workouts per bucket over the range: by day up to 31 days, then week / month / quarter.
// `fill`: the chart takes its parent's height (the Trainer's stretched panel): the caption becomes the title
// at the top, the bars grow from a 110 px minimum and the date ticks sit at the foot.
export function RangeBars({ sessions, startISO, endISO, fill = false }) {
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
  const peak = values.indexOf(Math.max(...values));
  const H = 110;
  const monthLabel = (ym) => new Date(`${ym}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const labelOf = (k, i) => {
    if (unit === 'day') return new Date(`${k}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (unit === 'week') return new Date(`${shiftISO(endISO, -7 * Number(k))}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (unit === 'month') return monthLabel(k);
    return monthLabel(`${k.slice(0, 4)}-${String((Number(k.slice(6)) - 1) * 3 + 1).padStart(2, '0')}`);
  };
  // At most five labels, evenly, always including the last bucket.
  const every = Math.max(1, Math.ceil(keys.length / 5));
  const gap = keys.length > 40 ? 2 : keys.length > 20 ? 3 : 6;
  return (
    <div style={fill ? { height: '100%', display: 'flex', flexDirection: 'column' } : undefined}>
      {fill ? <div style={figureLabel}>Workouts per {unit}</div> : null}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap, marginTop: 30, ...(fill ? { flex: 1, minHeight: H } : { height: H }) }}>
        {values.map((c, i) => {
          const isPeak = c > 0 && i === peak;
          return (
            <div key={keys[i]} title={`${labelOf(keys[i], i)}: ${c} workout${c === 1 ? '' : 's'}`} style={{
              flex: 1, minWidth: 0, position: 'relative', height: c ? `${Math.max(8, (c / max) * 100)}%` : 4,
              borderRadius: c ? '8px 8px 4px 4px' : 999, background: isPeak ? hatch('#6D93FA') : c ? W.blueSoft : '#EEF2FA',
            }}>
              {isPeak ? (
                <>
                  <span style={{ position: 'absolute', top: -4, left: '50%', width: 8, height: 8, marginLeft: -4, borderRadius: '50%', background: W.blue, border: '2px solid #FFFFFF' }} />
                  <span style={{ position: 'absolute', top: -30, left: '50%', transform: 'translateX(-50%)', background: COLORS.ink, color: '#FFFFFF', fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{c} workout{c === 1 ? '' : 's'}</span>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap, marginTop: 6 }}>
        {keys.map((k, i) => (
          <span key={k} style={{ flex: 1, minWidth: 0, fontSize: 10, color: COLORS.muted, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'visible' }}>
            {(keys.length - 1 - i) % every === 0 ? labelOf(k, i) : ''}
          </span>
        ))}
      </div>
      {fill ? null : <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 8 }}>Workouts per {unit}</div>}
    </div>
  );
}

// How many days the range has workouts on (the Workouts dropdown's count).
export const workoutDays = (sessions) => new Set(sessions.map((s) => s.date)).size;

export function DayTable({ date, sessions, unit }) {
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
  return dayRows.length ? (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr style={headRow}>
                {['Date', 'Workout', 'Type', 'Duration', ...(hasCalories ? ['Calories'] : []), ...(hasLifted ? [`Lifted (${unit})`] : []), ...(hasExercises ? ['Exercises'] : [])].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {dayRows.map((r) => {
                const mine = r.date === date;
                const cell = (extra) => ({ ...extra, background: mine ? W.blueWash : undefined });
                return (
                  <tr key={r.date}>
                    <td style={cell(td)}>{shortDate(r.date)}</td>
                    <td style={cell(td)}>{r.focus.join(', ')}{r.n > 1 ? <span style={{ color: COLORS.muted, fontSize: 11, marginLeft: 6 }}>{r.n} workouts</span> : null}</td>
                    <td style={cell(td)}>{r.kinds.map((k) => <Chip key={k} color={k === 'Gym' ? COLORS.workout : W.blue} style={{ marginRight: 4 }}>{k}</Chip>)}</td>
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
      ) : <div style={{ fontSize: 13, color: COLORS.muted }}>No workouts in this range.</div>;
}
