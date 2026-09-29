import React, { useState } from 'react';
import { tableWrap, table, th, headRow, td, tdNum } from './WorkoutTile';
import { compressSets, toUnit } from './strength';
import { groupOf, muscleOf } from './muscles';
import { ExerciseDetail, Sparkline, e1rmText, fmtVolume, missingMark, monthDay, muted, nameOf, setText } from './ptParts';
import { COLORS, pill } from '../shared/styles';

// The ticker board: one row per exercise in the range, like a market board. Change is the est. 1RM
// against the first time in the range; with one session in the range, against the previous time
// ever (dated); "new" when there is none. The trend line needs two sessions in the range. A row
// click opens the full exercise detail (rep-max table, records, sessions, chart) under it.
// Sort is kept in localStorage.
const SORT_KEY = 'plannerWorkoutTickerSort';
const readSort = () => { try { const v = JSON.parse(localStorage.getItem(SORT_KEY) || 'null'); return v && v.k ? v : { k: 'last', dir: -1 }; } catch (_) { return { k: 'last', dir: -1 }; } };
const writeSort = (v) => { try { localStorage.setItem(SORT_KEY, JSON.stringify(v)); } catch (_) { /* ignore */ } };

const SORTERS = {
  name: (r) => nameOf(r).toLowerCase(),
  muscle: (r) => groupOf(r.muscle).label,
  last: (r) => r.last.date,
  sessions: (r) => r.points.length,
  e1rm: (r) => r.last.e1rm_kg || 0,
  change: (r) => (r.pct === null ? -Infinity : r.pct),
  volume: (r) => r.volume_kg,
};

export default function ExerciseTicker({ history, allHistory, unit, muscle, onClearMuscle, openIds, onToggle, sessionsById, metric, setMetric }) {
  const [sort, setSort] = useState(readSort);
  const allById = new Map(allHistory.map((h) => [h.action_id, h]));
  let rows = history.map((h) => {
    const last = h.points[h.points.length - 1];
    let base = null;
    if (h.points.length > 1) base = h.points[0];
    else {
      const earlier = ((allById.get(h.action_id) || {}).points || []).filter((p) => p.date < last.date);
      base = earlier.length ? earlier[earlier.length - 1] : null;
    }
    const ch = base && base.e1rm_kg && last.e1rm_kg ? last.e1rm_kg - base.e1rm_kg : null;
    return { ...h, last, base, ch, pct: ch === null ? null : (100 * ch) / base.e1rm_kg, muscle: muscleOf(h.name), volume_kg: h.points.reduce((t, p) => t + (p.volume_kg || 0), 0) };
  });
  if (muscle) rows = rows.filter((r) => r.muscle === muscle);
  const key = SORTERS[sort.k] || SORTERS.last;
  rows.sort((a, b) => {
    const x = key(a); const y = key(b);
    if (x === y) return nameOf(a).localeCompare(nameOf(b));
    return (x > y ? 1 : -1) * sort.dir;
  });
  const setSortKey = (k) => { const next = { k, dir: sort.k === k ? -sort.dir : (k === 'name' || k === 'muscle' ? 1 : -1) }; setSort(next); writeSort(next); };
  const head = (k, text, right) => (
    <th style={{ ...th, textAlign: right ? 'right' : 'left', cursor: 'pointer', whiteSpace: 'nowrap', userSelect: 'none' }} onClick={() => setSortKey(k)} aria-sort={sort.k === k ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      {text}{sort.k === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}
    </th>
  );
  const g = muscle ? groupOf(muscle) : null;

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase', color: COLORS.muted }}>Exercises</span>
        {g ? (
          <button type="button" onClick={onClearMuscle} style={{ ...pill, border: 'none', cursor: 'pointer', color: COLORS.ink, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.color }} />Showing {g.label} · show all ✕
          </button>
        ) : <span style={muted}>Click a row for its rep-max table, records and history. Click a header to sort.</span>}
      </div>
      <div style={tableWrap}>
        <table style={{ ...table, minWidth: 760 }}>
          <thead>
            <tr style={headRow}>
              {head('name', 'Exercise')}{head('muscle', 'Muscle')}{head('last', 'Last', true)}{head('sessions', 'Sessions', true)}
              <th style={{ ...th, textAlign: 'right' }}>Best set</th>{head('e1rm', 'Est. 1RM', true)}{head('change', 'Change', true)}
              <th style={th}>Trend</th>{head('volume', 'Volume', true)}<th style={th} aria-label="Open" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const open = openIds.includes(r.action_id);
              const mg = groupOf(r.muscle);
              const up = r.ch !== null && r.ch > 0.02; const down = r.ch !== null && r.ch < -0.02;
              return (
                <React.Fragment key={r.action_id}>
                  <tr onClick={() => onToggle(r.action_id)} style={{ cursor: 'pointer', background: open ? COLORS.page : undefined }} aria-expanded={open}>
                    <td style={{ ...td, minWidth: 220 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{nameOf(r)}{r.name ? null : missingMark}
                        {r.prs.map((p) => <span key={p} style={{ ...pill, color: COLORS.accent, fontSize: 10, marginLeft: 6, padding: '2px 7px' }}>PR {p}</span>)}
                      </div>
                      <div style={{ ...muted, marginTop: 2 }}>{compressSets(r.last.set_list, unit)}</div>
                    </td>
                    <td style={td}>
                      <span style={{ ...pill, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, padding: '2px 8px' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: mg.color }} />{mg.label}
                      </span>
                    </td>
                    <td style={{ ...tdNum, textAlign: 'right' }}>{monthDay(r.last.date)}</td>
                    <td style={{ ...tdNum, textAlign: 'right' }}>{r.points.length}</td>
                    <td style={{ ...tdNum, textAlign: 'right' }}>{setText(r.last.best, unit)}</td>
                    <td style={{ ...tdNum, textAlign: 'right' }}><strong style={{ fontSize: 15 }}>{e1rmText(r.last.e1rm_kg, unit)}</strong> <span style={muted}>{unit}</span></td>
                    <td style={{ ...tdNum, textAlign: 'right' }}>
                      {r.ch === null ? <span style={muted}>new</span> : (
                        <>
                          <span style={{ fontWeight: 700, color: up ? COLORS.done : down ? COLORS.danger : COLORS.muted }}>
                            {up ? '▲' : down ? '▼' : '='} {Math.abs(r.pct).toFixed(1)}%
                          </span>
                          <div style={muted}>{up || down ? `${up ? '+' : '-'}${toUnit(Math.abs(r.ch), unit).toFixed(1)} ${unit} ` : ''}vs {monthDay(r.base.date)}</div>
                        </>
                      )}
                    </td>
                    <td style={td}>{r.points.length > 1 ? <Sparkline points={r.points} valueOf={(p) => p.e1rm_kg || 0} /> : <span style={muted}>-</span>}</td>
                    <td style={{ ...tdNum, textAlign: 'right' }}>{fmtVolume(r.volume_kg, unit)} {unit}</td>
                    <td style={{ ...td, color: COLORS.accent, fontSize: 12 }} aria-hidden="true">{open ? '▾' : '▸'}</td>
                  </tr>
                  {open ? (
                    <tr>
                      <td colSpan={10} style={{ ...td, background: COLORS.page, padding: '4px 14px 16px' }}>
                        <ExerciseDetail h={r} unit={unit} sessionsById={sessionsById} metric={metric} setMetric={setMetric} />
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length ? <div style={{ ...muted, marginTop: 8 }}>{g ? `No ${g.label.toLowerCase()} exercises in this range.` : 'No exercises in this range.'}</div> : null}
    </div>
  );
}
