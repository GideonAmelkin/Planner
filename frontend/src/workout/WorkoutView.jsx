import React, { useEffect, useState } from 'react';
import AgendaRail from '../shared/AgendaRail';
import { getWorkoutStatus, getWorkoutRecent, getWorkoutStrength } from './api';
import PersonalTrainer from './PersonalTrainer';
import OverviewView from './overview/OverviewView';
import WorkoutTopNav, { scrollToSection, sectionId } from './WorkoutTopNav';
import RefreshButton, { useWorkoutRefresh } from './RefreshButton';
import { RANGES, MAX_RANGE_DAYS, RangePicker } from './ranges';
import { shiftISO } from '../shared/dayInfo';
import { COLORS, card } from '../shared/styles';
import { snapshotAge } from '../shared/snapshotAge';
import { W, glassCard, pageBackground } from './theme';
import { useViewDate } from '../shared/today';

// The Workout tab: one scrolling dashboard (the user's call, 2026-09-29: "I don't want to toggle, I
// want to scroll") under a top bar that sticks on wide screens (a pill per section, the day controls,
// the one range picker that drives every section). Sections, top to bottom:
//   Overview  the body-figure dashboard (overview/), picked by the user 2026-09-29
//   Trainer   Personal Trainer (muscles, workouts per day, the Exercises and Workouts dropdowns; the
//             Log section folded in on 2026-10-03)
// Shelved 2026-10-03 (the user: off the UI, kept on the server for later): the Workouts section, the app's
// gym template art (TemplatesView.jsx, fed by getWorkoutCatalog / GET /api/workout/catalog, both kept). To
// bring it back: a { key: 'workouts' } entry in WorkoutTopNav's SECTIONS, the catalog fetch, and
// {section('workouts', <TemplatesView catalog={catalog} />)} after the Trainer.
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
const MAX_WIDTH = 1500;
const STRIP_WEEKS = 7; // the Overview's day strip: seven Sunday-start weeks ending with the shown day's week
// The top bar sticks only where it fits on one or two rows; on a phone it wraps to four and scrolls away.
const STICKY_QUERY = '(min-width: 900px)';

// The app stores kilograms; the user's app setting says whether to show kg or lb.
const weightUnit = (profile) => (profile && profile.shows_kg ? 'kg' : 'lb');

export default function WorkoutView() {
  const date = useViewDate();
  const [sticky, setSticky] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(STICKY_QUERY).matches : true));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(STICKY_QUERY);
    const on = () => setSticky(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const [muscle, setMuscle] = useState(null); // the Trainer's muscle filter; the Overview's popover sets it too

  const [status, setStatus] = useState(null);
  const [rangeRecent, setRangeRecent] = useState(null);
  const [stripRecent, setStripRecent] = useState(null);
  const [rangeKey, setRangeKey] = useState('d30');
  const [customFrom, setCustomFrom] = useState(() => shiftISO(date, -29));
  const [customTo, setCustomTo] = useState(date);
  const [strength, setStrength] = useState(null); // every gym session with sets
  const [error, setError] = useState(null);
  // Bumped by the Refresh button: every fetch below re-runs.
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useWorkoutRefresh(() => setReloadKey((k) => k + 1));

  useEffect(() => {
    let alive = true;
    setError(null);
    getWorkoutStatus().then((s) => { if (alive) setStatus(s); }).catch((err) => { if (alive) setError(err.message || String(err)); });
    return () => { alive = false; };
  }, [date, reloadKey]);
  useEffect(() => {
    getWorkoutStrength().then((d) => setStrength(d && d.sessions ? d : { sessions: [], weight_unit: 'lb' })).catch((err) => setError(err.message || String(err)));
  }, [reloadKey]);

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
  }, [rangeEnd, rangeDays, customValid, reloadKey]);

  // The strip ends on the Saturday of the shown day's week.
  const stripEnd = shiftISO(date, 6 - new Date(`${date}T12:00:00`).getDay());
  const stripStart = shiftISO(stripEnd, -(STRIP_WEEKS * 7 - 1));
  useEffect(() => {
    let alive = true;
    getWorkoutRecent(stripEnd, STRIP_WEEKS * 7)
      .then((r) => { if (alive) setStripRecent(r); })
      .catch((err) => { if (alive) setError(err.message || String(err)); });
    return () => { alive = false; };
  }, [stripEnd, reloadKey]);

  const available = status && status.available;
  const profile = (status && status.profile) || {};
  const counts = (status && status.counts) || {};
  const rangeSessions = ((rangeRecent && rangeRecent.sessions) || []).filter((s) => s.date >= rangeStart && s.date <= rangeEnd);
  // Lifetime starts the Log's chart at the first workout instead of ten empty years back.
  const chartStart = rangeKey === 'lifetime' && rangeSessions.length ? rangeSessions[rangeSessions.length - 1].date : rangeStart;

  const rangePicker = (
    // One unit, so the Refresh button wraps with the range select instead of onto a row of its own.
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <RangePicker rangeKey={rangeKey} onRangeKey={setRangeKey} customFrom={customFrom} customTo={customTo} onCustomFrom={setCustomFrom} onCustomTo={setCustomTo} />
      <RefreshButton phase={refresh.phase} onClick={refresh.start} />
    </span>
  );
  const age = status ? snapshotAge(status, date) : null;

  const shell = (inner) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh', background: pageBackground }}>
      <AgendaRail dateISO={date} section="workout" />
      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: MAX_WIDTH, margin: '0 auto', padding: '20px 24px 64px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={sticky ? { position: 'sticky', top: 0, zIndex: 5, margin: '-20px -24px 0', padding: '14px 24px 10px', background: 'rgba(236,241,255,.82)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: `1px solid ${W.glassBorder}` } : undefined}>
            <WorkoutTopNav date={date} extra={rangePicker} />
            {refresh.message ? (
              <div style={{ fontSize: 12, color: refresh.message.color, marginTop: 10 }}>{refresh.message.text}</div>
            ) : age ? (
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

  // Each section is a landing spot for its pill; the margin keeps it clear of the sticky bar.
  const section = (key, children) => <section id={sectionId(key)} style={{ scrollMarginTop: sticky ? 150 : 16, minWidth: 0 }}>{children}</section>;
  const openTrainer = (m) => { setMuscle(m || null); requestAnimationFrame(() => scrollToSection('trainer')); };

  return shell(
    <>
      {empty}
      {section('overview', (
        <OverviewView
          date={date} profile={profile} weights={(rangeRecent && rangeRecent.weights) || []}
          sessions={customValid ? rangeSessions : []} rangeStart={rangeStart} rangeEnd={rangeEnd} rangeSub={range.sub} lifetime={rangeKey === 'lifetime'}
          strength={strength} stripSessions={(stripRecent && stripRecent.sessions) || []} stripStart={stripStart} stripEnd={stripEnd}
          onOpenTrainer={openTrainer} muscle={muscle} onMuscle={setMuscle}
        />
      ))}
      {section('trainer', (
        <PersonalTrainer data={strength} date={date} rangeKey={rangeKey} customFrom={customFrom} customTo={customTo} muscle={muscle} onMuscle={setMuscle}
          workouts={rangeSessions} chartStart={chartStart} rangeEnd={rangeEnd} customValid={customValid} rangeSub={range.sub} bodyUnit={weightUnit(profile)} />
      ))}
      <div style={{ fontSize: 11, color: COLORS.faint }}>
        Home Workouts sessions reach here two ways: the phone posts its Apple Health workouts as they happen (timing, duration, calories), and the Mac presses the app's own Sync and exports it every hour (per-exercise detail, only what the app's cloud backup holds). Both live in <code>backend/workout-state</code>.
      </div>
    </>
  );
}
