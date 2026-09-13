// Route helpers: validation, the async wrapper that routes errors to the
// error middleware, and the generic row handlers that every list resource
// (tasks, notes, ongoing, master tasks, appointments) shares.
const { run, get } = require('../db');

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
const isDate = (s) => typeof s === 'string' && ISO_DATE.test(s);
const isDateTime = (s) => typeof s === 'string' && ISO_DATETIME.test(s);
const isYearMonth = (year, month) =>
  Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12;

// Wrap an async route so a thrown error reaches the error middleware as a 500.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Numeric :id param, or null when it is not an integer.
const idParam = (req) => {
  const id = Number(req.params.id);
  return Number.isInteger(id) ? id : null;
};

// GET one row back after a write.
const fetchRow = (table, select, id) => get(`SELECT ${select} FROM ${table} WHERE id = ?`, [id]);

// PATCH /:id with an allow-list of columns. Responds with the updated row.
function patchRow({ table, allowed, select = '*', touchUpdatedAt = true }) {
  return asyncHandler(async (req, res) => {
    const id = idParam(req);
    if (id === null) return res.status(400).json({ error: 'invalid id' });
    const body = req.body || {};
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (key in body) {
        updates.push(`${key} = ?`);
        values.push(body[key]);
      }
    }
    if (updates.length === 0) return res.status(400).json({ error: 'no fields' });
    if (touchUpdatedAt) updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    await run(`UPDATE ${table} SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json(await fetchRow(table, select, id));
  });
}

// POST /reorder with { ids: [...] }: order_index becomes the array position.
// One statement, so the reorder is atomic.
function reorderRows({ table, touchUpdatedAt = true }) {
  return asyncHandler(async (req, res) => {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.every((x) => Number.isInteger(x))) {
      return res.status(400).json({ error: 'ids must be an array of integers' });
    }
    if (ids.length > 0) {
      const cases = ids.map(() => 'WHEN ? THEN ?').join(' ');
      const params = ids.flatMap((id, i) => [id, i]);
      const touch = touchUpdatedAt ? ', updated_at = CURRENT_TIMESTAMP' : '';
      await run(
        `UPDATE ${table} SET order_index = CASE id ${cases} END${touch}
          WHERE id IN (${ids.map(() => '?').join(', ')})`,
        [...params, ...ids]
      );
    }
    res.json({ ok: true, count: ids.length });
  });
}

// DELETE /:id, optionally removing child rows (parent_id) first.
function deleteRow({ table, cascadeChildren = false }) {
  return asyncHandler(async (req, res) => {
    const id = idParam(req);
    if (id === null) return res.status(400).json({ error: 'invalid id' });
    if (cascadeChildren) await run(`DELETE FROM ${table} WHERE parent_id = ?`, [id]);
    await run(`DELETE FROM ${table} WHERE id = ?`, [id]);
    res.json({ ok: true });
  });
}

module.exports = {
  isDate, isDateTime, isYearMonth, asyncHandler, idParam, fetchRow, patchRow, reorderRows, deleteRow,
};
