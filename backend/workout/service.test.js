// Workout service tests: the phone push store and the two-source merge. Run from backend/:
//   node --test workout/
// A throwaway WORKOUT_STATE_DIR; nothing touches the real state or the network.
const os = require('os');
const path = require('path');
const fs = require('fs');
process.env.WORKOUT_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'planner-workout-test-'));

const test = require('node:test');
const assert = require('node:assert/strict');
const workout = require('./service');

const STATE = process.env.WORKOUT_STATE_DIR;
const push = (workouts, extra = {}) => workout.storeHealth({ device: 'iphone', sent_at: '2026-09-27T18:40:00-04:00', workouts, ...extra });
const home = (start, over = {}) => ({ type: 'Functional Strength Training', start, end: null, duration_s: 900, calories: 120, distance_m: null, source: 'Home Workout', ...over });

test('localDateOf keeps the phone local day and falls back to the server zone for bare UTC', () => {
  assert.equal(workout.localDateOf('2026-09-27T23:50:00-04:00'), '2026-09-27');
  assert.equal(workout.localDateOf('2026-09-28T00:10:00+02:00'), '2026-09-28');
  const d = new Date('2026-09-27T12:00:00Z');
  const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  assert.equal(workout.localDateOf('2026-09-27T12:00:00Z'), local);
});

test('storeHealth validates, upserts by start and type, and is idempotent', () => {
  assert.deepEqual(workout.storeHealth({}), { error: 'body must be {workouts: [...]}' });
  assert.match(push([{ type: 'Walk', start: 'not a date' }]).error, /parseable start/);
  assert.match(push(Array.from({ length: workout.MAX_PUSH_WORKOUTS + 1 }, () => home('2026-09-27T10:00:00-04:00'))).error, /at most/);

  const first = push([home('2026-09-27T18:02:11-04:00'), { type: 'Running', start: '2026-09-27T07:00:00-04:00', end: '2026-09-27T07:22:32-04:00', source: 'Garmin Connect' }]);
  assert.equal(first.stored, 2);
  assert.equal(first.new, 2);
  assert.equal(first.total, 2);
  assert.ok(fs.existsSync(path.join(STATE, 'health_workouts.json')));
  const again = push([home('2026-09-27T18:02:11.000-04:00', { calories: 130 })]);
  assert.deepEqual([again.stored, again.new, again.total], [1, 0, 2], 'same second and type is the same workout');
  const health = workout.loadHealth();
  const key = workout.workoutKey(home('2026-09-27T18:02:11-04:00'));
  assert.equal(health.workouts[key].calories, 130, 'a later push updates the row');
  const run = Object.values(health.workouts).find((w) => w.type === 'Running');
  assert.equal(run.duration_s, 1352, 'duration derived from end when the phone sends none');
});

test('status, recent and day merge the phone report with the snapshot', () => {
  const snap = {
    exported_at: '2026-09-27T17:32:20-04:00', snapshot_mtime_ms: 1, counts: { sessions: 2 }, profile: {}, awards: {},
    sessions: [
      { id: 'home:1', kind: 'home', title: 'Chest', focus: 'Chest', started_at: '2026-09-09T20:42:04-04:00', date: '2026-09-09', duration_s: 781, calories: null, exercises: [{}, {}] },
      // same start as the pushed 18:02 workout, within the window: it is the same session
      { id: 'home:2', kind: 'home', title: 'Abs', focus: 'Abs', started_at: '2026-09-27T18:05:00-04:00', date: '2026-09-27', duration_s: 900, calories: null, exercises: [{}] },
    ],
  };
  const health = workout.loadHealth();
  const st = workout.status(snap, health);
  assert.equal(st.available, true);
  assert.equal(st.health.available, true);
  assert.equal(st.health.count, 2);
  assert.equal(st.health.other_sources, 1, 'the Garmin run is stored but not a session');
  assert.equal(st.last_session.date, '2026-09-27');
  assert.equal(st.snapshot_last_session.date, '2026-09-27');

  const recent = workout.recent(snap, '2026-09-27', 30, health);
  assert.deepEqual(recent.map((s) => s.id), ['home:2', 'home:1']);
  assert.equal(recent[0].calories, 130, 'the snapshot session borrows the phone calories');
  assert.equal(recent[0].via, 'both');
  assert.equal(recent[0].exercise_count, 1);

  push([home('2026-09-26T07:30:00-04:00', { type: 'Core Training' })]);
  const withNew = workout.recent(snap, '2026-09-27', 30, workout.loadHealth());
  assert.deepEqual(withNew.map((s) => s.id), ['home:2', 'health:2026-09-26T07:30:00-04:00', 'home:1']);
  assert.equal(withNew[1].via, 'health');
  assert.equal(withNew[1].kind, 'home');
  assert.equal(withNew[1].title, 'Core Training');

  const day = workout.day(snap, '2026-09-26', workout.loadHealth());
  assert.equal(day.sessions.length, 1);
  assert.equal(day.sessions[0].source, 'Home Workout');

  // No snapshot at all: the phone report alone carries the tab.
  const alone = workout.status(null, workout.loadHealth());
  assert.equal(alone.available, true);
  assert.equal(alone.last_session.id, 'health:2026-09-27T18:02:11-04:00');
  assert.equal(workout.recent(null, '2026-09-27', 30, workout.loadHealth()).length, 2);
});

test.after(() => fs.rmSync(STATE, { recursive: true, force: true }));


test('strengthSessions keeps gym sessions with their sets, oldest first, and leaves home sessions out', () => {
  const snap = {
    sessions: [
      { id: 'gym:2', kind: 'gym', title: 'Lower Body Workout', started_at: '2026-09-27T15:02:49-04:00', date: '2026-09-27', duration_s: 1882, calories: 159, total_weight_kg: 5429.512, weight_unit: 'lb',
        exercises: [{ action_id: '1279', name: 'Smith Machine Squat', order: 0, sets: [{ reps: 8, weight_kg: 43.091, finished: true }] }] },
      { id: 'home:1', kind: 'home', title: 'Abs', started_at: '2026-09-26T07:00:00-04:00', date: '2026-09-26', duration_s: 700, exercises: [{}, {}] },
      { id: 'gym:1', kind: 'gym', title: 'Full Body Workout', started_at: '2026-09-20T15:00:00-04:00', date: '2026-09-20', duration_s: 1500, calories: 120, total_weight_kg: 1000, weight_unit: 'lb', exercises: [] },
    ],
  };
  const out = workout.strengthSessions(snap, null);
  assert.deepEqual(out.sessions.map((s) => s.id), ['gym:1', 'gym:2']);
  assert.equal(out.sessions[1].exercises[0].sets[0].weight_kg, 43.091, 'sets are kept');
  assert.equal(out.weight_unit, 'lb');
  assert.deepEqual(workout.strengthSessions(null, null), { sessions: [], weight_unit: 'lb' });
});

test('requestRefresh throttles, joins the pending request, and status says when the Mac answered', () => {
  const t0 = Date.parse('2026-10-03T21:50:00Z');
  const first = workout.requestRefresh(t0);
  assert.deepEqual(first, { requested_at: '2026-10-03T21:50:00.000Z', joined: false });
  const joined = workout.requestRefresh(t0 + 60 * 1000);
  assert.deepEqual(joined, { requested_at: first.requested_at, joined: true }, 'inside the window a click joins');
  assert.equal(workout.status(null, null).refresh.answered_at, null, 'no snapshot: pending');

  const snap = (refresh) => ({ source: { refresh }, sessions: [], counts: {}, snapshot_mtime_ms: t0 });
  const older = workout.status(snap({ request_at: '2026-10-03T21:00:00.000Z', handled_at: '2026-10-03T17:00:20-0400', app_sync: 'synced' }), null).refresh;
  assert.equal(older.answered_at, null, 'a stamp for an earlier request does not answer this one');
  const answered = workout.status(snap({ request_at: first.requested_at, handled_at: '2026-10-03T17:50:20-0400', app_sync: 'synced' }), null).refresh;
  assert.deepEqual(answered, { requested_at: first.requested_at, answered_at: '2026-10-03T17:50:20-0400', outcome: 'synced' });

  const next = workout.requestRefresh(t0 + 3 * 60 * 1000);
  assert.equal(next.joined, false, 'after the window a click is a new request');
  assert.equal(workout.loadRefresh().requested_at, '2026-10-03T21:53:00.000Z');
});
