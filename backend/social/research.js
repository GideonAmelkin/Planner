// Competitors card: read-only views over the TikTok tracker's research.db
// (~/Documents/Social/TikTokAnalyzer/data/research.db on RT100, override RESEARCH_DB_PATH).
// TikTokAnalyzer's `research.py competitors` (09:30) and the Mac hook job write it; the
// Planner only reads it, OPEN_READONLY, and re-queries when the file's mtime changes.
const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite3 = require('sqlite3');

const DB_PATH = process.env.RESEARCH_DB_PATH
  || path.join(os.homedir(), 'Documents', 'Social', 'TikTokAnalyzer', 'data', 'research.db');

let handle = null;   // { db, ino }
let cache = { mtimeMs: null, data: null };

function stat() {
  try {
    return fs.statSync(DB_PATH);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

const closeHandle = () => {
  if (handle) { try { handle.db.close(); } catch (_) { /* ignore */ } }
  handle = null;
};

function connection(st) {
  if (handle && handle.ino === st.ino) return Promise.resolve(handle.db);
  closeHandle();
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
      db.configure('busyTimeout', 3000);
      handle = { db, ino: st.ino };
      resolve(db);
    });
  });
}

const all = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

async function columns(db, table) {
  return new Set((await all(db, `PRAGMA table_info(${table})`)).map((r) => r.name));
}

// Everything the card needs, cached by mtime: accounts, every video of every account that
// is watched, proposed or removed, their hook rows and snapshots. null when the file is absent
// or predates the competitor columns.
async function load() {
  const st = stat();
  if (!st) { closeHandle(); cache = { mtimeMs: null, data: null }; return null; }
  if (cache.data && cache.mtimeMs === st.mtimeMs) return cache.data;
  const db = await connection(st);
  const acols = await columns(db, 'accounts');
  if (!acols.has('status')) return null;
  const accounts = await all(db, 'SELECT * FROM accounts ORDER BY handle');
  const videos = await all(db, `SELECT v.* FROM research_videos v JOIN accounts a ON a.handle = lower(v.handle)
    WHERE a.status IN ('watch', 'proposed', 'removed')`);
  const ids = new Set(videos.map((v) => v.video_id));
  const hooks = (await all(db, `SELECT video_id, whisper_model, hook_transcript, setup_transcript, full_transcript,
    onscreen_text_json, visual_json, duration, error, cause, attempts FROM hooks`)).filter((h) => ids.has(h.video_id));
  const snaps = (await all(db, 'SELECT video_id, read_at, views FROM research_snapshots ORDER BY read_at'))
    .filter((s) => ids.has(s.video_id));
  const hookById = new Map(hooks.map((h) => [h.video_id, h]));
  const snapsById = new Map();
  for (const s of snaps) {
    if (!snapsById.has(s.video_id)) snapsById.set(s.video_id, []);
    snapsById.get(s.video_id).push(s);
  }
  const data = {
    mtime: new Date(st.mtimeMs).toISOString(),
    mtimeMs: st.mtimeMs,
    accounts,
    videos,
    hookById,
    snapsById,
  };
  cache = { mtimeMs: st.mtimeMs, data };
  return data;
}

// The first spoken words, else the on-screen text of the first frame (same rule as the tracker's HookRow.hook_line).
function hookLine(hook) {
  if (!hook) return '';
  const spoken = (hook.hook_transcript || '').trim();
  if (spoken) return spoken;
  return onscreenAtStart(hook);
}

function onscreenAtStart(hook) {
  try {
    const entries = JSON.parse(hook.onscreen_text_json || '[]');
    const first = entries.find((e) => Number(e.t || 0) <= 0);
    return first && first.text ? String(first.text).trim() : '';
  } catch (_) {
    return '';
  }
}

function visuals(hook) {
  try {
    return JSON.parse(hook.visual_json || '[]').map((v) => v.visual).filter(Boolean).join(' / ');
  } catch (_) {
    return '';
  }
}

function onscreenAll(hook) {
  try {
    return JSON.parse(hook.onscreen_text_json || '[]').map((e) => e.text).filter(Boolean).join(' / ');
  } catch (_) {
    return '';
  }
}

module.exports = { DB_PATH, stat, load, hookLine, onscreenAtStart, onscreenAll, visuals };
