import React, { useEffect, useState } from 'react';
import WorkoutCard from './WorkoutCard';
import { exerciseHistory, inRange, newRecords, records } from './strength';
import { muscleVolume } from './muscles';
import { Delta, fmtVolume, monthDay, readOpen, writeOpen } from './ptParts';
import { Chip, Figure, figureLabel } from './ui';
import Icon from './icons';
import { DayTable, RangeBars, workoutDays } from './logParts';
import ExerciseTicker from './ExerciseTicker';
import MuscleChart from './MuscleChart';
import { shiftISO } from '../shared/dayInfo';
import { RANGES } from './ranges';
import { COLORS } from '../shared/styles';

// Personal Trainer: the gym lifts plus every workout (the Log section folded in on 2026-10-03, the user's
// pick of five layouts: option 2, charts side by side and two dropdowns).
//   top     big-number figures (sessions, exercises, volume, vs the previous session)
//   middle  two panels on one row (stacked when narrow): the MuscleChart (volume per group this range
//           against the same-length range before it) and RangeBars (workouts per day, gym and home)
//   bottom  two dropdowns, closed by default and remembered: Exercises, the ticker board (one row per
//           exercise, sortable, a row opens the exercise detail), and Workouts, one row per day
// The body figure and the balance radar live in the Overview since 2026-09-29; picking a muscle
// there, or on the MuscleChart here, filters the ticker.
// The range and the muscle filter belong to the page (WorkoutView): one range picker in the top bar
// drives every section, and the Overview's "Open in Trainer" sets the muscle.
// Rule: never render a comparison that has nothing to compare (trend lines, PR pills and the
// chart need two sessions). Math in strength.js and muscles.js; shared pieces in ptParts.jsx.

const EXERCISES_OPEN_KEY = 'plannerWorkoutExercisesOpen';
const WORKOUTS_OPEN_KEY = 'plannerWorkoutLogOpen';
const readFlag = (key) => { try { return localStorage.getItem(key) === '1'; } catch (_) { return false; } };
const writeFlag = (key, on) => { try { localStorage.setItem(key, on ? '1' : '0'); } catch (_) { /* ignore */ } };

// A dropdown row: chevron, title, a count chip; the body shows while open.
function Dropdown({ title, count, open, onToggle, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <button type="button" onClick={onToggle} aria-expanded={open} style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', border: `1px solid ${COLORS.hairline}`, background: 'rgba(255,255,255,.6)',
        borderRadius: 14, padding: '11px 14px', font: 'inherit', fontSize: 14, fontWeight: 600, color: COLORS.ink, cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ display: 'inline-flex', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .2s', color: COLORS.muted }}><Icon name="right" size={16} /></span>
        {title}
        {count ? <Chip>{count}</Chip> : null}
      </button>
      {open ? <div style={{ marginTop: 10, minWidth: 0 }}>{children}</div> : null}
    </div>
  );
}

// The two chart panels. On a narrow card (one column) they drop their frame, so the muscle chart's rows
// keep the width they had before the panels (a container query: it follows the card, not the window).
const panel = { minWidth: 0 };
const PANEL_CSS = `.pt-panel { border: 1px solid ${COLORS.hairline}; border-radius: 18px; padding: 14px 16px; background: rgba(255,255,255,.55); }
@container ptpanels (max-width: 560px) { .pt-panel { border: none; padding: 0; background: none; border-radius: 0; } }`;

export default function PersonalTrainer({ data, date, rangeKey, customFrom, customTo, muscle, onMuscle, workouts, chartStart, rangeEnd: logEnd, customValid, rangeSub, bodyUnit }) {
  const [exercisesOpen, setExercisesOpen] = useState(() => readFlag(EXERCISES_OPEN_KEY));
  const [workoutsOpen, setWorkoutsOpen] = useState(() => readFlag(WORKOUTS_OPEN_KEY));
  // A muscle picked on the Overview or the chart filters the board, so the board must be showing.
  useEffect(() => { if (muscle) setExercisesOpen(true); }, [muscle]);
  const toggleExercises = () => setExercisesOpen((o) => { writeFlag(EXERCISES_OPEN_KEY, !o); return !o; });
  const toggleWorkouts = () => setWorkoutsOpen((o) => { writeFlag(WORKOUTS_OPEN_KEY, !o); return !o; });
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
  const list = workouts || [];
  const aside = `${list.length} workout${list.length === 1 ? '' : 's'} ${rangeSub}`;
  const days = workoutDays(list);
  const activity = (
    <div className="pt-panel" style={panel}>
      <div style={figureLabel}>Workouts per day</div>
      {customValid ? <RangeBars sessions={list} startISO={chartStart} endISO={logEnd} /> : <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8 }}>Pick a start date on or before the end date.</div>}
    </div>
  );
  const workoutsDropdown = (
    <Dropdown title="Workouts" count={`${days} day${days === 1 ? '' : 's'}`} open={workoutsOpen} onToggle={toggleWorkouts}>
      <DayTable date={date} sessions={list} unit={bodyUnit || unit} />
    </Dropdown>
  );

  if (data && !all.length) {
    return (
      <WorkoutCard title="Personal Trainer" icon="dumbbell" sub="Your workouts: every session, muscle volume and lift" aside={aside}>
        <div style={{ fontSize: 13, color: COLORS.muted, lineHeight: 1.6, maxWidth: 640 }}>
          No gym sessions here yet. A session shows up after four steps: you finish it in the phone app, the phone app backs it up (Me &gt; Sync Data), the Mac's hourly sync pulls that backup, and the export ships it here. The status line at the top says where that chain stands.
        </div>
        <style>{PANEL_CSS}</style>
        <div style={{ marginTop: 18 }}>{activity}</div>
        <div style={{ marginTop: 18 }}>{workoutsDropdown}</div>
      </WorkoutCard>
    );
  }

  return (
    <WorkoutCard title="Personal Trainer" icon="dumbbell" sub="Your workouts: every session, muscle volume and lift" aside={aside}>
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

      <style>{PANEL_CSS}</style>
      <div style={{ containerType: 'inline-size', containerName: 'ptpanels', marginTop: 22 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: 16, alignItems: 'stretch' }}>
        {latest ? (
          <div className="pt-panel" style={panel}>
            <MuscleChart now={now} before={before} beforeLabel={beforeLabel} unit={unit} selected={muscle} onSelect={pick} />
          </div>
        ) : null}
        {activity}
      </div>
      </div>

      <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
        {latest ? (
          <Dropdown title="Exercises" count={`${history.length} lift${history.length === 1 ? '' : 's'}`} open={exercisesOpen} onToggle={toggleExercises}>
            <ExerciseTicker history={cards} allHistory={exerciseHistory(all)} unit={unit} muscle={muscle} onClearMuscle={() => onMuscle(null)}
              openIds={openIds} onToggle={toggle} sessionsById={sessionsById} metric={metric} setMetric={setMetric} />
          </Dropdown>
        ) : null}
        {workoutsDropdown}
      </div>
    </WorkoutCard>
  );
}
