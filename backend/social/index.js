// Social tab: the TikTok tracker's data, read-only, plus the Claude review of the
// recent videos. Nothing here writes to the tracker db; the review rows live in planner.db.
const { Router } = require('express');
const social = require('./service');
const review = require('./review');
const comp = require('./competitors');
const compJobs = require('./competitorJobs');
const thumbs = require('./thumbs');
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

// -- Competitors card --------------------------------------------------------------

router.get('/social/competitors', asyncHandler(async (req, res) => {
  const p = await comp.payload();
  res.json({ ...p, job_running: compJobs.isRunning() });
}));

// What the TikTok tracker's daily pass reads (research.py competitors / discover-weekly).
router.get('/social/competitors/handles', asyncHandler(async (req, res) => {
  res.json(await comp.listing());
}));

// {handle, action: add | remove}
router.post('/social/competitors/handles', asyncHandler(async (req, res) => {
  const { handle, action } = req.body || {};
  const { status, body } = await comp.changeHandle(String(action || 'add'), handle);
  res.status(status).json(body);
}));

// {niche}
router.put('/social/competitors/settings', asyncHandler(async (req, res) => {
  const { niche } = req.body || {};
  if (niche !== undefined) {
    const text = String(niche).replace(/\s+/g, ' ').trim();
    if (text.length < 20 || text.length > 600) return res.status(400).json({ error: 'niche must be 20 to 600 characters' });
    await comp.setSetting('niche', text);
  }
  res.json({ niche: await comp.niche() });
}));

// A competitor video's cover from the server's cache (filled by the competitor job). Covers never
// change, so the browser may keep them for 30 days.
router.get('/social/thumb/:id', (req, res) => {
  if (!thumbs.isVideoId(req.params.id)) return res.status(400).json({ error: 'invalid video id' });
  if (!thumbs.has(req.params.id)) return res.status(404).json({ error: 'no cover cached' });
  res.set('Cache-Control', 'public, max-age=2592000, immutable');
  return res.sendFile(thumbs.fileFor(req.params.id));
});

router.put('/social/competitors/saves/:id', asyncHandler(async (req, res) => {
  if (!isVideoId(req.params.id)) return res.status(400).json({ error: 'invalid video id' });
  await comp.saveVideo(req.params.id, (req.body || {}).note);
  res.json({ saved: true });
}));

router.delete('/social/competitors/saves/:id', asyncHandler(async (req, res) => {
  if (!isVideoId(req.params.id)) return res.status(400).json({ error: 'invalid video id' });
  await comp.unsaveVideo(req.params.id);
  res.json({ saved: false });
}));

module.exports = router;
module.exports.startReviewScheduler = review.startReviewScheduler;
module.exports.startCompetitorScheduler = compJobs.startCompetitorScheduler;
