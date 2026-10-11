import { shiftISO } from '../shared/dayInfo';

// The numbers behind the TikTok Data chart, drawn the way TikTok Studio's "Key metrics" card is:
// a tab per metric with its total for the range, then a line over the days in the range. Our data
// is per post (lifetime counts), so each point is a day you posted, with that day's posts summed.
export const METRICS = [
  { key: 'views', label: 'Video views' },
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'saves', label: 'Saves' },
  { key: 'shares', label: 'Shares' },
  { key: 'posts', label: 'Posts' },
];
export const RANGES = [7, 28, 60, 365];

const COUNTS = ['views', 'likes', 'comments', 'saves', 'shares'];

// The first day inside a range of `days` days ending today (today counts as one of them).
export const rangeStart = (today, days) => shiftISO(today, -(days - 1));

// Posts made inside the range, oldest first, with their counts as numbers.
export function windowPosts(videos, today, days) {
  const start = rangeStart(today, days);
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

// One point per post day: { date, value, posts }. `posts` is that day's posts, most viewed first.
export function dayPoints(posts, key) {
  const byDay = new Map();
  posts.forEach((p) => {
    if (!byDay.has(p.date_posted)) byDay.set(p.date_posted, []);
    byDay.get(p.date_posted).push(p);
  });
  return [...byDay.entries()].map(([date, ps]) => ({
    date,
    value: valueOf(ps, key),
    posts: [...ps].sort((a, b) => b.views - a.views),
  }));
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
