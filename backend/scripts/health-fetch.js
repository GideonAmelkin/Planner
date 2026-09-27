#!/usr/bin/env node
// Attended ingest into the Health store. Run on the server from backend/:
//   node scripts/health-fetch.js --date 2026-09-26 --dry-run        # cache only, writes nothing
//   node scripts/health-fetch.js --date 2026-09-26                  # one day
//   node scripts/health-fetch.js --from 2026-09-20 --to 2026-09-26  # a range, at most --max-days
//   node scripts/health-fetch.js --to 2026-09-26 --max-days 7       # the 7 days ending there
// --max-days defaults to 7 and refuses anything over 14; MAX_CALLS_PER_RUN (100) still
// applies inside the run. A dry run makes no Garmin call at all (garmin_cache only) and
// touches no table; it prints what a real run would write. Every real run is a
// health_runs row. The backend may be running at the same time: both use the same
// single-flight bridge queue only when they are the same process, so run this with
// the backend stopped for a finalize of many days, or accept that the two processes
// each talk to Garmin (the cache is shared through the database either way).
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { ingestDays, MAX_CALLS_PER_RUN } = require('../health/ingest');
const { localISO, shiftISO } = require('../lib/dates');

const DEFAULT_MAX_DAYS = 7;
const HARD_MAX_DAYS = 14;

function parseArgs(argv) {
  const args = { dryRun: false, maxDays: DEFAULT_MAX_DAYS, refresh: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a === '--no-refresh') args.refresh = false;
    else if (a === '--date') args.date = next();
    else if (a === '--from') args.from = next();
    else if (a === '--to') args.to = next();
    else if (a === '--max-days') args.maxDays = Number(next());
    else if (a === '--kind') args.kind = next();
    else throw new Error(`unknown argument ${a}`);
  }
  return args;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function datesFor(args) {
  if (!Number.isInteger(args.maxDays) || args.maxDays < 1) throw new Error('--max-days must be a positive integer');
  if (args.maxDays > HARD_MAX_DAYS) throw new Error(`--max-days ${args.maxDays} refused: the ceiling is ${HARD_MAX_DAYS} days per run (history is fetched in attended stages)`);
  if (args.date) {
    if (!ISO.test(args.date)) throw new Error('--date must be YYYY-MM-DD');
    return [args.date];
  }
  const to = args.to || localISO();
  if (!ISO.test(to)) throw new Error('--to must be YYYY-MM-DD');
  const from = args.from || shiftISO(to, -(args.maxDays - 1));
  if (!ISO.test(from)) throw new Error('--from must be YYYY-MM-DD');
  if (from > to) throw new Error('--from is after --to');
  const dates = [];
  for (let d = from; d <= to; d = shiftISO(d, 1)) dates.push(d);
  if (dates.length > args.maxDays) throw new Error(`${dates.length} days requested but --max-days is ${args.maxDays}`);
  return dates;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dates = datesFor(args);
  const kind = args.kind || (args.dryRun ? 'dry' : 'manual');
  console.log(`${args.dryRun ? 'DRY RUN (garmin_cache only, no Garmin calls, no writes)' : 'RUN'}: ${dates.length} day(s) ${dates[0]}..${dates[dates.length - 1]}, kind ${kind}, refresh ${args.refresh && !args.dryRun}, cap ${MAX_CALLS_PER_RUN} calls`);
  const out = await ingestDays(dates, { kind, refresh: args.refresh && !args.dryRun, dryRun: args.dryRun });
  for (const r of out.report) {
    const v = r.value === undefined ? '' : r.value === null ? 'null' : JSON.stringify(r.value).slice(0, 110);
    console.log(`  ${r.date}  ${r.metric.padEnd(24)} ${r.action.padEnd(9)} ${r.final ? 'final ' : '      '} ${r.taken_at || ''}  ${v}`);
  }
  for (const e of out.errors) console.log(`  ERROR ${e.date || ''} ${e.scope} ${e.call || ''}: [${e.code}] ${e.error}`);
  console.log(`done: ${out.done.length}/${dates.length} day(s)${out.stopped ? ' (BUDGET STOP)' : ''}; calls total ${out.calls_total}, cached ${out.calls_cached}, garmin ${out.calls_garmin}; written ${out.written}, unchanged ${out.unchanged}, stale ${out.stale}, errors ${out.failed}${out.id ? `; health_runs id ${out.id}` : ''}`);
  process.exit(out.stopped || out.errors.some((e) => e.code === 'exception') ? 2 : 0);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
