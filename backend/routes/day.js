// GET /api/day/:date is everything the daily spread renders in one payload.
const { Router } = require('express');
const { get } = require('../db');
const { getQuoteForDate } = require('../quoteService');
const { pullForward } = require('../rollover');
const { recordRun } = require('../autoRollover');
const calendarService = require('../calendarService');
const { tasksForDate, appointmentsForDate, notesForDate, ongoingItems } = require('../queries');
const { isDate, asyncHandler } = require('../lib/http');

const router = Router();

router.get('/day/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: 'invalid date' });
  const [tasks, appointments, notes, ongoing, notesTextRow, quote, calendarResult] = await Promise.all([
    tasksForDate(date),
    appointmentsForDate(date),
    notesForDate(date),
    ongoingItems(),
    get('SELECT content FROM daily_notes WHERE date = ?', [date]),
    getQuoteForDate(date),
    calendarService.listEventsForDate(date).catch((err) => ({
      events: [],
      errors: [{ message: err.message || String(err) }],
    })),
  ]);
  res.json({
    date,
    tasks,
    appointments,
    notes,
    ongoing,
    notes_text: notesTextRow ? notesTextRow.content : '',
    quote,
    external_events: calendarResult.events,
    calendar_errors: calendarResult.errors,
  });
}));

router.post('/day/:date/pull-forward', asyncHandler(async (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: 'invalid date' });
  const result = await pullForward(date);
  // Mark the day as handled so the nightly auto-rollover skips it.
  await recordRun(date, 'manual');
  res.json(result);
}));

module.exports = router;
