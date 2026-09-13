require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { startScheduler } = require('./autoRollover');

const PORT = process.env.PORT || 5002;
const JSON_LIMIT = '2mb';

const app = express();
app.use(cors());
app.use(express.json({ limit: JSON_LIMIT }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Every router declares its own /api/... paths so they stay greppable.
for (const name of ['day', 'tasks', 'appointments', 'notes', 'ongoing', 'masterTasks', 'summaries', 'calendar']) {
  app.use('/api', require(`./routes/${name}`));
}

// Anything thrown inside an asyncHandler lands here.
app.use((err, req, res, _next) => {
  console.error(`${req.method} ${req.originalUrl} error:`, err);
  res.status(500).json({ error: err.message || 'Internal error' });
});

app.listen(PORT, () => {
  console.log(`Planner backend listening on ${PORT}`);
  startScheduler();
});
