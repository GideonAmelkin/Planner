import { shiftISO, isoToDate } from '../shared/dayInfo';

// The numbers behind the TikTok Data chart, drawn the way TikTok Studio's "Key metrics" card is:
// a tab per metric with its total for the range, then a line over every day of the range through
// today. Our data is per post (lifetime counts), so a day's value is the posts made that day
// summed, and a day without a post is 0. Max covers the whole history, in weeks.
export const METRICS = [
  { key: 'views', label: 'Video views' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'saves', label: 'Saves' },
  { key: 'shares', label: 'Shares' },
  { key: 'posts', label: 'Posts' },
];
export const RANGES = [7, 28, 60, 365, 'max'];

const COUNTS = ['views', 'likes', 'comments', 'saves', 'shares'];

// The first day of a range ending today (today counts as one of its days); Max starts at the
// first post, or today when there are none.
export function rangeStart(today, range, videos = []) {
  if (range !== 'max') return shiftISO(today, -(range - 1));
  const first = (videos || []).reduce((min, v) => (v.date_posted && v.date_posted < min ? v.date_posted : min), today);
  return first;
}

// Posts made inside [start, today], oldest first, with their counts as numbers.
export function windowPosts(videos, start, today) {
  return (videos || [])
    .filter((v) => v.date_posted && v.date_posted >= start && v.date_posted <= today)
    .map((v) => {
      const out = { ...v };
      COUNTS.forEach((k) => { out[k] = Number(v[k]) || 0; });
      return out;
    })
    .sort((a, b) => (a.date_posted === b.date_posted ? String(a.video_id).localeCompare(String(b.video_id)) : a.date_posted < b.date_posted ? -1 : 1));
}

const valueOf = (posts, key) => (key === 'posts' ? posts.length : posts.reduce((s, p) => s + p[key], 0));

// One total per metric key, for the tab strip.
export function totals(posts) {
  return Object.fromEntries(METRICS.map((m) => [m.key, valueOf(posts, m.key)]));
}

// The Sunday that starts the week holding `iso`.
export const weekStart = (iso) => shiftISO(iso, -isoToDate(iso).getDay());

// One point per day from start through today, or per Sunday-start week when bucket is 'week':
// { date, value, posts }. `posts` is that bucket's posts, most viewed first; empty means 0.
export function seriesPoints(posts, key, start, today, bucket = 'day') {
  const keyOf = bucket === 'week' ? weekStart : (iso) => iso;
  const step = bucket === 'week' ? 7 : 1;
  const byKey = new Map();
  posts.forEach((p) => {
    const k = keyOf(p.date_posted);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(p);
  });
  const out = [];
  for (let d = keyOf(start); d <= today; d = shiftISO(d, step)) {
    const ps = byKey.get(d) || [];
    out.push({ date: d, value: valueOf(ps, key), posts: [...ps].sort((a, b) => b.views - a.views) });
  }
  return out;
}

export function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// About four round y ticks from 0 to at least the max.
export function niceTicks(max) {
  if (!max || max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw);
  const ticks = [0];
  while (ticks[ticks.length - 1] < max) ticks.push(+(ticks[ticks.length - 1] + step).toFixed(6));
  return ticks;
}
