const { all, get, run } = require('./db');
const { pullForward } = require('./rollover');

// How far back the catch-up sweep looks. Covers a weekend (or a few nights) of
// the Mac being asleep at 11:59 PM without cascading deep history on first run.
const WINDOW_DAYS = 3;

// Format a Date to YYYY-MM-DD in the process local timezone (same construction
// as rollover.js:nextDayISO). This is what "11:59 PM local time" / "today" key off.
function localISO(dt = new Date()) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function alreadyRun(date) {
  const row = await get('SELECT 1 FROM pull_forward_runs WHERE date = ?', [date]);
  return !!row;
}

async function recordRun(date, trigger) {
  await run(
    'INSERT OR IGNORE INTO pull_forward_runs (date, trigger) VALUES (?, ?)',
    [date, trigger]
  );
}

// Roll one source day forward unless it was already pulled (manually or by a
// prior auto run). Returns the pullForward result, or null when skipped.
async function autoRollDate(date) {
  if (await alreadyRun(date)) return null;
  const result = await pullForward(date);
  await recordRun(date, 'auto');
  return result;
}

let running = false;

// Roll forward every day with unfinished work that hasn't been pulled yet.
// includeToday=true also rolls the day that is currently ending (the 23:59 fire);
// otherwise only fully-ended days (date < today) are swept (startup / hourly catch-up).
async function processDueRollovers({ includeToday = false } = {}) {
  if (running) return 0;
  running = true;
  try {
    const today = localISO();
    const cutoff = localISO(new Date(Date.now() - WINDOW_DAYS * 86400000));

    // Candidate source days = those with at least one incomplete task ("items not
    // checked as completed"). A fully-completed day is not auto-rolled even if it
    // has notes; once a day IS rolled, pullForward carries its notes too.
    const rows = await all(
      `SELECT DISTINCT date FROM tasks
        WHERE status NOT IN ('completed','forwarded')
          AND date >= ? AND date <= ?
        ORDER BY date ASC`,
      [cutoff, today]
    );

    let days = 0;
    let items = 0;
    for (const { date } of rows) {
      if (date > today) continue;
      if (date === today && !includeToday) continue;
      const res = await autoRollDate(date);
      if (res) {
        days += 1;
        items += (res.rolledTasks || 0) + (res.movedNotes || 0);
      }
    }
    if (days > 0) {
      console.log(`[auto-rollover] pulled forward ${items} item(s) across ${days} day(s)`);
    }
    return days;
  } catch (err) {
    console.error('[auto-rollover] processDueRollovers failed:', err);
    return 0;
  } finally {
    running = false;
  }
}

function msUntilNext2359() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

function scheduleNightly() {
  setTimeout(async () => {
    await processDueRollovers({ includeToday: true });
    scheduleNightly(); // re-arm for the following night
  }, msUntilNext2359());
}

// Arm the nightly job once the long-running process is up:
//  - one catch-up sweep now (handles a missed 11:59 PM while asleep/off),
//  - an hourly safety sweep (timers are suspended during macOS sleep and fire
//    late on wake, so this is what makes "catch up on next run" reliable),
//  - the on-time 23:59 fire that also rolls the day currently ending.
function startScheduler() {
  processDueRollovers({ includeToday: false });
  setInterval(() => processDueRollovers({ includeToday: false }), 60 * 60 * 1000);
  scheduleNightly();
}

module.exports = { processDueRollovers, autoRollDate, recordRun, startScheduler };
