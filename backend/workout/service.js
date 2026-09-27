// Home Workouts (the iPhone app, exported on the Mac by tools/homeworkouts/export.py).
// Two sources, one reader:
//   home_workouts.json   the Mac's snapshot of the app (per-exercise detail; moves only when
//                        the Mac app has synced from the phone), rsynced, never written here;
//   health_workouts.json the phone's own report of its Apple Health workouts, pushed by a
//                        Shortcut to POST /api/workout/health as workouts happen. Written
//                        here, atomically, keyed by start time and type, never pruned.
// Both re-parse on mtime change. Dates are local calendar days (YYYY-MM-DD).
const fs = require('fs');
const path = require('path');

const STATE_DIR = process.env.WORKOUT_STATE_DIR || path.join(__dirname, '..', 'workout-state');
const SNAPSHOT = path.join(STATE_DIR, 'home_workouts.json');
const HEALTH = path.join(STATE_DIR, 'health_workouts.json');
const MEDIA_DIR = path.join(STATE_DIR, 'media');
const MEDIA_KINDS = { video: { dir: 'videos', ext: '.mp4' }, thumb: { dir: 'thumbs', ext: '.jpg' } };
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PUSH_WORKOUTS = 500;
const MATCH_WINDOW_MS = 10 * 60 * 1000; // a Health workout this close to a snapshot session is the same session
// Only the app's own Health entries become sessions here; the watch's go to the Garmin tab.
const HOME_WORKOUT_SOURCE = /home workout/i;

let cache = { mtimeMs: null, snapshot: null };
let healthCache = { mtimeMs: null, data: null };

function readJsonByMtime(file, box, decorate) {
  let st;
  try {
    st = fs.statSync(file);
  } catch (err) {
    if (err.code === 'ENOENT') { box.mtimeMs = null; box.data = null; return null; }
    throw err;
  }
  if (box.data && box.mtimeMs === st.mtimeMs) return box.data;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (decorate) decorate(data, st);
  box.mtimeMs = st.mtimeMs;
  box.data = data;
  return data;
}

// The parsed snapshot, or null when the Mac has not shipped one yet.
function load() {
  const box = { mtimeMs: cache.mtimeMs, data: cache.snapshot };
  const snap = readJsonByMtime(SNAPSHOT, box, (data, st) => { data.snapshot_mtime_ms = st.mtimeMs; });
  cache = { mtimeMs: box.mtimeMs, snapshot: box.data };
  return snap;
}

// The phone's Health report, or null before the first push.
function loadHealth() {
  return readJsonByMtime(HEALTH, healthCache);
}

// -- the phone push ---------------------------------------------------------------------

// Local calendar day of an ISO timestamp: the phone sends local time with its offset, so the
// first ten characters are the day; a bare UTC stamp falls back to this server's local zone.
function localDateOf(iso) {
  const s = String(iso);
  if (/[+-]\d\d:?\d\d$/.test(s) && /^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

// Validate one workout as the Shortcut sends it; null when unusable. Kept fields only.
function cleanWorkout(w) {
  if (!w || typeof w !== 'object') return null;
  const startMs = Date.parse(w.start);
  if (!w.start || Number.isNaN(startMs)) return null;
  const endMs = w.end ? Date.parse(w.end) : NaN;
  let duration = num(w.duration_s);
  if (duration === null && !Number.isNaN(endMs)) duration = Math.round((endMs - startMs) / 1000);
  return {
    type: String(w.type || 'Workout').trim() || 'Workout',
    start: String(w.start),
    end: Number.isNaN(endMs) ? null : String(w.end),
    duration_s: duration === null ? null : Math.max(0, Math.round(duration)),
    calories: num(w.calories),
    distance_m: num(w.distance_m),
    source: w.source ? String(w.source).trim() : null,
  };
}

const workoutKey = (w) => `${new Date(w.start).toISOString().slice(0, 19)}|${w.type}`;

// Merge a push into health_workouts.json. Returns {stored, new, total, received_at} or {error}.
function storeHealth(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.workouts)) return { error: 'body must be {workouts: [...]}' };
  if (body.workouts.length > MAX_PUSH_WORKOUTS) return { error: `at most ${MAX_PUSH_WORKOUTS} workouts per push` };
  const cleaned = body.workouts.map(cleanWorkout);
  const bad = cleaned.filter((w) => w === null).length;
  if (bad) return { error: `${bad} workout(s) have no parseable start` };
  const existing = loadHealth() || { workouts: {} };
  const workouts = { ...(existing.workouts || {}) };
  let added = 0;
  for (const w of cleaned) {
    const key = workoutKey(w);
    const before = workouts[key];
    if (!before) added += 1;
    // The first-seen start string is the session's identity; a re-push refreshes the numbers only.
    workouts[key] = { ...w, start: before ? before.start : w.start, received_at: new Date().toISOString() };
  }
  const received_at = new Date().toISOString();
  const data = { received_at, device: body.device ? String(body.device).slice(0, 40) : null, sent_at: body.sent_at || null, workouts };
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const tmp = `${HEALTH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, HEALTH);
  healthCache = { mtimeMs: null, data: null };
  return { stored: cleaned.length, new: added, total: Object.keys(workouts).length, received_at };
}

// Health workouts as sessions the tab already understands (sets stripped by construction).
function healthSessions(health) {
  if (!health) return [];
  return Object.values(health.workouts || {})
    .filter((w) => HOME_WORKOUT_SOURCE.test(w.source || ''))
    .map((w) => ({
      id: `health:${w.start}`, kind: 'home', via: 'health', source: w.source, title: w.type, focus: null,
      started_at: w.start, date: localDateOf(w.start), duration_s: w.duration_s, calories: w.calories,
      distance_m: w.distance_m, exercise_count: null,
    }));
}

const otherSourceCount = (health) => (health ? Object.values(health.workouts || {}).filter((w) => !HOME_WORKOUT_SOURCE.test(w.source || '')).length : 0);

// Every session from both sources. A Health workout within MATCH_WINDOW_MS of a snapshot session
// on the same day is that session: the snapshot row stays (it has the exercises) and borrows
// the calories the app never exported.
function allSessions(snap, health) {
  const own = (snap && snap.sessions) || [];
  const fromHealth = healthSessions(health);
  if (!fromHealth.length) return own;
  const out = own.map((s) => ({ ...s }));
  const extra = [];
  for (const h of fromHealth) {
    const hs = Date.parse(h.started_at);
    const twin = out.find((s) => s.date === h.date && s.via !== 'health' && Math.abs(Date.parse(s.started_at) - hs) <= MATCH_WINDOW_MS);
    if (twin) {
      if ((twin.calories === null || twin.calories === undefined) && h.calories !== null) twin.calories = h.calories;
      twin.via = 'both';
    } else {
      extra.push(h);
    }
  }
  return out.concat(extra);
}

// Exercise clips and thumbnails the Mac has shipped, by action id. Read per request:
// the directory changes on its own schedule, unrelated to the JSON's mtime.
function media() {
  const list = (kind) => {
    const { dir, ext } = MEDIA_KINDS[kind];
    try {
      return fs.readdirSync(path.join(MEDIA_DIR, dir))
        .filter((f) => f.endsWith(ext) && /^\d+\./.test(f))
        .map((f) => f.slice(0, -ext.length))
        .sort((a, b) => Number(a) - Number(b));
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  };
  return { videos: list('video'), thumbs: list('thumb') };
}

// Absolute path of one media file, or null when it is not there. `id` is digits only.
function mediaPath(kind, id) {
  const spec = MEDIA_KINDS[kind];
  if (!spec || !/^\d{1,12}$/.test(String(id))) return null;
  const p = path.join(MEDIA_DIR, spec.dir, `${id}${spec.ext}`);
  return fs.existsSync(p) ? p : null;
}

const withoutSets = (s) => ({ ...s, exercises: undefined, exercise_count: (s.exercises || []).length });

// The newest Health workout the phone reported, any source (for the status line).
function healthStatus(health) {
  if (!health) return { available: false };
  const all = Object.values(health.workouts || {});
  const newest = all.reduce((best, w) => (!best || Date.parse(w.start) > Date.parse(best.start) ? w : best), null);
  return {
    available: true,
    received_at: health.received_at,
    device: health.device || null,
    count: all.length,
    other_sources: otherSourceCount(health),
    last_workout: newest ? { date: localDateOf(newest.start), type: newest.type, source: newest.source, started_at: newest.start } : null,
  };
}

function status(snap, health) {
  const hs = healthStatus(health);
  if (!snap) return { available: hs.available, path: SNAPSHOT, health: hs, counts: {}, profile: {}, awards: {}, last_session: hs.available ? newestSession(allSessions(null, health)) : null };
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
    // Newest across both sources; the snapshot's own newest stays visible as snapshot_last_session.
    last_session: newestSession(allSessions(snap, health)),
    snapshot_last_session: newestSession(snap.sessions || []),
    health: hs,
  };
}

function newestSession(sessions) {
  if (!sessions.length) return null;
  const last = sessions.reduce((best, s) => (!best || (s.started_at || '') > (best.started_at || '') ? s : best), null);
  return withoutSets(last);
}

function sessionsForDate(snap, date, health) {
  return allSessions(snap, health).filter((s) => s.date === date);
}

// Sessions whose local date falls in the `days` days ending on `endDate` (inclusive),
// newest first, sets stripped.
function recent(snap, endDate, days, health) {
  const end = Date.parse(`${endDate}T00:00:00Z`);
  const start = end - (days - 1) * DAY_MS;
  return allSessions(snap, health)
    .filter((s) => { const t = Date.parse(`${s.date}T00:00:00Z`); return t >= start && t <= end; })
    .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
    .map(withoutSets);
}

function planDay(snap, date) {
  const days = (snap && snap.plan && snap.plan.days) || [];
  return days.find((d) => d.done_at && d.done_at.slice(0, 10) === date) || null;
}

function weightsOn(snap, date) {
  return ((snap && snap.weights) || []).filter((w) => w.date === date);
}

function day(snap, date, health) {
  return {
    date,
    sessions: sessionsForDate(snap, date, health),
    plan_day: planDay(snap, date),
    weights: weightsOn(snap, date),
  };
}

module.exports = {
  media, mediaPath, SNAPSHOT, HEALTH, load, loadHealth, storeHealth, status, day, recent, sessionsForDate,
  allSessions, localDateOf, workoutKey, MAX_PUSH_WORKOUTS };
