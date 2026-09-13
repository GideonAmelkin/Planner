require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { run, get, all } = require('./db');
const { getQuoteForDate } = require('./quoteService');
const { pullForward } = require('./rollover');
const { recordRun, startScheduler } = require('./autoRollover');
const calendarService = require('./calendarService');
const { monthPrefix } = require('./lib/dates');
const {
  isDate, isDateTime, isYearMonth, asyncHandler, fetchRow, patchRow, reorderRows, deleteRow,
} = require('./lib/http');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const PORT = process.env.PORT || 5002;
const JSON_LIMIT = '2mb';

// Task ordering used by the day view and the recap: A before B before C, then
// the number within the letter, then manual order.
const PRIORITY_ORDER = `CASE priority WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END,
             priority_num, order_index, id`;

const NOTE_COLUMNS = 'id, date, text, order_index, parent_id';
const ONGOING_COLUMNS = 'id, text, order_index, parent_id';
const APPOINTMENT_COLUMNS = 'id, date, hour, start_at, end_at, text';

const app = express();
app.use(cors());
app.use(express.json({ limit: JSON_LIMIT }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Day ------------------------------------------------------------------------

app.get('/api/day/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: 'invalid date' });
  const [tasks, appointments, notes, ongoing, notesTextRow, quote, calendarResult] = await Promise.all([
    all(`SELECT * FROM tasks WHERE date = ? ORDER BY ${PRIORITY_ORDER}`, [date]),
    all(`SELECT ${APPOINTMENT_COLUMNS} FROM appointments WHERE date = ? ORDER BY start_at, id`, [date]),
    all(`SELECT ${NOTE_COLUMNS} FROM daily_note_entries WHERE date = ? ORDER BY order_index, id`, [date]),
    all(`SELECT ${ONGOING_COLUMNS} FROM ongoing_items ORDER BY order_index, id`),
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

app.post('/api/day/:date/pull-forward', asyncHandler(async (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: 'invalid date' });
  const result = await pullForward(date);
  // Mark the day as handled so the nightly auto-rollover skips it.
  await recordRun(date, 'manual');
  res.json(result);
}));

// Tasks (Action Items) -------------------------------------------------------

app.post('/api/tasks', asyncHandler(async (req, res) => {
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

app.patch('/api/tasks/:id', patchRow({
  table: 'tasks',
  allowed: ['text', 'priority', 'priority_num', 'status', 'order_index', 'parent_id'],
}));
app.delete('/api/tasks/:id', deleteRow({ table: 'tasks' }));
app.post('/api/tasks/reorder', reorderRows({ table: 'tasks' }));

// Appointments ---------------------------------------------------------------

app.post('/api/appointments', asyncHandler(async (req, res) => {
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

app.patch('/api/appointments/:id', patchRow({
  table: 'appointments',
  allowed: ['text', 'start_at', 'end_at'],
  select: APPOINTMENT_COLUMNS,
}));
app.delete('/api/appointments/:id', deleteRow({ table: 'appointments' }));

// Notes (the "Tasks" section) ------------------------------------------------

app.post('/api/notes', asyncHandler(async (req, res) => {
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

app.patch('/api/notes/:id', patchRow({
  table: 'daily_note_entries',
  allowed: ['text', 'order_index', 'parent_id'],
  select: NOTE_COLUMNS,
}));
app.delete('/api/notes/:id', deleteRow({ table: 'daily_note_entries', cascadeChildren: true }));
app.post('/api/notes/reorder', reorderRows({ table: 'daily_note_entries' }));

// Ongoing --------------------------------------------------------------------

app.post('/api/ongoing', asyncHandler(async (req, res) => {
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

app.patch('/api/ongoing/:id', patchRow({
  table: 'ongoing_items',
  allowed: ['text', 'order_index', 'parent_id'],
  select: ONGOING_COLUMNS,
}));
app.delete('/api/ongoing/:id', deleteRow({ table: 'ongoing_items', cascadeChildren: true }));
app.post('/api/ongoing/reorder', reorderRows({ table: 'ongoing_items' }));

// Free-form daily notes ------------------------------------------------------

app.put('/api/notes-text/:date', asyncHandler(async (req, res) => {
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

// Master tasks (Monthly Goals) -----------------------------------------------

app.get('/api/master-tasks', asyncHandler(async (req, res) => {
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

app.post('/api/master-tasks', asyncHandler(async (req, res) => {
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

app.patch('/api/master-tasks/:id', patchRow({
  table: 'master_tasks',
  allowed: ['text', 'status', 'category', 'order_index'],
  touchUpdatedAt: false,
}));
app.delete('/api/master-tasks/:id', deleteRow({ table: 'master_tasks' }));
app.post('/api/master-tasks/reorder', reorderRows({ table: 'master_tasks', touchUpdatedAt: false }));

// Month summary + recap ------------------------------------------------------

app.get('/api/month/:year/:month', asyncHandler(async (req, res) => {
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  if (!isYearMonth(year, month)) {
    return res.status(400).json({ error: 'invalid year/month' });
  }
  const prefix = monthPrefix(year, month);
  const taskRows = await all(
    `SELECT date, COUNT(*) AS n FROM tasks
      WHERE date LIKE ? AND status != 'forwarded'
      GROUP BY date`,
    [prefix]
  );
  const apptRows = await all(
    `SELECT date, COUNT(*) AS n FROM appointments
      WHERE date LIKE ?
      GROUP BY date`,
    [prefix]
  );
  const summary = {};
  for (const r of taskRows) summary[r.date] = { tasks: r.n, appts: 0 };
  for (const r of apptRows) {
    summary[r.date] = summary[r.date] || { tasks: 0, appts: 0 };
    summary[r.date].appts = r.n;
  }
  res.json({ year, month, days: summary });
}));

// Recap: all completed action items grouped by date, most recent date first.
app.get('/api/recap', asyncHandler(async (req, res) => {
  const rows = await all(
    `SELECT id, date, text, priority, priority_num, order_index
       FROM tasks
      WHERE status = 'completed'
      ORDER BY date DESC, ${PRIORITY_ORDER}`
  );
  // rows are already date-DESC, so first-seen order preserves the grouping order.
  const groups = [];
  const byDate = new Map();
  for (const r of rows) {
    if (!byDate.has(r.date)) {
      const g = { date: r.date, items: [] };
      byDate.set(r.date, g);
      groups.push(g);
    }
    byDate.get(r.date).items.push(r);
  }
  res.json(groups);
}));

// Calendar integration ------------------------------------------------------

app.get('/api/calendar/accounts', asyncHandler(async (req, res) => {
  res.json({
    accounts: await calendarService.listAccounts(),
    providers: {
      google: calendarService.googleConfigured(),
      outlook: calendarService.microsoftConfigured(),
    },
  });
}));

app.delete('/api/calendar/accounts/:id', asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  await calendarService.disconnectAccount(id);
  res.json({ ok: true });
}));

app.get('/api/calendar/google/connect', (req, res) => {
  if (!calendarService.googleConfigured()) {
    return res.status(400).json({ error: 'Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.' });
  }
  res.redirect(calendarService.startGoogleAuth());
});

app.get('/api/calendar/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`${FRONTEND_URL}/?calendar_error=${encodeURIComponent(error)}`);
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    await calendarService.finishGoogleAuth(String(code));
    res.redirect(`${FRONTEND_URL}/?connected=google`);
  } catch (err) {
    console.error('Google callback error:', err);
    res.redirect(`${FRONTEND_URL}/?calendar_error=${encodeURIComponent(err.message || 'google_auth_failed')}`);
  }
});

app.get('/api/calendar/outlook/connect', (req, res) => {
  if (!calendarService.microsoftConfigured()) {
    return res.status(400).json({ error: 'Microsoft OAuth not configured. Set MS_CLIENT_ID and MS_CLIENT_SECRET in backend/.env.' });
  }
  res.redirect(calendarService.startMicrosoftAuth());
});

app.get('/api/calendar/outlook/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`${FRONTEND_URL}/?calendar_error=${encodeURIComponent(error)}`);
  if (!code) return res.status(400).json({ error: 'Missing code' });
  try {
    await calendarService.finishMicrosoftAuth(String(code));
    res.redirect(`${FRONTEND_URL}/?connected=outlook`);
  } catch (err) {
    console.error('Outlook callback error:', err);
    res.redirect(`${FRONTEND_URL}/?calendar_error=${encodeURIComponent(err.message || 'outlook_auth_failed')}`);
  }
});

// Anything thrown inside an asyncHandler lands here.
app.use((err, req, res, _next) => {
  console.error(`${req.method} ${req.originalUrl} error:`, err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`Planner backend listening on ${PORT}`);
  startScheduler();
});
