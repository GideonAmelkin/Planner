// Home Workouts (the iPhone app, exported on the Mac by tools/homeworkouts/export.py).
// The Mac ships one JSON snapshot to backend/workout-state/home_workouts.json over
// rsync; this module is the only reader. It re-parses when the file's mtime changes
// and never writes. Dates in the snapshot are local calendar days (YYYY-MM-DD).
const fs = require('fs');
const path = require('path');

const STATE_DIR = process.env.WORKOUT_STATE_DIR || path.join(__dirname, 'workout-state');
const SNAPSHOT = path.join(STATE_DIR, 'home_workouts.json');
const DAY_MS = 24 * 60 * 60 * 1000;

let cache = { mtimeMs: null, snapshot: null };

// The parsed snapshot, or null when the Mac has not shipped one yet.
function load() {
  let st;
  try {
    st = fs.statSync(SNAPSHOT);
  } catch (err) {
    if (err.code === 'ENOENT') { cache = { mtimeMs: null, snapshot: null }; return null; }
    throw err;
  }
  if (cache.snapshot && cache.mtimeMs === st.mtimeMs) return cache.snapshot;
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
  snapshot.snapshot_mtime_ms = st.mtimeMs;
  cache = { mtimeMs: st.mtimeMs, snapshot };
  return snapshot;
}

const withoutSets = (s) => ({ ...s, exercises: undefined, exercise_count: (s.exercises || []).length });

function status(snap) {
  if (!snap) return { available: false, path: SNAPSHOT };
  const sessions = snap.sessions || [];
  const last = sessions.length ? sessions[sessions.length - 1] : null;
  return {
    available: true,
    schema_version: snap.schema_version,
    exported_at: snap.exported_at,
    snapshot_mtime: snap.source && snap.source.snapshot_mtime,
    received_at: new Date(snap.snapshot_mtime_ms).toISOString(),
    app_version: snap.source && snap.source.app_version,
    counts: snap.counts || {},
    profile: snap.profile || {},
    awards: snap.awards || {},
    last_session: last ? withoutSets(last) : null,
  };
}

function sessionsForDate(snap, date) {
  return (snap.sessions || []).filter((s) => s.date === date);
}

// Sessions whose local date falls in the `days` days ending on `endDate` (inclusive),
// newest first, sets stripped.
function recent(snap, endDate, days) {
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const start = end - (days - 1) * DAY_MS;
  return (snap.sessions || [])
    .filter((s) => { const t = Date.parse(`${s.date}T00:00:00Z`); return t >= start && t <= end; })
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
    .map(withoutSets);
}

function planDay(snap, date) {
  const days = (snap.plan && snap.plan.days) || [];
  return days.find((d) => d.done_at && d.done_at.slice(0, 10) === date) || null;
}

function weightsOn(snap, date) {
  return (snap.weights || []).filter((w) => w.date === date);
}

function day(snap, date) {
  return {
    date,
    sessions: sessionsForDate(snap, date),
    plan_day: planDay(snap, date),
    weights: weightsOn(snap, date),
  };
}

module.exports = { SNAPSHOT, load, status, day, recent, sessionsForDate };
