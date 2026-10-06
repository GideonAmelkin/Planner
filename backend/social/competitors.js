// The Competitors card: what GET /api/social/competitors returns. Pure computation over
// research.db (read-only, research.js) joined with the Planner's own rows (watchlist, niche
// scores, labels, saves). The outlier multiple uses the tracker's exact rule
// (tiktok_analyzer/selection.py multiples_for): views / median views of the 20 aged posts
// published immediately before it, at least 10 of them, videos under 7 days old unscored.
const crypto = require('crypto');
const { run, get, all } = require('../db');
const { localISO } = require('../lib/dates');
const research = require('./research');
const thumbs = require('./thumbs');

const WINDOW_DAYS = 90;
const MIN_AGE_DAYS = 7;
const BASELINE_WINDOW = 20;
const MIN_BASELINE = 10;
const GAP_DAYS = 60;
const OUTLIER_MIN = 2.0;        // an outlier on the card beats its own baseline at least 2x
const TOP_OUTLIERS = 8;
const POPULAR_SHOWN = 6;
const MAX_WATCH = 15;
const DEFAULT_OWN_FOLLOWERS = 5006;   // read from the own video page 2026-10-05; refreshed by the job

const DEFAULT_NICHE = 'Motivation and positivity: daily encouragement, mindset, gratitude, talking to camera. '
  + 'Plus self-improvement challenges: personal growth journeys, 30-day challenges, discipline, documenting progress.';

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDaysAgo = (days, today = localISO()) => localISO(new Date(Date.parse(`${today}T12:00:00`) - days * DAY_MS));
const dayDiff = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / DAY_MS);
const hash = (s) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 12);
const cleanHandle = (h) => String(h || '').trim().replace(/^@+/, '').toLowerCase();
const isHandle = (h) => /^[a-z0-9._]{2,24}$/.test(h);

function median(nums) {
  const s = nums.filter((x) => x !== null && x !== undefined && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Python's round(x, d) on a float: rounds the exact binary value (0.35 is 0.3499... so it goes
// down), and an exact tie (0.25) goes to the even digit. toFixed already rounds the exact value
// and only differs on exact ties, where it rounds up; those are detected from the full expansion.
function round(x, d) {
  if (!Number.isFinite(x)) return x;
  const exact = Math.abs(x).toFixed(Math.min(100, d + 60));
  const dot = exact.indexOf('.');
  const tail = exact.slice(dot + 1 + d);
  if (tail[0] === '5' && /^50*$/.test(tail)) {
    const kept = exact.slice(0, dot + 1 + d).replace(/\.$/, '');
    const last = Number(kept[kept.length - 1]);
    const down = Number(kept);
    const step = 10 ** -d;
    const v = last % 2 === 0 ? down : down + step;
    return Math.sign(x) * Number(v.toFixed(d));
  }
  return Number(x.toFixed(d));
}

// Port of selection.multiples_for. videos: [{video_id, date_posted, views}]. Returns Map id -> {multiple, gap}.
function multiplesFor(videos, today) {
  const out = new Map(videos.map((v) => [v.video_id, { multiple: null, gap: null }]));
  const aged = videos
    .filter((v) => v.date_posted && v.views !== null && v.views !== undefined && dayDiff(v.date_posted, today) >= MIN_AGE_DAYS)
    .sort((a, b) => (a.date_posted === b.date_posted
      ? (a.video_id < b.video_id ? 1 : a.video_id > b.video_id ? -1 : 0)
      : (a.date_posted < b.date_posted ? 1 : -1)));
  aged.forEach((v, i) => {
    const trailing = aged.slice(i + 1, i + 1 + BASELINE_WINDOW);
    if (trailing.length < MIN_BASELINE) return;
    const base = median(trailing.map((t) => Number(t.views)));
    if (!base) return;
    const chain = aged.slice(i, i + 1 + BASELINE_WINDOW);
    let gap = false;
    for (let k = 0; k + 1 < chain.length; k++) {
      if (dayDiff(chain[k + 1].date_posted, chain[k].date_posted) > GAP_DAYS) { gap = true; break; }
    }
    out.set(v.video_id, { multiple: round(round(Number(v.views) / base, 3), 1), gap });
  });
  return out;
}

function band(followers, own) {
  if (!followers || !own) return null;
  const r = followers / own;
  if (r < 3) return 'Near';
  if (r < 30) return '10x';
  return '100x+';
}

const BAND_ORDER = { Near: 0, '10x': 1, '100x+': 2 };
const perK = (n, views) => (views ? round((Number(n) || 0) / views * 1000, 1) : null);

// -- settings ------------------------------------------------------------------

async function setting(key, fallback) {
  const row = await get('SELECT value FROM social_settings WHERE key = ?', [key]);
  return row && row.value !== null ? row.value : fallback;
}

async function setSetting(key, value) {
  await run(`INSERT INTO social_settings (key, value, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  [key, value, new Date().toISOString()]);
}

async function niche() { return setting('niche', DEFAULT_NICHE); }
async function ownFollowers() { return Number(await setting('own_followers', DEFAULT_OWN_FOLLOWERS)) || DEFAULT_OWN_FOLLOWERS; }
const nicheHash = (text) => hash(text);

// -- the watchlist ---------------------------------------------------------------

async function listing() {
  const rows = await all('SELECT handle, status FROM social_competitors ORDER BY handle');
  const by = (s) => rows.filter((r) => r.status === s).map((r) => r.handle);
  return { watch: by('watch'), removed: by('removed') };
}

// add | remove. Returns {status, body}.
async function changeHandle(action, raw) {
  const h = cleanHandle(raw);
  if (!isHandle(h)) return { status: 400, body: { error: 'not a TikTok handle' } };
  const now = new Date().toISOString();
  if (action === 'add') {
    const watching = (await get("SELECT COUNT(*) AS n FROM social_competitors WHERE status = 'watch'")).n;
    const existing = await get('SELECT status FROM social_competitors WHERE handle = ?', [h]);
    if (!(existing && existing.status === 'watch') && watching >= MAX_WATCH) {
      return { status: 409, body: { error: `at most ${MAX_WATCH} accounts` } };
    }
  }
  const status = { add: 'watch', remove: 'removed' }[action];
  if (!status) return { status: 400, body: { error: 'unknown action' } };
  await run(`INSERT INTO social_competitors (handle, status, added_at, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(handle) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at`, [h, status, now, now]);
  return { status: 200, body: { handle: h, status } };
}

// -- planner-side joins -----------------------------------------------------------

async function plannerRows(nh) {
  const [scores, labels, saves] = await Promise.all([
    all('SELECT video_id, score, topic FROM social_competitor_relevance WHERE niche_hash = ?', [nh]),
    all('SELECT video_id, move, format, text_overlay FROM social_competitor_labels WHERE label_hash = ?', [LABEL_HASH]),
    all('SELECT video_id, note, saved_at FROM social_competitor_saves'),
  ]);
  return {
    scores: new Map(scores.map((r) => [r.video_id, r])),
    labels: new Map(labels.map((r) => [r.video_id, r])),
    saves: new Map(saves.map((r) => [r.video_id, r])),
  };
}

// The label prompt version; changing the prompt in competitorJobs.js bumps it so rows relabel.
const LABEL_HASH = 'labels-v1';

// -- the payload --------------------------------------------------------------------

function videoView(v, ctx) {
  const hook = ctx.data.hookById.get(v.video_id);
  const score = ctx.p.scores.get(v.video_id);
  const label = ctx.p.labels.get(v.video_id);
  const save = ctx.p.saves.get(v.video_id);
  const m = ctx.multiples.get(v.video_id) || {};
  const views = Number(v.views) || 0;
  const created = v.create_time ? v.create_time * 1000 : (v.date_posted ? Date.parse(`${v.date_posted}T12:00:00Z`) : null);
  const ageDays = created ? Math.max(0.1, (Date.now() - created) / DAY_MS) : null;
  const snaps = ctx.data.snapsById.get(v.video_id) || [];
  let perDay = null;
  if (snaps.length >= 2) {
    const last = snaps[snaps.length - 1];
    const prev = [...snaps].reverse().find((s) => Date.parse(`${last.read_at}Z`) - Date.parse(`${s.read_at}Z`) >= 20 * 3600 * 1000);
    if (prev && last.views !== null && prev.views !== null) {
      const days = (Date.parse(`${last.read_at}Z`) - Date.parse(`${prev.read_at}Z`)) / DAY_MS;
      perDay = Math.round((last.views - prev.views) / days);
    }
  }
  return {
    video_id: v.video_id,
    handle: v.handle,
    url: v.url,
    date_posted: v.date_posted,
    age_days: ageDays === null ? null : round(ageDays, 1),
    views,
    likes: v.likes, comments: v.comments, saves: v.saves, shares: v.shares,
    saves_per_k: perK(v.saves, views),
    shares_per_k: perK(v.shares, views),
    multiple: m.multiple === undefined ? null : m.multiple,
    gap: m.gap || false,
    views_per_day: perDay,
    first_seen_views: v.first_seen_views,
    first_seen_age_h: v.first_seen_age_h,
    ...(({ line, more }) => ({ hook: line, hook_more: more }))(research.openingLine(hook, v.caption)),
    hook_state: !hook ? 'pending' : (hook.error ? (hook.cause || 'failed') : 'ok'),
    caption: v.caption || '',
    duration: v.duration,
    is_photo: Boolean(v.is_photo),
    sound: v.music_id ? { id: v.music_id, title: v.music_title, author: v.music_author, original: Boolean(v.music_original) } : null,
    in_popular: v.in_popular,
    score: score ? score.score : null,
    topic: score ? score.topic : null,
    move: label ? label.move : null,
    format: label ? label.format : null,
    text_overlay: label ? Boolean(label.text_overlay) : null,
    has_thumb: Boolean(ctx.thumbs && ctx.thumbs.has(v.video_id)),
    saved: Boolean(save),
    note: save ? save.note : null,
  };
}

async function payload() {
  const data = await research.load();
  const nicheText = await niche();
  const nh = nicheHash(nicheText);
  const own = await ownFollowers();
  const list = await listing();
  const base = {
    available: Boolean(data),
    research_db: research.DB_PATH,
    updated_at: data ? data.mtime : null,
    own_followers: own,
    niche: nicheText,
    watchlist: list.watch,
  };
  if (!data) return { ...base, accounts: [], saved: [] };
  const today = localISO();
  const start = isoDaysAgo(WINDOW_DAYS, today);
  const p = await plannerRows(nh);
  const cached = thumbs.cachedIds();
  const byHandle = new Map();
  for (const v of data.videos) {
    const h = cleanHandle(v.handle);
    if (!byHandle.has(h)) byHandle.set(h, []);
    byHandle.get(h).push(v);
  }
  const ledger = new Map(data.accounts.map((a) => [a.handle, a]));
  const all_ = [];
  const accounts = [];
  for (const handle of list.watch) {
    const vids = byHandle.get(handle) || [];
    const multiples = multiplesFor(vids, today);
    const ctx = { data, p, multiples, thumbs: cached };
    const a = ledger.get(handle) || {};
    const views = vids.map((v) => videoView(v, ctx));
    all_.push(...views);
    const inWindow = views.filter((v) => v.date_posted && v.date_posted >= start);
    const shown = (v) => v.score !== null && v.score >= 2;
    const outliers = inWindow.filter((v) => shown(v) && v.multiple !== null && v.multiple >= OUTLIER_MIN)
      .sort((x, y) => y.multiple - x.multiple).slice(0, TOP_OUTLIERS);
    const baselineNow = median(vids.filter((v) => v.date_posted && dayDiff(v.date_posted, today) >= MIN_AGE_DAYS)
      .sort((x, y) => (x.date_posted < y.date_posted ? 1 : -1)).slice(0, BASELINE_WINDOW).map((v) => Number(v.views)));
    const rising = inWindow.filter((v) => shown(v) && v.age_days !== null && v.age_days < MIN_AGE_DAYS)
      .map((v) => ({ ...v, early_multiple: baselineNow ? round(v.views / baselineNow, 1) : null }))
      .sort((x, y) => (y.early_multiple || 0) - (x.early_multiple || 0));
    const followers = a.followers || (vids.find((v) => v.author_followers) || {}).author_followers || null;
    accounts.push({
      handle,
      followers,
      band: band(followers, own),
      posts_90d: inWindow.length,
      median_views_90d: median(inWindow.map((v) => v.views)),
      baseline_now: baselineNow,
      last_walk_at: a.last_walk_at || null,
      deep_walked_at: a.deep_walked_at || null,
      last_cut_at: a.last_cut_at || null,
      last_popular_at: a.last_popular_at || null,
      // Only videos that can reach the card get a hook read (the tracker's pending_hooks): outliers
      // at OUTLIER_MIN or more, and young posts already at their account's usual views.
      hooks_pending: inWindow.filter((v) => v.hook_state === 'pending' && ((v.multiple !== null && v.multiple >= OUTLIER_MIN)
        || (v.multiple === null && baselineNow && v.age_days !== null && v.age_days < MIN_AGE_DAYS && v.views >= baselineNow))).length,
      unscored: inWindow.filter((v) => v.hook_state !== 'pending' && v.score === null).length,
      off_niche_hidden: inWindow.filter((v) => v.score === 0).length,
      outliers,
      rising,
      adjacent: inWindow.filter((v) => v.score === 1 && v.multiple !== null && v.multiple >= OUTLIER_MIN)
        .sort((x, y) => y.multiple - x.multiple).slice(0, TOP_OUTLIERS),
      popular: views.filter((v) => v.in_popular && v.score !== null && v.score >= 2)
        .sort((x, y) => x.in_popular - y.in_popular).slice(0, POPULAR_SHOWN),
      popular_hidden: views.filter((v) => v.in_popular && v.score === 0).length,
    });
  }
  accounts.sort((x, y) => (BAND_ORDER[x.band] ?? 3) - (BAND_ORDER[y.band] ?? 3) || x.handle.localeCompare(y.handle));

  const savedIds = new Set(p.saves.keys());
  const saved = all_.filter((v) => savedIds.has(v.video_id))
    .sort((x, y) => (p.saves.get(y.video_id).saved_at || '').localeCompare(p.saves.get(x.video_id).saved_at || ''));

  return {
    ...base,
    accounts,
    saved,
    last_run: await get('SELECT * FROM social_competitor_runs ORDER BY id DESC LIMIT 1'),
  };
}

// Top on-niche outliers per account for the Summary review (review.js v7).
async function winnersForReview(perAccount = 3) {
  const p = await payload();
  if (!p.available) return [];
  return p.accounts.flatMap((a) => a.outliers.slice(0, perAccount).map((o) => ({
    handle: a.handle, follower_band: a.band, opening_line: o.hook, move: o.move, format: o.format,
    multiple_vs_own_baseline: o.multiple, saves_per_1k_views: o.saves_per_k, date_posted: o.date_posted,
  }))).filter((w) => w.opening_line);
}

async function saveVideo(videoId, note) {
  await run(`INSERT INTO social_competitor_saves (video_id, note, saved_at) VALUES (?, ?, ?)
    ON CONFLICT(video_id) DO UPDATE SET note = excluded.note`, [videoId, note ? String(note).slice(0, 500) : null, new Date().toISOString()]);
}

async function unsaveVideo(videoId) {
  await run('DELETE FROM social_competitor_saves WHERE video_id = ?', [videoId]);
}

module.exports = {
  WINDOW_DAYS, OUTLIER_MIN, LABEL_HASH, DEFAULT_NICHE, MAX_WATCH,
  multiplesFor, band, median, cleanHandle, isHandle, nicheHash, niche, ownFollowers, setSetting,
  listing, changeHandle, payload, winnersForReview, saveVideo, unsaveVideo, isoDaysAgo,
};
