// Competitors card: the multiple matches the tracker's Python rule on the same data, the
// watchlist rules, and the payload's niche filter over a throwaway research.db.
const os = require('os');
const path = require('path');
process.env.PLANNER_DB_PATH = path.join(os.tmpdir(), `planner-comp-test-${process.pid}.db`);
process.env.RESEARCH_DB_PATH = path.join(os.tmpdir(), `research-comp-test-${process.pid}.db`);
process.env.SOCIAL_THUMB_DIR = path.join(os.tmpdir(), `thumbs-comp-test-${process.pid}`);
delete process.env.ANTHROPIC_API_KEY;

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { run } = require('../db');
const comp = require('../social/competitors');
const { localISO } = require('../lib/dates');

const fixture = require('./fixtures-competitors-multiples.json');

test.after(() => {
  fs.rmSync(process.env.SOCIAL_THUMB_DIR, { recursive: true, force: true });
  for (const p of [process.env.PLANNER_DB_PATH, process.env.RESEARCH_DB_PATH]) {
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(p + suffix, { force: true });
  }
});

test('multiplesFor matches selection.multiples_for (Python) on 80 videos', () => {
  const got = comp.multiplesFor(fixture.videos, '2026-10-05');
  let compared = 0;
  for (const [id, [m, gap]] of Object.entries(fixture.expected)) {
    const g = got.get(id);
    assert.equal(g.multiple, m, `multiple for ${id}`);
    if (m !== null) assert.equal(g.gap, gap, `gap for ${id}`);
    compared += 1;
  }
  assert.equal(compared, 80);
});

test('bands relative to the own follower count', () => {
  assert.equal(comp.band(12000, 5000), 'Near');
  assert.equal(comp.band(50000, 5000), '10x');
  assert.equal(comp.band(562300, 5000), '100x+');
  assert.equal(comp.band(null, 5000), null);
});

test('watchlist: seeded, validated, capped, soft removal', async () => {
  const list = await comp.listing();
  assert.deepEqual(list.watch, ['austingeorgas', 'farzyspeaks', 'rickyireland', 'scottygange', 'zancarver']);
  assert.equal((await comp.changeHandle('add', 'not a handle!')).status, 400);
  assert.equal((await comp.changeHandle('add', '@New.Person')).body.handle, 'new.person');
  assert.equal((await comp.changeHandle('remove', 'new.person')).body.status, 'removed');
  for (let i = 0; i < comp.MAX_WATCH - 5; i++) await comp.changeHandle('add', `extra${i}`);
  assert.equal((await comp.changeHandle('add', 'onetoomany')).status, 409);
  assert.equal((await comp.changeHandle('add', 'scottygange')).status, 200, 're-adding a watched handle is fine at the cap');
  for (let i = 0; i < comp.MAX_WATCH - 5; i++) await comp.changeHandle('remove', `extra${i}`);
  assert.deepEqual((await comp.listing()).removed.includes('new.person'), true);
});

function researchDb(rows) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(process.env.RESEARCH_DB_PATH);
    db.serialize(() => {
      db.run(`CREATE TABLE accounts (handle TEXT PRIMARY KEY, source TEXT, added_at TEXT, last_walk_at TEXT, status TEXT,
        followers INTEGER, last_video_count INTEGER, last_probe_at TEXT, last_popular_at TEXT, last_cut_at TEXT,
        deep_walked_at TEXT, discovery_json TEXT)`);
      db.run(`CREATE TABLE research_videos (video_id TEXT PRIMARY KEY, handle TEXT, url TEXT, caption TEXT, date_posted TEXT,
        duration INTEGER, views INTEGER, likes INTEGER, comments INTEGER, saves INTEGER, shares INTEGER, in_popular INTEGER,
        music_id TEXT, music_title TEXT, music_author TEXT, music_original INTEGER, author_followers INTEGER,
        create_time INTEGER, first_seen_views INTEGER, first_seen_age_h REAL, is_photo INTEGER, discovered_tag TEXT)`);
      db.run(`CREATE TABLE hooks (video_id TEXT PRIMARY KEY, whisper_model TEXT, hook_transcript TEXT, setup_transcript TEXT,
        full_transcript TEXT, onscreen_text_json TEXT, visual_json TEXT, duration REAL, error TEXT, cause TEXT, attempts INTEGER)`);
      db.run('CREATE TABLE research_snapshots (video_id TEXT, read_at TEXT, views INTEGER)');
      db.run("INSERT INTO accounts (handle, status, followers, deep_walked_at) VALUES ('scottygange', 'watch', 562300, '2026-10-01')");
      for (const r of rows) {
        db.run(`INSERT INTO research_videos (video_id, handle, url, date_posted, views, likes, comments, saves, shares, music_id, music_original)
          VALUES (?, 'scottygange', ?, ?, ?, 1, 1, ?, 1, ?, ?)`, [r.id, `https://www.tiktok.com/@scottygange/video/${r.id}`, r.day, r.views, r.saves || 0, r.music || null, r.music ? 0 : null]);
        db.run("INSERT INTO hooks (video_id, whisper_model, hook_transcript, onscreen_text_json, visual_json) VALUES (?, 'small', ?, '[]', '[]')", [r.id, `line ${r.id}`]);
      }
    });
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

test('payload: on-niche outliers only, adjacent strip, off-niche counted, saves joined', async () => {
  const today = localISO();
  const day = (n) => comp.isoDaysAgo(n, today);
  // 30 normal posts (1,000 views) from 8 to 60 days ago, plus three 10x posts 8 days ago with different scores.
  const rows = [];
  for (let i = 0; i < 30; i++) rows.push({ id: String(7100000000000000000n + BigInt(i)), day: day(10 + i * 2), views: 1000 });
  rows.push({ id: '7200000000000000001', day: day(8), views: 10000, saves: 50 });
  rows.push({ id: '7200000000000000002', day: day(8), views: 10000 });
  rows.push({ id: '7200000000000000003', day: day(8), views: 10000 });
  await researchDb(rows);
  const nh = comp.nicheHash(await comp.niche());
  const score = (id, s) => run('INSERT INTO social_competitor_relevance (video_id, niche_hash, score, scored_at) VALUES (?, ?, ?, ?)', [id, nh, s, 'x']);
  await score('7200000000000000001', 3);
  await score('7200000000000000002', 1);
  await score('7200000000000000003', 0);
  await comp.saveVideo('7200000000000000001', 'study the pacing');
  const p = await comp.payload();
  const a = p.accounts.find((x) => x.handle === 'scottygange');
  assert.deepEqual(a.outliers.map((o) => o.video_id), ['7200000000000000001']);
  assert.equal(a.outliers[0].multiple, 10);
  assert.equal(a.outliers[0].saves_per_k, 5);
  assert.equal(a.outliers[0].hook, 'line 7200000000000000001');
  assert.deepEqual(a.adjacent.map((o) => o.video_id), ['7200000000000000002']);
  assert.equal(a.off_niche_hidden, 1);
  assert.equal(a.band, '100x+');
  assert.equal(p.saved.length, 1);
  assert.equal(p.saved[0].note, 'study the pacing');
  const winners = await comp.winnersForReview(3);
  assert.equal(winners.length, 1);
  assert.equal(winners[0].opening_line, 'line 7200000000000000001');
});

test('thumb route: 400 bad id, 404 not cached, 200 with a long cache once cached', async () => {
  const { createApp } = require('../app');
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/social/thumb`;
  try {
    assert.equal((await fetch(`${base}/not-an-id`)).status, 400);
    assert.equal((await fetch(`${base}/7200000000000000001`)).status, 404);
    fs.mkdirSync(process.env.SOCIAL_THUMB_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.SOCIAL_THUMB_DIR, '7200000000000000001.jpg'), Buffer.alloc(600, 1));
    const ok = await fetch(`${base}/7200000000000000001`);
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get('cache-control'), /immutable/);
    const p = await comp.payload();
    const row = p.accounts.find((a) => a.handle === 'scottygange').outliers[0];
    assert.equal(row.has_thumb, true);
  } finally {
    server.close();
  }
});

test('coverFromHtml prefers the 240 px zoom cover', () => {
  const { coverFromHtml } = require('../social/thumbs');
  const page = (video) => `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__" type="application/json">${JSON.stringify({ __DEFAULT_SCOPE__: { 'webapp.video-detail': { itemInfo: { itemStruct: { video } } } } })}</script>`;
  assert.equal(coverFromHtml(page({ cover: 'big', zoomCover: { 240: 'small', 480: 'mid' } })), 'small');
  assert.equal(coverFromHtml(page({ cover: 'big' })), 'big');
  assert.equal(coverFromHtml('<html></html>'), null);
});
