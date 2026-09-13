// Ongoing: nested items not tied to any date.
const { Router } = require('express');
const { run } = require('../db');
const { ONGOING_COLUMNS } = require('../queries');
const { asyncHandler, fetchRow, patchRow, reorderRows, deleteRow } = require('../lib/http');

const router = Router();

router.post('/ongoing', asyncHandler(async (req, res) => {
  const { text, order_index = 0, parent_id = null } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'text required' });
  }
  const r = await run(
    'INSERT INTO ongoing_items (text, order_index, parent_id) VALUES (?, ?, ?)',
    [String(text).trim(), order_index, parent_id]
  );
  res.json(await fetchRow('ongoing_items', ONGOING_COLUMNS, r.lastID));
}));

router.patch('/ongoing/:id', patchRow({
  table: 'ongoing_items',
  allowed: ['text', 'order_index', 'parent_id'],
  select: ONGOING_COLUMNS,
}));
router.delete('/ongoing/:id', deleteRow({ table: 'ongoing_items', cascadeChildren: true }));
router.post('/ongoing/reorder', reorderRows({ table: 'ongoing_items' }));

module.exports = router;
