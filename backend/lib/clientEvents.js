// What open tabs report about moving to today (page loads, snaps, build reloads), so a
// tab that showed an old day can be traced afterwards. In memory only, newest last; a
// restart clears it. /api/ is public, so every field is clipped and the ring is capped.
const MAX_EVENTS = 300;
const MAX_FIELD = 200;
const FIELDS = ['event', 'reason', 'path', 'from', 'to', 'bundle', 'served', 'visibility', 'idleSec', 'browserDay', 'today'];

const events = [];

function clip(v) {
  if (v == null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  return String(v).slice(0, MAX_FIELD);
}

function record(body, ua) {
  const row = { at: new Date().toISOString() };
  for (const k of FIELDS) {
    const v = clip(body && body[k]);
    if (v !== undefined) row[k] = v;
  }
  if (!row.event) return null;
  if (ua) row.ua = clip(ua);
  events.push(row);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  return row;
}

function list() {
  return events.slice();
}

module.exports = { record, list };
