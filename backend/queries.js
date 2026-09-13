// SQL fragments and read queries shared by more than one route.
const { all } = require('./db');
const { monthPrefix } = require('./lib/dates');

// Task ordering used by the day view and the recap: A before B before C, then
// the number within the letter, then manual order.
const PRIORITY_ORDER = `CASE priority WHEN 'A' THEN 1 WHEN 'B' THEN 2 WHEN 'C' THEN 3 ELSE 4 END,
             priority_num, order_index, id`;

const NOTE_COLUMNS = 'id, date, text, order_index, parent_id';
const ONGOING_COLUMNS = 'id, text, order_index, parent_id';
const APPOINTMENT_COLUMNS = 'id, date, hour, start_at, end_at, text';

const tasksForDate = (date) => all(`SELECT * FROM tasks WHERE date = ? ORDER BY ${PRIORITY_ORDER}`, [date]);
const appointmentsForDate = (date) =>
  all(`SELECT ${APPOINTMENT_COLUMNS} FROM appointments WHERE date = ? ORDER BY start_at, id`, [date]);
const notesForDate = (date) =>
  all(`SELECT ${NOTE_COLUMNS} FROM daily_note_entries WHERE date = ? ORDER BY order_index, id`, [date]);
const ongoingItems = () => all(`SELECT ${ONGOING_COLUMNS} FROM ongoing_items ORDER BY order_index, id`);

// { 'YYYY-MM-DD': { tasks, appts } } for every day in the month that has either.
async function monthSummary(year, month) {
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
  return summary;
}

// Completed action items grouped by date, most recent date first.
async function completedByDate() {
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
  return groups;
}

module.exports = {
  PRIORITY_ORDER, NOTE_COLUMNS, ONGOING_COLUMNS, APPOINTMENT_COLUMNS,
  tasksForDate, appointmentsForDate, notesForDate, ongoingItems, monthSummary, completedByDate,
};
