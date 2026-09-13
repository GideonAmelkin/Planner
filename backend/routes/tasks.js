// Action Items: per-day prioritized tasks with one level of sub-items.
const { Router } = require('express');
const { run } = require('../db');
const { isDate, asyncHandler, fetchRow, patchRow, reorderRows, deleteRow } = require('../lib/http');

const router = Router();

router.post('/tasks', asyncHandler(async (req, res) => {
  const { date, text, priority = null, priority_num = null, order_index = 0, parent_id = null } = req.body || {};
  if (!isDate(date) || !text || !String(text).trim()) {
    return res.status(400).json({ error: 'date and text required' });
  }
  const r = await run(
    'INSERT INTO tasks (date, text, priority, priority_num, order_index, parent_id) VALUES (?, ?, ?, ?, ?, ?)',
    [date, String(text).trim(), priority, priority_num, order_index, parent_id]
  );
  res.json(await fetchRow('tasks', '*', r.lastID));
}));

router.patch('/tasks/:id', patchRow({
  table: 'tasks',
  allowed: ['text', 'priority', 'priority_num', 'status', 'order_index', 'parent_id'],
}));
router.delete('/tasks/:id', deleteRow({ table: 'tasks' }));
router.post('/tasks/reorder', reorderRows({ table: 'tasks' }));

module.exports = router;
