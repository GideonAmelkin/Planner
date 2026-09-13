// Manual appointments on the timeline (external calendar events are read-only
// and come from calendarService).
const { Router } = require('express');
const { run } = require('../db');
const { APPOINTMENT_COLUMNS } = require('../queries');
const { isDate, isDateTime, asyncHandler, fetchRow, patchRow, deleteRow } = require('../lib/http');

const router = Router();

router.post('/appointments', asyncHandler(async (req, res) => {
  const { date, start_at, end_at, text } = req.body || {};
  if (!isDate(date)) return res.status(400).json({ error: 'invalid date' });
  if (!isDateTime(start_at) || !isDateTime(end_at)) {
    return res.status(400).json({ error: 'start_at and end_at required (YYYY-MM-DDTHH:MM)' });
  }
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text required' });
  const r = await run(
    'INSERT INTO appointments (date, start_at, end_at, text) VALUES (?, ?, ?, ?)',
    [date, start_at, end_at, String(text).trim()]
  );
  res.json(await fetchRow('appointments', APPOINTMENT_COLUMNS, r.lastID));
}));

router.patch('/appointments/:id', patchRow({
  table: 'appointments',
  allowed: ['text', 'start_at', 'end_at'],
  select: APPOINTMENT_COLUMNS,
}));
router.delete('/appointments/:id', deleteRow({ table: 'appointments' }));

module.exports = router;
