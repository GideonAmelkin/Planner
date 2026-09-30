import React, { useState } from 'react';
import WorkoutCard from './WorkoutCard';
import { exerciseHistory, inRange, newRecords, records } from './strength';
import { muscleVolume } from './muscles';
import { Delta, fmtVolume, monthDay, readOpen, writeOpen } from './ptParts';
import { Figure } from './ui';
import ExerciseTicker from './ExerciseTicker';
import MuscleChart from './MuscleChart';
import { shiftISO } from '../shared/dayInfo';
import { RANGES } from './ranges';
import { COLORS } from '../shared/styles';

// Personal Trainer: the guided gym sessions the user logs in the app with reps and weight.
//   top     big-number figures (sessions, exercises, volume, vs the previous session), then the
//           MuscleChart: volume per group this range against the same-length range before it
//   bottom  the ticker board: one row per exercise (est. 1RM, change, trend, volume), sortable,
//           a row click opens the exercise detail (rep-max table, records, sessions, chart)
// The body figure and the balance radar live in the Overview since 2026-09-29; picking a muscle
// there, or on the MuscleChart here, filters the ticker.
// The range and the muscle filter belong to the page (WorkoutView): one range picker in the top bar
// drives every section, and the Overview's "Open in Trainer" sets the muscle.
// Rule: never render a comparison that has nothing to compare (trend lines, PR pills and the
// chart need two sessions). Math in strength.js and muscles.js; shared pieces in ptParts.jsx.

export default function PersonalTrainer({ data, date, rangeKey, customFrom, customTo, muscle, onMuscle }) {
  const [openIds, setOpenIds] = useState(readOpen);
  const [metric, setMetric] = useState('e1rm_kg');
  const all = (data && data.sessions) || [];
  const unit = (data && data.weight_unit) || 'lb';
  // Same choices as the top card. Lifetime starts at the first gym session; Custom runs From..To
  // (nothing when From is after To).
  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[2];
  const rangeEnd = rangeKey === 'custom' ? customTo : date;
  const rangeStart = rangeKey === 'custom' ? customFrom
    : rangeKey === 'lifetime' ? (all.length ? all[0].date : date)
      : shiftISO(date, -(range.days - 1));
  const sessions = rangeStart <= rangeEnd ? inRange(all, rangeStart, rangeEnd) : [];
  const history = exerciseHistory(sessions);
  const latest = sessions.length ? sessions[sessions.length - 1] : null;
  const previous = sessions.length > 1 ? sessions[sessions.length - 2] : null;
  const volumeKg = sessions.reduce((t, s) => t + (s.total_weight_kg || 0), 0);
  const unnamed = history.filter((h) => !h.name);
  const sessionsById = new Map(sessions.map((s) => [s.id, s]));
  const cards = history.map((h) => ({ ...h, rec: records(h.points), prs: newRecords(h.points) }));
  // The radar's comparison: the same number of days right before this range (none for Lifetime).
  const spanDays = Math.round((Date.parse(`${rangeEnd}T12:00:00`) - Date.parse(`${rangeStart}T12:00:00`)) / 86400000) + 1;
  const beforeEnd = shiftISO(rangeStart, -1);
  const beforeStart = shiftISO(rangeStart, -spanDays);
  const before = rangeKey === 'lifetime' ? null : muscleVolume(inRange(all, beforeStart, beforeEnd));
  const beforeLabel = spanDays === 1 ? monthDay(beforeEnd) : `${monthDay(beforeStart)} to ${monthDay(beforeEnd)}`;
  const now = muscleVolume(sessions);
  const pick = (m) => onMuscle(muscle === m ? null : m);
  const toggle = (id) => setOpenIds((ids) => { const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]; writeOpen(next); return next; });
  const aside = data === null ? 'Loading...' : `${all.length} gym session${all.length === 1 ? '' : 's'}`;

  if (data && !all.length) {
    return (
      <WorkoutCard title="Personal Trainer" icon="dumbbell" sub="Your gym lifts: volume per muscle and every exercise" aside={aside}>
        <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6, maxWidth: 640 }}>
          No gym sessions here yet. A session shows up after four steps: you finish it in the phone app, the phone app backs it up (Me &gt; Sync Data), the Mac's hourly sync pulls that backup, and the export ships it here. The status line at the top says where that chain stands.
        </div>
      </WorkoutCard>
    );
  }

  return (
    <WorkoutCard title="Personal Trainer" icon="dumbbell" sub="Your gym lifts: volume per muscle and every exercise" aside={aside}>
      {unnamed.length ? (
        <div style={{ fontSize: 12, color: COLORS.warn, marginBottom: 10 }}>
          {unnamed.length} exercise{unnamed.length === 1 ? '' : 's'} without a name yet (id{unnamed.length === 1 ? '' : 's'} {unnamed.map((h) => h.action_id).join(', ')}): the app has not downloaded their text, so they show as "Exercise &lt;id&gt;".
        </div>
      ) : null}

      {/* Level 1: the figures, no number twice. */}
      {latest ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 18 }}>
          <Figure label="Sessions" value={sessions.length} sub={sessions.length === 1 ? monthDay(latest.date) : `${monthDay(sessions[0].date)} to ${monthDay(latest.date)}`} />
          <Figure label="Exercises" value={history.length} sub="different lifts" />
          <Figure label="Volume lifted" value={fmtVolume(volumeKg, unit)} unit={unit} sub="weight x reps, every set" />
          {previous ? <Figure label="Last session" value={fmtVolume(latest.total_weight_kg || 0, unit)} unit={unit} sub={<Delta kg={(latest.total_weight_kg || 0) - (previous.total_weight_kg || 0)} unit={unit} suffix=" vs the one before" />} /> : null}
        </div>
      ) : <div style={{ marginTop: 4, fontSize: 13, color: COLORS.muted }}>No gym sessions in this range. Pick a longer range at the top.</div>}

      {latest ? (
        <>
          <div style={{ marginTop: 22 }}>
            <MuscleChart now={now} before={before} beforeLabel={beforeLabel} unit={unit} selected={muscle} onSelect={pick} />
          </div>
          <div style={{ marginTop: 26 }}>
            <ExerciseTicker history={cards} allHistory={exerciseHistory(all)} unit={unit} muscle={muscle} onClearMuscle={() => onMuscle(null)}
              openIds={openIds} onToggle={toggle} sessionsById={sessionsById} metric={metric} setMetric={setMetric} />
          </div>
        </>
      ) : null}
    </WorkoutCard>
  );
}
