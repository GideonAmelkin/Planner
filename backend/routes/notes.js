// The "Tasks" section (daily_note_entries) and the free-form Notes textarea
// (daily_notes) of the daily spread.
const { Router } = require('express');
const { run } = require('../db');
const { NOTE_COLUMNS } = require('../queries');
const { isDate, asyncHandler, fetchRow, patchRow, reorderRows, deleteRow } = require('../lib/http');

const router = Router();

router.post('/notes', asyncHandler(async (req, res) => {
  const { date, text, order_index = 0, parent_id = null } = req.body || {};
  if (!isDate(date) || !text || !String(text).trim()) {
    return res.status(400).json({ error: 'date and text required' });
  }
  const r = await run(
    'INSERT INTO daily_note_entries (date, text, order_index, parent_id) VALUES (?, ?, ?, ?)',
    [date, String(text).trim(), order_index, parent_id]
  );
  res.json(await fetchRow('daily_note_entries', NOTE_COLUMNS, r.lastID));
}));

router.patch('/notes/:id', patchRow({
  table: 'daily_note_entries',
  allowed: ['text', 'order_index', 'parent_id'],
  select: NOTE_COLUMNS,
}));
router.delete('/notes/:id', deleteRow({ table: 'daily_note_entries', cascadeChildren: true }));
router.post('/notes/reorder', reorderRows({ table: 'daily_note_entries' }));

router.put('/notes-text/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: 'invalid date' });
  const body = req.body || {};
  const content = typeof body.content === 'string' ? body.content : '';
  await run(
    `INSERT INTO daily_notes (date, content) VALUES (?, ?)
     ON CONFLICT(date) DO UPDATE SET content = excluded.content, updated_at = CURRENT_TIMESTAMP`,
    [date, content]
  );
  res.json({ ok: true });
}));

module.exports = router;
