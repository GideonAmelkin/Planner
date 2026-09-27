// When the Health store gets written:
//   - every Garmin warm (30 min) announces today's bundle on the bus; the ingest
//     consumes those very result objects (kind 'today', zero extra Garmin calls);
//   - 03:30 local: yesterday is refetched and finalized (kind 'finalize'), together with any
//     older day in the last 28 that is still not final (the watch had not synced past
//     midnight when it was last tried), oldest first, as many as fit under the run cap;
//   - catch-up of older days is OFF unless HEALTH_CATCHUP_DAYS is set, because
//     history is a rate-limit question and is done attended (scripts/health-fetch.js);
//   - after a sign-in problem (mfa_required / auth) the scheduled runs pause until a
//     warm-driven ingest succeeds again, so the store never hammers a challenge.
const bus = require('../lib/bus');
const { localISO, shiftISO } = require('../lib/dates');
const { ingestDays, recentRuns } = require('./ingest');
const { get, all } = require('../db');

const FINALIZE_HOUR = 3;
const FINALIZE_MINUTE = 30;
const CATCHUP_INTERVAL_MS = 60 * 60 * 1000;
const CATCHUP_DAYS_PER_RUN = 2;
const catchupDays = () => Math.max(0, Number(process.env.HEALTH_CATCHUP_DAYS || 0) || 0);

let running = false;
let timers = [];
const AUTH_CODES = new Set(['mfa_required', 'auth']);

async function paused() {
  const runs = await recentRuns(1);
  const last = runs[0];
  return !!(last && last.errors.some((e) => AUTH_CODES.has(e.code)));
}

async function guarded(label, fn) {
  if (running) { console.log(`[health] ${label} skipped: a run is in progress`); return null; }
  running = true;
  try {
    return await fn();
  } catch (err) {
    console.error(`[health] ${label} failed:`, err.message);
    return null;
  } finally {
    running = false;
  }
}

function onWarm(bundle) {
  if (!bundle || !bundle.date || !bundle.results) return;
  // Detached on purpose: the warm must not wait on the store.
  guarded('today', () => ingestDays([bundle.date], { kind: 'today', bundles: { [bundle.date]: bundle.results } }))
    .then((out) => { if (out) console.log(`[health] today ${bundle.date}: ${out.written} written, ${out.unchanged} unchanged, ${out.stale} stale, ${out.calls_garmin} direct calls${out.failed ? `, ${out.failed} errors` : ''}`); });
}

const FINALIZE_LOOKBACK_DAYS = 28;
const FINALIZE_MAX_DAYS = 5;   // 5 x 18 bundle calls stays under MAX_CALLS_PER_RUN

// Yesterday first, then the oldest days in the lookback that are stored but not final
// (or not stored at all), so a day the watch had not synced by 03:30 is retried the
// next night instead of waiting for someone to notice the amber line.
async function pendingFinalizeDates(today = localISO()) {
  const y = shiftISO(today, -1);
  const dates = [y];
  const older = await all(
    `SELECT date, SUM(final) AS finals, COUNT(*) AS n FROM health_days WHERE date < ? AND date >= ? GROUP BY date HAVING finals < n ORDER BY date`,
    [y, shiftISO(today, -FINALIZE_LOOKBACK_DAYS)]
  );
  for (const r of older) { if (dates.length >= FINALIZE_MAX_DAYS) break; dates.push(r.date); }
  return dates;
}

async function finalizeYesterday() {
  if (await paused()) { console.log('[health] finalize skipped: waiting for a Garmin sign-in'); return; }
  const dates = await pendingFinalizeDates();
  const out = await guarded('finalize', () => ingestDays(dates, { kind: 'finalize', refresh: true }));
  if (out) {
    const finals = out.report.filter((r) => r.final).map((r) => r.date);
    console.log(`[health] finalize ${dates.join(', ')}: ${out.written} written, final for ${[...new Set(finals)].join(', ') || 'none'}, ${out.calls_garmin} direct calls${out.failed ? `, ${out.failed} errors` : ''}`);
  }
}

function msUntil(hour, minute) {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

function scheduleFinalize() {
  const t = setTimeout(async () => { await finalizeYesterday(); scheduleFinalize(); }, msUntil(FINALIZE_HOUR, FINALIZE_MINUTE));
  timers.push(t);
}

// Days in the last N without a final steps row, oldest first; at most 2 per run.
async function catchUp() {
  const n = catchupDays();
  if (n === 0) return;
  if (await paused()) return;
  const today = localISO();
  const dates = [];
  for (let i = 1; i <= n && dates.length < CATCHUP_DAYS_PER_RUN; i++) {
    const d = shiftISO(today, -i);
    const row = await get(`SELECT final FROM health_days WHERE date = ? AND metric = 'steps'`, [d]);
    if (!row || !row.final) dates.unshift(d);
  }
  if (dates.length === 0) return;
  const out = await guarded('catch-up', () => ingestDays(dates, { kind: 'catchup', refresh: true }));
  if (out) console.log(`[health] catch-up ${dates.join(', ')}: ${out.written} written, ${out.calls_garmin} direct calls${out.failed ? `, ${out.failed} errors` : ''}`);
}

function startHealthScheduler() {
  bus.on('garmin:day', onWarm);
  scheduleFinalize();
  if (catchupDays() > 0) {
    console.log(`[health] catch-up on: up to ${CATCHUP_DAYS_PER_RUN} of the last ${catchupDays()} days per hour`);
    timers.push(setTimeout(catchUp, 90 * 1000));
    timers.push(setInterval(catchUp, CATCHUP_INTERVAL_MS));
  } else {
    console.log('[health] catch-up off (HEALTH_CATCHUP_DAYS unset); history is fetched attended');
  }
}

function stopHealthScheduler() {
  bus.off('garmin:day', onWarm);
  for (const t of timers) clearTimeout(t);
  timers = [];
}

module.exports = { startHealthScheduler, stopHealthScheduler, finalizeYesterday, pendingFinalizeDates, catchUp, paused, FINALIZE_HOUR, FINALIZE_MINUTE, FINALIZE_MAX_DAYS };
