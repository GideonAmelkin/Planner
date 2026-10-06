import { leaderboardRows, sortRows } from './competitorRows';

const v = (id, extra = {}) => ({ video_id: id, handle: 'a', views: 100, ...extra });
const accounts = [
  { handle: 'a', outliers: [v('1', { multiple: 5 })], rising: [v('2', { early_multiple: 9 }), v('1')], popular: [v('2'), v('3', { views: 5000 })], adjacent: [v('4', { multiple: 3 })] },
  { handle: 'b', outliers: [v('5', { handle: 'b', multiple: 12 })], rising: [], popular: [], adjacent: [] },
];

test('one row per video, type by priority, adjacent only when asked', () => {
  const rows = leaderboardRows(accounts, 'all', false);
  expect(rows.map((r) => [r.video_id, r.type])).toEqual([['1', 'outlier'], ['2', 'rising'], ['3', 'popular'], ['5', 'outlier']]);
  expect(leaderboardRows(accounts, 'all', true).map((r) => r.video_id)).toContain('4');
  expect(leaderboardRows(accounts, 'b', false).map((r) => r.video_id)).toEqual(['5']);
});

test('multiple sort uses the early multiple for rising rows', () => {
  const rows = sortRows(leaderboardRows(accounts, 'all', false), 'multiple', -1);
  expect(rows.map((r) => r.video_id)).toEqual(['5', '2', '1', '3']);
  expect(sortRows(rows, 'views', -1)[0].video_id).toBe('3');
});
