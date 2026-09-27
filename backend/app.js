// The express app without the listener, so tests can mount it on any port.
const express = require('express');
const cors = require('cors');
const agenda = require('./agenda');

const JSON_LIMIT = '2mb';

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: JSON_LIMIT }));

  // Liveness probe. Registered before the Health router so /api/health stays this
  // and /api/health/... belongs to the Health tab.
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

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
