import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AgendaRail from '../components/AgendaRail';
import WorkoutCard from '../components/workout/WorkoutCard';
import WorkoutTile, { tileGrid, tableWrap, table, th, headRow, td, tdNum, tableLink } from '../components/workout/WorkoutTile';
import { getWorkoutStatus, getWorkoutDay, getWorkoutRecent, getWorkoutCatalog } from '../services/api';
import { headlineLong, shiftISO, todayISO } from '../utils/dayInfo';
import { num, secondsToHm } from '../utils/garminFormat';
import { COLORS, SECTION_DOTS, card, navButton, pill, sectionDot, sectionHeader } from '../styles';

const MAX_WIDTH = 1500;
const HISTORY_DAYS = 30;   // the Last 30 Days table
const RANGE_DAYS = 366;    // the Summary window (the endpoint's maximum)
const WEEKS = 12;
const KG_TO_LB = 2.20462;

// The app stores kilograms; the user's app setting says whether to show kg or lb.
const weightUnit = (profile) => (profile && profile.shows_kg ? 'kg' : 'lb');
const toUnit = (kg, unit) => (kg === null || kg === undefined ? null : (unit === 'kg' ? kg : kg * KG_TO_LB));

const clockOf = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null);
const shortDate = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-');
const stamp = (iso) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null);
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
function WeightChart({ weights, unit }) {
  const pts = (weights || []).filter((w) => w.kg !== null && w.date).map((w) => [Date.parse(`${w.date}T12:00:00`), toUnit(w.kg, unit)]);
  if (pts.length < 2) return <div style={{ color: COLORS.muted, fontSize: 12 }}>One weigh-in so far; the chart starts with the second.</div>;
  const W = 600; const H = 64; const PAD = 2;
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

// Sessions per week for the last WEEKS weeks ending on endISO: slim bars, the
// busiest week sets the scale, empty weeks show a faint stub.
function WeekBars({ sessions, endISO }) {
  const end = Date.parse(`${endISO}T12:00:00`);
  const counts = new Array(WEEKS).fill(0);
  for (const sess of sessions) {
    const days = Math.floor((end - Date.parse(`${sess.date}T12:00:00`)) / 86400000);
    if (days < 0) continue;
    const w = Math.floor(days / 7);
    if (w < WEEKS) counts[WEEKS - 1 - w] += 1;
  }
  const max = Math.max(1, ...counts);
  const H = 40;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${WEEKS}, 1fr)`, gap: 6, alignItems: 'end', height: H }}>
        {counts.map((c, i) => (
          <div key={i} title={`${c} session${c === 1 ? '' : 's'}`} style={{
            height: c ? Math.max(6, Math.round((c / max) * H)) : 4,
            background: c ? COLORS.accent : COLORS.faint,
            borderRadius: 3,
            opacity: c ? 1 : 0.5,
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLORS.muted, marginTop: 6 }}>
        <span>{shortDate(shiftISO(endISO, -(WEEKS * 7 - 1)))}</span>
        <span>sessions per week</span>
        <span>{shortDate(shiftISO(endISO, -6))}</span>
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
  const [recent, setRecent] = useState(null);
  const [catalog, setCatalog] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, d, r] = await Promise.all([getWorkoutStatus(), getWorkoutDay(date), getWorkoutRecent(date, RANGE_DAYS)]);
      setStatus(s);
      setDay(d);
      setRecent(r);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { setDay(null); load(); }, [load]);

  useEffect(() => {
    if (!showTemplates || catalog) return;
    getWorkoutCatalog().then(setCatalog).catch((err) => setError(err.message || String(err)));
  }, [showTemplates, catalog]);

  const available = status && status.available;
  const profile = (status && status.profile) || {};
  const awards = (status && status.awards) || {};
  const unit = weightUnit(profile);
  const sessions = (day && day.sessions) || [];
  const yearSessions = (recent && recent.sessions) || [];
  const historyStart = shiftISO(date, -(HISTORY_DAYS - 1));
  const history = yearSessions.filter((s) => s.date >= historyStart && s.date <= date);
  const weights = (recent && recent.weights) || [];
  const counts = (status && status.counts) || {};
  const activeHours = yearSessions.reduce((t, s) => t + (s.duration_s || 0), 0) / 3600;
  const liftedKg = yearSessions.reduce((t, s) => t + (s.total_weight_kg || 0), 0);
  const firstWeight = weights.length ? weights[0] : null;
  const weightDeltaKg = weights.length >= 2 ? weights[weights.length - 1].kg - weights[0].kg : null;
  const weeksTotal = yearSessions.filter((s) => s.date > shiftISO(date, -(WEEKS * 7)) && s.date <= date).length;
  const latestWeight = weights.length ? weights[weights.length - 1] : null;
  const plan = (catalog && catalog.plan) || null;
  const last = status && status.last_session;

  const snapshotPill = !status
    ? 'Loading...'
    : (available && status.exported_at ? `Snapshot ${stamp(status.exported_at)}` : 'No snapshot');
  const arrowStyle = { ...navButton, width: 32, padding: '5px 0', textAlign: 'center', fontSize: 16, lineHeight: 1.2 };

  // The tab's own header card: date headline and day controls on the left,
  // the snapshot pills on the right. Same design language as the Agenda's
  // header, none of its features.
  const header = (
    <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
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
            style={{ background: COLORS.paper, color: COLORS.ink, border: `1px solid ${COLORS.hairline}`, padding: '4px 8px', borderRadius: 8, fontSize: 13, colorScheme: 'light' }}
          />
          <button type="button" disabled={loading} onClick={() => load()} style={{ ...navButton, cursor: loading ? 'default' : 'pointer', color: loading ? COLORS.faint : COLORS.ink }}>
            {loading ? 'Loading...' : 'Reload'}
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignSelf: 'flex-start' }}>
        <span style={pill}>Home Workouts</span>
        <span style={pill}>{snapshotPill}</span>
      </div>
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
        <div style={{ fontWeight: 600, marginBottom: 6 }}>No Home Workouts snapshot on the server yet.</div>
        <div>The Mac exports the app's data and ships it here every 6 hours (<code>tools/homeworkouts/sync.py</code>). Run it by hand once, or check that the launchd job has Full Disk Access. See the Home Workouts section of <code>deploy/README.md</code>.</div>
      </div>
    );
  }

  return shell(
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
        <WorkoutCard title="Summary" dot={COLORS.accent} aside={`${weeksTotal} in ${WEEKS} weeks`}>
          <div style={tileGrid(120)}>
            <WorkoutTile label="Workouts" value={counts.sessions !== undefined ? counts.sessions : awards.workout_count} sub={counts.gym_sessions !== undefined ? `${counts.gym_sessions} gym · ${counts.home_sessions || 0} home` : null} />
            <WorkoutTile label="Last 12 months" value={yearSessions.length} unit={yearSessions.length === 1 ? 'session' : 'sessions'} />
            <WorkoutTile label="Streak" value={awards.streak} unit={awards.streak === 1 ? 'day' : 'days'} />
            <WorkoutTile label="Active time" value={yearSessions.length ? num(activeHours, 1) : null} unit="h" sub="last 12 months" />
            <WorkoutTile label="Lifted" value={liftedKg ? num(toUnit(liftedKg, unit)) : null} unit={unit} sub="last 12 months" />
            <WorkoutTile label="Weight change" value={weightDeltaKg === null ? null : `${weightDeltaKg > 0 ? '+' : ''}${num(toUnit(weightDeltaKg, unit), 1)}`} unit={unit} sub={weightDeltaKg !== null && firstWeight ? `since ${shortDate(firstWeight.date)}` : null} />
            <WorkoutTile label="Last session" value={last ? shortDate(last.date) : null} size={16} sub={last ? last.title : null} />
          </div>
          <div style={{ marginTop: 16 }}>
            <WeekBars sessions={yearSessions} endISO={date} />
          </div>
          {!counts.sessions ? (
            <div style={{ marginTop: 12, fontSize: 12, color: COLORS.muted }}>
              No workouts in the snapshot yet. Sync the Home Workouts app on the Mac to pull history.
            </div>
          ) : null}
        </WorkoutCard>

        <WorkoutCard title="Body Weight" dot={SECTION_DOTS.ongoing} empty={!latestWeight && !profile.current_weight_kg}>
          <div style={tileGrid(100)}>
            <WorkoutTile label="Current" value={num(toUnit(latestWeight ? latestWeight.kg : profile.current_weight_kg, unit), 1)} unit={unit} sub={latestWeight ? `logged ${shortDate(latestWeight.date)}` : null} />
            <WorkoutTile label="Target" value={num(toUnit(profile.target_weight_kg, unit), 1)} unit={unit} />
            <WorkoutTile label="Height" value={profile.height_cm ? num(profile.height_cm / 2.54) : null} unit="in" sub={profile.bmi ? `BMI ${num(profile.bmi, 1)}` : null} />
          </div>
          <div style={{ marginTop: 14 }}><WeightChart weights={weights} unit={unit} /></div>
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
