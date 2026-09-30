import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import AgendaRail from '../shared/AgendaRail';
import { getWorkoutStatus, getWorkoutRecent, getWorkoutCatalog, getWorkoutStrength } from './api';
import PersonalTrainer from './PersonalTrainer';
import TemplatesView from './TemplatesView';
import LogView from './LogView';
import OverviewView from './overview/OverviewView';
import WorkoutTopNav, { VIEWS } from './WorkoutTopNav';
import { RANGES, MAX_RANGE_DAYS, RangePicker } from './ranges';
import { shiftISO } from '../shared/dayInfo';
import { COLORS, card } from '../shared/styles';
import { snapshotAge } from '../shared/snapshotAge';
import { glassCard, pageBackground } from './theme';

// The Workout tab: a top bar (the four views as a pill nav, the day controls) over one view:
//   Overview  the body-figure dashboard (overview/), picked by the user 2026-09-29
//   Trainer   Personal Trainer (muscles, ticker, exercise detail)
//   Workouts  the app's gym templates
//   Log       workouts per bucket and the per-day table
// The view is in ?view= (Overview has none) and remembered for the next visit, because the
// app's snap-to-today keeps only the path.
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
const MAX_WIDTH = 1500;
const STRIP_WEEKS = 7; // the Overview's day strip: seven Sunday-start weeks ending with the shown day's week
const VIEW_KEY = 'plannerWorkoutView';
const readView = () => { try { return localStorage.getItem(VIEW_KEY) || 'overview'; } catch (_) { return 'overview'; } };
const writeView = (v) => { try { localStorage.setItem(VIEW_KEY, v); } catch (_) { /* ignore */ } };
const isView = (v) => VIEWS.some((x) => x.key === v);

// The app stores kilograms; the user's app setting says whether to show kg or lb.
const weightUnit = (profile) => (profile && profile.shows_kg ? 'kg' : 'lb');

export default function WorkoutView() {
  const { date } = useParams();
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get('view');
  const view = isView(fromUrl) ? fromUrl : (fromUrl === null && isView(readView()) ? readView() : 'overview');
  const muscleParam = params.get('muscle');
  const setView = (v, extra = {}) => { writeView(v); setParams(v === 'overview' ? {} : { view: v, ...extra }); };

  const [status, setStatus] = useState(null);
  const [rangeRecent, setRangeRecent] = useState(null);
  const [stripRecent, setStripRecent] = useState(null);
  const [rangeKey, setRangeKey] = useState('d30');
  const [customFrom, setCustomFrom] = useState(() => shiftISO(date, -29));
  const [customTo, setCustomTo] = useState(date);
  const [catalog, setCatalog] = useState(null);
  const [strength, setStrength] = useState(null); // every gym session with sets
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    getWorkoutStatus().then((s) => { if (alive) setStatus(s); }).catch((err) => { if (alive) setError(err.message || String(err)); });
    return () => { alive = false; };
  }, [date]);
  useEffect(() => {
    getWorkoutCatalog().then(setCatalog).catch((err) => setError(err.message || String(err)));
    getWorkoutStrength().then((d) => setStrength(d && d.sessions ? d : { sessions: [], weight_unit: 'lb' })).catch((err) => setError(err.message || String(err)));
  }, []);

  // The range: fixed windows end on the shown date; Custom uses its own dates.
  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[2];
  const customValid = rangeKey !== 'custom' || (customFrom && customTo && customFrom <= customTo);
  const rangeEnd = rangeKey === 'custom' ? customTo : date;
  const rangeDays = rangeKey === 'custom'
    ? Math.min(MAX_RANGE_DAYS, Math.max(1, daysBetween(customFrom, customTo) + 1))
    : range.days;
  const rangeStart = shiftISO(rangeEnd, -(rangeDays - 1));

  useEffect(() => {
    if (!customValid) return undefined;
    let alive = true;
    getWorkoutRecent(rangeEnd, rangeDays)
      .then((r) => { if (alive) setRangeRecent(r); })
      .catch((err) => { if (alive) setError(err.message || String(err)); });
    return () => { alive = false; };
  }, [rangeEnd, rangeDays, customValid]);

  // The strip ends on the Saturday of the shown day's week.
  const stripEnd = shiftISO(date, 6 - new Date(`${date}T12:00:00`).getDay());
  const stripStart = shiftISO(stripEnd, -(STRIP_WEEKS * 7 - 1));
  useEffect(() => {
    let alive = true;
    getWorkoutRecent(stripEnd, STRIP_WEEKS * 7)
      .then((r) => { if (alive) setStripRecent(r); })
      .catch((err) => { if (alive) setError(err.message || String(err)); });
    return () => { alive = false; };
  }, [stripEnd]);

  const available = status && status.available;
  const profile = (status && status.profile) || {};
  const counts = (status && status.counts) || {};
  const rangeSessions = ((rangeRecent && rangeRecent.sessions) || []).filter((s) => s.date >= rangeStart && s.date <= rangeEnd);
  // Lifetime starts the Log's chart at the first workout instead of ten empty years back.
  const chartStart = rangeKey === 'lifetime' && rangeSessions.length ? rangeSessions[rangeSessions.length - 1].date : rangeStart;

  const rangePicker = (view === 'overview' || view === 'log') ? (
    <RangePicker rangeKey={rangeKey} onRangeKey={setRangeKey} customFrom={customFrom} customTo={customTo} onCustomFrom={setCustomFrom} onCustomTo={setCustomTo} />
  ) : null;
  const age = status ? snapshotAge(status, date) : null;

  const shell = (inner) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh', background: pageBackground }}>
      <AgendaRail dateISO={date} section="workout" />
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: MAX_WIDTH, margin: '0 auto', padding: '20px 24px 64px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <WorkoutTopNav date={date} view={view} onView={(v) => setView(v)} extra={rangePicker} />
            {age ? (
              // How old the data on this page really is: the snapshot only moves when the
              // Mac app has pulled new history from the phone. Same rule as Settings.
              <div style={{ fontSize: 12, color: age.color, marginTop: 10 }}>{age.text}</div>
            ) : null}
          </div>
          {inner}
        </div>
      </main>
    </div>
  );

  if (error) return shell(<div style={{ ...card, color: COLORS.danger }}>Error: {error}</div>);
  if (!status) return shell(<div style={{ ...glassCard, color: COLORS.muted }}>Loading workout data...</div>);

  if (!available) {
    return shell(
      <div style={{ ...glassCard, maxWidth: 560, fontSize: 13, lineHeight: 1.6 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>No Home Workouts data on the server yet.</div>
        <div>Two things feed this tab: the phone's Shortcut posts Apple Health workouts as they happen, and the Mac exports the app's data every 6 hours (<code>tools/homeworkouts/sync.py</code>). Neither has arrived. See the Home Workouts section of <code>deploy/README.md</code>.</div>
      </div>
    );
  }

  const empty = !counts.sessions && !(status.health && status.health.count) ? (
    <div style={{ fontSize: 12, color: COLORS.muted }}>
      No workouts yet: the phone has not reported and the Mac snapshot is empty. Sync the Home Workouts app on the Mac to pull history.
    </div>
  ) : null;

  let body;
  if (view === 'trainer') body = <PersonalTrainer key={muscleParam || 'all'} data={strength} date={date} initialMuscle={muscleParam} />;
  else if (view === 'workouts') body = <TemplatesView catalog={catalog} />;
  else if (view === 'log') {
    body = <LogView date={date} sessions={rangeSessions} unit={weightUnit(profile)} rangeSub={range.sub} chartStart={chartStart} rangeEnd={rangeEnd} customValid={customValid} />;
  } else {
    body = (
      <OverviewView
        date={date} profile={profile} weights={(rangeRecent && rangeRecent.weights) || []}
        sessions={customValid ? rangeSessions : []} rangeStart={rangeStart} rangeEnd={rangeEnd} rangeSub={range.sub} lifetime={rangeKey === 'lifetime'}
        strength={strength} stripSessions={(stripRecent && stripRecent.sessions) || []} stripStart={stripStart} stripEnd={stripEnd}
        onOpenTrainer={(m) => setView('trainer', m ? { muscle: m } : {})}
      />
    );
  }

  return shell(
    <>
      {empty}
      {body}
      <div style={{ fontSize: 11, color: COLORS.faint }}>
        Home Workouts sessions reach here two ways: the phone posts its Apple Health workouts as they happen (timing, duration, calories), and the Mac presses the app's own Sync and exports it every hour (per-exercise detail, only what the app's cloud backup holds). Both live in <code>backend/workout-state</code>.
      </div>
    </>
  );
}
