import React, { useState } from 'react';
import WorkoutCard from './WorkoutCard';
import { tableWrap, table, th, headRow, td, tdNum } from './WorkoutTile';
import { compressSets, exerciseHistory, exerciseSessionRows, fmtWeight, inRange, newRecords, records, repMaxTable, toUnit, weeklyVolume, EPLEY_MAX_REPS } from './strength';
import { shiftISO } from '../shared/dayInfo';
import { num, secondsToHm } from '../shared/format';
import { COLORS, pill, navButton } from '../shared/styles';

// Personal Trainer: the guided gym sessions the user logs in the app with reps and weight, with the
// EXERCISE as the primary object (as Hevy, FitNotes, Stronglifts and Alpha Progression have it):
//   level 1  one summary line for the range, then the latest session as a compact block
//   level 2  one card per exercise, most recent first: best e1RM with its set, the sets compressed
//   level 3  the card expanded in place: rep-max table, records grid, that exercise's session
//            history, and the metric chart once there are two sessions
// Rule: never render a comparison that has nothing to compare. Anything needing two sessions
// (deltas, PR badges, sparklines, the chart) is absent until it can say something, and one muted
// line per block says what unlocks it. All math is in strength.js.
const RANGES = [
  { key: 'd30', label: '30 days', days: 30 },
  { key: 'd90', label: '90 days', days: 90 },
  { key: 'y365', label: '365 days', days: 365 },
  { key: 'all', label: 'All time', days: null },
];
const METRICS = [
  { key: 'e1rm_kg', label: 'Est. 1RM', weight: true },
  { key: 'heaviest_kg', label: 'Heaviest', weight: true },
  { key: 'volume_kg', label: 'Volume', weight: true },
  { key: 'reps', label: 'Total reps', weight: false },
];
// Which exercise cards are expanded, kept like the Workouts card's state (survives tabs and reloads).
const OPEN_KEY = 'plannerWorkoutExerciseOpen';
const readOpen = () => { try { const v = JSON.parse(localStorage.getItem(OPEN_KEY) || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch (_) { return []; } };
const writeOpen = (ids) => { try { localStorage.setItem(OPEN_KEY, JSON.stringify(ids)); } catch (_) { /* ignore */ } };

const shortDate = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '-');
const monthDay = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-');
const fmtVolume = (kg, unit) => { const v = toUnit(kg, unit); return v === null ? '-' : num(Math.round(v)); };
const kVolume = (kg, unit) => { const v = toUnit(kg, unit) || 0; return v >= 10000 ? `${(v / 1000).toFixed(1)}k` : num(Math.round(v)); };
const e1rmText = (kg, unit) => { const v = toUnit(kg, unit); return v === null ? 'NA' : v.toFixed(1); };
const setText = (set, unit) => (set ? `${fmtWeight(set.weight_kg, unit)} ${unit} × ${set.reps}` : '-');
const nameOf = (h) => h.name || `Exercise ${h.action_id}`;
const missingMark = <span style={{ color: COLORS.warn, fontSize: 11, marginLeft: 6 }} title="The app has not downloaded this exercise's text yet">(name missing)</span>;
const muted = { fontSize: 12, color: COLORS.muted };
const label = { fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: COLORS.muted };

function Delta({ kg, unit, suffix = '' }) {
  if (kg === null || kg === undefined) return null;
  if (Math.abs(kg) < 0.05) return <span style={muted}>same</span>;
  const up = kg > 0;
  return <span style={{ color: up ? COLORS.done : COLORS.danger, fontWeight: 600, fontSize: 12 }}>{up ? '▲' : '▼'} {fmtWeight(Math.abs(kg), unit)} {unit}{suffix}</span>;
}

// One series over sessions: 2px line, markers with a surface ring, a title per marker. Only drawn
// with two or more points (the caller guarantees it).
function LineChart({ points, valueOf, format, width = 560, height = 120 }) {
  const padL = 8; const padR = 8; const padT = 14; const padB = 18;
  const ys = points.map(valueOf);
  const min = Math.min(...ys); const max = Math.max(...ys);
  const sx = (i) => padL + (i * (width - padL - padR)) / (points.length - 1);
  const sy = (v) => (max === min ? height / 2 : height - padB - ((v - min) * (height - padT - padB)) / (max - min));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(valueOf(p)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label="Metric over sessions" style={{ display: 'block', maxWidth: width }}>
      <line x1={padL} x2={width - padR} y1={height - padB} y2={height - padB} stroke={COLORS.hairline} strokeWidth={1} />
      <path d={d} fill="none" stroke={COLORS.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (
        <circle key={p.session_id} cx={sx(i)} cy={sy(valueOf(p))} r={4} fill={COLORS.accent} stroke={COLORS.paper} strokeWidth={2}>
          <title>{`${monthDay(p.date)}: ${format(valueOf(p))}`}</title>
        </circle>
      ))}
      <text x={padL} y={height - 4} fontSize={10} fill={COLORS.muted}>{monthDay(points[0].date)}</text>
      <text x={width - padR} y={height - 4} fontSize={10} fill={COLORS.muted} textAnchor="end">{monthDay(points[points.length - 1].date)}</text>
      <text x={width - padR} y={padT - 3} fontSize={10} fill={COLORS.muted} textAnchor="end">{format(max)}</text>
    </svg>
  );
}

function Sparkline({ points, valueOf }) {
  const W = 96; const H = 24; const pad = 5;
  const ys = points.map(valueOf); const min = Math.min(...ys); const max = Math.max(...ys);
  const sx = (i) => pad + (i * (W - 2 * pad)) / (points.length - 1);
  const sy = (v) => (max === min ? H / 2 : H - pad - ((v - min) * (H - 2 * pad)) / (max - min));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(valueOf(p)).toFixed(1)}`).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Estimated 1RM over ${points.length} sessions`} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={COLORS.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx(points.length - 1)} cy={sy(valueOf(points[points.length - 1]))} r={4} fill={COLORS.accent} stroke={COLORS.paper} strokeWidth={2} />
    </svg>
  );
}

// Tonnage per week from the first week with data: thin rounded bars from one baseline. Tonnage is
// dominated by leg work; sets per muscle group is the better measure (see strength.js weeklyVolume).
function WeeklyBars({ weeks, unit }) {
  const H = 48;
  const max = Math.max(1, ...weeks.map((w) => w.volume_kg));
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))`, gap: 6, alignItems: 'end', height: H + 18, paddingTop: 18 }}>
        {weeks.map((w) => {
          const h = w.volume_kg ? Math.max(6, Math.round((w.volume_kg / max) * H)) : 4;
          return (
            <div key={w.start} title={`Week of ${monthDay(w.start)}: ${fmtVolume(w.volume_kg, unit)} ${unit}, ${w.sessions} session${w.sessions === 1 ? '' : 's'}`} style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: H }}>
              <div style={{ width: '100%', maxWidth: 24, height: h, background: w.volume_kg ? COLORS.accent : COLORS.faint, opacity: w.volume_kg ? 1 : 0.5, borderRadius: '4px 4px 0 0' }} />
              {w.volume_kg ? <span style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 10, fontWeight: 600, color: COLORS.ink, whiteSpace: 'nowrap' }}>{kVolume(w.volume_kg, unit)}</span> : null}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLORS.muted, marginTop: 6, gap: 8 }}>
        <span>{monthDay(weeks[0].start)}</span>
        <span style={{ textAlign: 'center' }}>{unit} lifted per week (tonnage; sets per muscle group would be the better measure)</span>
        <span>{monthDay(weeks[weeks.length - 1].start)}</span>
      </div>
    </div>
  );
}

// Level 3: the expanded exercise card.
function ExerciseDetail({ h, unit, sessionsById, metric, setMetric }) {
  const rec = records(h.points);
  const rows = repMaxTable(h.points);
  const many = h.points.length > 1;
  const history = exerciseSessionRows(h.points);
  const m = METRICS.find((x) => x.key === metric) || METRICS[0];
  const fmt = (v) => (m.weight ? `${m.key === 'volume_kg' ? fmtVolume(v, unit) : e1rmText(v, unit)} ${unit}` : `${num(v)} reps`);
  const recTile = (title, value, date) => (
    <div style={{ minWidth: 120 }}>
      <div style={label}>{title}</div>
      <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{value}</div>
      <div style={muted}>{monthDay(date)}</div>
    </div>
  );
  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ ...label, marginBottom: 6 }}>Rep max table</div>
        <div style={tableWrap}>
          <table style={{ ...table, maxWidth: 480 }}>
            <thead><tr style={headRow}><th style={th}>Reps</th><th style={th}>Best actual ({unit})</th><th style={th}>Estimated ({unit})</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.reps} style={r.pr ? { background: COLORS.calloutBg } : undefined}>
                  <td style={tdNum}>{r.reps}</td>
                  <td style={td}>{r.actual ? <>{fmtWeight(r.actual.kg, unit)} <span style={muted}>{monthDay(r.actual.date)}</span>{r.pr ? <span style={{ ...pill, color: COLORS.accent, marginLeft: 6, fontSize: 10 }}>PR</span> : null}</> : <span style={{ color: COLORS.faint }}>-</span>}</td>
                  <td style={tdNum}>{r.estimated_kg === null ? 'NA' : fmtWeight(r.estimated_kg, unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ ...muted, marginTop: 4 }}>Estimates from the best set by Epley, meaningful up to {EPLEY_MAX_REPS} reps.</div>
      </div>
      <div>
        <div style={{ ...label, marginBottom: 6 }}>Records</div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {rec.heaviest ? recTile('Heaviest weight', `${fmtWeight(rec.heaviest.kg, unit)} ${unit}`, rec.heaviest.date) : null}
          {rec.bestE1rm ? recTile('Best est. 1RM', `${e1rmText(rec.bestE1rm.kg, unit)} ${unit}`, rec.bestE1rm.date) : null}
          {rec.bestE1rm ? recTile('Est. 10RM', `${e1rmText(rec.bestE1rm.e10rm_kg, unit)} ${unit}`, rec.bestE1rm.date) : null}
          {rec.bestSet ? recTile('Best set volume', `${fmtVolume(rec.bestSet.kg, unit)} ${unit} (${setText(rec.bestSet.set, unit)})`, rec.bestSet.date) : null}
          {rec.bestSession ? recTile('Best session volume', `${fmtVolume(rec.bestSession.kg, unit)} ${unit}`, rec.bestSession.date) : null}
          {rec.mostReps ? recTile('Most reps in a set', `${rec.mostReps.set.reps} (${fmtWeight(rec.mostReps.set.weight_kg, unit)} ${unit})`, rec.mostReps.date) : null}
        </div>
      </div>
      <div>
        <div style={{ ...label, marginBottom: 6 }}>Sessions</div>
        <div style={tableWrap}>
          <table style={table}>
            <thead><tr style={headRow}><th style={th}>Date</th><th style={th}>Sets</th><th style={{ ...th, textAlign: 'right' }}>Volume ({unit})</th><th style={{ ...th, textAlign: 'right' }}>Est. 1RM</th>{many ? <th style={th}>vs previous</th> : null}</tr></thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.session_id}>
                  <td style={td}>{shortDate(p.date)}</td>
                  <td style={td}>{compressSets(p.set_list, unit)}</td>
                  <td style={tdNum}>{fmtVolume(p.volume_kg, unit)}</td>
                  <td style={tdNum}>{e1rmText(p.e1rm_kg, unit)}</td>
                  {many ? <td style={td}>{p.delta_e1rm_kg === null ? <span style={muted}>-</span> : <Delta kg={p.delta_e1rm_kg} unit={unit} />}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        {many ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
              <span style={label}>Chart</span>
              {METRICS.map((x) => (
                <button key={x.key} type="button" onClick={() => setMetric(x.key)} style={{ ...navButton, fontSize: 12, padding: '3px 8px', cursor: 'pointer', fontWeight: x.key === metric ? 700 : 500, color: x.key === metric ? COLORS.accent : COLORS.ink }}>{x.label}</button>
              ))}
            </div>
            <LineChart points={h.points} valueOf={(p) => p[m.key] || 0} format={fmt} />
          </>
        ) : <div style={muted}>The chart (est. 1RM, heaviest, volume, total reps over time) appears from your second session of this exercise.</div>}
      </div>
    </div>
  );
}

export default function PersonalTrainer({ data, date }) {
  const [rangeKey, setRangeKey] = useState('d30');
  const [openIds, setOpenIds] = useState(readOpen);
  const [metric, setMetric] = useState('e1rm_kg');
  const all = (data && data.sessions) || [];
  const unit = (data && data.weight_unit) || 'lb';
  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[0];
  const rangeStart = range.days ? shiftISO(date, -(range.days - 1)) : (all.length ? all[0].date : date);
  const sessions = inRange(all, rangeStart, date);
  const history = exerciseHistory(sessions);
  const latest = sessions.length ? sessions[sessions.length - 1] : null;
  const previous = sessions.length > 1 ? sessions[sessions.length - 2] : null;
  const volumeKg = sessions.reduce((t, s) => t + (s.total_weight_kg || 0), 0);
  const unnamed = history.filter((h) => !h.name);
  const weeks = latest ? weeklyVolume(sessions, rangeStart, date) : [];
  const sessionsById = new Map(sessions.map((s) => [s.id, s]));
  const cards = history.map((h) => ({ ...h, last: h.points[h.points.length - 1], rec: records(h.points), prs: newRecords(h.points) }))
    .sort((a, b) => (a.last.date === b.last.date ? nameOf(a).localeCompare(nameOf(b)) : (a.last.date < b.last.date ? 1 : -1)));
  const toggle = (id) => setOpenIds((ids) => { const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]; writeOpen(next); return next; });
  const aside = data === null ? 'Loading...' : `${all.length} gym session${all.length === 1 ? '' : 's'}`;
  const actions = (
    <select value={rangeKey} onChange={(e) => setRangeKey(e.target.value)} style={{ ...navButton, fontSize: 12, padding: '4px 8px', cursor: 'pointer' }} title="Range">
      {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
    </select>
  );

  if (data && !all.length) {
    return (
      <WorkoutCard title="Personal Trainer" dot={COLORS.workout} aside={aside}>
        <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6, maxWidth: 640 }}>
          No gym sessions here yet. A session shows up after four steps: you finish it in the phone app, the phone app backs it up (Me &gt; Sync Data), the Mac's hourly sync pulls that backup, and the export ships it here. The status line at the top says where that chain stands.
        </div>
      </WorkoutCard>
    );
  }

  return (
    <WorkoutCard title="Personal Trainer" dot={COLORS.workout} aside={aside} actions={actions}>
      {unnamed.length ? (
        <div style={{ fontSize: 12, color: COLORS.warn, marginBottom: 10 }}>
          {unnamed.length} exercise{unnamed.length === 1 ? '' : 's'} without a name yet (id{unnamed.length === 1 ? '' : 's'} {unnamed.map((h) => h.action_id).join(', ')}): the app has not downloaded their text, so they show as "Exercise &lt;id&gt;".
        </div>
      ) : null}

      {/* Level 1: one line, no number twice. */}
      {latest ? (
        <div style={{ fontSize: 14, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
          <strong>{sessions.length} session{sessions.length === 1 ? '' : 's'}</strong>
          <span style={muted}>·</span><strong>{history.length} exercise{history.length === 1 ? '' : 's'}</strong>
          <span style={muted}>·</span><strong>{fmtVolume(volumeKg, unit)} {unit} lifted</strong>
          {previous ? <Delta kg={(latest.total_weight_kg || 0) - (previous.total_weight_kg || 0)} unit={unit} suffix=" vs previous session" /> : null}
          <span style={muted}>·</span><span style={muted}>{sessions.length === 1 ? monthDay(latest.date) : `${monthDay(sessions[0].date)} to ${monthDay(latest.date)}`}</span>
        </div>
      ) : <div style={{ marginTop: 4, fontSize: 13, color: COLORS.muted }}>No gym sessions in this range. Pick a longer range above.</div>}

      {/* The latest session, compact: what was done, in the compressed notation; numbers per exercise live on the cards. */}
      {latest ? (
        <div style={{ marginTop: 14, background: COLORS.page, borderRadius: 12, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{latest.title || 'Gym workout'}</span>
            <span style={muted}>{shortDate(latest.date)}</span>
            <span style={pill}>{secondsToHm(latest.duration_s) || '-'}</span>
            {latest.calories ? <span style={pill}>{num(latest.calories)} kcal</span> : null}
            <span style={pill}>{fmtVolume(latest.total_weight_kg, unit)} {unit}</span>
          </div>
          <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '4px 20px', fontSize: 13 }}>
            {(latest.exercises || []).map((e) => (
              <div key={e.action_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name && !/^\d+$/.test(e.name) ? e.name : `Exercise ${e.action_id}`}</span>
                <span style={{ color: COLORS.muted, whiteSpace: 'nowrap' }}>{compressSets(e.sets, unit) || '-'}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Level 2: one card per exercise, most recent first; click expands level 3 in place. */}
      {cards.length ? (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {cards.map((c) => {
            const open = openIds.includes(c.action_id);
            const many = c.points.length > 1;
            return (
              <div key={c.action_id} style={{ border: `1px solid ${COLORS.hairline}`, borderRadius: 12, padding: '12px 14px' }}>
                <button type="button" onClick={() => toggle(c.action_id)} aria-expanded={open} style={{ width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', color: COLORS.ink, font: 'inherit', textAlign: 'left' }}>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{nameOf(c)}</span>
                      {c.name ? null : missingMark}
                      <span style={muted}>{many ? `${c.points.length} sessions · last ${monthDay(c.last.date)}` : monthDay(c.last.date)}</span>
                      {c.prs.map((p) => <span key={p} style={{ ...pill, color: COLORS.accent, fontSize: 10 }}>PR {p}</span>)}
                    </span>
                    <span style={{ display: 'block', marginTop: 4, fontSize: 13, color: COLORS.muted }}>{compressSets(c.last.set_list, unit)}</span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
                    {many ? <Sparkline points={c.points} valueOf={(p) => p.e1rm_kg || 0} /> : null}
                    <span style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', fontSize: 18, fontWeight: 600, lineHeight: 1.1 }}>{e1rmText(c.last.e1rm_kg, unit)} <span style={{ fontSize: 11, fontWeight: 500, color: COLORS.muted }}>{unit} est. 1RM</span></span>
                      <span style={{ display: 'block', ...muted }}>from {setText(c.last.best, unit)}</span>
                    </span>
                    <span style={{ color: COLORS.accent, fontSize: 12 }} aria-hidden="true">{open ? '▾' : '▸'}</span>
                  </span>
                </button>
                {open ? <ExerciseDetail h={c} unit={unit} sessionsById={sessionsById} metric={metric} setMetric={setMetric} /> : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {weeks.length ? <div style={{ marginTop: 18 }}><WeeklyBars weeks={weeks} unit={unit} /></div> : null}
    </WorkoutCard>
  );
}
