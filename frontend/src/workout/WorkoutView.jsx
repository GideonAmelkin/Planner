import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { endOfMonth } from 'date-fns';
import AgendaRail from '../shared/AgendaRail';
import MiniCalendar from '../shared/MiniCalendar';
import WorkoutCard from './WorkoutCard';
import WorkoutTile, { tableWrap, table, th, headRow, td, tdNum, tableLink } from './WorkoutTile';
import { API_BASE } from '../shared/api';
import { getWorkoutStatus, getWorkoutRecent, getWorkoutCatalog } from './api';
import { dateToISO, headlineLong, isoToDate, shiftISO, todayISO } from '../shared/dayInfo';
import { num, secondsToHm } from '../shared/format';
import { COLORS, SECTION_DOTS, card, navButton, pill } from '../shared/styles';
import { snapshotAge } from '../shared/snapshotAge';
import { templateBanner, titleLines, APP_BLUE, POPPINS } from './art';

const RANGES = [
  { key: 'd1', label: '1 day', days: 1, sub: 'this day' },
  { key: 'd7', label: '7 days', days: 7, sub: 'last 7 days' },
  { key: 'd30', label: '30 days', days: 30, sub: 'last 30 days' },
  { key: 'd90', label: '90 days', days: 90, sub: 'last 90 days' },
  { key: 'd180', label: '180 days', days: 180, sub: 'last 180 days' },
  { key: 'y365', label: '365 days', days: 365, sub: 'last 365 days' },
  { key: 'lifetime', label: 'Lifetime', days: 3660, sub: 'lifetime' },
  { key: 'custom', label: 'Custom', days: null, sub: 'custom range' },
];
const MAX_RANGE_DAYS = 3660;
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
// Longest run of consecutive calendar days that each have at least one workout.
const longestStreak = (dates) => {
  const days = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return best;
};
// "Wed. Sep 9, 2026" for the Last workout tile.
const tileDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '.');

const MAX_WIDTH = 1500;
// The Workouts (templates) card is a dropdown, closed by default; a missing key reads as closed.
// Stored like the sidebar's plannerNavCollapsed so it survives tab changes and reloads.
const TEMPLATES_OPEN_KEY = 'plannerWorkoutTemplatesOpen';
const readTemplatesOpen = () => { try { return localStorage.getItem(TEMPLATES_OPEN_KEY) === '1'; } catch (_) { return false; } };
const writeTemplatesOpen = (v) => { try { localStorage.setItem(TEMPLATES_OPEN_KEY, v ? '1' : '0'); } catch (_) { /* ignore */ } };
const MONTH_FETCH_DAYS = 45; // covers the mini calendar's six-week grid
const KG_TO_LB = 2.20462;

// The app stores kilograms; the user's app setting says whether to show kg or lb.
const weightUnit = (profile) => (profile && profile.shows_kg ? 'kg' : 'lb');
const toUnit = (kg, unit) => (kg === null || kg === undefined ? null : (unit === 'kg' ? kg : kg * KG_TO_LB));

// Every date on this tab reads 'Mon, Sep 8, 2026'.
const shortDate = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '-');
// A session the phone reported through Apple Health and the Mac snapshot does not have yet.
const kindLabel = (s) => (s.via === 'health' ? 'Home (phone)' : s.kind === 'gym' ? 'Gym' : 'Home');
// Six gym exercises have no name on disk; the exporter keeps the id, say so instead of a bare number.
// Exercise thumbnail: the synced JPEG when there is one, else the clip's own frame at 0.5 s
// (18 clips decode in the browser but not in AVFoundation, so they have no JPEG).
const thumbStyle = { width: 36, height: 36, borderRadius: 6, objectFit: 'cover', verticalAlign: 'middle', marginRight: 10, background: COLORS.page, display: 'inline-block' };
const exerciseName = (e) => (/^\d+$/.test(e.name || '') ? `Exercise ${e.name}` : e.name);

// "8" when every set has the same reps, otherwise the list ("12, 10, 8").
const repsText = (sets) => {
  if (!sets || !sets.length) return '-';
  const reps = sets.map((s) => s.reps || 0);
  return reps.every((r) => r === reps[0]) ? String(reps[0]) : reps.join(', ');
};

// Media the Mac shipped from the app's own cache (see tools/homeworkouts/sync.py).
const mediaUrl = (kind, id) => `${API_BASE}/workout/media/${kind}/${id}`;

const maxSets = (t) => Math.max(0, ...t.exercises.map((e) => (e.sets || []).length));

// Ink-on-paper line of body weight over time; labels carry the unit.
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

export default function WorkoutView() {
  const { date } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [monthRecent, setMonthRecent] = useState(null); // the mini calendar's month
  const [rangeRecent, setRangeRecent] = useState(null); // the Summary range
  const [rangeKey, setRangeKey] = useState('d30');
  const [customFrom, setCustomFrom] = useState(() => shiftISO(date, -29));
  const [customTo, setCustomTo] = useState(date);
  const [catalog, setCatalog] = useState(null);
  const [openTemplate, setOpenTemplate] = useState(null);
  const [templatesOpen, setTemplatesOpen] = useState(readTemplatesOpen);
  const toggleTemplates = () => setTemplatesOpen((o) => { writeTemplatesOpen(!o); if (o) { setOpenTemplate(null); setPlayingExercise(null); } return !o; });
  const [playingExercise, setPlayingExercise] = useState(null);
  const [logOpen, setLogOpen] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const monthEnd = dateToISO(endOfMonth(isoToDate(date)));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, m] = await Promise.all([
        getWorkoutStatus(),
        getWorkoutRecent(monthEnd, MONTH_FETCH_DAYS),
      ]);
      setStatus(s);
      setMonthRecent(m);
      if (!catalog) getWorkoutCatalog().then(setCatalog).catch((err) => setError(err.message || String(err)));
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [date, monthEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // The Summary range: fixed windows end on the shown date; Custom uses its own dates.
  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[2];
  const customValid = rangeKey !== 'custom' || (customFrom && customTo && customFrom <= customTo);
  const rangeEnd = rangeKey === 'custom' ? customTo : date;
  const rangeDays = rangeKey === 'custom'
    ? Math.min(MAX_RANGE_DAYS, Math.max(1, daysBetween(customFrom, customTo) + 1))
    : range.days;
  const rangeStart = shiftISO(rangeEnd, -(rangeDays - 1));

  useEffect(() => {
    if (!customValid) return;
    let alive = true;
    getWorkoutRecent(rangeEnd, rangeDays)
      .then((r) => { if (alive) setRangeRecent(r); })
      .catch((err) => { if (alive) setError(err.message || String(err)); });
    return () => { alive = false; };
  }, [rangeEnd, rangeDays, customValid]);

  const available = status && status.available;
  const profile = (status && status.profile) || {};
  const unit = weightUnit(profile);
  const weights = (monthRecent && monthRecent.weights) || [];
  const counts = (status && status.counts) || {};
  const workoutDays = new Set(((monthRecent && monthRecent.sessions) || []).map((s) => s.date));

  const rangeSessions = ((rangeRecent && rangeRecent.sessions) || []).filter((s) => s.date >= rangeStart && s.date <= rangeEnd);
  const rangeGym = rangeSessions.filter((s) => s.kind === 'gym').length;
  const activeHours = rangeSessions.reduce((t, s) => t + (s.duration_s || 0), 0) / 3600;
  const lastInRange = rangeSessions.length ? rangeSessions[0] : null;
  const rangeStreak = longestStreak(rangeSessions.map((s) => s.date));
  // Lifetime starts the chart at the first workout instead of ten empty years back.
  const chartStart = rangeKey === 'lifetime' && rangeSessions.length ? rangeSessions[rangeSessions.length - 1].date : rangeStart;
  const hasCalories = rangeSessions.some((s) => s.calories);
  const hasExercises = rangeSessions.some((s) => s.exercise_count);
  const hasLifted = rangeSessions.some((s) => s.total_weight_kg);
  const latestWeight = weights.length ? weights[weights.length - 1] : null;
  const currentKg = latestWeight ? latestWeight.kg : profile.current_weight_kg;
  // Weight change over the selected range: last weigh-in minus the first one inside it.
  const rangeWeights = ((rangeRecent && rangeRecent.weights) || []).filter((w) => w.date >= rangeStart && w.date <= rangeEnd && w.kg !== null && w.kg !== undefined);
  const weightDeltaKg = rangeWeights.length >= 2 ? rangeWeights[rangeWeights.length - 1].kg - rangeWeights[0].kg : 0;
  const weightDelta = Math.abs(toUnit(weightDeltaKg, unit)) >= 0.05 ? toUnit(weightDeltaKg, unit) : 0;
  // The log shows one row per day: types joined, durations and counts added up.
  const dayRows = [];
  {
    const byDate = new Map();
    for (const s of rangeSessions) {
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
  }
  const templatesList = (catalog && catalog.templates) || [];

  const arrowStyle = { ...navButton, width: 32, padding: '5px 0', textAlign: 'center', fontSize: 16, lineHeight: 1.2 };
  const controlStyle = { ...navButton, fontSize: 12, padding: '4px 8px', cursor: 'pointer' };
  const dateInputStyle = { background: COLORS.paper, color: COLORS.ink, border: `1px solid ${COLORS.hairline}`, padding: '4px 8px', borderRadius: 8, fontSize: 13, colorScheme: 'light' };

  const rangeControls = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <select value={rangeKey} onChange={(e) => setRangeKey(e.target.value)} style={controlStyle} title="Range">
        {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
      </select>
      {rangeKey === 'custom' ? (
        <>
          <input type="date" value={customFrom} max={customTo} onChange={(e) => e.target.value && setCustomFrom(e.target.value)} style={{ ...dateInputStyle, fontSize: 12, padding: '3px 6px' }} title="From" />
          <span style={{ fontSize: 12, color: COLORS.muted }}>to</span>
          <input type="date" value={customTo} min={customFrom} onChange={(e) => e.target.value && setCustomTo(e.target.value)} style={{ ...dateInputStyle, fontSize: 12, padding: '3px 6px' }} title="To" />
        </>
      ) : null}
    </span>
  );

  const indicator = weightDelta
    ? <span style={{ color: weightDelta > 0 ? COLORS.danger : COLORS.done, fontWeight: 600 }}>{weightDelta > 0 ? '▲' : '▼'} {num(Math.abs(weightDelta), 1)} {unit}</span>
    : null;

  // One header card: date and controls, six tiles with the range picker, the bars and
  // the per-day log on the left; the month calendar (green checks) top right.
  const header = (
    <div style={card}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: -0.5, lineHeight: 1.1, whiteSpace: 'nowrap' }}>
              {headlineLong(date)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Link to={`/workout/${shiftISO(date, -1)}`} style={arrowStyle} title="Previous day">‹</Link>
              <Link to={`/workout/${todayISO()}`} style={navButton}>Today</Link>
              <Link to={`/workout/${shiftISO(date, 1)}`} style={arrowStyle} title="Next day">›</Link>
              <input
                type="date"
                value={date}
                onChange={(e) => { if (e.target.value) navigate(`/workout/${e.target.value}`); }}
                style={dateInputStyle}
              />
            </div>
          </div>
          {status ? (
            // How old the data on this page really is: the snapshot only moves when the
            // Mac app has pulled new history from the phone. Same rule as Settings.
            <div style={{ fontSize: 12, color: snapshotAge(status, date).color, marginTop: 8 }}>{snapshotAge(status, date).text}</div>
          ) : null}
        </div>
        <MiniCalendar dateISO={date} section="workout" marks={workoutDays} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 28, flexWrap: 'wrap', marginTop: 128 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, flexWrap: 'wrap' }}>
          <WorkoutTile label="Height" value={profile.height_cm ? num(profile.height_cm / 2.54) : null} unit="in" />
          <WorkoutTile label="Weight" value={currentKg ? num(toUnit(currentKg, unit), 1) : null} unit={unit} sub={indicator} />
          <WorkoutTile label="Workouts" value={rangeSessions.length} sub={`${rangeGym} gym · ${rangeSessions.length - rangeGym} home`} />
          <WorkoutTile label="Duration" value={rangeSessions.length ? num(activeHours, 1) : null} unit="h" />
          <WorkoutTile label="Longest streak" value={rangeStreak || null} unit={rangeStreak === 1 ? 'day' : 'days'} />
          <WorkoutTile label="Last workout" value={lastInRange ? tileDate(lastInRange.date) : null} size={16} />
        </div>
        {rangeControls}
      </div>
      <div style={{ paddingTop: 16 }}>
        {customValid ? <RangeBars sessions={rangeSessions} startISO={chartStart} endISO={rangeEnd} /> : <div style={{ fontSize: 12, color: COLORS.muted }}>Pick a start date on or before the end date.</div>}
      </div>
      <button
        type="button"
        onClick={() => setLogOpen((o) => !o)}
        style={{ marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: COLORS.page, border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, fontWeight: 600, color: COLORS.ink, cursor: 'pointer' }}
      >
        <span>{rangeSessions.length} workout{rangeSessions.length === 1 ? '' : 's'} {range.sub === 'lifetime' ? 'lifetime' : range.sub}</span>
        <span style={{ color: COLORS.accent }}>{logOpen ? '▾' : '▸'}</span>
      </button>
      {logOpen ? (
        dayRows.length ? (
          <div style={{ ...tableWrap, marginTop: 10 }}>
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
                      {hasCalories ? <td style={cell(tdNum)}>{num(r.calories) || '-'}</td> : null}
                      {hasLifted ? <td style={cell(tdNum)}>{r.lifted_kg ? num(toUnit(r.lifted_kg, unit)) : '-'}</td> : null}
                      {hasExercises ? <td style={cell(tdNum)}>{r.exercise_count || '-'}</td> : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div style={{ marginTop: 10, fontSize: 13, color: COLORS.muted }}>No workouts in this range.</div>
      ) : null}
      {status && !counts.sessions && !(status.health && status.health.count) ? (
        <div style={{ marginTop: 12, fontSize: 12, color: COLORS.muted }}>
          No workouts yet: the phone has not reported and the Mac snapshot is empty. Sync the Home Workouts app on the Mac to pull history.
        </div>
      ) : null}
    </div>
  );

  const shell = (inner) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh' }}>
      <AgendaRail dateISO={date} section="workout" />
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: MAX_WIDTH, margin: '0 auto', padding: '24px 24px 64px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {header}
          {inner}
        </div>
      </main>
    </div>
  );

  if (error) return shell(<div style={{ ...card, color: COLORS.danger }}>Error: {error}</div>);
  if (!status && loading) return shell(<div style={{ ...card, color: COLORS.muted }}>Loading workout data...</div>);

  if (status && !available) {
    return shell(
      <div style={{ ...card, maxWidth: 560, fontSize: 13, lineHeight: 1.6 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>No Home Workouts data on the server yet.</div>
        <div>Two things feed this tab: the phone's Shortcut posts Apple Health workouts as they happen, and the Mac exports the app's data every 6 hours (<code>tools/homeworkouts/sync.py</code>). Neither has arrived. See the Home Workouts section of <code>deploy/README.md</code>.</div>
      </div>
    );
  }

  return shell(
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
      <WorkoutCard title="Workouts" dot={SECTION_DOTS.notes} aside={catalog ? `${templatesList.length} gym workouts` : 'Loading...'} empty={!!catalog && templatesList.length === 0} emptyText="No templates in the snapshot." collapsible open={templatesOpen} onToggle={toggleTemplates}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {templatesList.map((t) => {
            const [a, b] = titleLines(t.name);
            const open = openTemplate === t.id;
            const strong = /StrongLifts/.test(t.name);
            return (
                <div
                  key={t.id}
                  onClick={() => { setOpenTemplate(open ? null : t.id); setPlayingExercise(null); }}
                  title={t.name}
                  style={{
                    position: 'relative', aspectRatio: '690 / 240', borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                    background: `url(${templateBanner(t.name) || ''}) center / cover, ${COLORS.ink}`,
                    outline: open ? `3px solid ${APP_BLUE}` : 'none', outlineOffset: 2,
                    alignSelf: 'start',
                  }}
                >
                  <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#FFFFFF', fontFamily: POPPINS, fontWeight: 800, fontSize: 14, lineHeight: 1.05, textTransform: 'uppercase', textShadow: '0 1px 2px rgba(0,0,0,.3)' }}>
                    {a}<br />{b}
                    {strong ? null : <div style={{ fontWeight: 500, fontSize: 11, marginTop: 4, textTransform: 'none' }}>Classic Gym Workout</div>}
                  </div>
                </div>
            );
          })}
        </div>
        {(() => {
          const t = templatesList.find((x) => x.id === openTemplate);
          if (!t) return null;
          const media = (catalog && catalog.media) || { videos: [], thumbs: [] };
          const numCell = { ...tdNum, textAlign: 'right', padding: '8px 12px 8px 0' };
          const numHead = { ...th, textAlign: 'right', padding: '4px 12px 8px 0' };
          return (
                  <div style={{ marginTop: 12, background: COLORS.page, borderRadius: 12, padding: '14px 18px', minWidth: 0 }}>
                    <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 16, textTransform: 'uppercase' }}>{t.name}</div>
                    <div style={{ display: 'flex', gap: 6, margin: '6px 0 10px' }}>
                      <span style={pill}>{t.exercises.length} exercises</span>
                      <span style={pill}>{maxSets(t)} sets</span>
                    </div>
                    <div style={tableWrap}>
                      <table style={{ ...table, tableLayout: 'fixed' }}>
                        <colgroup><col /><col style={{ width: 64 }} /><col style={{ width: 90 }} /><col style={{ width: 130 }} /></colgroup>
                        <thead><tr style={headRow}><th style={th}>Exercise</th><th style={numHead}>Sets</th><th style={numHead}>Reps</th><th style={numHead}>Video</th></tr></thead>
                        <tbody>
                          {t.exercises.map((e) => {
                            const hasVideo = media.videos.includes(String(e.action_id));
                            const hasThumb = media.thumbs.includes(String(e.action_id));
                            const playing = playingExercise === `${t.id}:${e.action_id}:${e.order}`;
                            return (
                              <React.Fragment key={`${e.action_id}-${e.order}`}>
                                <tr>
                                  <td style={{ ...td, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {hasThumb ? <img src={mediaUrl('thumb', e.action_id)} alt="" style={thumbStyle} />
                                      : hasVideo ? <video src={`${mediaUrl('video', e.action_id)}#t=0.5`} muted playsInline preload="metadata" style={thumbStyle} /> : null}
                                    {exerciseName(e)}
                                  </td>
                                  <td style={numCell}>{(e.sets || []).length || '-'}</td>
                                  <td style={numCell}>{repsText(e.sets)}</td>
                                  <td style={numCell}>
                                    {hasVideo ? (
                                      <button type="button" onClick={() => setPlayingExercise(playing ? null : `${t.id}:${e.action_id}:${e.order}`)} style={{ ...tableLink, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}>{playing ? 'Hide' : 'Play ▶'}</button>
                                    ) : (
                                      <span style={{ color: COLORS.faint, fontSize: 11 }} title="The app has no clip for this exercise, or the sync has not fetched it yet.">Clip unavailable</span>
                                    )}
                                  </td>
                                </tr>
                                {playing ? (
                                  <tr><td colSpan={4} style={{ padding: '4px 0 12px' }}>
                                    <video controls autoPlay preload="metadata" src={mediaUrl('video', e.action_id)} style={{ width: '100%', maxWidth: 480, borderRadius: 10, background: '#000', display: 'block' }} />
                                  </td></tr>
                                ) : null}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
          );
        })()}
      </WorkoutCard>
      </div>
      <div style={{ fontSize: 11, color: COLORS.faint }}>
        Home Workouts sessions reach here two ways: the phone posts its Apple Health workouts as they happen (timing, duration, calories), and the Mac exports the app every 6 hours (per-exercise detail, only what the Mac copy of the app has synced). Both live in <code>backend/workout-state</code>.
      </div>
    </>
  );
}
