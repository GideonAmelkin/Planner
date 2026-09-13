const { all, get, run } = require('./db');
const { nextDayISO } = require('./lib/dates');

const keyOf = (text, parentId) => `${text}|${parentId ?? 'null'}`;

// Duplicate every still-open task on sourceDate to sourceDate+1 — but only
// when an exact match (same text + same effective parent_id) doesn't already
// exist on the target day. The source row stays untouched and visible.
// Completed and previously-forwarded tasks are excluded from the candidate set.
async function pushTasksForward(sourceDate) {
  const targetDate = nextDayISO(sourceDate);

  const candidates = await all(
    `SELECT id, parent_id, priority, priority_num, text, order_index
       FROM tasks
      WHERE date = ?
        AND status != 'completed'
        AND status != 'forwarded'
      ORDER BY (parent_id IS NULL) DESC, order_index ASC, id ASC`,
    [sourceDate]
  );
  if (candidates.length === 0) return 0;

  const existing = await all(
    `SELECT id, parent_id, text FROM tasks
      WHERE date = ? AND status != 'forwarded'`,
    [targetDate]
  );
  const lookup = new Map();
  for (const e of existing) lookup.set(keyOf(e.text, e.parent_id), e.id);

  const idMap = new Map();
  let inserted = 0;
  for (const t of candidates) {
    const newParent = t.parent_id != null ? (idMap.get(t.parent_id) ?? null) : null;
    const key = keyOf(t.text, newParent);
    if (lookup.has(key)) {
      // Already on target — record mapping for this source's children, skip insert.
      idMap.set(t.id, lookup.get(key));
      continue;
    }
    const ins = await run(
      `INSERT INTO tasks
         (date, priority, priority_num, text, status, order_index, forwarded_from, parent_id)
         VALUES (?, ?, ?, ?, 'in_process', ?, ?, ?)`,
      [targetDate, t.priority, t.priority_num, t.text, t.order_index || 0, sourceDate, newParent]
    );
    idMap.set(t.id, ins.lastID);
    lookup.set(key, ins.lastID);
    inserted += 1;
  }
  return inserted;
}

// Duplicate every note entry on sourceDate to sourceDate+1, deduplicating by
// (text, effective parent_id) on the target day. Source rows stay put.
async function pushNotesForward(sourceDate) {
  const targetDate = nextDayISO(sourceDate);

  const candidates = await all(
    `SELECT id, parent_id, text, order_index FROM daily_note_entries
      WHERE date = ?
      ORDER BY (parent_id IS NULL) DESC, order_index ASC, id ASC`,
    [sourceDate]
  );
  if (candidates.length === 0) return 0;

  const existing = await all(
    `SELECT id, parent_id, text FROM daily_note_entries WHERE date = ?`,
    [targetDate]
  );
  const lookup = new Map();
  for (const e of existing) lookup.set(keyOf(e.text, e.parent_id), e.id);

  const maxRow = await get(
    `SELECT COALESCE(MAX(order_index), -1) AS m
       FROM daily_note_entries WHERE date = ?`,
    [targetDate]
  );
  let nextOrder = (maxRow ? maxRow.m : -1) + 1;

  const idMap = new Map();
  let inserted = 0;
  for (const n of candidates) {
    const newParent = n.parent_id != null ? (idMap.get(n.parent_id) ?? null) : null;
    const key = keyOf(n.text, newParent);
    if (lookup.has(key)) {
      idMap.set(n.id, lookup.get(key));
      continue;
    }
    const ins = await run(
      `INSERT INTO daily_note_entries
         (date, text, order_index, parent_id)
         VALUES (?, ?, ?, ?)`,
      [targetDate, n.text, nextOrder, newParent]
    );
    idMap.set(n.id, ins.lastID);
    lookup.set(key, ins.lastID);
    nextOrder += 1;
    inserted += 1;
  }
  return inserted;
}

// `sourceDate` is the day the user is viewing when they click the button.
// Originals stay; fresh copies appear on sourceDate+1 unless an exact match
// (text + parent) already exists. Completed source tasks are skipped.
async function pullForward(sourceDate) {
  const rolledTasks = await pushTasksForward(sourceDate);
  const movedNotes = await pushNotesForward(sourceDate);
  return { rolledTasks, movedNotes, targetDate: nextDayISO(sourceDate) };
}

module.exports = { pullForward };
