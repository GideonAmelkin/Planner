import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { endOfMonth } from 'date-fns';
import AgendaRail from '../components/AgendaRail';
import MiniCalendar from '../components/MiniCalendar';
import WorkoutCard from '../components/workout/WorkoutCard';
import WorkoutTile, { tileGrid, tableWrap, table, th, headRow, td, tdNum, tableLink } from '../components/workout/WorkoutTile';
import { getWorkoutStatus, getWorkoutDay, getWorkoutRecent, getWorkoutCatalog } from '../services/api';
import { dateToISO, headlineLong, isoToDate, shiftISO, todayISO } from '../utils/dayInfo';
import { num, secondsToHm } from '../utils/garminFormat';
import { COLORS, SECTION_DOTS, card, navButton, pill, sectionDot, sectionHeader } from '../styles';

const RANGES = [
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

const MAX_WIDTH = 1500;
const HISTORY_DAYS = 30;   // the Last 30 Days table
const MONTH_FETCH_DAYS = 45; // covers the mini calendar's six-week grid
const KG_TO_LB = 2.20462;

// The app stores kilograms; the user's app setting says whether to show kg or lb.
const weightUnit = (profile) => (profile && profile.shows_kg ? 'kg' : 'lb');
const toUnit = (kg, unit) => (kg === null || kg === undefined ? null : (unit === 'kg' ? kg : kg * KG_TO_LB));

const clockOf = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null);
// Every date on this tab reads 'Mon, Sep 8, 2026'.
const shortDate = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '-');
const kindLabel = (s) => (s.kind === 'gym' ? 'Gym' : 'Home');
// Six gym exercises have no name on disk; the exporter keeps the id, say so instead of a bare number.
const exerciseName = (e) => (/^\d+$/.test(e.name || '') ? `Exercise ${e.name}` : e.name);

// Session volume: sum of reps x weight over finished sets (all sets when none is flagged).
function volumeKg(session) {
  if (!session.exercises) return session.total_weight_kg || null;
  let total = 0;
  let any = false;
  for (const e of session.exercises) {
    for (const s of e.sets || []) {
      if (s.reps && s.weight_kg) { total += s.reps * s.weight_kg; any = true; }
    }
  }
  return any ? total : (session.total_weight_kg || null);
}

const setsText = (sets, unit) => {
  if (!sets || !sets.length) return '-';
  return sets.map((s) => `${s.reps || 0} x ${num(toUnit(s.weight_kg, unit), 0) || 0}`).join(', ');
};

// Ink-on-paper line of body weight over time; labels carry the unit.
function WeightChart({ weights, unit, height = 64 }) {
  const pts = (weights || []).filter((w) => w.kg !== null && w.date).map((w) => [Date.parse(`${w.date}T12:00:00`), toUnit(w.kg, unit)]);
  if (pts.length < 2) return <div style={{ color: COLORS.muted, fontSize: 12 }}>One weigh-in so far; the chart starts with the second.</div>;
  const W = 600; const H = height; const PAD = 2;
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]);
  const x0 = Math.min(...xs); const x1 = Math.max(...xs);
  const y0 = Math.min(...ys); const y1 = Math.max(...ys);
  const sx = (x) => (x1 === x0 ? W / 2 : PAD + ((x - x0) / (x1 - x0)) * (W - 2 * PAD));
  const sy = (y) => (y1 === y0 ? H / 2 : H - PAD - ((y - y0) / (y1 - y0)) * (H - 2 * PAD));
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: H, display: 'block' }} role="img" aria-label={`Body weight, ${num(y0, 1)} to ${num(y1, 1)} ${unit}`}>
        <path d={path} fill="none" stroke={COLORS.accent} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLORS.muted, marginTop: 4 }}>
        <span>{shortDate(pts[0] && weights[0].date)}</span>
        <span>{num(y0, 1)} to {num(y1, 1)} {unit}</span>
        <span>{shortDate(weights[weights.length - 1].date)}</span>
      </div>
    </div>
  );
}

// Sessions per bucket across a range: weekly buckets up to a year, monthly
// beyond that. The busiest bucket sets the scale; empty ones show a faint stub.
function RangeBars({ sessions, startISO, endISO }) {
  const totalDays = daysBetween(startISO, endISO) + 1;
  const monthly = totalDays > 366;
  const keys = [];
  if (monthly) {
    let cur = new Date(`${startISO.slice(0, 7)}-01T12:00:00`);
    const endKey = endISO.slice(0, 7);
    while (keys.length < 400) {
      const k = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      keys.push(k);
      if (k === endKey) break;
      cur.setMonth(cur.getMonth() + 1);
    }
  } else {
    for (let w = Math.ceil(totalDays / 7) - 1; w >= 0; w--) keys.push(String(w));
  }
  const counts = new Map(keys.map((k) => [k, 0]));
  const end = Date.parse(`${endISO}T12:00:00`);
  for (const sess of sessions) {
    if (sess.date < startISO || sess.date > endISO) continue;
    const k = monthly ? sess.date.slice(0, 7) : String(Math.floor((end - Date.parse(`${sess.date}T12:00:00`)) / (7 * 86400000)));
    if (counts.has(k)) counts.set(k, counts.get(k) + 1);
  }
  const values = keys.map((k) => counts.get(k));
  const max = Math.max(1, ...values);
  const H = 40;
  const label = (k) => (monthly
    ? new Date(`${k}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    : shortDate(shiftISO(endISO, -(Number(k) * 7 + 6) < 0 ? 0 : -(Number(k) * 7 + 6))));
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${keys.length}, 1fr)`, gap: keys.length > 40 ? 2 : 6, alignItems: 'end', height: H }}>
        {values.map((c, i) => (
          <div key={keys[i]} title={`${c} session${c === 1 ? '' : 's'}`} style={{
            height: c ? Math.max(6, Math.round((c / max) * H)) : 4,
            background: c ? COLORS.accent : COLORS.faint,
            borderRadius: 3,
            opacity: c ? 1 : 0.5,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLORS.muted, marginTop: 6 }}>
        <span>{monthly ? label(keys[0]) : shortDate(startISO)}</span>
        <span>sessions per {monthly ? 'month' : 'week'}</span>
        <span>{monthly ? label(keys[keys.length - 1]) : shortDate(endISO)}</span>
      </div>
    </div>
  );
}

function SessionBlock({ session: s, unit }) {
  const vol = volumeKg(s);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>{s.title}</span>
        <span style={{ ...pill, color: COLORS.workout, fontSize: 11 }}>{kindLabel(s)}</span>
        <span style={{ fontSize: 12, color: COLORS.muted }}>
          {[clockOf(s.started_at), secondsToHm(s.duration_s), s.calories ? `${num(s.calories)} cal` : null, vol ? `${num(toUnit(vol, unit))} ${unit} lifted` : null].filter(Boolean).join(' · ')}
        </span>
      </div>
      {s.exercises && s.exercises.length ? (
        <div style={tableWrap}>
          <table style={table}>
            <thead>
              <tr style={headRow}>
                <th style={th}>Exercise</th>
                <th style={th}>{s.kind === 'gym' ? `Sets (reps x ${unit})` : 'Time'}</th>
              </tr>
            </thead>
            <tbody>
              {s.exercises.map((e) => (
                <tr key={`${e.action_id}-${e.order}`}>
                  <td style={td}>{exerciseName(e)}</td>
                  <td style={tdNum}>{s.kind === 'gym' ? setsText(e.sets, unit) : (e.seconds ? `${e.seconds}s` : '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: COLORS.muted }}>No exercise detail in the snapshot for this session.</div>
      )}
    </div>
  );
}

function Templates({ catalog, unit }) {
  const [open, setOpen] = useState(null);
  const templates = (catalog && catalog.templates) || [];
  if (!templates.length) return <div style={{ color: COLORS.muted, fontSize: 12 }}>No templates in the snapshot.</div>;
  return (
    <div>
      {templates.map((t) => (
        <div key={t.id} style={{ borderBottom: `1px solid ${COLORS.hairline}` }}>
          <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: COLORS.ink, cursor: 'pointer', fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{t.name}</span>
            <span style={{ fontSize: 11, color: COLORS.muted }}>{t.exercises.length} exercises <span style={{ color: COLORS.accent }}>{open === t.id ? '▾' : '▸'}</span></span>
          </button>
          {open === t.id ? (
            <div style={{ ...tableWrap, paddingBottom: 10 }}>
              <table style={table}>
                <thead><tr style={headRow}><th style={th}>Exercise</th><th style={th}>Default sets (reps x {unit})</th></tr></thead>
                <tbody>
                  {t.exercises.map((e) => (
                    <tr key={`${e.action_id}-${e.order}`}><td style={td}>{exerciseName(e)}</td><td style={tdNum}>{setsText(e.sets, unit)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export default function WorkoutView() {
  const { date } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [day, setDay] = useState(null);
  const [recent, setRecent] = useState(null);       // 30-day window for the table
  const [monthRecent, setMonthRecent] = useState(null); // the mini calendar's month
  const [rangeRecent, setRangeRecent] = useState(null); // the Summary range
  const [rangeKey, setRangeKey] = useState('y365');
  const [customFrom, setCustomFrom] = useState(() => shiftISO(date, -29));
  const [customTo, setCustomTo] = useState(date);
  const [catalog, setCatalog] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const monthEnd = dateToISO(endOfMonth(isoToDate(date)));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, d, r, m] = await Promise.all([
        getWorkoutStatus(),
        getWorkoutDay(date),
        getWorkoutRecent(date, HISTORY_DAYS),
        getWorkoutRecent(monthEnd, MONTH_FETCH_DAYS),
      ]);
      setStatus(s);
      setDay(d);
      setRecent(r);
      setMonthRecent(m);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [date, monthEnd]);

  useEffect(() => { setDay(null); load(); }, [load]);

  // The Summary range: fixed windows end on the shown date; Custom uses its own dates.
  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[4];
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

  useEffect(() => {
    if (!showTemplates || catalog) return;
    getWorkoutCatalog().then(setCatalog).catch((err) => setError(err.message || String(err)));
  }, [showTemplates, catalog]);

  const available = status && status.available;
  const profile = (status && status.profile) || {};
  const awards = (status && status.awards) || {};
  const unit = weightUnit(profile);
  const sessions = (day && day.sessions) || [];
  const history = ((recent && recent.sessions) || []).filter((s) => s.date <= date);
  const weights = (recent && recent.weights) || [];
  const counts = (status && status.counts) || {};
  const workoutDays = new Set(((monthRecent && monthRecent.sessions) || []).map((s) => s.date));

  const rangeSessions = ((rangeRecent && rangeRecent.sessions) || []).filter((s) => s.date >= rangeStart && s.date <= rangeEnd);
  const rangeGym = rangeSessions.filter((s) => s.kind === 'gym').length;
  const activeHours = rangeSessions.reduce((t, s) => t + (s.duration_s || 0), 0) / 3600;
  const liftedKg = rangeSessions.reduce((t, s) => t + (s.total_weight_kg || 0), 0);
  const rangeWeights = weights.filter((w) => w.date >= rangeStart && w.date <= rangeEnd && w.kg !== null);
  const weightDeltaKg = rangeWeights.length >= 2 ? rangeWeights[rangeWeights.length - 1].kg - rangeWeights[0].kg : null;
  const lastInRange = rangeSessions.length ? rangeSessions[0] : null;
  const latestWeight = weights.length ? weights[weights.length - 1] : null;
  const plan = (catalog && catalog.plan) || null;

  const arrowStyle = { ...navButton, width: 32, padding: '5px 0', textAlign: 'center', fontSize: 16, lineHeight: 1.2 };
  const controlStyle = { ...navButton, fontSize: 12, padding: '4px 8px', cursor: 'pointer' };
  const dateInputStyle = { background: COLORS.paper, color: COLORS.ink, border: `1px solid ${COLORS.hairline}`, padding: '4px 8px', borderRadius: 8, fontSize: 13, colorScheme: 'light' };

  // Header card: the date and its controls on the left, body weight in the
  // middle, the month calendar (green checks on workout days) on the right.
  const header = (
    <div style={{ ...card, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
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
      <div style={{ background: COLORS.calloutBg, borderRadius: 12, padding: '14px 20px', alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: COLORS.calloutText }}>
          <span style={sectionDot(SECTION_DOTS.ongoing)} />
          Body Weight
        </div>
        {latestWeight || profile.current_weight_kg ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))', gap: '12px 28px', alignItems: 'center' }}>
            <div style={{ ...tileGrid(96), gap: '10px 18px' }}>
              <WorkoutTile label="Current" value={num(toUnit(latestWeight ? latestWeight.kg : profile.current_weight_kg, unit), 1)} unit={unit} sub={latestWeight ? `logged ${shortDate(latestWeight.date)}` : null} />
              <WorkoutTile label="Target" value={num(toUnit(profile.target_weight_kg, unit), 1)} unit={unit} />
              <WorkoutTile label="Height" value={profile.height_cm ? num(profile.height_cm / 2.54) : null} unit="in" sub={profile.bmi ? `BMI ${num(profile.bmi, 1)}` : null} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <WeightChart weights={weights} unit={unit} height={64} />
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: COLORS.muted }}>No weigh-ins in the snapshot.</div>
        )}
      </div>
      <MiniCalendar dateISO={date} section="workout" marks={workoutDays} />
    </div>
  );

  const rangeControls = (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <select value={rangeKey} onChange={(e) => setRangeKey(e.target.value)} style={controlStyle} title="Summary range">
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
        <div style={{ fontWeight: 600, marginBottom: 6 }}>No Home Workouts snapshot on the server yet.</div>
        <div>The Mac exports the app's data and ships it here every 6 hours (<code>tools/homeworkouts/sync.py</code>). Run it by hand once, or check that the launchd job has Full Disk Access. See the Home Workouts section of <code>deploy/README.md</code>.</div>
      </div>
    );
  }

  return shell(
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        <WorkoutCard title="Summary" dot={COLORS.accent} aside={`${rangeSessions.length} session${rangeSessions.length === 1 ? '' : 's'}`} actions={rangeControls}>
          <div style={tileGrid(120)}>
            <WorkoutTile label="Workouts" value={rangeSessions.length} sub={`${rangeGym} gym · ${rangeSessions.length - rangeGym} home`} />
            <WorkoutTile label="Streak" value={awards.streak} unit={awards.streak === 1 ? 'day' : 'days'} sub="all time" />
            <WorkoutTile label="Active time" value={rangeSessions.length ? num(activeHours, 1) : null} unit="h" sub={range.sub} />
            <WorkoutTile label="Lifted" value={liftedKg ? num(toUnit(liftedKg, unit)) : null} unit={unit} sub={range.sub} />
            <WorkoutTile label="Weight change" value={weightDeltaKg === null ? null : `${weightDeltaKg > 0 ? '+' : ''}${num(toUnit(weightDeltaKg, unit), 1)}`} unit={unit} sub={weightDeltaKg !== null ? `since ${shortDate(rangeWeights[0].date)}` : null} />
            <WorkoutTile label="Last session" value={lastInRange ? shortDate(lastInRange.date) : null} size={16} sub={lastInRange ? lastInRange.title : null} />
          </div>
          <div style={{ marginTop: 16 }}>
            {customValid ? <RangeBars sessions={rangeSessions} startISO={rangeStart} endISO={rangeEnd} /> : <div style={{ fontSize: 12, color: COLORS.muted }}>Pick a start date on or before the end date.</div>}
          </div>
          {!counts.sessions ? (
            <div style={{ marginTop: 12, fontSize: 12, color: COLORS.muted }}>
              No workouts in the snapshot yet. Sync the Home Workouts app on the Mac to pull history.
            </div>
          ) : null}
        </WorkoutCard>

        <WorkoutCard title="Sessions" dot={COLORS.workout} empty={sessions.length === 0} aside={sessions.length ? `${sessions.length} on this day` : null} emptyText="No workout logged on this day.">
          {sessions.map((s) => <SessionBlock key={s.id} session={s} unit={unit} />)}
          {day && day.plan_day ? (
            <div style={{ fontSize: 12, color: COLORS.muted }}>Plan day {day.plan_day.day} ({day.plan_day.name}) was completed on this day.</div>
          ) : null}
        </WorkoutCard>

        <WorkoutCard title={`Last ${HISTORY_DAYS} Days`} dot={SECTION_DOTS.tasks} empty={history.length === 0} aside={history.length ? `${history.length} sessions` : null} emptyText={`No sessions in the ${HISTORY_DAYS} days ending on this date.`}>
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr style={headRow}>
                  {['Date', 'Workout', 'Type', 'Duration', 'Calories', `Lifted (${unit})`, 'Exercises'].map((h) => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s.id}>
                    <td style={tdNum}><Link to={`/workout/${s.date}`} style={tableLink}>{shortDate(s.date)}</Link></td>
                    <td style={td}>{s.title}</td>
                    <td style={td}>{kindLabel(s)}</td>
                    <td style={tdNum}>{secondsToHm(s.duration_s) || '-'}</td>
                    <td style={tdNum}>{num(s.calories) || '-'}</td>
                    <td style={tdNum}>{s.total_weight_kg ? num(toUnit(s.total_weight_kg, unit)) : '-'}</td>
                    <td style={tdNum}>{s.exercise_count || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </WorkoutCard>
      </div>

      <section style={card}>
        <button
          type="button"
          onClick={() => setShowTemplates((s) => !s)}
          style={{ ...sectionHeader, padding: 0, width: '100%', background: 'transparent', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        >
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <span style={sectionDot(SECTION_DOTS.notes)} />
            Plan and Templates
          </span>
          <span style={{ color: COLORS.accent, fontSize: 14 }}>{showTemplates ? '▾' : '▸'}</span>
        </button>
        {showTemplates ? (
          <div style={{ marginTop: 14 }}>
            {!catalog ? <div style={{ color: COLORS.muted, fontSize: 12 }}>Loading...</div> : (
              <>
                {plan ? (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.muted, marginBottom: 8 }}>{plan.total_days}-day plan</div>
                    <div style={tileGrid(100)}>
                      <WorkoutTile label="Done" value={plan.finish_days} sub={`of ${plan.total_days} days`} />
                      <WorkoutTile label="Current day" value={plan.current_day_index !== null && plan.current_day_index !== undefined ? plan.current_day_index + 1 : null} />
                      <WorkoutTile label="Updated" value={plan.updated_at ? shortDate(plan.updated_at.slice(0, 10)) : null} size={16} />
                    </div>
                    <div style={{ ...tableWrap, marginTop: 12 }}>
                      <table style={table}>
                        <thead><tr style={headRow}><th style={th}>Day</th><th style={th}>Focus</th><th style={th}>Exercises</th><th style={th}>Done</th></tr></thead>
                        <tbody>
                          {plan.days.map((d) => (
                            <tr key={d.day}>
                              <td style={tdNum}>{d.day}</td>
                              <td style={td}>{d.name || '-'}</td>
                              <td style={td}>{d.exercises.map(exerciseName).join(', ')}</td>
                              <td style={tdNum}>{d.done_at ? shortDate(d.done_at.slice(0, 10)) : '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.muted, marginBottom: 8 }}>Gym templates</div>
                <Templates catalog={catalog} unit={unit} />
              </>
            )}
          </div>
        ) : null}
      </section>
      <div style={{ fontSize: 11, color: COLORS.faint }}>
        Home Workouts app data, exported on the Mac and read from <code>backend/workout-state</code>. Only what the Mac copy of the app has synced is here.
      </div>
    </>
  );
}
