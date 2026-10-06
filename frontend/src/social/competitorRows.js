// Pure helpers for the Competitors leaderboard: which videos become rows, and how they sort.

// A video can be on several of an account's lists; the row keeps the first type in this order.
export const TYPE_ORDER = ['outlier', 'rising', 'popular', 'adjacent'];
export const TYPE_LABEL = { outlier: 'outlier', rising: 'rising', popular: 'all-time hit', adjacent: 'adjacent' };
const LIST_FOR = { outlier: 'outliers', rising: 'rising', popular: 'popular', adjacent: 'adjacent' };

// accounts: the payload's accounts; scope: 'all' or a handle. Adjacent videos (niche score 1) are
// always included, tagged in the Type column.
export function leaderboardRows(accounts, scope) {
  const types = TYPE_ORDER;
  const rows = new Map();
  for (const a of accounts || []) {
    if (scope !== 'all' && a.handle !== scope) continue;
    for (const type of types) {
      for (const v of a[LIST_FOR[type]] || []) {
        if (!rows.has(v.video_id)) rows.set(v.video_id, { ...v, type });
      }
    }
  }
  return [...rows.values()];
}

// The value a column sorts by. Rising rows have no multiple yet (under the 7-day age gate): their
// early multiple stands in so they sort among the rest.
export const SORT_VALUE = {
  account: (v) => v.handle || '',
  posted: (v) => v.date_posted || '',
  move: (v) => v.move || '',
  format: (v) => v.format || '',
  sound: (v) => (v.sound ? (v.sound.original ? 'original' : v.sound.title || '') : ''),
  multiple: (v) => v.multiple ?? v.early_multiple ?? -1,
  saves: (v) => v.saves_per_k ?? -1,
  shares: (v) => v.shares_per_k ?? -1,
  views: (v) => v.views ?? -1,
  type: (v) => TYPE_ORDER.indexOf(v.type),
};
export const TEXT_COLUMNS = ['account', 'posted', 'move', 'format', 'sound', 'type'];

export function sortRows(rows, key, dir) {
  const val = SORT_VALUE[key] || SORT_VALUE.multiple;
  return [...rows].sort((a, b) => {
    const x = val(a);
    const y = val(b);
    if (x === y) return (b.views || 0) - (a.views || 0);
    return (x > y ? 1 : -1) * dir;
  });
}
