// Health tab: reads over the Health store only. No route here calls Garmin on a page
// load; the one write route starts a throttled ingest run in the background.
// GET /api/health (the liveness probe) is registered in app.js before this router.
const { Router } = require('express');
const { asyncHandler, isDate } = require('../lib/http');
const { localISO, shiftISO } = require('../lib/dates');
const { METRICS, BY_KEY } = require('./metrics');
const { ingestDays, metricsForDate, history, activitiesBetween, recentRuns, MAX_CALLS_PER_RUN } = require('./ingest');
const { all } = require('../db');
const { paused, FINALIZE_HOUR, FINALIZE_MINUTE } = require('./scheduler');
const { directCallStats } = require('../garmin/service');

const router = Router();

const HISTORY_DAYS = 28;
const MANUAL_THROTTLE_MS = 30 * 60 * 1000;
// Rate thresholds, from the one rate measured as tolerated: the warm's 18 calls every 30
// minutes, about 36 an hour, from RT100 since 2026-09-26 without a rate_limited answer.
// Counted over every source in this process (warm, Garmin tab views, Health ingest).
const MEASURED_SAFE_PER_HOUR = 36;
const AMBER_PER_HOUR = 54;   // 1.5x the measured rate
const RED_PER_HOUR = 108;    // 3x
const FAIL_STREAK_RED = 3;
// A day older than this many days that is stored but not final is a rule that stopped
// firing (the finality bug of 2026-09-27 was exactly that: a field null on every past
// day). Surfaced on the status line so it cannot sit unnoticed.
const NEVER_FINAL_AFTER_DAYS = 2;

// The metric rows for a date with the absent reason filled in for every declared
// metric that has no value, so a card can always say why.
async function dayMetrics(date) {
  const stored = await metricsForDate(date);
  const out = {};
  for (const m of METRICS) {
    const row = stored[m.key];
    if (row && row.value !== null) out[m.key] = { value: row.value, taken_at: row.taken_at, fetched_at: row.fetched_at, final: row.final, absent: null };
    else out[m.key] = { value: null, taken_at: row ? row.taken_at : null, fetched_at: row ? row.fetched_at : null, final: row ? row.final : false, absent: row ? m.absent() : 'Not fetched yet for this day.' };
  }
  return out;
}

router.get('/health/day/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: 'invalid date' });
  const start = shiftISO(date, -(HISTORY_DAYS - 1));
  const [metrics, rows, activities] = await Promise.all([dayMetrics(date), history(start, date), activitiesBetween(start, date)]);
  // history: date -> metric -> {value, final}
  const days = {};
  for (const r of rows) {
    if (!days[r.date]) days[r.date] = {};
    days[r.date][r.metric] = { value: r.value, final: r.final, taken_at: r.taken_at };
  }
  res.json({ date, metrics, activities: activities.filter((a) => a.date === date), history: { start, end: date, days, activities } });
}));

router.get('/health/status', asyncHandler(async (req, res) => {
  const runs = await recentRuns(200);
  const real = runs.filter((r) => !r.dry_run);
  const last = real[0] || null;
  let streak = 0;
  for (const r of real) { if (r.failed > 0) streak += 1; else break; }
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const last24 = real.filter((r) => r.started_at >= dayAgo);
  const sum = (k) => last24.reduce((n, r) => n + (r[k] || 0), 0);
  const direct24 = sum('calls_garmin');
  const rate = directCallStats();
  const isPaused = await paused();
  const stuck = last && !last.finished_at && Date.now() - last.started_at > 10 * 60 * 1000;
  const cutoff = shiftISO(localISO(), -NEVER_FINAL_AFTER_DAYS);
  const notFinal = await all(`SELECT date, COUNT(*) AS metrics FROM health_days WHERE date <= ? AND final = 0 GROUP BY date ORDER BY date`, [cutoff]);
  const level = isPaused || streak >= FAIL_STREAK_RED || stuck || rate.last_hour > RED_PER_HOUR ? 'danger' : rate.last_hour > AMBER_PER_HOUR || notFinal.length > 0 ? 'warn' : 'ok';
  const todayRows = await metricsForDate(localISO());
  const withValue = Object.values(todayRows).filter((r) => r.value !== null).length;
  const lastFetched = Object.values(todayRows).reduce((m, r) => Math.max(m, r.fetched_at || 0), 0) || null;
  res.json({
    level, paused: isPaused, stuck: !!stuck, failed_streak: streak, fail_streak_red_at: FAIL_STREAK_RED,
    last_run: last ? { id: last.id, kind: last.kind, dates: last.dates, started_at: last.started_at, finished_at: last.finished_at, ok: last.ok, failed: last.failed, written: last.written, unchanged: last.unchanged, stale: last.stale, calls_total: last.calls_total, calls_cached: last.calls_cached, calls_garmin: last.calls_garmin, errors: last.errors } : null,
    today: { date: localISO(), metrics_with_value: withValue, metrics_declared: METRICS.length, last_fetched_at: lastFetched },
    last_24h: { runs: last24.length, calls_total: sum('calls_total'), calls_cached: sum('calls_cached'), calls_garmin: direct24 },
    rate: { direct_calls_last_hour: rate.last_hour, direct_calls_last_24h: rate.last_24h, counting_since: rate.since, measured_safe_per_hour: MEASURED_SAFE_PER_HOUR, amber_above_per_hour: AMBER_PER_HOUR, red_above_per_hour: RED_PER_HOUR },
    never_final: { after_days: NEVER_FINAL_AFTER_DAYS, days: notFinal.map((r) => r.date), count: notFinal.length },
    caps: { max_calls_per_run: MAX_CALLS_PER_RUN },
    next_finalize: `${String(FINALIZE_HOUR).padStart(2, '0')}:${String(FINALIZE_MINUTE).padStart(2, '0')} local`,
    catchup_days: Math.max(0, Number(process.env.HEALTH_CATCHUP_DAYS || 0) || 0),
  });
}));

router.get('/health/runs', asyncHandler(async (req, res) => {
  res.json({ runs: await recentRuns(50) });
}));

// Manual run for today: refreshes the bundle, so it costs about 20 direct calls.
// Throttled because /api/ is public.
let lastManualAt = 0;
router.post('/health/fetch', asyncHandler(async (req, res) => {
  const now = Date.now();
  if (now - lastManualAt < MANUAL_THROTTLE_MS) {
    const retry = Math.ceil((MANUAL_THROTTLE_MS - (now - lastManualAt)) / 1000);
    return res.status(429).json({ error: 'a manual fetch ran recently', retry_after_seconds: retry });
  }
  if (await paused()) return res.status(409).json({ error: 'Garmin needs a sign-in (Settings) before the store can fetch again' });
  lastManualAt = now;
  const date = localISO();
  ingestDays([date], { kind: 'manual', refresh: true })
    .then((out) => console.log(`[health] manual ${date}: ${out.written} written, ${out.calls_garmin} direct calls${out.failed ? `, ${out.failed} errors` : ''}`))
    .catch((err) => console.error('[health] manual run failed:', err.message));
  res.status(202).json({ started: true, date });
}));

// The declared metrics, for the card array on the frontend and for docs.
router.get('/health/metrics', (req, res) => {
  res.json({ metrics: METRICS.map((m) => ({ key: m.key, calls: m.calls })) });
});

module.exports = router;
module.exports.BY_KEY = BY_KEY;
