// The Competitors card's analysis job, run on a schedule only (the API is public, so
// nothing here can be triggered from outside). Every step is capped per run and skips work
// already done, so a sweep with nothing new costs nothing.
//
// 1. niche relevance: Haiku scores each competitor video 0-3 against the niche text
//    (transcript, caption, on-screen text); rows keyed by the niche text's hash, so editing
//    the niche rescores everything in the background;
// 2. labels: Haiku names the hook move and the format of each video scored 1 or more;
// 3. comments: for on-niche outliers, the top comments are read signed out from TikTok's
//    public comment list (2 pages x 50, sorted by likes here, top 30 kept), re-read weekly
//    while the video is under 30 days old, then tagged question / request / objection /
//    joke / praise / other by Haiku;
// 4. once a day, the own follower count from the own newest video page (follower bands).
const Anthropic = require('@anthropic-ai/sdk');
const { run, get, all } = require('../db');
const { localISO } = require('../lib/dates');
const research = require('./research');
const comp = require('./competitors');
const social = require('./service');

const MODEL = 'claude-haiku-4-5';
const SCORE_BATCH = 20;
const SCORE_CAP = 200;          // videos scored per run
const LABEL_BATCH = 15;
const LABEL_CAP = 150;
const COMMENT_VIDEO_CAP = 20;   // videos whose comments are read per run
const COMMENT_PAGES = 2;
const COMMENT_PAGE_SIZE = 50;
const COMMENTS_KEPT = 30;
const COMMENT_REREAD_DAYS = 7;
const COMMENT_FRESH_DAYS = 30;
const SWEEP_MS = 15 * 60 * 1000;
const FIRST_SWEEP_MS = 2 * 60 * 1000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const MOVES = ['Verdict', 'Relatable', 'Objection-first', 'Confession', 'Reveal', 'Contrarian', 'Cold open', 'Countdown',
  'Callback', 'Question', 'Reply', 'Story', 'Challenge', 'Milestone', 'How-to'];
const FORMATS = ['talking head', 'reply-to-comment', 'text-on-screen', 'b-roll voiceover', 'tutorial', 'listicle', 'skit',
  'green screen', 'duet/stitch', 'slideshow', 'other'];
const TAGS = ['question', 'request', 'objection', 'joke', 'praise', 'other'];

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

// Videos the card can show: watched accounts' videos in the window or on Popular, and
// discovery candidates; only once their hook row exists (the Mac has processed them).
function candidates(data, watch) {
  const start = comp.isoDaysAgo(comp.WINDOW_DAYS);
  const status = new Map(data.accounts.map((a) => [a.handle, a.status]));
  return data.videos.filter((v) => {
    const h = String(v.handle || '').toLowerCase();
    const s = status.get(h);
    if (!data.hookById.has(v.video_id)) return false;
    if (s === 'watch' && watch.has(h)) return (v.date_posted && v.date_posted >= start) || v.in_popular;
    if (s === 'proposed') return Boolean(v.discovered_tag);
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

// -- 3. comments -------------------------------------------------------------------------

// One page of TikTok's public comment list. No cookies, no signature (verified 2026-10-05 from the
// Mac and RT100). has_more is unreliable, so the caller stops on an empty page.
async function commentPage(videoId, cursor) {
  const url = `https://www.tiktok.com/api/comment/list/?aid=1988&aweme_id=${videoId}&count=${COMMENT_PAGE_SIZE}&cursor=${cursor}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://www.tiktok.com/' } });
  if (!res.ok) return { status: `http ${res.status}`, comments: [] };
  const text = await res.text();
  if (!text) return { status: 'empty body', comments: [] };
  const body = JSON.parse(text);
  return { status: 'ok', comments: body.comments || [] };
}

// Bump TAG_VERSION when the tag prompt changes: the next run clears every stored tag and retags.
const TAG_VERSION = 'tags-v2';
const TAG_SYSTEM = (niche) => `You sort comments under a TikTok video for a creator who mines comments for their NEXT video ideas.
The creator's niche: ${niche}
You get the video's opening line and its comments. Tag each comment by what it could become, not by its grammar:
- question: a sincere question about the video's topic that the creator could answer in a whole video
  ("How do you stay consistent when nobody watches?"). Not jokes phrased as questions, not rhetorical questions,
  not questions about the song, the outfit, the location or the creator's personal life.
- request: asks the creator to make, explain or show something on the topic ("Do one about mornings").
- objection: sincere disagreement or pushback on the video's point that a reply video could address
  ("It's okay to be sad sometimes"). Not sarcasm or one-line quips.
- joke: wordplay, sarcasm, memes, quips, references ("Fun is getting expensive", "Are you a Lannister?").
- praise: thanks, agreement, compliments.
- other: anything else (song or product questions, remarks about looks, off-topic, spam).
When unsure between question/request/objection and joke/other, choose joke or other. Use the comment id given.`;

const TAG_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['tags'],
  properties: {
    tags: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['cid', 'tag'],
        properties: { cid: { type: 'string' }, tag: { type: 'string', enum: TAGS } },
      },
    },
  },
};

async function commentStep(totals) {
  const p = await comp.payload();
  if (!p.available) return;
  const freshCut = comp.isoDaysAgo(COMMENT_FRESH_DAYS);
  const rereadCut = new Date(Date.now() - COMMENT_REREAD_DAYS * 24 * 3600 * 1000).toISOString();
  const reads = new Map((await all('SELECT video_id, read_at FROM social_comment_reads')).map((r) => [r.video_id, r.read_at]));
  const targets = p.accounts.flatMap((a) => a.outliers).filter((o) => {
    const last = reads.get(o.video_id);
    if (!last) return true;
    return o.date_posted >= freshCut && last < rereadCut;
  }).slice(0, COMMENT_VIDEO_CAP);
  for (let n = 0; n < targets.length; n++) {
    const video = targets[n];
    if (n > 0) await sleep(4000 + Math.floor(Math.random() * 3000));
    const got = [];
    let status = 'ok';
    for (let page = 0; page < COMMENT_PAGES; page++) {
      if (page > 0) await sleep(4000 + Math.floor(Math.random() * 3000));
      let r;
      try { r = await commentPage(video.video_id, page * COMMENT_PAGE_SIZE); } catch (err) { r = { status: `error ${err.message}`, comments: [] }; }
      if (r.status !== 'ok') { status = r.status; break; }
      if (!r.comments.length) break;
      got.push(...r.comments);
    }
    if (status !== 'ok' && !got.length) {
      await run(`INSERT OR REPLACE INTO social_comment_reads (video_id, read_at, status, kept) VALUES (?, ?, ?, 0)`, [video.video_id, now(), status]);
      console.warn(`[social] comments ${video.video_id}: ${status}; stopping comment reads this run`);
      break;   // treat any refusal as a challenge: stop, try next sweep
    }
    const kept = [...new Map(got.filter((c) => c && c.cid && c.text).map((c) => [String(c.cid), c])).values()]
      .sort((x, y) => (y.digg_count || 0) - (x.digg_count || 0)).slice(0, COMMENTS_KEPT);
    const readAt = now();
    for (const c of kept) {
      await run(`INSERT INTO social_competitor_comments (video_id, cid, text, likes, replies, created_at, read_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(video_id, cid) DO UPDATE SET likes = excluded.likes, replies = excluded.replies, read_at = excluded.read_at`,
      [video.video_id, String(c.cid), clip(c.text, 500), c.digg_count || 0, c.reply_comment_total || 0, c.create_time || null, readAt]);
    }
    await run(`INSERT OR REPLACE INTO social_comment_reads (video_id, read_at, status, kept) VALUES (?, ?, ?, ?)`, [video.video_id, readAt, status, kept.length]);
    totals.comment_videos += 1;
    const untagged = await all('SELECT cid, text FROM social_competitor_comments WHERE video_id = ? AND tag IS NULL', [video.video_id]);
    if (untagged.length) {
      totals.tagged += await tagVideo(video.video_id, video.hook, untagged, totals);
    }
  }
}

async function tagVideo(videoId, hook, comments, totals) {
  const niche = await comp.niche();
  const { result, usage } = await callJson(TAG_SYSTEM(niche), { video_hook: hook, comments: comments.map((c) => ({ cid: c.cid, text: c.text })) }, TAG_SCHEMA, 3000);
  add(totals, usage);
  let n = 0;
  for (const t of result.tags || []) {
    await run('UPDATE social_competitor_comments SET tag = ? WHERE video_id = ? AND cid = ?', [t.tag, videoId, t.cid]);
    n += 1;
  }
  return n;
}

// A new TAG_VERSION clears every stored tag once; then up to RETAG_VIDEO_CAP videos with untagged
// comments are tagged per run (comments read earlier keep their text, only the tag is redone).
const RETAG_VIDEO_CAP = 40;
async function retagStep(data, totals) {
  const stored = await get("SELECT value FROM social_settings WHERE key = 'comment_tag_version'");
  if (!stored || stored.value !== TAG_VERSION) {
    await run('UPDATE social_competitor_comments SET tag = NULL');
    await comp.setSetting('comment_tag_version', TAG_VERSION);
  }
  const videos = await all('SELECT DISTINCT video_id FROM social_competitor_comments WHERE tag IS NULL LIMIT ?', [RETAG_VIDEO_CAP]);
  for (const { video_id: videoId } of videos) {
    const comments = await all('SELECT cid, text FROM social_competitor_comments WHERE video_id = ? AND tag IS NULL', [videoId]);
    totals.tagged += await tagVideo(videoId, research.hookLine(data.hookById.get(videoId)), comments, totals);
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
  const totals = { scored: 0, labeled: 0, comment_videos: 0, tagged: 0, input_tokens: 0, output_tokens: 0 };
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
      await commentStep(totals);
      await retagStep(data, totals);
    }
  } catch (err) {
    error = err.message || String(err);
    console.error('[social] competitor job failed:', error);
  } finally {
    running = false;
  }
  await run(`UPDATE social_competitor_runs SET finished_at = ?, scored = ?, labeled = ?, comment_videos = ?, tagged = ?,
    input_tokens = ?, output_tokens = ?, error = ? WHERE id = ?`,
  [now(), totals.scored, totals.labeled, totals.comment_videos, totals.tagged, totals.input_tokens, totals.output_tokens, error, lastID]);
  if (totals.scored || totals.labeled || totals.comment_videos || error) {
    console.log(`[social] competitor job: ${totals.scored} scored, ${totals.labeled} labeled, ${totals.comment_videos} comment reads, `
      + `${totals.tagged} tagged, ${totals.input_tokens} in / ${totals.output_tokens} out${error ? `, error ${error}` : ''}`);
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
  const leftover = last && (last.scored >= SCORE_CAP || last.labeled >= LABEL_CAP || last.comment_videos >= COMMENT_VIDEO_CAP);
  const newDay = !last || localISO(new Date(last.finished_at)) !== localISO();
  const settingsChanged = await get('SELECT 1 FROM social_settings WHERE updated_at > ? AND key = \'niche\'', [last ? last.finished_at : '']);
  const tagVersion = await get("SELECT value FROM social_settings WHERE key = 'comment_tag_version'");
  const untagged = await get('SELECT 1 FROM social_competitor_comments WHERE tag IS NULL LIMIT 1');
  const retag = (!tagVersion || tagVersion.value !== TAG_VERSION) || Boolean(untagged);
  if (lastSeenMtime === st.mtimeMs && !leftover && !newDay && !settingsChanged && !retag) return;
  lastSeenMtime = st.mtimeMs;
  await runJob();
}

function startCompetitorScheduler() {
  if (!hasKey()) { console.log('[social] ANTHROPIC_API_KEY not set; competitor job off'); return; }
  setTimeout(() => sweep().catch((e) => console.error('[social] competitor sweep:', e.message)), FIRST_SWEEP_MS);
  setInterval(() => sweep().catch((e) => console.error('[social] competitor sweep:', e.message)), SWEEP_MS);
}

module.exports = { runJob, sweep, startCompetitorScheduler, isRunning: () => running, MODEL, MOVES, FORMATS };
