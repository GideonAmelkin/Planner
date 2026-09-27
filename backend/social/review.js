// The "Next Video Hooks & Ideas" review: Claude reads the creator's recent videos
// (metrics, the tracker's baseline multiple, transcript, caption) and explains what
// made the winners work, then proposes the next hooks. The numbers the model sees
// are computed here and stored next to its text, so the page shows the same figures.
//
// The Planner API has no auth and nginx exposes /api/ publicly, so every run is
// throttled from the social_reviews table: one per 30 minutes, twelve per local day.
// A scheduler generates one review a day at 07:15 (after the tracker's 06:15 cron and
// the 06:45 hook job) when the tracker db has new videos since the last review.
const Anthropic = require('@anthropic-ai/sdk');
const { run, get, all } = require('../db');
const { localISO } = require('../lib/dates');
const social = require('./service');

const MODEL = 'claude-opus-5';
const MAX_TOKENS = 2500;
const PROMPT_VERSION = 'v4';   // stored as a suffix on `trigger`, so rows from older prompts are recognisable
const MIN_GAP_MS = 30 * 60 * 1000;
const DAILY_CAP = 12;
const TOP_N = 5;
const SCHEDULE_HOUR = 7;
const SCHEDULE_MINUTE = 15;
const SWEEP_MS = 15 * 60 * 1000;

let running = false;
let lastError = null;

const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY);

// Suggested hook moves. The model names each hook's move in one or two words and may coin its own.
const HOOK_TYPES = ['Verdict', 'Mirror', 'Objection-first', 'Confession', 'Reveal', 'Contrarian', 'Cold open', 'Countdown', 'Callback', 'Question'];

const SYSTEM = `You write TikTok hooks for one creator, in their own voice, from their own data.
You receive the creator's recent videos: post date, caption, the first spoken line (hook), the full transcript,
views, likes, comments, saves, shares, engagement per 1,000 views, rank by views, and the tracker's "multiple" (views
divided by a rolling baseline of the creator's own previous posts; 1.0 is a normal post, 2.0 is twice normal).
You also receive "series": where the creator is today in their current run of daily posts (day number, posts so far,
days left if it is a 30-day challenge), and the account's all-time best posts for what this audience has responded to.

Hook moves, one or two words each: ${HOOK_TYPES.join(', ')}. Coin your own when none fits.

Do four things:
1. window_summary: one sentence, at most 25 words, on how the period went.
2. hook_types: name the move of the opening line of EVERY video in the window. Notice which moves the top-ranked
   and highest-multiple videos share; write toward those.
3. hooks: 8 hooks to consider for the next videos, weighted toward the moves that are working. Each is the first
   three seconds as the creator would say them on camera:
   - one or two short sentences, at most 12 words in total; at least four of the eight under 9 words;
   - open a loop and do not close it: the line promises, it never explains;
   - anchored in today's position in the series where it helps (the day number, the days left, what has changed);
   - never these constructions: "here is what", "here's what", "here is why", "actually", "the truth is",
     "let me tell you", "what nobody tells you"; never start with a count of days unless it is today's day number;
   - no two hooks share an opening word or the same template; do not repeat the creator's existing opening lines.
   Shape examples (shape only, do not copy): "It's working. Just not the way I thought it would." /
   "I almost skipped today. That's exactly why I didn't." / "You're probably like me. You thought this stuff was soft."
4. pick: the one hook to post next (its index in hooks, starting at 0) and a caption of at most 6 words.

Rules: no explanations, no preamble, plain sentences, no markdown. Never use em dashes or en dashes; use commas or
periods. Ids only in id fields.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['window_summary', 'hook_types', 'hooks', 'pick'],
  properties: {
    window_summary: { type: 'string', description: 'One sentence, at most 25 words, on the period as a whole.' },
    hook_types: {
      type: 'array',
      description: 'One entry per video in the window: the move its opening line makes, one or two words.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['video_id', 'type'],
        properties: {
          video_id: { type: 'string' },
          type: { type: 'string', description: 'One or two words naming the move.' },
        },
      },
    },
    hooks: {
      type: 'array',
      description: '8 hooks to consider, weighted toward the moves that are working.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['hook', 'type'],
        properties: {
          hook: { type: 'string', description: 'The first three seconds, spoken: one or two short sentences, at most 12 words.' },
          type: { type: 'string', description: 'One or two words naming the move.' },
        },
      },
    },
    pick: {
      type: 'object',
      additionalProperties: false,
      required: ['index', 'caption'],
      properties: {
        index: { type: 'integer', description: 'Index into hooks (0-based) of the one to post next.' },
        caption: { type: 'string', description: 'At most 6 words.' },
      },
    },
  },
};

// House rule: no em dashes anywhere, including AI text.
const clean = (s) => String(s).replace(/\s*\u2014\s*/g, ', ').replace(/\u2013/g, '-');
function sanitize(v) {
  if (typeof v === 'string') return clean(v);
  if (Array.isArray(v)) return v.map(sanitize);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sanitize(x)]));
  return v;
}

const perK = (n, views) => (views ? Math.round((Number(n) || 0) / views * 10000) / 10 : null);
const median = (nums) => {
  const s = nums.filter((x) => x !== null && x !== undefined).sort((a, b) => a - b);
  if (!s.length) return null;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const dayDiff = (a, b) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / DAY_MS);

// Where the creator is today in the current run of posts: the run is everything since
// the last gap of more than RUN_GAP_DAYS between posts (the creator posts most days, not
// every day). days_left is set when the run reads like a 30-day challenge.
const RUN_GAP_DAYS = 7;
function seriesContext(window) {
  const days = [...new Set(window.videos.map((v) => v.date_posted).filter(Boolean))].sort();
  if (!days.length) return null;
  let start = days[0];
  for (let i = 1; i < days.length; i++) {
    if (dayDiff(days[i - 1], days[i]) > RUN_GAP_DAYS) start = days[i];
  }
  const today = localISO();
  const dayNumber = dayDiff(start, today) + 1;
  const text = window.videos.map((v) => `${v.caption || ''} ${v.script || ''}`).join(' ').toLowerCase();
  const challenge = /\b30 days\b|thirty days|\/30\b/.test(text);
  const previous = window.previous_post || null;
  return {
    today,
    run_started: start,
    day_number_today: dayNumber,
    posts_in_run: window.videos.filter((v) => v.date_posted && v.date_posted >= start).length,
    newest_post: days[days.length - 1],
    days_since_last_post: dayDiff(days[days.length - 1], today),
    gap_before_run_days: previous && start === days[0] ? dayDiff(previous, start) : null,
    days_left: challenge ? Math.max(0, 30 - dayNumber) : null,
  };
}

// Deterministic figures: rank by views, engagement per 1k views, window medians.
function computeStats(window) {
  const videos = window.videos.map((v) => {
    const views = Number(v.views) || 0;
    return {
      video_id: v.video_id,
      date_posted: v.date_posted,
      url: v.url,
      caption: v.caption || '',
      hook: v.hook_summary || '',
      views,
      likes: Number(v.likes) || 0,
      comments: Number(v.comments) || 0,
      saves: Number(v.saves) || 0,
      shares: Number(v.shares) || 0,
      likes_per_k: perK(v.likes, views),
      comments_per_k: perK(v.comments, views),
      saves_per_k: perK(v.saves, views),
      shares_per_k: perK(v.shares, views),
      multiple: v.multiple === null || v.multiple === undefined ? null : Number(v.multiple),
      script_chars: (v.script || '').length,
    };
  });
  const ranked = [...videos].sort((a, b) => b.views - a.views || (b.multiple || 0) - (a.multiple || 0));
  ranked.forEach((v, i) => { v.rank = i + 1; });
  return {
    series: seriesContext(window),
    basis: window.basis,
    start: window.start,
    end: window.end,
    count: videos.length,
    medians: {
      views: median(videos.map((v) => v.views)),
      likes: median(videos.map((v) => v.likes)),
      likes_per_k: median(videos.map((v) => v.likes_per_k)),
      saves_per_k: median(videos.map((v) => v.saves_per_k)),
      shares_per_k: median(videos.map((v) => v.shares_per_k)),
      comments_per_k: median(videos.map((v) => v.comments_per_k)),
    },
    top: ranked.slice(0, TOP_N).map((v) => v.video_id),
    videos: ranked,
  };
}

function buildInput(window, stats, best) {
  const byId = new Map(window.videos.map((v) => [v.video_id, v]));
  return {
    period: { basis: stats.basis, start: stats.start, end: stats.end, videos: stats.count, medians: stats.medians },
    series: stats.series,
    top_performers: stats.top,
    videos: stats.videos.map((v) => ({
      video_id: v.video_id,
      rank_by_views: v.rank,
      date_posted: v.date_posted,
      views: v.views, likes: v.likes, comments: v.comments, saves: v.saves, shares: v.shares,
      likes_per_1k_views: v.likes_per_k, comments_per_1k_views: v.comments_per_k,
      saves_per_1k_views: v.saves_per_k, shares_per_1k_views: v.shares_per_k,
      multiple_vs_own_baseline: v.multiple,
      caption: v.caption,
      opening_line: v.hook,
      transcript: (byId.get(v.video_id) || {}).script || '',
    })),
    all_time_best_by_multiple: best.map((b) => ({
      video_id: b.video_id, date_posted: b.date_posted, views: b.views, likes: b.likes, comments: b.comments,
      saves: b.saves, shares: b.shares, multiple: b.multiple, opening_line: b.hook_summary || '', caption: b.caption || '',
    })),
  };
}

async function callModel(input) {
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  });
  if (response.stop_reason !== 'end_turn') {
    throw new Error(`model stopped early (${response.stop_reason})`);
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return {
    result: sanitize(JSON.parse(text)),
    usage: response.usage || {},
    model: response.model || MODEL,
  };
}

// A readable reason for the stored error column; the SDK's typed errors first.
function describeError(err) {
  if (err instanceof Anthropic.RateLimitError) return 'Claude API rate limit; try again later';
  if (err instanceof Anthropic.AuthenticationError) return 'Claude API key rejected';
  if (err instanceof Anthropic.APIConnectionError) return `Could not reach the Claude API: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status}: ${err.message}`;
  return err.message || String(err);
}

const latestRow = (onlyOk) => get(
  `SELECT * FROM social_reviews ${onlyOk ? 'WHERE error IS NULL' : ''} ORDER BY generated_at DESC, id DESC LIMIT 1`
);

// null when a run may start now, otherwise { reason, next_allowed_at }.
async function throttle() {
  const last = await latestRow(false);
  if (last) {
    const at = Date.parse(last.generated_at);
    if (Date.now() - at < MIN_GAP_MS) {
      return { reason: 'one review per 30 minutes', next_allowed_at: new Date(at + MIN_GAP_MS).toISOString() };
    }
  }
  const today = localISO();
  const rowsToday = await all('SELECT generated_at FROM social_reviews ORDER BY generated_at DESC');
  const n = rowsToday.filter((r) => localISO(new Date(r.generated_at)) === today).length;
  if (n >= DAILY_CAP) {
    const midnight = new Date(); midnight.setHours(24, 0, 0, 0);
    return { reason: `${DAILY_CAP} reviews per day`, next_allowed_at: midnight.toISOString() };
  }
  return null;
}

// The actual run. Writes a row whether it succeeds or fails.
async function generate(trigger) {
  running = true;
  lastError = null;
  const startedAt = Date.now();
  const generatedAt = new Date(startedAt).toISOString();
  let window = null;
  try {
    window = await social.recentWindow();
    if (!window || !window.videos.length) throw new Error('no videos in the tracker database');
    const stats = computeStats(window);
    const best = await social.allTimeBest(10);
    const { result, usage, model } = await callModel(buildInput(window, stats, best));
    await run(
      `INSERT INTO social_reviews (generated_at, trigger, window_start, window_end, video_count, newest_video_id, model,
        input_tokens, output_tokens, duration_ms, stats_json, result_json, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [generatedAt, `${trigger}/${PROMPT_VERSION}`, stats.start, stats.end, stats.count, window.videos[0] && window.videos[0].video_id, model,
        usage.input_tokens || null, usage.output_tokens || null, Date.now() - startedAt,
        JSON.stringify(stats), JSON.stringify(result)]
    );
    console.log(`[social] review generated (${trigger}): ${stats.count} videos, ${usage.input_tokens || '?'} in / ${usage.output_tokens || '?'} out, ${Math.round((Date.now() - startedAt) / 1000)} s`);
  } catch (err) {
    lastError = describeError(err);
    console.error(`[social] review failed (${trigger}):`, lastError);
    await run(
      `INSERT INTO social_reviews (generated_at, trigger, window_start, window_end, video_count, newest_video_id, model,
        duration_ms, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [generatedAt, `${trigger}/${PROMPT_VERSION}`, window && window.start, window && window.end, window ? window.videos.length : null,
        window && window.videos[0] ? window.videos[0].video_id : null, MODEL, Date.now() - startedAt, lastError]
    ).catch((e) => console.error('[social] could not record the failed review:', e.message));
  } finally {
    running = false;
  }
}

// Start a run in the background. Returns { status, body } for the route.
async function requestGenerate(trigger = 'manual') {
  if (!hasKey()) return { status: 503, body: { error: 'ANTHROPIC_API_KEY is not set on the server' } };
  if (running) return { status: 409, body: { running: true, error: 'a review is already being generated' } };
  const t = await throttle();
  if (t) {
    return {
      status: 429,
      body: { error: `Throttled: ${t.reason}`, next_allowed_at: t.next_allowed_at,
        retry_after_seconds: Math.max(1, Math.ceil((Date.parse(t.next_allowed_at) - Date.now()) / 1000)) },
    };
  }
  generate(trigger);   // not awaited: the page polls GET /social/review
  return { status: 202, body: { running: true } };
}

// Videos posted after the review's window or added to it since (the "stale" line).
function newVideosSince(review, stats, rowsNow) {
  if (!rowsNow) return 0;
  const inWindow = new Set((stats.videos || []).map((v) => v.video_id));
  return rowsNow.filter((r) => r.date_posted && (
    r.date_posted > review.window_end || (r.date_posted >= review.window_start && !inWindow.has(r.video_id))
  )).length;
}

// What GET /social/review returns.
async function current() {
  const row = await latestRow(true);
  const latestAny = await latestRow(false);
  const t = await throttle();
  const base = {
    running,
    has_key: hasKey(),
    last_error: latestAny && latestAny.error ? { at: latestAny.generated_at, message: latestAny.error } : (lastError ? { message: lastError } : null),
    throttle: t ? { reason: t.reason, next_allowed_at: t.next_allowed_at } : null,
  };
  if (!row) return { available: false, ...base };
  const stats = JSON.parse(row.stats_json);
  const rowsNow = await social.rows();
  return {
    available: true,
    ...base,
    id: row.id,
    generated_at: row.generated_at,
    trigger: row.trigger,
    model: row.model,
    window: { basis: stats.basis, start: row.window_start, end: row.window_end, count: row.video_count },
    usage: { input_tokens: row.input_tokens, output_tokens: row.output_tokens, duration_ms: row.duration_ms },
    stats,
    review: JSON.parse(row.result_json),
    stale: { new_videos: newVideosSince(row, stats, rowsNow) },
  };
}

// Daily refresh: once past 07:15, if nothing was generated today and the tracker has
// videos the last review did not see, run one. Cheap to call often; it is throttled.
async function maybeAutoGenerate() {
  if (!hasKey() || running) return;
  const now = new Date();
  if (now.getHours() < SCHEDULE_HOUR || (now.getHours() === SCHEDULE_HOUR && now.getMinutes() < SCHEDULE_MINUTE)) return;
  const latestAny = await latestRow(false);
  if (latestAny && localISO(new Date(latestAny.generated_at)) === localISO(now)) return;
  const last = await latestRow(true);
  const st = await social.status();
  if (!st.available) return;
  if (last) {
    const stats = JSON.parse(last.stats_json);
    const rowsNow = await social.rows();
    const changed = st.newest_video_id !== last.newest_video_id || newVideosSince(last, stats, rowsNow) > 0;
    if (!changed) return;
  }
  const t = await throttle();
  if (t) return;
  await generate('schedule');
}

function msUntilNextRun() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), SCHEDULE_HOUR, SCHEDULE_MINUTE, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

function scheduleDaily() {
  setTimeout(async () => {
    await maybeAutoGenerate().catch((e) => console.error('[social] scheduled review:', e.message));
    scheduleDaily();
  }, msUntilNextRun());
}

// Arm the daily job: a 07:15 fire that re-arms, a 15-minute sweep that catches a
// missed fire (restart, sleep), and one sweep a minute after start-up.
function startReviewScheduler() {
  if (!hasKey()) { console.log('[social] ANTHROPIC_API_KEY not set; review scheduler off'); return; }
  setTimeout(() => maybeAutoGenerate().catch((e) => console.error('[social] start-up review sweep:', e.message)), 60 * 1000);
  setInterval(() => maybeAutoGenerate().catch((e) => console.error('[social] review sweep:', e.message)), SWEEP_MS);
  scheduleDaily();
}

module.exports = {
  MODEL, HOOK_TYPES, hasKey, computeStats, sanitize, requestGenerate, current, startReviewScheduler, isRunning: () => running,
};
