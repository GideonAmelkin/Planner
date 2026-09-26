require('dotenv').config();
const express = require('express');
const cors = require('cors');
const agenda = require('./agenda');
const { startWarmCache } = require('./garminService');

const PORT = process.env.PORT || 5002;
const JSON_LIMIT = '2mb';

const app = express();
app.use(cors());
app.use(express.json({ limit: JSON_LIMIT }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// One router per tab. Every route file declares its own /api/... paths so they stay greppable.
app.use('/api', agenda);
for (const name of ['garmin', 'workout']) {
  app.use('/api', require(`./routes/${name}`));
}

// Anything thrown inside an asyncHandler lands here.
app.use((err, req, res, _next) => {
  console.error(`${req.method} ${req.originalUrl} error:`, err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`Planner backend listening on ${PORT}`);
  agenda.startScheduler();
  startWarmCache();
});
