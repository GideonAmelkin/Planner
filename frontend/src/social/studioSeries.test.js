import { windowPosts, totals, seriesPoints, niceTicks, rangeStart, median, weekStart } from './studioSeries';

const v = (id, date, extra = {}) => ({ video_id: id, date_posted: date, views: '100', likes: 10, comments: 1, saves: 2, shares: 3, ...extra });
const videos = [
  v('old', '2021-01-13', { views: 40 }),
  v('a', '2026-10-03'),            // day before a 7-day range ending Oct 10
  v('b', '2026-10-04'),            // first day of that range
  v('c', '2026-10-09', { views: 50 }),
  v('d', '2026-10-09', { views: 300, likes: null }),
  v('e', null),
];
const TODAY = '2026-10-10';

test('a range counts today as one of its days; Max starts at the first post', () => {
  expect(rangeStart(TODAY, 7)).toBe('2026-10-04');
  expect(rangeStart(TODAY, 'max', videos)).toBe('2021-01-13');
  expect(rangeStart(TODAY, 'max', [])).toBe(TODAY);
  expect(windowPosts(videos, rangeStart(TODAY, 7), TODAY).map((p) => p.video_id)).toEqual(['b', 'c', 'd']);
});

test('totals per metric, Posts is a count, blanks are zero', () => {
  const t = totals(windowPosts(videos, '2026-10-04', TODAY));
  expect(t).toEqual({ views: 450, likes: 20, comments: 3, saves: 6, shares: 9, posts: 3 });
});

test('every day from the start through today, zero when nothing was posted', () => {
  const pts = seriesPoints(windowPosts(videos, '2026-10-04', TODAY), 'views', '2026-10-04', TODAY);
  expect(pts.map((p) => p.date)).toEqual(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10']);
  expect(pts.map((p) => p.value)).toEqual([100, 0, 0, 0, 0, 350, 0]);
  expect(pts[5].posts.map((p) => p.video_id)).toEqual(['d', 'c']);
});

test('Max is weekly from the first post\'s week, and the weeks add up to the totals', () => {
  const start = rangeStart(TODAY, 'max', videos);
  const posts = windowPosts(videos, start, TODAY);
  const pts = seriesPoints(posts, 'views', start, TODAY, 'week');
  expect(weekStart('2026-10-10')).toBe('2026-10-04');
  expect(pts[0].date).toBe('2021-01-10');
  expect(pts[pts.length - 1].date).toBe('2026-10-04');
  expect(pts.every((p, i) => !i || (Date.parse(p.date) - Date.parse(pts[i - 1].date)) === 7 * 864e5)).toBe(true);
  expect(pts.reduce((s, p) => s + p.value, 0)).toBe(totals(posts).views);
});

test('the median is over post days only', () => {
  const pts = seriesPoints(windowPosts(videos, '2026-10-04', TODAY), 'views', '2026-10-04', TODAY);
  expect(median(pts.filter((p) => p.posts.length).map((p) => p.value))).toBe(225);
});

test('ticks start at zero and cover the max', () => {
  expect(niceTicks(0)).toEqual([0, 1]);
  expect(niceTicks(719)).toEqual([0, 200, 400, 600, 800]);
  expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
});
