// Competitor video covers for the Competitors card, cached on the server's disk once per video.
// A cover is read signed out: one GET of the public video page for itemStruct.video.zoomCover (240 px), then
// the image. TikTok's cover URLs are signed and expire, so the card never links to them directly;
// it asks GET /api/social/thumb/:id, which serves this cache. Covers do not change, so a cached
// file is never refetched. The folder is server-only data (gitignored, refused by push.sh).
const fs = require('fs');
const path = require('path');

const DIR = process.env.SOCIAL_THUMB_DIR || path.join(__dirname, '..', 'social-state', 'thumbs');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const isVideoId = (s) => /^\d{5,25}$/.test(String(s));

const fileFor = (id) => path.join(DIR, `${id}.jpg`);
const has = (id) => isVideoId(id) && fs.existsSync(fileFor(id));

// Every cached id, for the payload's has_thumb flags (one readdir, not one stat per video).
function cachedIds() {
  try {
    return new Set(fs.readdirSync(DIR).filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4)));
  } catch (err) {
    if (err.code === 'ENOENT') return new Set();
    throw err;
  }
}

// The cover URL from a video page, or null.
function coverFromHtml(html) {
  const m = html.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  let data;
  try { data = JSON.parse(m[1]); } catch (_) { return null; }
  const item = (((data.__DEFAULT_SCOPE__ || {})['webapp.video-detail'] || {}).itemInfo || {}).itemStruct || {};
  const video = item.video || {};
  // zoomCover holds TikTok's own resized covers keyed by width; 240 px is plenty for a 34 px cell on a
  // retina screen (the plain cover is 1080x1920, about 250 KB).
  const zoom = video.zoomCover || {};
  return zoom['240'] || zoom['480'] || video.cover || video.originCover || null;
}

// Fetch and store one cover. Returns 'ok' | 'no cover' | 'refused <why>'. A refusal (HTTP error,
// a page without its JSON) tells the caller to stop the run.
async function fetchCover(id, url) {
  const page = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
  if (!page.ok) return `refused http ${page.status}`;
  const html = await page.text();
  if (!html.includes('__UNIVERSAL_DATA_FOR_REHYDRATION__')) return 'refused no page json';
  const cover = coverFromHtml(html);
  if (!cover) return 'no cover';
  const img = await fetch(cover, { headers: { 'User-Agent': UA, Referer: 'https://www.tiktok.com/' } });
  if (!img.ok) return `refused image http ${img.status}`;
  const bytes = Buffer.from(await img.arrayBuffer());
  if (bytes.length < 500) return 'no cover';
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = `${fileFor(id)}.tmp`;
  fs.writeFileSync(tmp, bytes);
  fs.renameSync(tmp, fileFor(id));
  return 'ok';
}

module.exports = { DIR, isVideoId, fileFor, has, cachedIds, coverFromHtml, fetchCover };
