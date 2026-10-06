import { leaderboardRows, sortRows } from './competitorRows';

const v = (id, extra = {}) => ({ video_id: id, handle: 'a', views: 100, ...extra });
const accounts = [
  { handle: 'a', outliers: [v('1', { multiple: 5 })], rising: [v('2', { early_multiple: 9 }), v('1')], popular: [v('2'), v('3', { views: 5000 })], adjacent: [v('4', { multiple: 3 })] },
  { handle: 'b', outliers: [v('5', { handle: 'b', multiple: 12 })], rising: [], popular: [], adjacent: [] },
];

test('one row per video, type by priority, adjacent always included', () => {
  const rows = leaderboardRows(accounts, 'all');
  expect(rows.map((r) => [r.video_id, r.type])).toEqual([['1', 'outlier'], ['2', 'rising'], ['3', 'popular'], ['4', 'adjacent'], ['5', 'outlier']]);
  expect(leaderboardRows(accounts, 'b').map((r) => r.video_id)).toEqual(['5']);
});

test('multiple sort uses the early multiple for rising rows', () => {
  const rows = sortRows(leaderboardRows(accounts, 'all'), 'multiple', -1);
  expect(rows.map((r) => r.video_id)).toEqual(['5', '2', '1', '4', '3']);
  expect(sortRows(rows, 'views', -1)[0].video_id).toBe('3');
});
