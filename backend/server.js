require('dotenv').config();
const agenda = require('./agenda');
const { startWarmCache } = require('./garmin/service');
const { startReviewScheduler } = require('./social/review');
const { startCompetitorScheduler } = require('./social/competitorJobs');
const { startHealthScheduler } = require('./health/scheduler');
const { createApp } = require('./app');

const PORT = process.env.PORT || 5002;

const app = createApp();

app.listen(PORT, () => {
  console.log(`Planner backend listening on ${PORT}`);
  agenda.startScheduler();
  // The Health listener must be on the bus before the first warm announces a bundle.
  startHealthScheduler();
  startWarmCache();
  startReviewScheduler();
  startCompetitorScheduler();
});
