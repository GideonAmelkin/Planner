import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TopNav from '../components/TopNav';
import WorkoutCard from '../components/workout/WorkoutCard';
import WorkoutTile, { tileGrid, tableWrap, table, th, headRow, td, tdNum } from '../components/workout/WorkoutTile';
import { getWorkoutStatus, getWorkoutDay, getWorkoutRecent, getWorkoutCatalog } from '../services/api';
import { longDate } from '../utils/dayInfo';
import { num, secondsToHm } from '../utils/garminFormat';
import { COLORS, uppercaseHeading, outlineButton } from '../styles';

const MAX_WIDTH = 1500;
const HISTORY_DAYS = 30;
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
  if (pts.length < 2) return <div style={{ color: COLORS.muted, fontSize: 12, fontStyle: 'italic' }}>One weigh-in so far; the chart starts with the second.</div>;
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
        <path d={path} fill="none" stroke={COLORS.ink} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLORS.muted, marginTop: 4 }}>
        <span>{shortDate(pts[0] && weights[0].date)}</span>
        <span>{num(y0, 1)} to {num(y1, 1)} {unit}</span>
        <span>{shortDate(weights[weights.length - 1].date)}</span>
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
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.workout }}>{kindLabel(s)}</span>
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
        <div style={{ fontSize: 12, color: COLORS.muted, fontStyle: 'italic' }}>No exercise detail in the snapshot for this session.</div>
      )}
    </div>
  );
}

function Templates({ catalog, unit }) {
  const [open, setOpen] = useState(null);
  const templates = (catalog && catalog.templates) || [];
  if (!templates.length) return <div style={{ color: COLORS.muted, fontSize: 12, fontStyle: 'italic' }}>No templates in the snapshot.</div>;
  return (
    <div>
      {templates.map((t) => (
        <div key={t.id} style={{ borderBottom: `1px solid ${COLORS.hairline}` }}>
          <button type="button" onClick={() => setOpen(open === t.id ? null : t.id)} style={{ width: '100%', background: 'transparent', border: 'none', padding: '8px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: COLORS.ink, cursor: 'pointer', fontSize: 13 }}>
            <span style={{ fontWeight: 600 }}>{t.name}</span>
            <span style={{ fontSize: 11, color: COLORS.muted }}>{t.exercises.length} exercises {open === t.id ? '▾' : '▸'}</span>
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
      const [s, d, r] = await Promise.all([getWorkoutStatus(), getWorkoutDay(date), getWorkoutRecent(date, HISTORY_DAYS)]);
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
  const history = (recent && recent.sessions) || [];
  const weights = (recent && recent.weights) || [];
  const latestWeight = weights.length ? weights[weights.length - 1] : null;
  const plan = (catalog && catalog.plan) || null;
  const last = status && status.last_session;

  const shell = (inner) => (
    <div>
      <TopNav dateISO={date} section="workout" />
      <div style={{ maxWidth: MAX_WIDTH, margin: '0 auto', padding: '32px min(24px, 4vw) 64px min(24px, 4vw)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
          <div>
            <div style={uppercaseHeading}>Workout App</div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>{longDate(date)}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: COLORS.muted, flexWrap: 'wrap' }}>
            {available && status.exported_at ? <span>Snapshot from the Mac {stamp(status.exported_at)}</span> : null}
            <button disabled={loading} onClick={() => load()} style={outlineButton(COLORS.ink, { small: true, disabled: loading })}>
              {loading ? 'Loading...' : 'Reload'}
            </button>
          </div>
        </div>
        {inner}
      </div>
    </div>
  );

  if (error) return shell(<div style={{ color: COLORS.danger }}>Error: {error}</div>);
  if (!status && loading) return shell(<div style={{ color: COLORS.muted }}>Loading workout data...</div>);

  if (status && !available) {
    return shell(
      <div style={{ background: COLORS.paper, border: `1px solid ${COLORS.ink}`, padding: 20, maxWidth: 560, fontSize: 13, lineHeight: 1.6 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>No Home Workouts snapshot on the server yet.</div>
        <div>The Mac exports the app's data and ships it here every 6 hours (<code>tools/homeworkouts/sync.py</code>). Run it by hand once, or check that the launchd job has Full Disk Access. See the Home Workouts section of <code>deploy/README.md</code>.</div>
      </div>
    );
  }

  const c = status.counts || {};
  return shell(
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 16 }}>
        <WorkoutCard title="Sessions" span={2} empty={sessions.length === 0} aside={sessions.length ? `${sessions.length} on this day` : null} emptyText="No workout logged on this day.">
          {sessions.map((s) => <SessionBlock key={s.id} session={s} unit={unit} />)}
          {day && day.plan_day ? (
            <div style={{ fontSize: 12, color: COLORS.muted }}>Plan day {day.plan_day.day} ({day.plan_day.name}) was completed on this day.</div>
          ) : null}
        </WorkoutCard>

        <WorkoutCard title="Totals">
          <div style={tileGrid(100)}>
            <WorkoutTile label="Streak" value={awards.streak} unit={awards.streak === 1 ? 'day' : 'days'} />
            <WorkoutTile label="Workouts" value={awards.workout_count} sub={c.sessions !== undefined ? `${c.sessions} in the snapshot` : null} />
            <WorkoutTile label="Active" value={awards.active_time_min} unit="min" />
            <WorkoutTile label="Last session" value={last ? shortDate(last.date) : null} size={16} sub={last ? last.title : null} />
          </div>
        </WorkoutCard>

        <WorkoutCard title="Body Weight" empty={!latestWeight && !profile.current_weight_kg}>
          <div style={tileGrid(100)}>
            <WorkoutTile label="Current" value={num(toUnit(latestWeight ? latestWeight.kg : profile.current_weight_kg, unit), 1)} unit={unit} sub={latestWeight ? `logged ${shortDate(latestWeight.date)}` : null} />
            <WorkoutTile label="Target" value={num(toUnit(profile.target_weight_kg, unit), 1)} unit={unit} />
            <WorkoutTile label="Height" value={profile.height_cm ? num(profile.height_cm / 2.54) : null} unit="in" sub={profile.bmi ? `BMI ${num(profile.bmi, 1)}` : null} />
          </div>
          <div style={{ marginTop: 14 }}><WeightChart weights={weights} unit={unit} /></div>
        </WorkoutCard>

        <WorkoutCard title={`Last ${HISTORY_DAYS} Days`} span={2} empty={history.length === 0} aside={history.length ? `${history.length} sessions` : null} emptyText={`No sessions in the ${HISTORY_DAYS} days ending on this date.`}>
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
                    <td style={tdNum}><Link to={`/workout/${s.date}`} style={{ textDecoration: 'underline' }}>{shortDate(s.date)}</Link></td>
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

      <section style={{ marginTop: 32, background: COLORS.paper, border: `1px solid ${COLORS.ink}`, padding: '12px 16px' }}>
        <button
          type="button"
          onClick={() => setShowTemplates((s) => !s)}
          style={{ width: '100%', background: 'transparent', border: 'none', padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: COLORS.ink, cursor: 'pointer' }}
        >
          <span style={{ fontStyle: 'italic', fontSize: 13, fontWeight: 500 }}>Plan and Templates</span>
          <span style={{ color: COLORS.accent, fontSize: 14 }}>{showTemplates ? '▾' : '▸'}</span>
        </button>
        {showTemplates ? (
          <div style={{ marginTop: 10, borderTop: `1px solid ${COLORS.ink}`, paddingTop: 12 }}>
            {!catalog ? <div style={{ color: COLORS.muted, fontSize: 12 }}>Loading...</div> : (
              <>
                {plan ? (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.muted, marginBottom: 6 }}>{plan.total_days}-day plan</div>
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
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.muted, marginBottom: 6 }}>Gym templates</div>
                <Templates catalog={catalog} unit={unit} />
              </>
            )}
          </div>
        ) : null}
      </section>
      <div style={{ marginTop: 10, fontSize: 11, color: COLORS.faint }}>
        Home Workouts app data, exported on the Mac and read from <code>backend/workout-state</code>. Only what the Mac copy of the app has synced is here.
        {' '}Back to <Link to={`/agenda/${date}`} style={{ textDecoration: 'underline' }}>the agenda</Link>.
      </div>
    </>
  );
}
