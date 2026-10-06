// The Competitors card's analysis job, run on a schedule only (the API is public, so
// nothing here can be triggered from outside). Every step is capped per run and skips work
// already done, so a sweep with nothing new costs nothing.
//
// 1. niche relevance: Haiku scores each competitor video 0-3 against the niche text
//    (transcript, caption, on-screen text); rows keyed by the niche text's hash, so editing
//    the niche rescores everything in the background;
// 2. labels: Haiku names the hook move and the format of each video scored 1 or more;
// 3. covers: each shown video's cover cached once (thumbs.js);
// 4. once a day, the own follower count from the own newest video page (follower bands).
// Comment reading and tagging were removed on 2026-10-06 (the card no longer shows ideas).
const Anthropic = require('@anthropic-ai/sdk');
const { run, get, all } = require('../db');
const { localISO } = require('../lib/dates');
const research = require('./research');
const comp = require('./competitors');
const thumbs = require('./thumbs');
const social = require('./service');

const MODEL = 'claude-haiku-4-5';
const SCORE_BATCH = 20;
const SCORE_CAP = 200;          // videos scored per run
const LABEL_BATCH = 15;
const LABEL_CAP = 150;
const SWEEP_MS = 15 * 60 * 1000;
const FIRST_SWEEP_MS = 2 * 60 * 1000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const MOVES = ['Verdict', 'Relatable', 'Objection-first', 'Confession', 'Reveal', 'Contrarian', 'Cold open', 'Countdown',
  'Callback', 'Question', 'Reply', 'Story', 'Challenge', 'Milestone', 'How-to'];
const FORMATS = ['talking head', 'reply-to-comment', 'text-on-screen', 'b-roll voiceover', 'tutorial', 'listicle', 'skit',
  'green screen', 'duet/stitch', 'slideshow', 'other'];

let running = false;
const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY);
const clean = (s) => String(s || '').replace(/\s*—\s*/g, ', ').replace(/–/g, '-');
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}...` : t; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

async function callJson(system, input, schema, maxTokens = 4000) {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    output_config: { format: { type: 'json_schema', schema } },
  });
  if (response.stop_reason !== 'end_turn') throw new Error(`model stopped early (${response.stop_reason})`);
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return { result: JSON.parse(text), usage: response.usage || {} };
}

// -- 1. niche relevance ----------------------------------------------------------------

const SCORE_SYSTEM = (niche) => `You judge whether TikTok videos belong to one creator's niche.
The niche: ${niche}
For each video you get its caption, the first spoken words, the on-screen text, a short description of the opening
frames and part of the transcript. Score it:
3 = core of the niche, 2 = clearly in the niche, 1 = adjacent (a nearby topic or a format the niche could borrow),
0 = off-niche (news, sports clips, ads, unrelated topics).
Judge the topic and what the video is for, not its quality. topic: 2 to 5 plain words naming what the video is about.
Never use em dashes.`;

const SCORE_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['scores'],
  properties: {
    scores: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['video_id', 'score', 'topic'],
        properties: { video_id: { type: 'string' }, score: { type: 'integer', enum: [0, 1, 2, 3] }, topic: { type: 'string' } },
      },
    },
  },
};

function videoInput(v, hook) {
  return {
    video_id: v.video_id,
    caption: clip(v.caption, 300),
    first_words: clip(hook && hook.hook_transcript, 200),
    on_screen: clip(hook ? research.onscreenAll(hook) : '', 300),
    opening_frames: clip(hook ? research.visuals(hook) : '', 300),
    transcript: clip(hook && hook.full_transcript, 1200),
    photo_post: Boolean(v.is_photo),
  };
}

// Videos the card can show: watched accounts' videos in the window or on Popular, only once
// their hook row exists (the Mac has processed them).
function candidates(data, watch) {
  const start = comp.isoDaysAgo(comp.WINDOW_DAYS);
  const status = new Map(data.accounts.map((a) => [a.handle, a.status]));
  return data.videos.filter((v) => {
    const h = String(v.handle || '').toLowerCase();
    const s = status.get(h);
    if (!data.hookById.has(v.video_id)) return false;
    if (s === 'watch' && watch.has(h)) return (v.date_posted && v.date_posted >= start) || v.in_popular;
    return false;
  });
}

async function scoreStep(data, watch, totals) {
  const niche = await comp.niche();
  const nh = comp.nicheHash(niche);
  const done = new Set((await all('SELECT video_id FROM social_competitor_relevance WHERE niche_hash = ?', [nh])).map((r) => r.video_id));
  const todo = candidates(data, watch).filter((v) => !done.has(v.video_id)).slice(0, SCORE_CAP);
  for (let i = 0; i < todo.length; i += SCORE_BATCH) {
    const batch = todo.slice(i, i + SCORE_BATCH);
    const { result, usage } = await callJson(SCORE_SYSTEM(niche), { videos: batch.map((v) => videoInput(v, data.hookById.get(v.video_id))) }, SCORE_SCHEMA);
    add(totals, usage);
    const wanted = new Set(batch.map((v) => v.video_id));
    for (const s of result.scores || []) {
      if (!wanted.has(s.video_id)) continue;
      await run(`INSERT OR REPLACE INTO social_competitor_relevance (video_id, niche_hash, score, topic, model, scored_at)
        VALUES (?, ?, ?, ?, ?, ?)`, [s.video_id, nh, s.score, clean(s.topic).slice(0, 80), MODEL, now()]);
      totals.scored += 1;
    }
  }
}

// -- 2. move + format ------------------------------------------------------------------

const LABEL_SYSTEM = `You label the opening of TikTok videos for a creator studying competitors.
move: how the first three seconds grab the viewer, one of ${MOVES.join(', ')}; coin one or two words only when none fits.
Relatable = names the viewer's own situation first. Reply = answers a viewer comment shown on screen.
format: how the video is made, exactly one of ${FORMATS.join(', ')}.
text_overlay: true when the opening frames carry on-screen text beyond a caption sticker.
Never use em dashes.`;

const LABEL_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['labels'],
  properties: {
    labels: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['video_id', 'move', 'format', 'text_overlay'],
        properties: {
          video_id: { type: 'string' }, move: { type: 'string' },
          format: { type: 'string', enum: FORMATS }, text_overlay: { type: 'boolean' },
        },
      },
    },
  },
};

async function labelStep(data, watch, totals) {
  const nh = comp.nicheHash(await comp.niche());
  const shown = new Set((await all('SELECT video_id FROM social_competitor_relevance WHERE niche_hash = ? AND score >= 1', [nh])).map((r) => r.video_id));
  const done = new Set((await all('SELECT video_id FROM social_competitor_labels WHERE label_hash = ?', [comp.LABEL_HASH])).map((r) => r.video_id));
  const todo = candidates(data, watch).filter((v) => shown.has(v.video_id) && !done.has(v.video_id)).slice(0, LABEL_CAP);
  for (let i = 0; i < todo.length; i += LABEL_BATCH) {
    const batch = todo.slice(i, i + LABEL_BATCH);
    const input = batch.map((v) => {
      const hook = data.hookById.get(v.video_id);
      return { ...videoInput(v, hook), transcript: clip(hook && hook.setup_transcript, 300), duration_s: v.duration };
    });
    const { result, usage } = await callJson(LABEL_SYSTEM, { videos: input }, LABEL_SCHEMA);
    add(totals, usage);
    const wanted = new Set(batch.map((v) => v.video_id));
    for (const l of result.labels || []) {
      if (!wanted.has(l.video_id)) continue;
      await run(`INSERT OR REPLACE INTO social_competitor_labels (video_id, label_hash, move, format, text_overlay, model, labeled_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`, [l.video_id, comp.LABEL_HASH, clean(l.move).slice(0, 30), l.format, l.text_overlay ? 1 : 0, MODEL, now()]);
      totals.labeled += 1;
    }
  }
}

// -- 3. covers ---------------------------------------------------------------------------

const THUMB_CAP = 80;
// Every video the card can show (outliers, rising, all-time hits, adjacent, saved) without a cached
// cover, fetched signed out, 2-4 s apart; the first refusal ends the step until the next run.
async function thumbStep(totals) {
  const p = await comp.payload();
  if (!p.available) return;
  const cached = thumbs.cachedIds();
  const seen = new Set();
  const todo = [];
  const want = (v) => { if (v && !seen.has(v.video_id) && !cached.has(v.video_id)) { seen.add(v.video_id); todo.push(v); } };
  for (const a of p.accounts) for (const k of ['outliers', 'rising', 'popular', 'adjacent']) a[k].forEach(want);
  p.saved.forEach(want);
  for (const [n, v] of todo.slice(0, THUMB_CAP).entries()) {
    if (n) await sleep(2000 + Math.floor(Math.random() * 2000));
    let status;
    try { status = await thumbs.fetchCover(v.video_id, v.url); } catch (err) { status = `refused ${err.message}`; }
    if (status === 'ok') { totals.thumbs += 1; continue; }
    if (status.startsWith('refused')) { console.warn(`[social] cover ${v.video_id}: ${status}; stopping covers this run`); break; }
  }
}

// -- 4. own follower count -----------------------------------------------------------------

async function ownFollowersStep() {
  const last = await get("SELECT updated_at FROM social_settings WHERE key = 'own_followers'");
  if (last && localISO(new Date(last.updated_at)) === localISO()) return;
  const rows = await social.rows();
  const newest = rows && rows.find((r) => r.url && r.last_refresh_status === 'ok');
  if (!newest) return;
  const res = await fetch(newest.url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
  if (!res.ok) return;
  const html = await res.text();
  const m = html.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return;
  const item = (((JSON.parse(m[1]).__DEFAULT_SCOPE__ || {})['webapp.video-detail'] || {}).itemInfo || {}).itemStruct || {};
  const followers = Number((item.authorStats || {}).followerCount);
  if (followers > 0) await comp.setSetting('own_followers', String(followers));
}

// -- the run -------------------------------------------------------------------------------

function add(totals, usage) {
  totals.input_tokens += usage.input_tokens || 0;
  totals.output_tokens += usage.output_tokens || 0;
}

async function runJob() {
  if (running || !hasKey()) return null;
  running = true;
  const totals = { scored: 0, labeled: 0, comment_videos: 0, tagged: 0, input_tokens: 0, output_tokens: 0, thumbs: 0 };
  const startedAt = now();
  const { lastID } = await run('INSERT INTO social_competitor_runs (started_at) VALUES (?)', [startedAt]);
  let error = null;
  try {
    await ownFollowersStep().catch((e) => console.warn('[social] own followers:', e.message));
    const data = await research.load();
    if (data) {
      const watch = new Set((await comp.listing()).watch);
      await scoreStep(data, watch, totals);
      await labelStep(data, watch, totals);
      await thumbStep(totals);
    }
  } catch (err) {
    error = err.message || String(err);
    console.error('[social] competitor job failed:', error);
  } finally {
    running = false;
  }
  await run(`UPDATE social_competitor_runs SET finished_at = ?, scored = ?, labeled = ?, comment_videos = ?, tagged = ?,
    input_tokens = ?, output_tokens = ?, thumbs = ?, error = ? WHERE id = ?`,
  [now(), totals.scored, totals.labeled, totals.comment_videos, totals.tagged, totals.input_tokens, totals.output_tokens, totals.thumbs, error, lastID]);
  if (totals.scored || totals.labeled || totals.thumbs || error) {
    console.log(`[social] competitor job: ${totals.scored} scored, ${totals.labeled} labeled, `
      + `${totals.thumbs} covers, ${totals.input_tokens} in / ${totals.output_tokens} out${error ? `, error ${error}` : ''}`);
  }
  return { ...totals, error };
}

// The sweep runs the job only when there is something to do: research.db changed since the
// last finished run, or a step still has work (a capped run left some), or a new day.
let lastSeenMtime = null;
async function sweep() {
  const st = research.stat();
  if (!st) return;
  const last = await get('SELECT finished_at, scored, labeled, comment_videos FROM social_competitor_runs WHERE finished_at IS NOT NULL ORDER BY id DESC LIMIT 1');
  const leftover = last && (last.scored >= SCORE_CAP || last.labeled >= LABEL_CAP);
  const newDay = !last || localISO(new Date(last.finished_at)) !== localISO();
  const settingsChanged = await get('SELECT 1 FROM social_settings WHERE updated_at > ? AND key = \'niche\'', [last ? last.finished_at : '']);
  if (lastSeenMtime === st.mtimeMs && !leftover && !newDay && !settingsChanged) return;
  lastSeenMtime = st.mtimeMs;
  await runJob();
}

function startCompetitorScheduler() {
  if (!hasKey()) { console.log('[social] ANTHROPIC_API_KEY not set; competitor job off'); return; }
  setTimeout(() => sweep().catch((e) => console.error('[social] competitor sweep:', e.message)), FIRST_SWEEP_MS);
  setInterval(() => sweep().catch((e) => console.error('[social] competitor sweep:', e.message)), SWEEP_MS);
}

module.exports = { runJob, sweep, startCompetitorScheduler, isRunning: () => running, MODEL, MOVES, FORMATS };
