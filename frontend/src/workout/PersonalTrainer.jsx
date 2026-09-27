import React, { useState } from 'react';
import WorkoutCard from './WorkoutCard';
import WorkoutTile, { tableWrap, table, th, headRow, td, tdNum } from './WorkoutTile';
import { compareToPrevious, exerciseHistory, fmtWeight, inRange, records, toUnit, weeklyVolume } from './strength';
import { shiftISO } from '../shared/dayInfo';
import { num, secondsToHm } from '../shared/format';
import { COLORS, pill, navButton } from '../shared/styles';

// Personal Trainer: the guided gym sessions the user logs in the app with reps and weight,
// shown the way strength apps show growth: estimated 1RM per exercise (Epley, the same figure
// the app prints as "1 RM"), best set, heaviest weight, records, volume per week, and each
// session compared with the previous time the exercise was done. All math is in strength.js.
const RANGES = [
  { key: 'd30', label: '30 days', days: 30 },
  { key: 'd90', label: '90 days', days: 90 },
  { key: 'y365', label: '365 days', days: 365 },
  { key: 'all', label: 'All time', days: null },
];

const shortDate = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '-');
const monthDay = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-');
const fmtVolume = (kg, unit) => { const v = toUnit(kg, unit); return v === null ? '-' : num(Math.round(v)); };
const kVolume = (kg, unit) => { const v = toUnit(kg, unit) || 0; return v >= 10000 ? `${(v / 1000).toFixed(1)}k` : num(Math.round(v)); };
const e1rmText = (kg, unit) => { const v = toUnit(kg, unit); return v === null ? '-' : v.toFixed(1); };
const setText = (best, unit) => (best ? `${fmtWeight(best.weight_kg, unit)} ${unit} × ${best.reps}` : '-');
const setsText = (sets, unit) => (sets || []).map((s) => `${fmtWeight(s.weight_kg, unit)} × ${s.reps}`).join(', ');
// A name the export could not resolve shows the id with a visible marker.
const nameOf = (h) => h.name || `Exercise ${h.action_id}`;
const missingMark = <span style={{ color: COLORS.warn, fontSize: 11, marginLeft: 6 }} title="The app has not downloaded this exercise's text yet">(name missing)</span>;

function Delta({ kg, unit, suffix = '' }) {
  if (kg === null || kg === undefined || Math.abs(kg) < 0.05) return <span style={{ color: COLORS.muted }}>same</span>;
  const up = kg > 0;
  return <span style={{ color: up ? COLORS.done : COLORS.danger, fontWeight: 600 }}>{up ? '▲' : '▼'} {fmtWeight(Math.abs(kg), unit)} {unit}{suffix}</span>;
}

// Estimated 1RM per session, one line, 2px, markers with a surface ring; one session is one dot.
function Sparkline({ points, unit }) {
  const W = 120;
  const H = 28;
  const pad = 5;
  const ys = points.map((p) => p.e1rm_kg || 0);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const sx = (i) => (points.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (points.length - 1));
  const sy = (v) => (max === min ? H / 2 : H - pad - ((v - min) * (H - 2 * pad)) / (max - min));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)},${sy(p.e1rm_kg || 0).toFixed(1)}`).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Estimated 1RM over ${points.length} session${points.length === 1 ? '' : 's'}`} style={{ display: 'block' }}>
      {points.length > 1 ? <path d={d} fill="none" stroke={COLORS.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
      {points.map((p, i) => (
        <circle key={p.session_id} cx={sx(i)} cy={sy(p.e1rm_kg || 0)} r={4} fill={COLORS.accent} stroke={COLORS.paper} strokeWidth={2}>
          <title>{`${monthDay(p.date)}: ${e1rmText(p.e1rm_kg, unit)} ${unit} est. 1RM`}</title>
        </circle>
      ))}
    </svg>
  );
}

// Tonnage per week: thin rounded bars from one baseline, the value above each, empty weeks faint.
function WeeklyBars({ weeks, unit }) {
  const H = 48;
  const max = Math.max(1, ...weeks.map((w) => w.volume_kg));
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${weeks.length}, 1fr)`, gap: 6, alignItems: 'end', height: H + 18, paddingTop: 18 }}>
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
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: COLORS.muted, marginTop: 6 }}>
        <span>{monthDay(weeks[0].start)}</span>
        <span>{unit} lifted per week</span>
        <span>{monthDay(weeks[weeks.length - 1].start)}</span>
      </div>
    </div>
  );
}

export default function PersonalTrainer({ data, date }) {
  const [rangeKey, setRangeKey] = useState('d30');
  const [openId, setOpenId] = useState(null);
  const all = (data && data.sessions) || [];
  const unit = (data && data.weight_unit) || 'lb';
  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[0];
  const rangeStart = range.days ? shiftISO(date, -(range.days - 1)) : (all.length ? all[0].date : date);
  const sessions = inRange(all, rangeStart, date);
  const history = exerciseHistory(sessions);
  const latest = sessions.length ? sessions[sessions.length - 1] : null;
  const previous = latest ? [...all].filter((s) => s.date <= latest.date && s.id !== latest.id).pop() : null;
  const comparison = compareToPrevious(latest, all);
  const volumeKg = sessions.reduce((t, s) => t + (s.total_weight_kg || 0), 0);
  const unnamed = history.filter((h) => !h.name);
  const weeks = latest ? weeklyVolume(sessions, rangeStart, date) : [];
  const baselineDate = sessions.length ? sessions[0].date : null;
  const rows = history
    .map((h) => ({ ...h, last: h.points[h.points.length - 1], first: h.points[0], rec: records(h.points) }))
    .sort((a, b) => (a.last.date === b.last.date ? nameOf(a).localeCompare(nameOf(b)) : (a.last.date < b.last.date ? 1 : -1)));
  const aside = data === null ? 'Loading...' : `${all.length} gym session${all.length === 1 ? '' : 's'}${all.length ? ` · last ${monthDay(all[all.length - 1].date)}` : ''}`;
  const controlStyle = { ...navButton, fontSize: 12, padding: '4px 8px', cursor: 'pointer' };
  const actions = (
    <select value={rangeKey} onChange={(e) => { setRangeKey(e.target.value); setOpenId(null); }} style={controlStyle} title="Range">
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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, flexWrap: 'wrap' }}>
        <WorkoutTile label="Sessions" value={sessions.length} />
        <WorkoutTile label="Volume" value={sessions.length ? fmtVolume(volumeKg, unit) : null} unit={unit} />
        <WorkoutTile label="Exercises tracked" value={history.length} />
        <WorkoutTile label="Last session" value={latest ? fmtVolume(latest.total_weight_kg, unit) : null} unit={unit}
          sub={latest && previous ? <Delta kg={(latest.total_weight_kg || 0) - (previous.total_weight_kg || 0)} unit={unit} suffix=" vs previous" /> : (latest ? <span style={{ color: COLORS.muted }}>first session</span> : null)} />
      </div>

      {latest ? (
        <div style={{ marginTop: 18, background: COLORS.page, borderRadius: 12, padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{latest.title || 'Gym workout'}</span>
            <span style={{ fontSize: 12, color: COLORS.muted }}>{shortDate(latest.date)}</span>
            <span style={pill}>{secondsToHm(latest.duration_s) || '-'}</span>
            {latest.calories ? <span style={pill}>{num(latest.calories)} kcal</span> : null}
            <span style={pill}>{fmtVolume(latest.total_weight_kg, unit)} {unit}</span>
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, margin: '4px 0 10px' }}>
            {previous ? `Compared with the previous time each exercise was done.` : 'Baseline. Growth shows from your second session.'}
          </div>
          <div style={tableWrap}>
            <table style={table}>
              <thead><tr style={headRow}><th style={th}>Exercise</th><th style={th}>Sets</th><th style={th}>Best set</th><th style={{ ...th, textAlign: 'right' }}>Est. 1RM ({unit})</th><th style={th}>vs previous</th></tr></thead>
              <tbody>
                {comparison.map((c) => (
                  <tr key={c.action_id}>
                    <td style={td}>{c.name || `Exercise ${c.action_id}`}{c.name ? null : missingMark}</td>
                    <td style={td}>{c.now.sets ? setsText((latest.exercises.find((e) => String(e.action_id) === c.action_id) || {}).sets, unit) : '-'}</td>
                    <td style={td}>{setText(c.now.best, unit)}</td>
                    <td style={tdNum}>{e1rmText(c.now.e1rm_kg, unit)}</td>
                    <td style={td}>{c.status === 'first' ? <span style={{ color: COLORS.muted }}>first time</span> : c.status === 'empty' ? '-' : <Delta kg={c.delta_e1rm_kg} unit={unit} suffix=" est. 1RM" />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 14, fontSize: 13, color: COLORS.muted }}>No gym sessions in this range. Pick a longer range above.</div>
      )}

      {rows.length ? (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>By exercise · change since {monthDay(baselineDate)} (the first session in this range)</div>
          <div style={tableWrap}>
            <table style={table}>
              <thead>
                <tr style={headRow}>
                  {['Exercise', 'Sessions', 'Best set', `Est. 1RM (${unit})`, `Change since ${monthDay(baselineDate)}`, `Heaviest (${unit})`, 'Trend'].map((h) => <th key={h} style={th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const open = openId === r.action_id;
                  const change = r.points.length > 1 && r.first.e1rm_kg ? ((r.last.e1rm_kg - r.first.e1rm_kg) / r.first.e1rm_kg) * 100 : null;
                  return (
                    <React.Fragment key={r.action_id}>
                      <tr onClick={() => setOpenId(open ? null : r.action_id)} style={{ cursor: 'pointer', background: open ? COLORS.calloutBg : undefined }} title="Click for this exercise's log and records">
                        <td style={td}>{nameOf(r)}{r.name ? null : missingMark}</td>
                        <td style={tdNum}>{r.points.length}</td>
                        <td style={td}>{setText(r.last.best, unit)}</td>
                        <td style={tdNum}>{e1rmText(r.last.e1rm_kg, unit)}</td>
                        <td style={td}>{change === null ? <span style={{ color: COLORS.muted }}>baseline</span> : <span style={{ color: change > 0 ? COLORS.done : change < 0 ? COLORS.danger : COLORS.muted, fontWeight: 600 }}>{change > 0 ? '▲' : change < 0 ? '▼' : ''} {Math.abs(change).toFixed(1)}%</span>}</td>
                        <td style={tdNum}>{fmtWeight(r.rec.heaviest && r.rec.heaviest.kg, unit)}</td>
                        <td style={td}><Sparkline points={r.points} unit={unit} /></td>
                      </tr>
                      {open ? (
                        <tr>
                          <td colSpan={7} style={{ ...td, background: COLORS.calloutBg, paddingBottom: 12 }}>
                            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 6 }}>
                              Records: heaviest {fmtWeight(r.rec.heaviest && r.rec.heaviest.kg, unit)} {unit} ({monthDay(r.rec.heaviest && r.rec.heaviest.date)}) · best set {r.rec.bestSet ? `${setText(r.rec.bestSet.set, unit)} (${monthDay(r.rec.bestSet.date)})` : '-'} · best session volume {fmtVolume(r.rec.bestSession && r.rec.bestSession.kg, unit)} {unit} ({monthDay(r.rec.bestSession && r.rec.bestSession.date)})
                            </div>
                            <table style={table}>
                              <thead><tr style={headRow}><th style={th}>Date</th><th style={th}>Sets</th><th style={{ ...th, textAlign: 'right' }}>Volume ({unit})</th><th style={{ ...th, textAlign: 'right' }}>Est. 1RM ({unit})</th></tr></thead>
                              <tbody>
                                {[...r.points].reverse().map((p) => (
                                  <tr key={p.session_id}>
                                    <td style={td}>{shortDate(p.date)}</td>
                                    <td style={td}>{setsText((sessions.find((s) => s.id === p.session_id) || { exercises: [] }).exercises.find((e) => String(e.action_id) === r.action_id)?.sets, unit)}</td>
                                    <td style={tdNum}>{fmtVolume(p.volume_kg, unit)}</td>
                                    <td style={tdNum}>{e1rmText(p.e1rm_kg, unit)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {weeks.length ? <div style={{ marginTop: 18 }}><WeeklyBars weeks={weeks} unit={unit} /></div> : null}
    </WorkoutCard>
  );
}
