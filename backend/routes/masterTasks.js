// Monthly Goals: Personal | Business running lists per month.
const { Router } = require('express');
const { run, all } = require('../db');
const { isYearMonth, asyncHandler, fetchRow, patchRow, reorderRows, deleteRow } = require('../lib/http');

const router = Router();

router.get('/master-tasks', asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!isYearMonth(year, month)) {
    return res.status(400).json({ error: 'year and month (1-12) required' });
  }
  res.json(await all(
    `SELECT * FROM master_tasks WHERE year = ? AND month = ?
     ORDER BY category, order_index, id`,
    [year, month]
  ));
}));

router.post('/master-tasks', asyncHandler(async (req, res) => {
  const { year, month, category, text, order_index = 0 } = req.body || {};
  if (!isYearMonth(year, month)) {
    return res.status(400).json({ error: 'year and month required' });
  }
  if (!['personal', 'business'].includes(category)) {
    return res.status(400).json({ error: 'category must be personal or business' });
  }
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text required' });
  const r = await run(
    'INSERT INTO master_tasks (year, month, category, text, order_index) VALUES (?, ?, ?, ?, ?)',
    [year, month, category, String(text).trim(), order_index]
  );
  res.json(await fetchRow('master_tasks', '*', r.lastID));
}));

router.patch('/master-tasks/:id', patchRow({
  table: 'master_tasks',
  allowed: ['text', 'status', 'category', 'order_index'],
  touchUpdatedAt: false,
}));
router.delete('/master-tasks/:id', deleteRow({ table: 'master_tasks' }));
router.post('/master-tasks/reorder', reorderRows({ table: 'master_tasks', touchUpdatedAt: false }));

module.exports = router;
