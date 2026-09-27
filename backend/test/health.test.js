// Health store tests. Run from backend/: node --test test/
// They open a throwaway database (PLANNER_DB_PATH) and never spawn the Garmin bridge:
// bundles are handed to the ingest the way the warm hands them over, and the two
// static reads come from garmin_cache rows the test plants (cacheOnly never spawns).
process.env.PLANNER_DB_PATH = require('path').join(require('os').tmpdir(), `planner-health-test-${process.pid}.db`);
process.env.GARMIN_STATE_DIR = require('path').join(require('os').tmpdir(), `planner-health-test-${process.pid}-state`);
delete process.env.GARMIN_EMAIL;
delete process.env.GARMIN_PASSWORD;

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { run, get, all } = require('../db');
const bus = require('../lib/bus');
const garmin = require('../garmin/service');
const { ingestDays, decide, MAX_CALLS_PER_RUN } = require('../health/ingest');
const { METRICS } = require('../health/metrics');
const { vo2Classify, compactSeries } = require('../health/metrics');
const { createApp } = require('../app');

const ok = (data) => ({ ok: true, cached: true, fetched_at: 1, data });

function bundle(date, { steps = 5078, lastSync = `${date}T20:43:30.41`, hrTail = 99 } = {}) {
  return {
    summary: ok({ totalSteps: steps, dailyStepGoal: 4680, totalDistanceMeters: 5015, totalKilocalories: 2140, activeKilocalories: 635, bmrKilocalories: 1505, floorsAscended: 1.46818, floorsDescended: 1.4, userFloorsAscendedGoal: 10, restingHeartRate: 60, minHeartRate: 46, maxHeartRate: 194, averageStressLevel: 16, restStressDuration: 10740, lowStressDuration: 540, mediumStressDuration: 120, highStressDuration: 540, bodyBatteryMostRecentValue: 60, intensityMinutesGoal: 150, activeSeconds: 1788, lastSyncTimestampGMT: lastSync, wellnessEndTimeGmt: `${date}T20:43:00.0` }),
    sleep: ok({ dailySleepDTO: { sleepTimeSeconds: null } }),
    heart_rate: ok({ restingHeartRate: 60, minHeartRate: 50, maxHeartRate: 193, lastSevenDaysAvgRestingHeartRate: 59, endTimestampGMT: `${date}T20:43:00.0`, heartRateValues: [[1790521440000, 85], [1790521560000, hrTail]] }),
    stress: ok({ avgStressLevel: 16, maxStressLevel: 92, endTimestampGMT: `${date}T20:43:00.0`, stressValuesArray: [[1790481600000, -1], [1790481780000, 12], [1790481960000, 20]] }),
    body_battery: ok([{ charged: 8, drained: 25, endTimestampGMT: `${date}T20:43:00.0`, bodyBatteryValuesArray: [[1790521380000, 77], [1790529480000, 85]] }]),
    hrv: ok({}),
    spo2: ok({ averageSpO2: null, latestSpO2: null }),
    respiration: ok({ avgWakingRespirationValue: 14, lowestRespirationValue: 9, highestRespirationValue: 21, endTimestampGMT: `${date}T20:43:00.0` }),
    training_readiness: ok([]),
    training_status: ok({ mostRecentTrainingStatus: null }),
    max_metrics: ok([{ generic: { calendarDate: date, vo2MaxPreciseValue: 48.9, vo2MaxValue: 49 } }]),
    fitness_age: ok({ chronologicalAge: 33, fitnessAge: 30.607687817635412, achievableFitnessAge: 26.967086641406862, previousFitnessAge: 30.6, lastUpdated: `${date}T00:00:00.0`, components: {} }),
    activities: ok([{ activityId: 24522242010, activityName: 'Strength', startTimeLocal: `${date} 15:07:09`, startTimeGMT: `${date} 19:07:09`, activityType: { typeKey: 'strength_training' }, duration: 1912.7, distance: 0, calories: 290, averageHR: 139, maxHR: 179, totalSets: 1, totalReps: 9, hasPolyline: false }]),
    weigh_ins: ok({ dateWeightList: [] }),
    hydration: ok({ valueInML: 0, goalInML: 3638, sweatLossInML: 799 }),
    intensity_minutes: ok({ weeklyModerate: 45, weeklyVigorous: 54, weeklyTotal: 153, weekGoal: 150, moderateMinutes: 29, vigorousMinutes: 42, endTimestampGMT: `${date}T20:43:00.0` }),
    floors: ok({ floorValuesArray: [] }),
    steps: ok([{ startGMT: `${date}T04:00:00.0`, steps: 0 }]),
  };
}

// The two static reads and the weigh-in seed, planted in garmin_cache so cacheOnly
// finds them (a real run would also find them there after the first fetch).
async function plantStatics(date) {
  const put = (name, params, data) => run('INSERT OR REPLACE INTO garmin_cache (name, params, fetched_at, payload) VALUES (?, ?, ?, ?)', [name, params, Date.now(), JSON.stringify(data)]);
  await put('get_heart_rate_zones', '{}', [{ sport: 'DEFAULT', zone1Floor: 100, zone2Floor: 119, zone3Floor: 139, zone4Floor: 159, zone5Floor: 179, maxHeartRateUsed: 199, trainingMethod: 'HR_MAX' }]);
  await put('get_user_profile', '{}', { userData: { gender: 'MALE', height: 182.88, weight: 79378, birthDate: '1992-10-02' } });
  await put('get_weigh_ins', JSON.stringify({ enddate: date, startdate: '2024-01-01' }), { dailyWeightSummaries: [{ summaryDate: '2025-10-02', latestWeight: { weight: 79378, calendarDate: '2025-10-02', sourceType: 'USER_SETTING', timestampGMT: 1759378500435 } }] });
  await put('get_activity_exercise_sets', JSON.stringify({ activity_id: '24522242010' }), { exerciseSets: [{ exercises: [{ category: 'SQUAT' }], repetitionCount: 9 }] });
}

const YESTERDAY = '2026-09-26';
const TODAY_FAKE = '2026-09-27';   // a "today" run never finalizes, whatever the date

test.before(async () => {
  await new Promise((r) => setTimeout(r, 200));   // let db.serialize create the tables
  await plantStatics(YESTERDAY);
});
test.after(() => { try { fs.unlinkSync(process.env.PLANNER_DB_PATH); } catch (_) { /* ignore */ } });

test('warm() resolves with its bundle when a bus listener throws, rejects or hangs', async () => {
  const fake = async (date) => ({ date, fetched_at: 5, results: bundle(date) });
  const throwing = () => { throw new Error('listener boom'); };
  const rejecting = () => Promise.reject(new Error('async boom')).catch(() => {});
  const hanging = () => new Promise(() => {});
  bus.on('garmin:day', throwing); bus.on('garmin:day', rejecting); bus.on('garmin:day', hanging);
  const t0 = Date.now();
  const out = await garmin.warm({ fetch: fake });
  bus.off('garmin:day', throwing); bus.off('garmin:day', rejecting); bus.off('garmin:day', hanging);
  assert.equal(out.fetched_at, 5);
  assert.ok(out.results.summary.ok);
  assert.ok(Date.now() - t0 < 500, 'a hanging listener must not delay the warm');
});

test('warm() still resolves when the fetch itself fails', async () => {
  const out = await garmin.warm({ fetch: async () => { throw new Error('bridge down'); } });
  assert.equal(out, null);
});

test('a today run writes every metric non-final with zero direct calls and zero bundle counting', async () => {
  const out = await ingestDays([YESTERDAY], { kind: 'today', bundles: { [YESTERDAY]: bundle(YESTERDAY) } });
  assert.equal(out.calls_garmin, 0, 'the warm bundle is not the ingest\'s call');
  assert.equal(out.calls_cached, 4, 'zones + profile + weigh-in seed + exercise sets, all from cache');
  assert.equal(out.failed, 0, JSON.stringify(out.errors));
  const rows = await all('SELECT metric, value, final, payload FROM health_days WHERE date = ?', [YESTERDAY]);
  assert.equal(rows.length, METRICS.length, 'one row per declared metric');
  assert.ok(rows.every((r) => r.final === 0), 'a today run never finalizes');
  const steps = JSON.parse(rows.find((r) => r.metric === 'steps').value);
  assert.deepEqual([steps.value, steps.goal], [5078, 4680], 'goal stored beside the value');
  const hrv = rows.find((r) => r.metric === 'hrv');
  assert.equal(hrv.value, null, 'empty HRV is a null value ...');
  assert.ok(JSON.parse(hrv.payload).hrv.ok, '... with its payload kept');
  const w = JSON.parse(rows.find((r) => r.metric === 'weight').value);
  assert.deepEqual([w.profile_weight_g, w.lbs, w.bmi, w.weigh_in_date], [79378, 175.0, 23.7, '2025-10-02']);
  const v = JSON.parse(rows.find((r) => r.metric === 'vo2max').value);
  assert.equal(v.label, 'Excellent');
  const fa = JSON.parse(rows.find((r) => r.metric === 'fitness_age').value);
  assert.equal(fa.achievable, 26.967086641406862, 'stored raw, never rounded');
  const act = await get('SELECT sets, reps, payload FROM health_activities WHERE activity_id = 24522242010');
  assert.deepEqual([act.sets, act.reps], [1, 9]);
  assert.ok(JSON.parse(act.payload).exercise_sets, 'strength session fetched its sets once');
});

test('the same day twice is idempotent: nothing written, nothing double counted', async () => {
  const before = await get('SELECT COUNT(*) AS n, SUM(fetched_at) AS f FROM health_days WHERE date = ?', [YESTERDAY]);
  const out = await ingestDays([YESTERDAY], { kind: 'today', bundles: { [YESTERDAY]: bundle(YESTERDAY) } });
  const after = await get('SELECT COUNT(*) AS n, SUM(fetched_at) AS f FROM health_days WHERE date = ?', [YESTERDAY]);
  assert.equal(out.written, 0);
  assert.equal(out.unchanged, METRICS.length + 1, 'every metric + 1 activity unchanged');
  assert.deepEqual(after, before, 'no row touched');
  assert.equal(out.calls_garmin, 0);
  assert.equal((await all('SELECT activity_id FROM health_activities')).length, 1);
});

test('a reading never moves backwards: older taken_at and null-over-value are counted stale', async () => {
  const older = bundle(YESTERDAY, { steps: 100, lastSync: `${YESTERDAY}T10:00:00.0` });
  older.summary.data.wellnessEndTimeGmt = `${YESTERDAY}T10:00:00.0`;
  older.heart_rate.data.endTimestampGMT = `${YESTERDAY}T10:00:00.0`;
  const out = await ingestDays([YESTERDAY], { kind: 'today', bundles: { [YESTERDAY]: older } });
  const steps = JSON.parse((await get('SELECT value FROM health_days WHERE date = ? AND metric = ?', [YESTERDAY, 'steps'])).value);
  assert.equal(steps.value, 5078, 'the newer reading stayed');
  assert.ok(out.stale >= 3, `steps, calories, floors and heart rate should be stale: ${out.stale}`);
  assert.equal(out.written, 0);
});

test('finality: only a non-today run, for a past date, with a sync after midnight', async () => {
  // Sync before the end of the day: written, but not final.
  const early = bundle(YESTERDAY, { lastSync: `${YESTERDAY}T23:00:00.0` });
  early.summary.data.wellnessEndTimeGmt = `${YESTERDAY}T23:59:00.0`;
  let out = await ingestDays([YESTERDAY], { kind: 'finalize', bundles: { [YESTERDAY]: early } });
  let row = await get('SELECT final FROM health_days WHERE date = ? AND metric = ?', [YESTERDAY, 'steps']);
  assert.equal(row.final, 0, 'watch had not synced past midnight');
  // Sync after the end of the local day: final.
  const late = bundle(YESTERDAY, { lastSync: `${YESTERDAY.slice(0, 8)}27T12:00:00.0` });
  late.summary.data.wellnessEndTimeGmt = `${YESTERDAY.slice(0, 8)}27T03:59:00.0`;
  out = await ingestDays([YESTERDAY], { kind: 'finalize', bundles: { [YESTERDAY]: late } });
  row = await get('SELECT final FROM health_days WHERE date = ? AND metric = ?', [YESTERDAY, 'steps']);
  assert.equal(row.final, 1);
  assert.equal(out.failed, 0);
  // A final row is never replaced, even by a newer reading.
  const newer = bundle(YESTERDAY, { steps: 9999, lastSync: `${YESTERDAY.slice(0, 8)}28T12:00:00.0` });
  newer.summary.data.wellnessEndTimeGmt = `${YESTERDAY.slice(0, 8)}28T03:59:00.0`;
  out = await ingestDays([YESTERDAY], { kind: 'finalize', bundles: { [YESTERDAY]: newer } });
  const steps = JSON.parse((await get('SELECT value FROM health_days WHERE date = ? AND metric = ?', [YESTERDAY, 'steps'])).value);
  assert.equal(steps.value, 5078);
  assert.equal(out.written, 0);
});

test('--force is the only way past a final row, and the scheduler kinds cannot pass it', async () => {
  const corrected = bundle(YESTERDAY, { steps: 6000, lastSync: `${YESTERDAY.slice(0, 8)}28T12:00:00.0` });
  corrected.summary.data.wellnessEndTimeGmt = `${YESTERDAY.slice(0, 8)}28T03:59:00.0`;
  await assert.rejects(() => ingestDays([YESTERDAY], { kind: 'finalize', force: true, bundles: { [YESTERDAY]: corrected } }), /only accepted with kind "force"/);
  const out = await ingestDays([YESTERDAY], { kind: 'force', force: true, bundles: { [YESTERDAY]: corrected } });
  const steps = JSON.parse((await get('SELECT value FROM health_days WHERE date = ? AND metric = ?', [YESTERDAY, 'steps'])).value);
  assert.equal(steps.value, 6000, 'the correction landed');
  assert.ok(out.forced >= 1);
  assert.ok(out.errors.some((e) => e.code === 'force'), 'recorded on the run row');
  assert.equal(out.failed, 0, 'the force note is not a failure');
  const row = await get('SELECT final FROM health_days WHERE date = ? AND metric = ?', [YESTERDAY, 'steps']);
  assert.equal(row.final, 1, 'still final afterwards');
});

test('a past day with no sync of its own is final once a later stored day proves the watch synced after it', async () => {
  // Garmin's past-day summaries carry lastSyncTimestampGMT: null; the proof of a sync
  // after the day comes from the newest stored summary (today's, written by the warm).
  const d = '2026-09-18';
  const past = bundle(d, { lastSync: null });
  past.summary.data.lastSyncTimestampGMT = null;
  past.summary.data.wellnessEndTimeGmt = '2026-09-19T04:00:00.0';
  past.activities = ok([]);
  // The store holds a later day whose summary says the watch synced on the 27th.
  const out = await ingestDays([d], { kind: 'finalize', bundles: { [d]: past } });
  const row = await get('SELECT final FROM health_days WHERE date = ? AND metric = ?', [d, 'steps']);
  assert.equal(row.final, 1, `final via the newest stored sync; errors ${JSON.stringify(out.errors)}`);
});

test('a today run never finalizes even when the sync is after midnight', async () => {
  const d = '2026-09-20';
  const late = bundle(d, { lastSync: '2026-09-21T12:00:00.0' });
  late.activities = ok([]);   // the fixture's activity id belongs to YESTERDAY
  await ingestDays([d], { kind: 'today', bundles: { [d]: late } });
  const row = await get('SELECT final FROM health_days WHERE date = ? AND metric = ?', [d, 'steps']);
  assert.equal(row.final, 0);
});

test('a dry run makes no Garmin call, writes nothing, and reports what it would write', async () => {
  const d = '2026-09-10';
  const runsBefore = (await all('SELECT id FROM health_runs')).length;
  const out = await ingestDays([d], { kind: 'dry', dryRun: true });
  assert.equal(out.calls_garmin, 0);
  assert.equal(out.id, null, 'no health_runs row');
  assert.equal((await all('SELECT id FROM health_runs')).length, runsBefore);
  assert.equal(await get('SELECT 1 AS x FROM health_days WHERE date = ?', [d]), undefined);
  assert.ok(out.errors.some((e) => e.code === 'cache_miss'), 'the bundle was not in the cache, and the dry run said so instead of calling Garmin');
  assert.ok(out.report.length > 0);
});

test('the per-run call ceiling stops a run before it would exceed MAX_CALLS_PER_RUN', async () => {
  const dates = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06'];
  const out = await ingestDays(dates, { kind: 'dry', dryRun: true, maxCalls: MAX_CALLS_PER_RUN });
  assert.ok(out.stopped);
  assert.ok(out.errors.some((e) => e.code === 'budget_stop'));
  assert.equal(out.done.length, 5, '5 days x 20 = 100 fit, the sixth does not');
});

test('every run is a health_runs row with started_at before finished_at and the counters', async () => {
  const rows = await all('SELECT * FROM health_runs ORDER BY id');
  assert.ok(rows.length >= 4);
  for (const r of rows) {
    assert.ok(r.started_at > 0);
    assert.ok(r.finished_at >= r.started_at);
    assert.ok(Number.isInteger(r.calls_total) && Number.isInteger(r.calls_cached) && Number.isInteger(r.calls_garmin));
    assert.equal(r.calls_total, r.calls_cached + r.calls_garmin);
  }
});

test('GET /api/health is still the liveness probe, and /api/health/* is the Health tab', async () => {
  const app = createApp();
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const probe = await fetch(`${base}/health`).then((r) => r.json());
    assert.deepEqual(probe, { status: 'ok' });
    const day = await fetch(`${base}/health/day/${YESTERDAY}`).then((r) => r.json());
    assert.equal(day.metrics.steps.value.value, 6000, "the forced correction from the test above");
    assert.equal(day.metrics.hrv.value, null);
    assert.equal(day.metrics.hrv.absent, 'Wear your device while sleeping to reveal your status.');
    assert.equal(day.activities.length, 1);
    const status = await fetch(`${base}/health/status`).then((r) => r.json());
    assert.ok(['ok', 'warn', 'danger'].includes(status.level));
    assert.ok(status.last_run);
    const bad = await fetch(`${base}/health/day/nope`);
    assert.equal(bad.status, 400);
  } finally {
    server.close();
  }
});

test('helpers: VO2 classification and series compaction', () => {
  assert.equal(vo2Classify(48.9, 'MALE', 33).label, 'Excellent');
  assert.equal(vo2Classify(40.4, 'MALE', 33).label, 'Poor');
  assert.equal(vo2Classify(54, 'MALE', 33).label, 'Superior');
  assert.equal(vo2Classify(42.4, 'FEMALE', 35).label, 'Excellent');
  assert.equal(vo2Classify(49, null, 33), null);
  assert.deepEqual(compactSeries([[0, -1], [180000, 5], [360000, 7]]), { start: 0, step_ms: 180000, values: [null, 5, 7] });
  assert.deepEqual(compactSeries([[0, 1], [100, 2], [500, 3]]), { pairs: [[0, 1], [100, 2], [500, 3]] });
  assert.equal(decide(null, { value: null, payload: null }), 'unchanged');
  assert.equal(decide({ value: '1', payload: 'p', taken_at: 'b', final: 0 }, { value: 2, valueJSON: '2', payloadJSON: 'p', taken_at: 'a', final: false }), 'stale');
});
