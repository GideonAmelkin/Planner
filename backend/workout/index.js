// Workout App tab: read-only views over the Home Workouts snapshot the Mac ships to
// backend/workout-state/. Nothing here writes; there is deliberately no upload route.
const { Router } = require('express');
const workout = require('./service');
const { asyncHandler, isDate } = require('../lib/http');

const router = Router();

const notAvailable = (res) => res.status(404).json({ available: false, error: 'no Home Workouts snapshot on the server yet' });

router.get('/workout/status', asyncHandler(async (req, res) => {
  res.json(workout.status(workout.load()));
}));

router.get('/workout/day/:date', asyncHandler(async (req, res) => {
  const { date } = req.params;
  if (!isDate(date)) return res.status(400).json({ error: 'invalid date' });
  const snap = workout.load();
  if (!snap) return notAvailable(res);
  res.json({ ...workout.day(snap, date), exported_at: snap.exported_at });
}));

// GET /workout/recent?end=YYYY-MM-DD&days=30   (days 1..3660)
router.get('/workout/recent', asyncHandler(async (req, res) => {
  const end = req.query.end;
  const days = Number(req.query.days || 30);
  if (end !== undefined && !isDate(end)) return res.status(400).json({ error: 'invalid end date' });
  // Up to ten years so the Workout tab's Lifetime summary is one call.
  if (!Number.isInteger(days) || days < 1 || days > 3660) return res.status(400).json({ error: 'days must be 1 to 3660' });
  const snap = workout.load();
  if (!snap) return notAvailable(res);
  const endDate = end || new Date().toISOString().slice(0, 10);
  res.json({ end: endDate, days, sessions: workout.recent(snap, endDate, days), weights: snap.weights || [], exported_at: snap.exported_at });
}));

router.get('/workout/catalog', asyncHandler(async (req, res) => {
  const snap = workout.load();
  if (!snap) return notAvailable(res);
  res.json({ templates: snap.templates || [], plan: snap.plan || null, media: workout.media(), exported_at: snap.exported_at });
}));

// The app's own exercise clip / thumbnail for an action id, shipped by the Mac's
// sync into workout-state/media. sendFile answers Range requests, so <video> can seek.
router.get('/workout/media/:kind/:id', (req, res) => {
  if (req.params.kind !== 'video' && req.params.kind !== 'thumb') return res.status(404).json({ error: 'unknown media kind' });
  const file = workout.mediaPath(req.params.kind, req.params.id);
  if (!file) return res.status(404).json({ error: `no ${req.params.kind} for exercise ${req.params.id}` });
  res.sendFile(file, { headers: { 'Cache-Control': 'private, max-age=86400' } });
});

module.exports = router;
