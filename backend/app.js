// The express app without the listener, so tests can mount it on any port.
const express = require('express');
const cors = require('cors');
const agenda = require('./agenda');
const { today } = require('./lib/today');
const clientEvents = require('./lib/clientEvents');

const JSON_LIMIT = '2mb';

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: JSON_LIMIT }));

  // Liveness probe. Registered before the Health router so /api/health stays this
  // and /api/health/... belongs to the Health tab.
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // The server's local day; the frontend's "today" (shared/dayInfo.js todayISO).
  app.get('/api/today', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(today());
  });

  // The open tabs' trail of loads, snaps to today and build reloads (lib/clientEvents.js).
  app.post('/api/client-event', express.text({ type: '*/*', limit: '4kb' }), (req, res) => {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = null; }
    }
    res.status(clientEvents.record(body, req.get('user-agent')) ? 204 : 400).end();
  });
  app.get('/api/client-events', (req, res) => res.json(clientEvents.list()));

  // One router per tab. Every route file declares its own /api/... paths so they stay greppable.
  app.use('/api', agenda);
  app.use('/api', require('./garmin'));
  app.use('/api', require('./workout'));
  app.use('/api', require('./social'));
  app.use('/api', require('./health'));

  // Anything thrown inside an asyncHandler lands here.
  app.use((err, req, res, _next) => {
    console.error(`${req.method} ${req.originalUrl} error:`, err);
    res.status(500).json({ error: err.message || 'Internal error' });
  });
  return app;
}

module.exports = { createApp };
