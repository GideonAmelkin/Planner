require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { run, get, all } = require('./db');
const { getQuoteForDate } = require('./quoteService');
const { pullForward } = require('./rollover');
const { recordRun, startScheduler } = require('./autoRollover');
const calendarService = require('./calendarService');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const isDateTime = (s) => typeof s === 'string' && ISO_DATETIME.test(s);

const PORT = process.env.PORT || 5002;
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (s) => typeof s === 'string' && ISO_DATE.test(s);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/day/:date', async (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: 'invalid date' });
  try {
    const [tasks, appointments, notes, ongoing, notesTextRow, quote, calendarResult] = await Promise.all([
      all(`SELECT * FROM tasks WHERE date = ? ORDER BY
             CASE priority WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END,
             priority_num,
             order_index,
             id`, [date]),
      all('SELECT id, date, hour, start_at, end_at, text FROM appointments WHERE date = ? ORDER BY start_at, id', [date]),
      all('SELECT id, date, text, order_index, parent_id FROM daily_note_entries WHERE date = ? ORDER BY order_index, id', [date]),
      all('SELECT id, text, order_index, parent_id FROM ongoing_items ORDER BY order_index, id'),
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
  } catch (err) {
    console.error('GET /api/day error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/day/:date/pull-forward', async (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: 'invalid date' });
  try {
    const result = await pullForward(date);
    // Mark the day as handled so the nightly auto-rollover skips it.
    await recordRun(date, 'manual');
    res.json(result);
  } catch (err) {
    console.error('POST /api/day/:date/pull-forward error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  const { date, text, priority = null, priority_num = null, order_index = 0, parent_id = null } = req.body || {};
  if (!isDate(date) || !text || !String(text).trim()) {
    return res.status(400).json({ error: 'date and text required' });
  }
  try {
    const r = await run(
      'INSERT INTO tasks (date, text, priority, priority_num, order_index, parent_id) VALUES (?, ?, ?, ?, ?, ?)',
      [date, String(text).trim(), priority, priority_num, order_index, parent_id]
    );
    const row = await get('SELECT * FROM tasks WHERE id = ?', [r.lastID]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const allowed = ['text', 'priority', 'priority_num', 'status', 'order_index', 'parent_id'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (key in req.body) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'no fields' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  try {
    await run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);
    const row = await get('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    await run('DELETE FROM tasks WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/reorder', async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.every((x) => Number.isInteger(x))) {
    return res.status(400).json({ error: 'ids must be an array of integers' });
  }
  try {
    for (let i = 0; i < ids.length; i++) {
      await run(
        'UPDATE tasks SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [i, ids[i]]
      );
    }
    res.json({ ok: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes/reorder', async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.every((x) => Number.isInteger(x))) {
    return res.status(400).json({ error: 'ids must be an array of integers' });
  }
  try {
    for (let i = 0; i < ids.length; i++) {
      await run(
        'UPDATE daily_note_entries SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [i, ids[i]]
      );
    }
    res.json({ ok: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/appointments', async (req, res) => {
  const { date, start_at, end_at, text } = req.body || {};
  if (!isDate(date)) return res.status(400).json({ error: 'invalid date' });
  if (!isDateTime(start_at) || !isDateTime(end_at)) {
    return res.status(400).json({ error: 'start_at and end_at required (YYYY-MM-DDTHH:MM)' });
  }
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text required' });
  try {
    const r = await run(
      'INSERT INTO appointments (date, start_at, end_at, text) VALUES (?, ?, ?, ?)',
      [date, start_at, end_at, String(text).trim()]
    );
    const row = await get('SELECT id, date, hour, start_at, end_at, text FROM appointments WHERE id = ?', [r.lastID]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/appointments/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const allowed = ['text', 'start_at', 'end_at'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (key in req.body) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'no fields' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  try {
    await run(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`, values);
    const row = await get('SELECT * FROM appointments WHERE id = ?', [id]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/appointments/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    await run('DELETE FROM appointments WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notes', async (req, res) => {
  const { date, text, order_index = 0, parent_id = null } = req.body || {};
  if (!isDate(date) || !text || !String(text).trim()) {
    return res.status(400).json({ error: 'date and text required' });
  }
  try {
    const r = await run(
      'INSERT INTO daily_note_entries (date, text, order_index, parent_id) VALUES (?, ?, ?, ?)',
      [date, String(text).trim(), order_index, parent_id]
    );
    const row = await get('SELECT id, date, text, order_index, parent_id FROM daily_note_entries WHERE id = ?', [r.lastID]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/notes/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const allowed = ['text', 'order_index', 'parent_id'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (key in req.body) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'no fields' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  try {
    await run(`UPDATE daily_note_entries SET ${updates.join(', ')} WHERE id = ?`, values);
    const row = await get('SELECT id, date, text, order_index, parent_id FROM daily_note_entries WHERE id = ?', [id]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/notes/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    await run('DELETE FROM daily_note_entries WHERE parent_id = ?', [id]);
    await run('DELETE FROM daily_note_entries WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ongoing/reorder', async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.every((x) => Number.isInteger(x))) {
    return res.status(400).json({ error: 'ids must be an array of integers' });
  }
  try {
    for (let i = 0; i < ids.length; i++) {
      await run(
        'UPDATE ongoing_items SET order_index = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [i, ids[i]]
      );
    }
    res.json({ ok: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ongoing', async (req, res) => {
  const { text, order_index = 0, parent_id = null } = req.body || {};
  if (!text || !String(text).trim()) {
    return res.status(400).json({ error: 'text required' });
  }
  try {
    const r = await run(
      'INSERT INTO ongoing_items (text, order_index, parent_id) VALUES (?, ?, ?)',
      [String(text).trim(), order_index, parent_id]
    );
    const row = await get('SELECT id, text, order_index, parent_id FROM ongoing_items WHERE id = ?', [r.lastID]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/ongoing/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const allowed = ['text', 'order_index', 'parent_id'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (key in req.body) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'no fields' });
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);
  try {
    await run(`UPDATE ongoing_items SET ${updates.join(', ')} WHERE id = ?`, values);
    const row = await get('SELECT id, text, order_index, parent_id FROM ongoing_items WHERE id = ?', [id]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ongoing/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    await run('DELETE FROM ongoing_items WHERE parent_id = ?', [id]);
    await run('DELETE FROM ongoing_items WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/notes-text/:date', async (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: 'invalid date' });
  const content = typeof req.body.content === 'string' ? req.body.content : '';
  try {
    await run(
      `INSERT INTO daily_notes (date, content) VALUES (?, ?)
       ON CONFLICT(date) DO UPDATE SET content = excluded.content, updated_at = CURRENT_TIMESTAMP`,
      [date, content]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/master-tasks', async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'year and month (1-12) required' });
  }
  try {
    const rows = await all(
      `SELECT * FROM master_tasks WHERE year = ? AND month = ?
       ORDER BY category, order_index, id`,
      [year, month]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/master-tasks', async (req, res) => {
  const { year, month, category, text, order_index = 0 } = req.body || {};
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'year and month required' });
  }
  if (!['personal', 'business'].includes(category)) {
    return res.status(400).json({ error: 'category must be personal or business' });
  }
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'text required' });
  try {
    const r = await run(
      'INSERT INTO master_tasks (year, month, category, text, order_index) VALUES (?, ?, ?, ?, ?)',
      [year, month, category, String(text).trim(), order_index]
    );
    const row = await get('SELECT * FROM master_tasks WHERE id = ?', [r.lastID]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/master-tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  const allowed = ['text', 'status', 'category', 'order_index'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (key in req.body) {
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'no fields' });
  values.push(id);
  try {
    await run(`UPDATE master_tasks SET ${updates.join(', ')} WHERE id = ?`, values);
    const row = await get('SELECT * FROM master_tasks WHERE id = ?', [id]);
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/master-tasks/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    await run('DELETE FROM master_tasks WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/master-tasks/reorder', async (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids) || !ids.every((x) => Number.isInteger(x))) {
    return res.status(400).json({ error: 'ids must be an array of integers' });
  }
  try {
    for (let i = 0; i < ids.length; i++) {
      await run('UPDATE master_tasks SET order_index = ? WHERE id = ?', [i, ids[i]]);
    }
    res.json({ ok: true, count: ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/month/:year/:month', async (req, res) => {
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return res.status(400).json({ error: 'invalid year/month' });
  }
  const mm = String(month).padStart(2, '0');
  const prefix = `${year}-${mm}-%`;
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recap: all completed action items grouped by date, most recent date first.
app.get('/api/recap', async (req, res) => {
  try {
    const rows = await all(
      `SELECT id, date, text, priority, priority_num, order_index
         FROM tasks
        WHERE status = 'completed'
        ORDER BY date DESC,
                 CASE priority WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END,
                 priority_num, order_index, id`,
      []
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Calendar integration ------------------------------------------------------

app.get('/api/calendar/accounts', async (req, res) => {
  try {
    const rows = await calendarService.listAccounts();
    res.json({
      accounts: rows,
      providers: {
        google: calendarService.googleConfigured(),
        outlook: calendarService.microsoftConfigured(),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/calendar/accounts/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  try {
    await calendarService.disconnectAccount(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/calendar/google/connect', (req, res) => {
  if (!calendarService.googleConfigured()) {
    return res.status(400).send('Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.');
  }
  try {
    res.redirect(calendarService.startGoogleAuth());
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/calendar/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`${FRONTEND_URL}/?calendar_error=${encodeURIComponent(error)}`);
  if (!code) return res.status(400).send('Missing code');
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
    return res.status(400).send('Microsoft OAuth not configured. Set MS_CLIENT_ID and MS_CLIENT_SECRET in backend/.env.');
  }
  try {
    res.redirect(calendarService.startMicrosoftAuth());
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get('/api/calendar/outlook/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`${FRONTEND_URL}/?calendar_error=${encodeURIComponent(error)}`);
  if (!code) return res.status(400).send('Missing code');
  try {
    await calendarService.finishMicrosoftAuth(String(code));
    res.redirect(`${FRONTEND_URL}/?connected=outlook`);
  } catch (err) {
    console.error('Outlook callback error:', err);
    res.redirect(`${FRONTEND_URL}/?calendar_error=${encodeURIComponent(err.message || 'outlook_auth_failed')}`);
  }
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`Planner backend listening on ${PORT}`);
  startScheduler();
});
