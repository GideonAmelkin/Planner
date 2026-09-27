// Social tab: read-only views over the TikTok tracker's database. TikTokAnalyzer
// (~/Documents/Social/TikTokAnalyzer on RT100) owns data/tiktok.db: its 06:15 cron
// writes it and then rewrites the Google Sheet from it. This module is a second
// reader of that same file. It opens the db OPEN_READONLY, never writes, never
// creates it, and re-queries only when the file's mtime changes.
const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite3 = require('sqlite3');
const { localISO } = require('../lib/dates');

const DB_PATH = process.env.TIKTOK_DB_PATH
  || path.join(os.homedir(), 'Documents', 'Social', 'TikTokAnalyzer', 'data', 'tiktok.db');
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;       // the review looks at the last 30 days of posts...
const WINDOW_MIN = 10;        // ...or the 20 most recent when fewer than 10 posted in it
const WINDOW_FALLBACK = 20;

// Every sheet column plus the tracker's bookkeeping; `script` is left to video().
const LIST_COLUMNS = [
  'video_id', 'url', 'caption', 'date_posted', 'username', 'views', 'likes', 'comments', 'saves', 'shares',
  'hook_summary', 'multiple', 'baseline_spans_gap', 'source', 'first_seen_at', 'last_seen_at',
  'last_refreshed_at', 'last_refresh_status',
];
const ORDER = 'ORDER BY date_posted DESC, video_id DESC';

let handle = null;                        // { db, ino }
let cache = { mtimeMs: null, rows: null };

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

// One read-only connection, reopened if the file is ever replaced (new inode).
function connection(st) {
  if (handle && handle.ino === st.ino) return Promise.resolve(handle.db);
  closeHandle();
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
      db.configure('busyTimeout', 3000);    // the cron may be mid-write; wait, do not fail
      handle = { db, ino: st.ino };
      resolve(db);
    });
  });
}

const all = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});
const get = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
});

// Every video (no script), newest first, or null when the tracker db is not there.
async function rows() {
  const st = stat();
  if (!st) { closeHandle(); cache = { mtimeMs: null, rows: null }; return null; }
  if (cache.rows && cache.mtimeMs === st.mtimeMs) return cache.rows;
  const db = await connection(st);
  const list = await all(db, `SELECT ${LIST_COLUMNS.join(', ')} FROM videos ${ORDER}`);
  cache = { mtimeMs: st.mtimeMs, rows: list };
  return list;
}

// One video with its transcript, or null.
async function video(id) {
  const st = stat();
  if (!st) return null;
  const db = await connection(st);
  return (await get(db, `SELECT ${LIST_COLUMNS.join(', ')}, script, script_summary FROM videos WHERE video_id = ?`, [id])) || null;
}

const isoDaysAgo = (days) => localISO(new Date(Date.now() - days * DAY_MS));
const sum = (list, key) => list.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

// Tile numbers for the data card.
function summary(list, st) {
  const cutoff = isoDaysAgo(WINDOW_DAYS);
  const recent = list.filter((r) => r.date_posted && r.date_posted >= cutoff);
  const refreshed = list.map((r) => r.last_refreshed_at).filter(Boolean).sort();
  return {
    videos: list.length,
    total_views: sum(list, 'views'),
    views_30d: sum(recent, 'views'),
    posts_30d: recent.length,
    last_post: list.length ? list[0].date_posted : null,
    newest_video_id: list.length ? list[0].video_id : null,
    updated_at: refreshed.length ? refreshed[refreshed.length - 1] : (st ? new Date(st.mtimeMs).toISOString() : null),
    db_mtime: st ? new Date(st.mtimeMs).toISOString() : null,
  };
}

// The videos the review analyses, with transcripts: the last 30 days of posts, or the
// 20 most recent when fewer than 10 fall in that window.
async function recentWindow() {
  const st = stat();
  if (!st) return null;
  const db = await connection(st);
  const cutoff = isoDaysAgo(WINDOW_DAYS);
  const cols = `${LIST_COLUMNS.join(', ')}, script`;
  let list = await all(db, `SELECT ${cols} FROM videos WHERE date_posted >= ? ${ORDER}`, [cutoff]);
  let basis = `last ${WINDOW_DAYS} days`;
  if (list.length < WINDOW_MIN) {
    list = await all(db, `SELECT ${cols} FROM videos WHERE date_posted IS NOT NULL ${ORDER} LIMIT ?`, [WINDOW_FALLBACK]);
    basis = `last ${WINDOW_FALLBACK} posts`;
  }
  const dates = list.map((r) => r.date_posted).filter(Boolean).sort();
  // The last post before the window, so the review knows how long the account was quiet.
  const prev = dates.length ? await get(db, 'SELECT MAX(date_posted) AS d FROM videos WHERE date_posted < ?', [dates[0]]) : null;
  return {
    basis,
    start: dates[0] || null,
    end: dates[dates.length - 1] || null,
    previous_post: prev && prev.d ? prev.d : null,
    videos: list,
  };
}

// The account's all-time best by the tracker's baseline multiple, for context.
async function allTimeBest(limit = 10) {
  const st = stat();
  if (!st) return [];
  const db = await connection(st);
  return all(db, `SELECT video_id, date_posted, views, likes, comments, saves, shares, multiple, hook_summary, caption
    FROM videos WHERE multiple IS NOT NULL ORDER BY multiple DESC LIMIT ?`, [limit]);
}

async function status() {
  const st = stat();
  const list = await rows();
  if (!list) return { available: false, path: path.basename(DB_PATH) };
  return { available: true, path: path.basename(DB_PATH), ...summary(list, st) };
}

module.exports = { DB_PATH, stat, rows, video, summary, recentWindow, allTimeBest, status, WINDOW_DAYS };
