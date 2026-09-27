// The Health store's writer. ingestDays() turns Garmin day bundles into health_days /
// health_activities rows under these rules:
//   - one source per metric (health/metrics.js); goals come from the same day's response;
//   - a row is never overwritten backwards: an incoming reading whose taken_at is older
//     than the stored one, or a null where a value exists, is counted as `stale`, not written;
//   - a final row is never replaced; a day is marked final only by a run that is not the
//     30-minute "today" pass, for a date before today, when the summary's
//     lastSyncTimestampGMT is at or after the end of that local day (the watch synced
//     after midnight, so the totals cannot grow any more). Otherwise the row is written
//     non-final and the next finalize / catch-up tries again;
//   - date is Garmin's calendarDate, never the write date; fetched_at is kept beside it;
//   - every run is a health_runs row inserted with started_at before any work, so a run
//     that dies mid-flight shows as a row without finished_at;
//   - MAX_CALLS_PER_RUN caps what one run may send to Garmin, whatever kind it is;
//   - a dry run reads garmin_cache only (callMany cacheOnly) and touches no table.
const { run, get, all } = require('../db');
const { localISO, dayWindow } = require('../lib/dates');
const garmin = require('../garmin/service');
const { METRICS, STATIC_CALLS } = require('./metrics');

const MAX_CALLS_PER_RUN = 100;
const BUNDLE_SIZE = garmin.dayCalls('2000-01-01').length;   // 18
const STATIC_SIZE = Object.keys(STATIC_CALLS).length;          // 2
const WEIGH_IN_SEED_FROM = '2024-01-01';

const parseGmt = (s) => {
  if (!s) return null;
  const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
  return Number.isFinite(t) ? t : null;
};

// Where a metric's payload comes from: the full response objects, keyed by call.
const payloadFor = (metric, results) => Object.fromEntries(metric.calls.map((k) => [k, results[k] === undefined ? null : results[k]]));

const stableJSON = (v) => JSON.stringify(v, (key, val) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.keys(val).sort().reduce((o, k) => { o[k] = val[k]; return o; }, {}) : val));

class Budget {
  constructor(max = MAX_CALLS_PER_RUN) { this.max = max; this.used = 0; this.stopped = false; }
  // true when `n` more calls fit; otherwise flags the stop and returns false.
  take(n) { if (this.used + n > this.max) { this.stopped = true; return false; } this.used += n; return true; }
}

function countCalls(counters, results) {
  for (const r of Object.values(results)) {
    if (!r) continue;
    counters.calls_total += 1;
    if (r.ok && r.cached) counters.calls_cached += 1;
    else if (r.code === 'cache_miss' || r.code === 'bad_request') { /* never reached Garmin */ }
    else counters.calls_garmin += 1;
  }
}

function collectErrors(errors, date, results, scope) {
  for (const [key, r] of Object.entries(results)) {
    if (r && !r.ok) errors.push({ date, call: key, scope, code: r.code || 'garmin', error: r.error || 'no result' });
  }
}

// Newest weigh-in carried forward from earlier rows, including this date's own row
// (a day with no weigh-in keeps carrying the one it was given), so a re-run of the
// same day derives the same value.
async function previousWeighIn(date) {
  const row = await get(
    `SELECT value FROM health_days WHERE metric = 'weight' AND date <= ? AND json_extract(value, '$.latest_weigh_in_g') IS NOT NULL ORDER BY date DESC LIMIT 1`,
    [date]
  );
  if (!row) return null;
  const v = JSON.parse(row.value);
  return { grams: v.latest_weigh_in_g, date: v.weigh_in_date, source: v.weigh_in_source, at: null };
}

// Decide what to do with one metric row. Returns 'write' | 'unchanged' | 'stale' | 'final'.
// `force` (the script's --force only) lets a refetch replace a final row: Garmin does
// correct days after the fact, and without it a correction could never reach the store.
function decide(existing, incoming, force = false) {
  if (!existing) return incoming.value === null && incoming.payload === null ? 'unchanged' : 'write';
  if (existing.final && !force) return 'final';
  const had = existing.value !== null && existing.value !== undefined;
  if (incoming.value === null && had) return 'stale';
  if (incoming.taken_at && existing.taken_at && incoming.taken_at < existing.taken_at) return 'stale';
  if (existing.value === incoming.valueJSON && existing.payload === incoming.payloadJSON && !!existing.final === incoming.final) return 'unchanged';
  return 'write';
}

async function ingestDay(date, { kind, refresh, dryRun, force, bundle, budget, counters, errors, report, today }) {
  const cacheOnly = !!dryRun;
  let results = bundle || null;
  // 1. The day bundle (18 calls) unless the warm handed it over.
  if (!results) {
    if (!budget.take(BUNDLE_SIZE)) return 'budget_stop';
    results = await garmin.callMany(garmin.dayCalls(date), { refresh, cacheOnly });
    countCalls(counters, results);
  }
  collectErrors(errors, date, results, 'bundle');
  // 2. The two static reads (24-hour cache; cheap).
  if (!budget.take(STATIC_SIZE)) return 'budget_stop';
  const statics = await garmin.callMany(Object.entries(STATIC_CALLS).map(([key, c]) => ({ key, name: c.name, kwargs: c.kwargs })), { cacheOnly });
  countCalls(counters, statics);
  collectErrors(errors, date, statics, 'static');
  Object.assign(results, statics);

  const summary = results.summary && results.summary.ok ? results.summary.data : null;
  const lastSync = summary ? parseGmt(summary.lastSyncTimestampGMT) : null;
  const dayEnd = dayWindow(date).end.getTime();
  const final = kind !== 'today' && date < today && lastSync !== null && lastSync >= dayEnd;
  const fetchedAt = Date.now();

  // 3. Weight: carry the newest earlier weigh-in; seed once from a wide window when the
  //    store has never seen one.
  let previous = dryRun ? null : await previousWeighIn(date);
  const todaysWeighIn = results.weigh_ins && results.weigh_ins.ok && results.weigh_ins.data && Array.isArray(results.weigh_ins.data.dateWeightList) && results.weigh_ins.data.dateWeightList.length > 0;
  if (!previous && !todaysWeighIn && !dryRun) {
    const any = await get(`SELECT 1 AS x FROM health_days WHERE metric = 'weight' LIMIT 1`);
    if (!any && budget.take(1)) {
      const seed = await garmin.callMany([{ key: 'weigh_ins_history', name: 'get_weigh_ins', kwargs: { startdate: WEIGH_IN_SEED_FROM, enddate: date } }], { cacheOnly });
      countCalls(counters, seed);
      collectErrors(errors, date, seed, 'seed');
      const hist = seed.weigh_ins_history && seed.weigh_ins_history.ok ? seed.weigh_ins_history.data : null;
      const days = (hist && hist.dailyWeightSummaries) || [];
      const last = days.length ? days[days.length - 1] : null;
      const lw = last && last.latestWeight;
      if (lw) previous = { grams: lw.weight, date: lw.calendarDate, source: lw.sourceType || null, at: lw.timestampGMT || null };
      results.weigh_ins_history = seed.weigh_ins_history;
    }
  }

  // 4. Metrics.
  const ctx = { date, previousWeighIn: previous };
  for (const metric of METRICS) {
    let value = null;
    try { value = metric.derive(results, ctx); } catch (err) { errors.push({ date, call: metric.key, scope: 'derive', code: 'derive', error: err.message }); value = null; }
    // Garmin's timestamp for the reading. A metric that reads the daily summary takes
    // the summary's last-sync time, which moves forward with every watch sync, so an
    // older summary can never overwrite a newer one through a metric whose own window
    // timestamp did not change.
    const own = (() => { try { return metric.takenAt(results) || null; } catch (_) { return null; } })();
    const sync = summary ? (summary.lastSyncTimestampGMT || summary.wellnessEndTimeGmt || null) : null;
    const taken = metric.calls.includes('summary') && sync ? (own && own > sync ? own : sync) : own;
    const payload = payloadFor(metric, results);
    const anyOk = metric.calls.some((k) => results[k] && results[k].ok);
    const incoming = { value, taken_at: taken, final, valueJSON: value === null ? null : stableJSON(value), payload: anyOk ? payload : null, payloadJSON: anyOk ? stableJSON(payload) : null };
    const existing = dryRun ? null : await get('SELECT value, payload, taken_at, final FROM health_days WHERE date = ? AND metric = ?', [date, metric.key]);
    const action = decide(existing, incoming, force);
    if (force && existing && existing.final && action === 'write') counters.forced += 1;
    report.push({ date, metric: metric.key, action: force && existing && existing.final && action === 'write' ? 'FORCED' : action, final, taken_at: taken, value: value === null ? null : value });
    if (action === 'write') {
      counters.written += 1;
      if (!dryRun) {
        await run(
          `INSERT INTO health_days (date, metric, value, payload, taken_at, fetched_at, final) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(date, metric) DO UPDATE SET value = excluded.value, payload = excluded.payload, taken_at = excluded.taken_at, fetched_at = excluded.fetched_at, final = excluded.final`,
          [date, metric.key, incoming.valueJSON, incoming.payloadJSON, taken, fetchedAt, final ? 1 : 0]
        );
      }
    } else if (action === 'stale') counters.stale += 1;
    else counters.unchanged += 1;
  }

  // 5. Activities: upsert each; one detail fetch per new run (route), one exercise-set
  //    fetch per new strength session, never repeated once stored.
  const acts = results.activities && results.activities.ok && Array.isArray(results.activities.data) ? results.activities.data : [];
  for (const a of acts) {
    if (!a || !Number.isInteger(a.activityId)) continue;
    const type = (a.activityType && a.activityType.typeKey) || null;
    const existing = dryRun ? null : await get('SELECT payload, polyline FROM health_activities WHERE activity_id = ?', [a.activityId]);
    const prior = existing && existing.payload ? JSON.parse(existing.payload) : {};
    const payload = { ...prior, activity: a };
    let polyline = existing ? existing.polyline : null;
    if (a.hasPolyline && !polyline) {
      if (!budget.take(1)) return 'budget_stop';
      const det = await garmin.callMany([{ key: 'details', name: 'get_activity_details', kwargs: { activity_id: String(a.activityId), maxchart: 1, maxpoly: 200 } }], { cacheOnly });
      countCalls(counters, det);
      collectErrors(errors, date, det, `activity ${a.activityId}`);
      const geo = det.details && det.details.ok && det.details.data && det.details.data.geoPolylineDTO;
      if (geo && Array.isArray(geo.polyline)) polyline = JSON.stringify(geo.polyline.map((p) => [p.lat, p.lon]));
      if (det.details && det.details.ok) payload.details_geo = geo || null;
    }
    if (/strength/i.test(type || '') && !('exercise_sets' in prior)) {
      if (!budget.take(1)) return 'budget_stop';
      const sets = await garmin.callMany([{ key: 'sets', name: 'get_activity_exercise_sets', kwargs: { activity_id: String(a.activityId) } }], { cacheOnly });
      countCalls(counters, sets);
      collectErrors(errors, date, sets, `activity ${a.activityId}`);
      if (sets.sets && sets.sets.ok) payload.exercise_sets = sets.sets.data;
    }
    const row = {
      date: (a.startTimeLocal || '').slice(0, 10) || date, type, name: a.activityName || null, start_local: a.startTimeLocal || null,
      duration_s: a.duration ?? null, distance_m: a.distance ?? null, calories: a.calories ?? null, avg_hr: a.averageHR ?? null, max_hr: a.maxHR ?? null,
      sets: a.totalSets ?? a.activeSets ?? null, reps: a.totalReps ?? null, polyline, taken_at: a.startTimeGMT || a.startTimeLocal || null,
    };
    const payloadJSON = stableJSON(payload);
    const unchanged = existing && existing.payload === payloadJSON && existing.polyline === polyline;
    report.push({ date, metric: `activity:${a.activityId}`, action: unchanged ? 'unchanged' : 'write', name: row.name, type });
    if (unchanged) { counters.unchanged += 1; continue; }
    counters.written += 1;
    if (!dryRun) {
      await run(
        `INSERT INTO health_activities (activity_id, date, type, name, start_local, duration_s, distance_m, calories, avg_hr, max_hr, sets, reps, polyline, payload, taken_at, fetched_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(activity_id) DO UPDATE SET date = excluded.date, type = excluded.type, name = excluded.name, start_local = excluded.start_local,
             duration_s = excluded.duration_s, distance_m = excluded.distance_m, calories = excluded.calories, avg_hr = excluded.avg_hr, max_hr = excluded.max_hr,
             sets = excluded.sets, reps = excluded.reps, polyline = excluded.polyline, payload = excluded.payload, taken_at = excluded.taken_at, fetched_at = excluded.fetched_at`,
        [a.activityId, row.date, row.type, row.name, row.start_local, row.duration_s, row.distance_m, row.calories, row.avg_hr, row.max_hr, row.sets, row.reps, row.polyline, payloadJSON, row.taken_at, fetchedAt]
      );
    }
  }
  return 'done';
}

// Ingest one or more dates. `bundles` maps a date to results the caller already holds
// (the warm's); those calls are not counted, the run only counts what it added.
async function ingestDays(dates, { kind = 'manual', refresh = false, dryRun = false, force = false, bundles = {}, maxCalls = MAX_CALLS_PER_RUN } = {}) {
  const today = localISO();
  const counters = { calls_total: 0, calls_cached: 0, calls_garmin: 0, written: 0, unchanged: 0, stale: 0, forced: 0 };
  if (force && kind !== 'force') throw new Error('force is only accepted with kind "force" (scripts/health-fetch.js --force); the scheduler never passes it');
  if (force) console.error(`[health] FORCE: final rows for ${dates.join(', ')} may be replaced by this run`);
  const errors = [];
  const report = [];
  const budget = new Budget(maxCalls);
  const startedAt = Date.now();
  let runId = null;
  if (!dryRun) {
    const ins = await run('INSERT INTO health_runs (started_at, kind, dates, dry_run) VALUES (?, ?, ?, 0)', [startedAt, kind, JSON.stringify(dates)]);
    runId = ins.lastID;
  }
  const done = [];
  let stopped = false;
  try {
    for (const date of dates) {
      const outcome = await ingestDay(date, { kind, refresh, dryRun, force, bundle: bundles[date] || null, budget, counters, errors, report, today });
      if (outcome === 'budget_stop') {
        errors.push({ date, call: null, scope: 'run', code: 'budget_stop', error: `stopped before ${date}: the run would exceed ${budget.max} Garmin calls (${budget.used} planned)` });
        stopped = true;
        break;
      }
      done.push(date);
    }
  } catch (err) {
    errors.push({ date: null, call: null, scope: 'run', code: 'exception', error: err.message });
  }
  if (force) errors.push({ date: null, call: null, scope: 'run', code: 'force', error: `--force replaced ${counters.forced} final row(s)` });
  const failed = errors.filter((e) => e.code !== 'force').length;
  const ok = counters.calls_total - errors.filter((e) => e.call).length;
  const summary = { id: runId, kind, dates, done, dry_run: dryRun, stopped, started_at: startedAt, finished_at: Date.now(), ok, failed, ...counters, errors, report };
  if (!dryRun) {
    await run(
      `UPDATE health_runs SET finished_at = ?, ok = ?, failed = ?, written = ?, unchanged = ?, stale = ?, errors = ?, calls_total = ?, calls_cached = ?, calls_garmin = ? WHERE id = ?`,
      [summary.finished_at, ok, failed, counters.written, counters.unchanged, counters.stale, JSON.stringify(errors), counters.calls_total, counters.calls_cached, counters.calls_garmin, runId]
    );
  }
  return summary;
}

// Read side ----------------------------------------------------------------------

const parseRow = (r) => ({ ...r, value: r.value ? JSON.parse(r.value) : null, final: !!r.final });

async function metricsForDate(date) {
  const rows = await all('SELECT date, metric, value, taken_at, fetched_at, final FROM health_days WHERE date = ?', [date]);
  const out = {};
  for (const r of rows) out[r.metric] = parseRow(r);
  return out;
}

// Small values for a date range, stress and body battery series stripped.
async function history(startDate, endDate) {
  const rows = await all('SELECT date, metric, value, taken_at, fetched_at, final FROM health_days WHERE date >= ? AND date <= ? ORDER BY date', [startDate, endDate]);
  return rows.map(parseRow).map((r) => {
    if (r.value && r.value.series) r.value = { ...r.value, series: undefined };
    return r;
  });
}

async function activitiesBetween(startDate, endDate) {
  return all('SELECT activity_id, date, type, name, start_local, duration_s, distance_m, calories, avg_hr, max_hr, sets, reps, polyline, taken_at, fetched_at FROM health_activities WHERE date >= ? AND date <= ? ORDER BY start_local', [startDate, endDate]);
}

async function recentRuns(limit = 50) {
  const rows = await all('SELECT * FROM health_runs ORDER BY id DESC LIMIT ?', [limit]);
  return rows.map((r) => ({ ...r, dates: r.dates ? JSON.parse(r.dates) : [], errors: r.errors ? JSON.parse(r.errors) : [] }));
}

module.exports = { ingestDays, MAX_CALLS_PER_RUN, BUNDLE_SIZE, STATIC_SIZE, metricsForDate, history, activitiesBetween, recentRuns, decide, parseGmt };
