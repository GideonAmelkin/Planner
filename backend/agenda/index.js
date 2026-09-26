// The Agenda tab's API: the daily spread, its lists, appointments, Monthly Goals, the
// month / recap summaries and the calendar accounts. One router, mounted at /api by
// server.js; every route file declares its full /api/... paths so they stay greppable.
const { Router } = require('express');
const { startScheduler } = require('./autoRollover');

const router = Router();
for (const name of ['day', 'tasks', 'appointments', 'notes', 'ongoing', 'masterTasks', 'summaries', 'calendar']) {
  router.use(require(`./routes/${name}`));
}

module.exports = router;
module.exports.startScheduler = startScheduler;
