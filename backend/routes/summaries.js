// Read-only aggregates: per-day counts for a month, and the Recap list.
const { Router } = require('express');
const { monthSummary, completedByDate } = require('../queries');
const { isYearMonth, asyncHandler } = require('../lib/http');

const router = Router();

router.get('/month/:year/:month', asyncHandler(async (req, res) => {
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  if (!isYearMonth(year, month)) {
    return res.status(400).json({ error: 'invalid year/month' });
  }
  res.json({ year, month, days: await monthSummary(year, month) });
}));

router.get('/recap', asyncHandler(async (req, res) => {
  res.json(await completedByDate());
}));

module.exports = router;
