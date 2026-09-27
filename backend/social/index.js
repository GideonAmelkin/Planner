// Social tab: the TikTok tracker's data, read-only, plus the Claude review of the
// recent videos. Nothing here writes to the tracker db; the review rows live in planner.db.
const { Router } = require('express');
const social = require('./service');
const review = require('./review');
const { asyncHandler } = require('../lib/http');

const router = Router();

const notAvailable = (res) => res.status(404).json({ available: false, error: 'the TikTok tracker database is not on this server' });
const isVideoId = (s) => /^\d{5,25}$/.test(String(s));

router.get('/social/status', asyncHandler(async (req, res) => {
  const st = await social.status();
  res.json({ ...st, review: { has_key: review.hasKey(), running: review.isRunning() } });
}));

router.get('/social/videos', asyncHandler(async (req, res) => {
  const rows = await social.rows();
  if (!rows) return notAvailable(res);
  const summary = social.summary(rows, social.stat());
  res.json({ summary, videos: rows, updated_at: summary.updated_at });
}));

router.get('/social/videos/:id', asyncHandler(async (req, res) => {
  if (!isVideoId(req.params.id)) return res.status(400).json({ error: 'invalid video id' });
  if (!social.stat()) return notAvailable(res);
  const row = await social.video(req.params.id);
  if (!row) return res.status(404).json({ error: 'unknown video' });
  res.json(row);
}));

router.get('/social/review', asyncHandler(async (req, res) => {
  const cur = await review.current();
  res.status(cur.available ? 200 : 404).json(cur);
}));

router.post('/social/review/generate', asyncHandler(async (req, res) => {
  const { status, body } = await review.requestGenerate('manual');
  res.status(status).json(body);
}));

module.exports = router;
module.exports.startReviewScheduler = review.startReviewScheduler;
