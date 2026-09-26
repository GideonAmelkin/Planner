// Garmin Connect: sign-in, the Health page bundle, and one route per registry
// endpoint (GET for reads, POST for writes). Static paths come before /:name.
const { Router } = require('express');
const garmin = require('./service');
const { asyncHandler, isDate } = require('../lib/http');

const router = Router();

router.get('/garmin/status', asyncHandler(async (req, res) => {
  res.json(await garmin.status());
}));

router.post('/garmin/login', asyncHandler(async (req, res) => {
  res.json(await garmin.login());
}));

router.post('/garmin/login/mfa', asyncHandler(async (req, res) => {
  const code = req.body && req.body.code;
  if (!code || !/^\d{4,8}$/.test(String(code).trim())) return res.status(400).json({ error: 'code must be 4 to 8 digits' });
  res.json(await garmin.submitMfa(code));
}));

router.post('/garmin/logout', asyncHandler(async (req, res) => {
  res.json(await garmin.logout());
}));

router.get('/garmin/endpoints', (req, res) => {
  res.json({ count: garmin.registry.length, endpoints: garmin.registry });
});

router.get('/garmin/day/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: 'invalid date' });
  res.json(await garmin.dayBundle(date, { refresh: req.query.refresh === '1' }));
}));

router.post('/garmin/batch', asyncHandler(async (req, res) => {
  const { calls, refresh } = req.body || {};
  if (!Array.isArray(calls) || calls.length === 0 || calls.length > 50) {
    return res.status(400).json({ error: 'calls must be an array of 1 to 50 items' });
  }
  const prepared = [];
  for (const [i, c] of calls.entries()) {
    const entry = garmin.BY_NAME[c && c.name];
    if (!entry) return res.status(400).json({ error: `calls[${i}]: unknown endpoint` });
    if (entry.kind !== 'read') return res.status(400).json({ error: `calls[${i}]: ${c.name} is not a read endpoint` });
    try {
      prepared.push({ key: c.key || `${c.name}#${i}`, name: c.name, kwargs: garmin.buildKwargs(entry, c.params || {}) });
    } catch (err) {
      return res.status(400).json({ error: `calls[${i}]: ${err.message}` });
    }
  }
  res.json({ results: await garmin.callMany(prepared, { refresh: !!refresh }) });
}));

const lookup = (req, res) => {
  const entry = garmin.BY_NAME[req.params.name];
  if (!entry) { res.status(404).json({ error: `unknown endpoint ${req.params.name}` }); return null; }
  if (entry.kind === 'unsupported') { res.status(400).json({ error: `${entry.name} is not exposed (file transfer)` }); return null; }
  return entry;
};

router.get('/garmin/:name', asyncHandler(async (req, res) => {
  const entry = lookup(req, res);
  if (!entry) return;
  if (entry.kind !== 'read') return res.status(405).json({ error: `${entry.name} is a write endpoint; use POST` });
  let kwargs;
  try { kwargs = garmin.buildKwargs(entry, req.query); } catch (err) { return res.status(400).json({ error: err.message }); }
  const out = await garmin.callOne(entry.name, kwargs, { refresh: req.query.refresh === '1' });
  res.status(out.ok ? 200 : 502).json({ endpoint: entry.name, params: kwargs, ...out });
}));

router.post('/garmin/:name', asyncHandler(async (req, res) => {
  const entry = lookup(req, res);
  if (!entry) return;
  if (entry.kind !== 'write') return res.status(405).json({ error: `${entry.name} is a read endpoint; use GET` });
  let kwargs;
  try { kwargs = garmin.buildKwargs(entry, req.body || {}); } catch (err) { return res.status(400).json({ error: err.message }); }
  const out = await garmin.callOne(entry.name, kwargs);
  res.status(out.ok ? 200 : 502).json({ endpoint: entry.name, params: kwargs, ...out });
}));

module.exports = router;
