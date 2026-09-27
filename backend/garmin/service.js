// Garmin Connect. Everything goes through backend/garmin/bridge.py (Python, the
// garminconnect client) one process at a time, so the token file is never refreshed
// by two runs at once and Garmin sees a single slow client. Read results are cached
// in garmin_cache; the Health page bundle for today is warmed on a timer.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { run, get } = require('../db');
const { localISO } = require('../lib/dates');
const bus = require('../lib/bus');
const registry = require('./registry.json');

const GARMIN_DIR = __dirname;
const PYTHON = process.env.GARMIN_PYTHON || path.join(GARMIN_DIR, '.venv', 'bin', 'python');
const STATE_DIR = process.env.GARMIN_STATE_DIR || path.join(__dirname, '..', 'garmin-state');
const TOKEN_FILE = path.join(STATE_DIR, 'garmin_tokens.json');

const CALL_TIMEOUT_MS = 120 * 1000;
const LOGIN_TIMEOUT_MS = 6 * 60 * 1000;   // covers the 5 minute MFA wait in the bridge
const TODAY_TTL_MS = 30 * 60 * 1000;
const PAST_TTL_MS = 24 * 60 * 60 * 1000;
const WARM_INTERVAL_MS = 30 * 60 * 1000;

const BY_NAME = Object.fromEntries(registry.map((e) => [e.name, e]));

const configured = () => !!(process.env.GARMIN_EMAIL && process.env.GARMIN_PASSWORD);
const pythonOk = () => fs.existsSync(PYTHON);
const tokenFileExists = () => fs.existsSync(TOKEN_FILE);

// One bridge run at a time ---------------------------------------------------

let chain = Promise.resolve();
function enqueue(fn) {
  const p = chain.then(fn, fn);
  chain = p.catch(() => {});
  return p;
}

// Spawn the bridge. Resolves with the "done" line; `onEvent` sees the others.
function spawnBridge(command, payload, { onEvent, timeoutMs = CALL_TIMEOUT_MS } = {}) {
  const args = [path.join(GARMIN_DIR, 'bridge.py'), command];
  if (payload !== undefined) args.push(JSON.stringify(payload));
  const child = spawn(PYTHON, args, {
    cwd: GARMIN_DIR,
    env: {
      ...process.env,
      GARMIN_TOKENSTORE: STATE_DIR,
      PYTHONUNBUFFERED: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdoutBuf = '';
  let stderrBuf = '';
  let done = null;
  const result = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Garmin bridge timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdoutBuf += chunk.toString();
      let nl;
      while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
        const line = stdoutBuf.slice(0, nl).trim();
        stdoutBuf = stdoutBuf.slice(nl + 1);
        if (!line) continue;
        let obj;
        try { obj = JSON.parse(line); } catch (_) { continue; }
        if (obj.done) done = obj;
        else if (onEvent) onEvent(obj);
      }
    });
    child.stderr.on('data', (chunk) => { stderrBuf += chunk.toString(); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (done) return resolve(done);
      const tail = stderrBuf.trim().split('\n').slice(-3).join(' ');
      reject(new Error(`Garmin bridge exited ${code}${tail ? `: ${tail}` : ''}`));
    });
  });
  return { child, result };
}

// Sign-in with the MFA hand-off -------------------------------------------------

let pendingLogin = null;   // { child, result, needsMfa }

function login() {
  if (!configured()) {
    return Promise.resolve({ ok: false, code: 'not_configured', error: 'GARMIN_EMAIL / GARMIN_PASSWORD not set in backend/.env' });
  }
  if (!pythonOk()) {
    return Promise.resolve({ ok: false, code: 'no_python', error: `Python not found at ${PYTHON}; see deploy/README.md` });
  }
  if (pendingLogin) {
    return Promise.resolve(pendingLogin.needsMfa ? { ok: false, needs_mfa: true } : { ok: false, code: 'in_progress', error: 'A sign-in is already running' });
  }
  return new Promise((resolve) => {
    enqueue(() => {
      const handle = { needsMfa: false };
      const { child, result } = spawnBridge('login', undefined, {
        timeoutMs: LOGIN_TIMEOUT_MS,
        onEvent: (ev) => {
          if (ev.event === 'needs_mfa') {
            handle.needsMfa = true;
            resolve({ ok: false, needs_mfa: true });
          }
        },
      });
      handle.child = child;
      handle.result = result
        .catch((err) => ({ ok: false, error: err.message, code: 'bridge' }))
        .then((out) => {
          pendingLogin = null;
          if (out.ok) warmSoon();
          return out;
        });
      pendingLogin = handle;
      handle.result.then((out) => resolve(out));
      return handle.result;
    });
  });
}

function submitMfa(code) {
  if (!pendingLogin || !pendingLogin.needsMfa) {
    return Promise.resolve({ ok: false, code: 'no_pending', error: 'No sign-in is waiting for a code' });
  }
  pendingLogin.child.stdin.write(`${String(code).trim()}\n`);
  return pendingLogin.result;
}

async function logout() {
  const out = await enqueue(() => spawnBridge('logout').result);
  await run('DELETE FROM garmin_cache');
  return out;
}

async function status() {
  const base = {
    configured: configured(),
    python_ok: pythonOk(),
    token_file: tokenFileExists(),
    email: process.env.GARMIN_EMAIL || null,
    signing_in: !!pendingLogin,
    needs_mfa: !!(pendingLogin && pendingLogin.needsMfa),
  };
  if (!base.python_ok || !base.token_file || pendingLogin) return { ...base, connected: false };
  try {
    const out = await enqueue(() => spawnBridge('status').result);
    return { ...base, connected: !!out.connected, profile: out.profile || null, error: out.error || null, code: out.code || null };
  } catch (err) {
    return { ...base, connected: false, error: err.message, code: 'bridge' };
  }
}

// Registry-driven argument coercion ---------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function coerce(type, raw, name) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  switch (type) {
    case 'date':
      if (typeof raw !== 'string' || !ISO_DATE.test(raw)) throw new Error(`${name} must be YYYY-MM-DD`);
      return raw;
    case 'int': {
      const n = Number(raw);
      if (!Number.isInteger(n)) throw new Error(`${name} must be an integer`);
      return n;
    }
    case 'float': {
      const n = Number(raw);
      if (!Number.isFinite(n)) throw new Error(`${name} must be a number`);
      return n;
    }
    case 'bool':
      if (typeof raw === 'boolean') return raw;
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
      throw new Error(`${name} must be true or false`);
    case 'json':
      if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch (_) { throw new Error(`${name} must be JSON`); }
      }
      return raw;
    default:
      return String(raw);
  }
}

// Validate `source` (query or body) against a registry entry -> kwargs.
function buildKwargs(entry, source) {
  const kwargs = {};
  for (const p of entry.params) {
    const v = coerce(p.type, source[p.name], p.name);
    if (v === undefined) {
      if (p.required) throw new Error(`missing ${p.name}`);
      continue;
    }
    kwargs[p.name] = v;
  }
  return kwargs;
}

// Cached calls ------------------------------------------------------------------

const cacheKey = (kwargs) => JSON.stringify(kwargs, Object.keys(kwargs).sort());
const touchesToday = (kwargs) => {
  const today = localISO();
  return Object.values(kwargs).some((v) => v === today) || !Object.values(kwargs).some((v) => ISO_DATE.test(String(v)));
};

async function readCache(name, kwargs, refresh) {
  if (refresh) return null;
  const row = await get('SELECT fetched_at, payload FROM garmin_cache WHERE name = ? AND params = ?', [name, cacheKey(kwargs)]);
  if (!row) return null;
  const ttl = touchesToday(kwargs) ? TODAY_TTL_MS : PAST_TTL_MS;
  if (Date.now() - row.fetched_at > ttl) return null;
  return { data: JSON.parse(row.payload), fetched_at: row.fetched_at };
}

async function writeCache(name, kwargs, data) {
  await run(
    `INSERT INTO garmin_cache (name, params, fetched_at, payload) VALUES (?, ?, ?, ?)
       ON CONFLICT(name, params) DO UPDATE SET fetched_at = excluded.fetched_at, payload = excluded.payload`,
    [name, cacheKey(kwargs), Date.now(), JSON.stringify(data === undefined ? null : data)]
  );
}

// Run a batch of {key, name, kwargs}. Reads hit the cache first; whatever is
// missing goes to Garmin in one bridge run. Returns {key: {ok, data, cached, fetched_at | error, code}}.
// `cacheOnly` never spawns the bridge: a miss comes back as {ok:false, code:'cache_miss'}
// (the Health ingest's dry run uses it, so a dry run cannot make a Garmin call).
async function callMany(calls, { refresh = false, cacheOnly = false } = {}) {
  const results = {};
  const pending = [];
  for (const c of calls) {
    const entry = BY_NAME[c.name];
    if (!entry || entry.kind === 'unsupported') {
      results[c.key] = { ok: false, code: 'bad_request', error: `unknown or unsupported endpoint: ${c.name}` };
      continue;
    }
    if (entry.kind === 'read') {
      const hit = await readCache(c.name, c.kwargs, refresh && !cacheOnly);
      if (hit) { results[c.key] = { ok: true, cached: true, fetched_at: hit.fetched_at, data: hit.data }; continue; }
    }
    pending.push(c);
  }
  if (pending.length === 0) return results;
  if (cacheOnly) {
    for (const c of pending) results[c.key] = { ok: false, code: 'cache_miss', error: `${c.name} is not in garmin_cache (dry run makes no Garmin calls)` };
    return results;
  }
  if (!pythonOk()) {
    for (const c of pending) results[c.key] = { ok: false, code: 'no_python', error: `Python not found at ${PYTHON}` };
    return results;
  }
  const out = await enqueue(() => spawnBridge('call', { calls: pending }).result);
  const now = Date.now();
  for (const c of pending) {
    const r = (out.results && out.results[c.key]) || { ok: false, code: out.code || 'bridge', error: out.error || 'no result' };
    if (r.ok && BY_NAME[c.name].kind === 'read') {
      await writeCache(c.name, c.kwargs, r.data);
      results[c.key] = { ok: true, cached: false, fetched_at: now, data: r.data };
    } else {
      results[c.key] = r;
    }
  }
  return results;
}

async function callOne(name, kwargs, opts) {
  const res = await callMany([{ key: name, name, kwargs }], opts);
  return res[name];
}

// The Health page bundle ---------------------------------------------------------

function dayCalls(date) {
  return [
    { key: 'summary', name: 'get_user_summary', kwargs: { cdate: date } },
    { key: 'sleep', name: 'get_sleep_data', kwargs: { cdate: date } },
    { key: 'heart_rate', name: 'get_heart_rates', kwargs: { cdate: date } },
    { key: 'stress', name: 'get_stress_data', kwargs: { cdate: date } },
    { key: 'body_battery', name: 'get_body_battery', kwargs: { startdate: date, enddate: date } },
    { key: 'hrv', name: 'get_hrv_data', kwargs: { cdate: date } },
    { key: 'spo2', name: 'get_spo2_data', kwargs: { cdate: date } },
    { key: 'respiration', name: 'get_respiration_data', kwargs: { cdate: date } },
    { key: 'training_readiness', name: 'get_training_readiness', kwargs: { cdate: date } },
    { key: 'training_status', name: 'get_training_status', kwargs: { cdate: date } },
    { key: 'max_metrics', name: 'get_max_metrics', kwargs: { cdate: date } },
    { key: 'fitness_age', name: 'get_fitnessage_data', kwargs: { cdate: date } },
    { key: 'activities', name: 'get_activities_by_date', kwargs: { startdate: date, enddate: date } },
    { key: 'weigh_ins', name: 'get_daily_weigh_ins', kwargs: { cdate: date } },
    { key: 'hydration', name: 'get_hydration_data', kwargs: { cdate: date } },
    { key: 'intensity_minutes', name: 'get_intensity_minutes_data', kwargs: { cdate: date } },
    { key: 'floors', name: 'get_floors', kwargs: { cdate: date } },
    { key: 'steps', name: 'get_steps_data', kwargs: { cdate: date } },
  ];
}

async function dayBundle(date, { refresh = false } = {}) {
  const results = await callMany(dayCalls(date), { refresh });
  const fetched = Object.values(results).map((r) => r.fetched_at).filter(Boolean);
  return { date, fetched_at: fetched.length ? Math.max(...fetched) : null, results };
}

// Keep today's bundle warm so the tab opens instantly. The bundle is then announced on
// the bus ('garmin:day') for the Health ingest, which consumes the very same result
// objects, so the Health store and this cache can never hold different bytes for the
// same minute. The announcement is guarded: a listener that throws, rejects or hangs
// cannot fail, delay or change what warm() resolves with. `fetch` is injectable for
// the test of that guarantee.
let warmTimer = null;
async function warm({ fetch = dayBundle } = {}) {
  if (fetch === dayBundle && (!tokenFileExists() || pendingLogin || !pythonOk())) return null;
  let bundle = null;
  try {
    bundle = await fetch(localISO());
  } catch (err) {
    console.error('Garmin warm-cache failed:', err.message);
    return null;
  }
  bus.announce('garmin:day', { kind: 'warm', date: bundle.date, results: bundle.results, fetched_at: bundle.fetched_at });
  return bundle;
}
function warmSoon() { setTimeout(warm, 2000); }
function startWarmCache() {
  if (warmTimer) return;
  warmSoon();
  warmTimer = setInterval(warm, WARM_INTERVAL_MS);
}

module.exports = {
  registry, BY_NAME, configured, pythonOk, tokenFileExists,
  login, submitMfa, logout, status,
  buildKwargs, callOne, callMany, dayBundle, dayCalls, warm, startWarmCache,
};
