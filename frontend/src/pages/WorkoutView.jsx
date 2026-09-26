import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { endOfMonth } from 'date-fns';
import AgendaRail from '../components/AgendaRail';
import MiniCalendar from '../components/MiniCalendar';
import WorkoutCard from '../components/workout/WorkoutCard';
import WorkoutTile, { tileGrid, tableWrap, table, th, headRow, td, tdNum, tableLink } from '../components/workout/WorkoutTile';
import { getWorkoutStatus, getWorkoutRecent, getWorkoutCatalog } from '../services/api';
import { dateToISO, headlineLong, isoToDate, shiftISO, todayISO } from '../utils/dayInfo';
import { num, secondsToHm } from '../utils/garminFormat';
import { COLORS, SECTION_DOTS, card, navButton, pill, sectionDot } from '../styles';
import { templateBanner, titleLines, APP_BLUE, POPPINS } from '../workoutArt';

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

const MAX_WIDTH = 1500;
const MONTH_FETCH_DAYS = 45; // covers the mini calendar's six-week grid
const KG_TO_LB = 2.20462;

// The app stores kilograms; the user's app setting says whether to show kg or lb.
const weightUnit = (profile) => (profile && profile.shows_kg ? 'kg' : 'lb');
const toUnit = (kg, unit) => (kg === null || kg === undefined ? null : (unit === 'kg' ? kg : kg * KG_TO_LB));

// Every date on this tab reads 'Mon, Sep 8, 2026'.
const shortDate = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '-');
const kindLabel = (s) => (s.kind === 'gym' ? 'Gym' : 'Home');
// Six gym exercises have no name on disk; the exporter keeps the id, say so instead of a bare number.
const exerciseName = (e) => (/^\d+$/.test(e.name || '') ? `Exercise ${e.name}` : e.name);

// "8" when every set has the same reps, otherwise the list ("12, 10, 8").
const repsText = (sets) => {
  if (!sets || !sets.length) return '-';
  const reps = sets.map((s) => s.reps || 0);
  return reps.every((r) => r === reps[0]) ? String(reps[0]) : reps.join(', ');
};

// The app bundle has no per-exercise URLs, so link to a video search for named exercises.
const videoUrl = (e) => (/^\d+$/.test(e.name || '') || !e.name ? null : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.name.replace(/ · /g, ' ')} exercise form`)}`);

const maxSets = (t) => Math.max(0, ...t.exercises.map((e) => (e.sets || []).length));

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
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${keys.length}, 1fr)`, gap: keys.length > 40 ? 2 : 6, alignItems: 'end', height: H, marginTop: 30 }}>
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
        <span>{monthly ? label(keys[0]) : shortDate(startISO)}</span>
        <span>sessions per {monthly ? 'month' : 'week'}</span>
        <span>{monthly ? label(keys[keys.length - 1]) : shortDate(endISO)}</span>
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
  const [rangeKey, setRangeKey] = useState('y365');
  const [customFrom, setCustomFrom] = useState(() => shiftISO(date, -29));
  const [customTo, setCustomTo] = useState(date);
  const [catalog, setCatalog] = useState(null);
  const [openTemplate, setOpenTemplate] = useState(null);
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
  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[5];
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
  const awards = (status && status.awards) || {};
  const unit = weightUnit(profile);
  const weights = (monthRecent && monthRecent.weights) || [];
  const counts = (status && status.counts) || {};
  const workoutDays = new Set(((monthRecent && monthRecent.sessions) || []).map((s) => s.date));

  const rangeSessions = ((rangeRecent && rangeRecent.sessions) || []).filter((s) => s.date >= rangeStart && s.date <= rangeEnd);
  const rangeGym = rangeSessions.filter((s) => s.kind === 'gym').length;
  const activeHours = rangeSessions.reduce((t, s) => t + (s.duration_s || 0), 0) / 3600;
  const lastInRange = rangeSessions.length ? rangeSessions[0] : null;
  const hasCalories = rangeSessions.some((s) => s.calories);
  const hasExercises = rangeSessions.some((s) => s.exercise_count);
  const hasLifted = rangeSessions.some((s) => s.total_weight_kg);
  const latestWeight = weights.length ? weights[weights.length - 1] : null;
  const templatesList = (catalog && catalog.templates) || [];

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
      <div style={{ background: COLORS.calloutBg, borderRadius: 12, padding: '12px 20px', alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: COLORS.calloutText }}>
          <span style={sectionDot(SECTION_DOTS.ongoing)} />
          Body Weight
        </div>
        {latestWeight || profile.current_weight_kg ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: '12px 24px', alignItems: 'center' }}>
            <div style={{ ...tileGrid(96), gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px 12px' }}>
              <WorkoutTile label="Current" value={num(toUnit(latestWeight ? latestWeight.kg : profile.current_weight_kg, unit), 1)} unit={unit} sub={latestWeight ? `logged ${new Date(`${latestWeight.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : null} />
              <WorkoutTile label="Target" value={num(toUnit(profile.target_weight_kg, unit), 1)} unit={unit} />
              <WorkoutTile label="Height" value={profile.height_cm ? num(profile.height_cm / 2.54) : null} unit="in" sub={profile.bmi ? `BMI ${num(profile.bmi, 1)}` : null} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <WeightChart weights={weights} unit={unit} height={48} />
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
        <WorkoutCard title="Activity" dot={COLORS.accent} actions={rangeControls}>
          <div style={tileGrid(140)}>
            <WorkoutTile label="Workouts" value={rangeSessions.length} sub={`${rangeGym} gym · ${rangeSessions.length - rangeGym} home, ${range.sub}`} />
            <WorkoutTile label="Active time" value={rangeSessions.length ? num(activeHours, 1) : null} unit="h" sub={range.sub} />
            <WorkoutTile label="Streak" value={awards.streak} unit={awards.streak === 1 ? 'day' : 'days'} sub="all time" />
            <WorkoutTile label="Last workout" value={lastInRange ? shortDate(lastInRange.date) : null} size={16} sub={lastInRange ? `${lastInRange.title} · ${secondsToHm(lastInRange.duration_s) || '-'}` : null} />
          </div>
          <div style={{ marginTop: 16 }}>
            {customValid ? <RangeBars sessions={rangeSessions} startISO={rangeStart} endISO={rangeEnd} /> : <div style={{ fontSize: 12, color: COLORS.muted }}>Pick a start date on or before the end date.</div>}
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
            rangeSessions.length ? (
              <div style={{ ...tableWrap, marginTop: 10 }}>
                <table style={table}>
                  <thead>
                    <tr style={headRow}>
                      {['Date', 'Workout', 'Type', 'Duration', ...(hasCalories ? ['Calories'] : []), ...(hasLifted ? [`Lifted (${unit})`] : []), ...(hasExercises ? ['Exercises'] : [])].map((h) => <th key={h} style={th}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rangeSessions.map((s) => {
                      const mine = s.date === date;
                      const cell = (extra) => ({ ...extra, background: mine ? COLORS.calloutBg : undefined });
                      return (
                        <tr key={s.id}>
                          <td style={cell(tdNum)}><Link to={`/workout/${s.date}`} style={tableLink}>{shortDate(s.date)}</Link></td>
                          <td style={cell(td)}>{s.title}</td>
                          <td style={cell(td)}><span style={{ ...pill, color: COLORS.workout, fontSize: 11 }}>{kindLabel(s)}</span></td>
                          <td style={cell(tdNum)}>{secondsToHm(s.duration_s) || '-'}</td>
                          {hasCalories ? <td style={cell(tdNum)}>{num(s.calories) || '-'}</td> : null}
                          {hasLifted ? <td style={cell(tdNum)}>{s.total_weight_kg ? num(toUnit(s.total_weight_kg, unit)) : '-'}</td> : null}
                          {hasExercises ? <td style={cell(tdNum)}>{s.exercise_count || '-'}</td> : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <div style={{ marginTop: 10, fontSize: 13, color: COLORS.muted }}>No workouts in this range.</div>
          ) : null}
          {!counts.sessions ? (
            <div style={{ marginTop: 12, fontSize: 12, color: COLORS.muted }}>
              No workouts in the snapshot yet. Sync the Home Workouts app on the Mac to pull history.
            </div>
          ) : null}
        </WorkoutCard>

      <WorkoutCard title="Templates" dot={SECTION_DOTS.notes} aside={catalog ? `${templatesList.length} gym templates` : 'Loading...'} empty={!!catalog && templatesList.length === 0} emptyText="No templates in the snapshot.">
        {templatesList.length ? (() => {
          const selected = templatesList.find((t) => t.id === openTemplate) || templatesList[0];
          return (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
                {templatesList.map((t) => {
                  const [a, b] = titleLines(t.name);
                  const open = selected.id === t.id;
                  const strong = /StrongLifts/.test(t.name);
                  return (
                    <div
                      key={t.id}
                      onClick={() => setOpenTemplate(t.id)}
                      title={t.name}
                      style={{
                        position: 'relative', aspectRatio: '690 / 240', borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                        background: `url(${templateBanner(t.name) || ''}) center / cover, ${COLORS.ink}`,
                        outline: open ? `3px solid ${APP_BLUE}` : 'none', outlineOffset: 2,
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
              <div style={{ background: COLORS.page, borderRadius: 12, padding: '14px 18px', minWidth: 0, gridColumn: 'span 2' }}>
                <div style={{ fontFamily: POPPINS, fontWeight: 800, fontSize: 16, textTransform: 'uppercase' }}>{selected.name}</div>
                <div style={{ display: 'flex', gap: 6, margin: '6px 0 10px' }}>
                  <span style={pill}>{selected.exercises.length} exercises</span>
                  <span style={pill}>{maxSets(selected)} sets</span>
                </div>
                <div style={tableWrap}>
                  <table style={table}>
                    <thead><tr style={headRow}><th style={th}>Exercise</th><th style={{ ...th, textAlign: 'right' }}>Sets</th><th style={{ ...th, textAlign: 'right' }}>Reps</th><th style={{ ...th, textAlign: 'right' }}>Video</th></tr></thead>
                    <tbody>
                      {selected.exercises.map((e) => (
                        <tr key={`${e.action_id}-${e.order}`}>
                          <td style={td}>{exerciseName(e)}</td>
                          <td style={tdNum}>{(e.sets || []).length || '-'}</td>
                          <td style={tdNum}>{repsText(e.sets)}</td>
                          <td style={tdNum}>{videoUrl(e) ? <a href={videoUrl(e)} target="_blank" rel="noreferrer" style={tableLink}>Video ↗</a> : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })() : null}
      </WorkoutCard>
      </div>
      <div style={{ fontSize: 11, color: COLORS.faint }}>
        Home Workouts app data, exported on the Mac and read from <code>backend/workout-state</code>. Only what the Mac copy of the app has synced is here.
      </div>
    </>
  );
}
