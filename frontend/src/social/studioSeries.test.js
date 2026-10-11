import { windowPosts, totals, dayPoints, niceTicks, rangeStart } from './studioSeries';

const v = (id, date, extra = {}) => ({ video_id: id, date_posted: date, views: '100', likes: 10, comments: 1, saves: 2, shares: 3, ...extra });
const videos = [
  v('a', '2026-10-03'),            // day before a 7-day range ending Oct 10
  v('b', '2026-10-04'),            // first day of that range
  v('c', '2026-10-09', { views: 50 }),
  v('d', '2026-10-09', { views: 300, likes: null }),
  v('e', null),
];

test('the range counts today as one of its days', () => {
  expect(rangeStart('2026-10-10', 7)).toBe('2026-10-04');
  expect(windowPosts(videos, '2026-10-10', 7).map((p) => p.video_id)).toEqual(['b', 'c', 'd']);
});

test('totals per metric, Posts is a count, blanks are zero', () => {
  const t = totals(windowPosts(videos, '2026-10-10', 7));
  expect(t).toEqual({ views: 450, likes: 20, comments: 3, saves: 6, shares: 9, posts: 3 });
});

test('same-day posts are summed into one point, most viewed first', () => {
  const pts = dayPoints(windowPosts(videos, '2026-10-10', 7), 'views');
  expect(pts.map((p) => [p.date, p.value])).toEqual([['2026-10-04', 100], ['2026-10-09', 350]]);
  expect(pts[1].posts.map((p) => p.video_id)).toEqual(['d', 'c']);
  expect(dayPoints(windowPosts(videos, '2026-10-10', 7), 'posts')[1].value).toBe(2);
});

test('ticks start at zero and cover the max', () => {
  expect(niceTicks(0)).toEqual([0, 1]);
  expect(niceTicks(719)).toEqual([0, 200, 400, 600, 800]);
  expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
});
