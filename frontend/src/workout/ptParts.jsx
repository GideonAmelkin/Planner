import React from 'react';
import { tableWrap, table, th, headRow, td, tdNum } from './WorkoutTile';
import { compressSets, exerciseSessionRows, fmtWeight, records, repMaxTable, toUnit, EPLEY_MAX_REPS } from './strength';
import { num } from '../shared/format';
import { COLORS } from '../shared/styles';
import { W } from './theme';
import { Chip, PastelTile, PASTELS } from './ui';

// The Personal Trainer card's shared pieces: formatters, the open-row store, the small charts and
// the expanded exercise detail (rep-max table, records, sessions, metric chart). Used by
// PersonalTrainer.jsx and ExerciseTicker.jsx.
const METRICS = [
  { key: 'e1rm_kg', label: 'Est. 1RM', weight: true },
  { key: 'heaviest_kg', label: 'Heaviest', weight: true },
  { key: 'volume_kg', label: 'Volume', weight: true },
  { key: 'reps', label: 'Total reps', weight: false },
];
// Which exercise cards are expanded, kept like the Workouts card's state (survives tabs and reloads).
export const OPEN_KEY = 'plannerWorkoutExerciseOpen';
export const readOpen = () => { try { const v = JSON.parse(localStorage.getItem(OPEN_KEY) || '[]'); return Array.isArray(v) ? v.map(String) : []; } catch (_) { return []; } };
export const writeOpen = (ids) => { try { localStorage.setItem(OPEN_KEY, JSON.stringify(ids)); } catch (_) { /* ignore */ } };

export const shortDate = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '-');
export const monthDay = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-');
export const fmtVolume = (kg, unit) => { const v = toUnit(kg, unit); return v === null ? '-' : num(Math.round(v)); };
export const e1rmText = (kg, unit) => { const v = toUnit(kg, unit); return v === null ? 'NA' : v.toFixed(1); };
export const setText = (set, unit) => (set ? `${fmtWeight(set.weight_kg, unit)} ${unit} × ${set.reps}` : '-');
export const nameOf = (h) => h.name || `Exercise ${h.action_id}`;
export const missingMark = <span style={{ color: COLORS.warn, fontSize: 11, marginLeft: 6 }} title="The app has not downloaded this exercise's text yet">(name missing)</span>;
export const muted = { fontSize: 12, color: COLORS.muted };
export const label = { fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: COLORS.muted };

export function Delta({ kg, unit, suffix = '' }) {
  if (kg === null || kg === undefined) return null;
  if (Math.abs(kg) < 0.05) return <span style={muted}>same</span>;
  const up = kg > 0;
  return <span style={{ color: up ? COLORS.done : COLORS.danger, fontWeight: 600, fontSize: 12 }}>{up ? '▲' : '▼'} {fmtWeight(Math.abs(kg), unit)} {unit}{suffix}</span>;
}

// One series over sessions: 2px line, markers with a surface ring, a title per marker. Only drawn
// with two or more points (the caller guarantees it).
export function LineChart({ points, valueOf, format, width = 560, height = 120 }) {
  const padL = 8; const padR = 8; const padT = 14; const padB = 18;
  const ys = points.map(valueOf);
  const min = Math.min(...ys); const max = Math.max(...ys);
  const sx = (i) => padL + (i * (width - padL - padR)) / (points.length - 1);
  const sy = (v) => (max === min ? height / 2 : height - padB - ((v - min) * (height - padT - padB)) / (max - min));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(valueOf(p)).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" role="img" aria-label="Metric over sessions" style={{ display: 'block', maxWidth: width }}>
      <line x1={padL} x2={width - padR} y1={height - padB} y2={height - padB} stroke={COLORS.hairline} strokeWidth={1} />
      <path d={d} fill="none" stroke={W.blue} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (
        <circle key={p.session_id} cx={sx(i)} cy={sy(valueOf(p))} r={4} fill={W.blue} stroke={COLORS.paper} strokeWidth={2}>
          <title>{`${monthDay(p.date)}: ${format(valueOf(p))}`}</title>
        </circle>
      ))}
      <text x={padL} y={height - 4} fontSize={10} fill={COLORS.muted}>{monthDay(points[0].date)}</text>
      <text x={width - padR} y={height - 4} fontSize={10} fill={COLORS.muted} textAnchor="end">{monthDay(points[points.length - 1].date)}</text>
      <text x={width - padR} y={padT - 3} fontSize={10} fill={COLORS.muted} textAnchor="end">{format(max)}</text>
    </svg>
  );
}

export function Sparkline({ points, valueOf }) {
  const W = 96; const H = 24; const pad = 5;
  const ys = points.map(valueOf); const min = Math.min(...ys); const max = Math.max(...ys);
  const sx = (i) => pad + (i * (W - 2 * pad)) / (points.length - 1);
  const sy = (v) => (max === min ? H / 2 : H - pad - ((v - min) * (H - 2 * pad)) / (max - min));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(valueOf(p)).toFixed(1)}`).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Estimated 1RM over ${points.length} sessions`} style={{ display: 'block' }}>
      <path d={d} fill="none" stroke={W.blue} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx(points.length - 1)} cy={sy(valueOf(points[points.length - 1]))} r={4} fill={W.blue} stroke={COLORS.paper} strokeWidth={2} />
    </svg>
  );
}

// Level 3: the expanded exercise card.
export function ExerciseDetail({ h, unit, sessionsById, metric, setMetric }) {
  const rec = records(h.points);
  const rows = repMaxTable(h.points);
  const many = h.points.length > 1;
  const history = exerciseSessionRows(h.points);
  const m = METRICS.find((x) => x.key === metric) || METRICS[0];
  const fmt = (v) => (m.weight ? `${m.key === 'volume_kg' ? fmtVolume(v, unit) : e1rmText(v, unit)} ${unit}` : `${num(v)} reps`);
  let tileIx = 0;
  const recTile = (title, value, date) => {
    const [bg, fg] = PASTELS[tileIx++ % PASTELS.length];
    return <PastelTile key={title} icon="trophy" label={title} value={value} sub={monthDay(date)} bg={bg} fg={fg} valueSize={15} />;
  };
  return (
    <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ ...label, marginBottom: 6 }}>Rep max table</div>
        <div style={tableWrap}>
          <table style={{ ...table, maxWidth: 480 }}>
            <thead><tr style={headRow}><th style={th}>Reps</th><th style={th}>Best actual ({unit})</th><th style={th}>Estimated ({unit})</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.reps} style={r.pr ? { background: W.blueWash } : undefined}>
                  <td style={tdNum}>{r.reps}</td>
                  <td style={td}>{r.actual ? <>{fmtWeight(r.actual.kg, unit)} <span style={muted}>{monthDay(r.actual.date)}</span>{r.pr ? <Chip color={W.blue} style={{ marginLeft: 6, fontSize: 10 }}>PR</Chip> : null}</> : <span style={{ color: COLORS.faint }}>-</span>}</td>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
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
                <button key={x.key} type="button" onClick={() => setMetric(x.key)} style={{ border: 'none', borderRadius: 999, fontSize: 12, padding: '5px 11px', cursor: 'pointer', font: 'inherit', fontWeight: x.key === metric ? 600 : 500, background: x.key === metric ? W.blue : W.chip, color: x.key === metric ? '#FFFFFF' : COLORS.ink }}>{x.label}</button>
              ))}
            </div>
            <LineChart points={h.points} valueOf={(p) => p[m.key] || 0} format={fmt} />
          </>
        ) : <div style={muted}>The chart (est. 1RM, heaviest, volume, total reps over time) appears from your second session of this exercise.</div>}
      </div>
    </div>
  );
}
