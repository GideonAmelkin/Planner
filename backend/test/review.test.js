// Checking a hook off the Video Recommendations card: the routes' refusals, the slot swap in place,
// the list getting shorter when no reference is left, and checked references never offered again.
const os = require('os');
const path = require('path');
process.env.PLANNER_DB_PATH = path.join(os.tmpdir(), `planner-review-test-${process.pid}.db`);
process.env.RESEARCH_DB_PATH = path.join(os.tmpdir(), `research-review-test-${process.pid}-missing.db`);
process.env.TIKTOK_DB_PATH = path.join(os.tmpdir(), `tiktok-review-test-${process.pid}-missing.db`);
process.env.ANTHROPIC_API_KEY = 'test-key-not-used';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { run, get, all } = require('../db');
const review = require('../social/review');
const comp = require('../social/competitors');
const social = require('../social/service');

const ref = (id, handle, multiple) => ({ video_id: id, url: `https://www.tiktok.com/@${handle}/video/${id}`, handle, band: '100x+', line: `line ${id}`, move: 'Verdict', multiple, has_thumb: true, topic: 'joy', caption: '' });

test.after(() => {
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(process.env.PLANNER_DB_PATH + suffix, { force: true });
});

async function seedReview(refs) {
  const hooks = refs.map((r, i) => ({ ref_video_id: r.video_id, hook: `My hook number ${i + 1}`, move: 'Verdict' }));
  await run(`INSERT INTO social_reviews (generated_at, trigger, window_start, window_end, video_count, newest_video_id, model,
    stats_json, result_json, error) VALUES (?, 'manual/v9', '2026-09-08', '2026-10-08', 1, '1', 'stub', ?, ?, NULL)`,
  [new Date().toISOString(), JSON.stringify({ videos: [], references: refs }), JSON.stringify({ hook_types: [], hooks })]);
}

// Stubs: the tracker window, the next reference, the model.
social.recentWindow = async () => ({ basis: '30 days', start: '2026-09-08', end: '2026-10-08', videos: [], previous_post: null });
social.allTimeBest = async () => [];

test('pickHooks skips excluded (checked) references', () => {
  const o = (id, m) => ({ handle: 'a', video_id: id, multiple: m, hook: `line ${id}`, hook_state: 'ok', hook_source: 'spoken' });
  const got = comp.pickHooks([{ handle: 'a', band: 'Near', outliers: [o('1', 9), o('2', 8), o('3', 7)] }], 10, 3, new Set(['2']));
  assert.deepEqual(got.map((h) => h.video_id), ['1', '3']);
});

test('check: 400 bad id, 404 not on the card, then the slot is replaced in place and the reference recorded', async () => {
  const { createApp } = require('../app');
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/social/review/hooks`;
  try {
    await seedReview([ref('1001001', 'a', 90), ref('1002001', 'b', 80), ref('1003001', 'c', 70)]);
    assert.equal((await fetch(`${base}/abc/check`, { method: 'POST' })).status, 400);
    assert.equal((await fetch(`${base}/9999999/check`, { method: 'POST' })).status, 404);

    comp.nextReference = async (onCard) => {
      assert.deepEqual(onCard.map((r) => r.video_id), ['1001001', '1003001']);
      return { ...ref('2002001', 'd', 60), transcript: 'start of it' };
    };
    review.setModelCall(async (input, system, schema) => {
      assert.equal(input.references.length, 1);
      assert.deepEqual(input.hooks_on_card, ['My hook number 1', 'My hook number 3']);
      assert.deepEqual(schema.required, ['ref_video_id', 'hook', 'move']);
      return { result: { ref_video_id: 'ignored', hook: 'A brand new line for you', move: 'Reveal' }, usage: {} };
    });
    const res = await fetch(`${base}/1002001/check`, { method: 'POST' });
    assert.equal(res.status, 202);
    await review.whenReplaced();
    const row = await get('SELECT result_json, stats_json FROM social_reviews ORDER BY id DESC LIMIT 1');
    const hooks = JSON.parse(row.result_json).hooks;
    assert.deepEqual(hooks.map((h) => h.ref_video_id), ['1001001', '2002001', '1003001']);
    assert.equal(hooks[1].hook, 'A brand new line for you');
    const refs = JSON.parse(row.stats_json).references;
    assert.ok(refs.some((r) => r.video_id === '2002001' && r.transcript === undefined));
    assert.ok(!refs.some((r) => r.video_id === '1002001'));
    assert.deepEqual((await all('SELECT ref_video_id FROM social_hook_checks')).map((r) => r.ref_video_id), ['1002001']);
    assert.deepEqual([...(await comp.checkedIds())], ['1002001']);
    const cur = await review.current();
    assert.deepEqual(cur.replacing, []);
    assert.equal(cur.replace_cap.used, 1);
  } finally {
    server.close();
  }
});

test('check: no reference left removes the slot; a copy twice keeps the slot and reports an error', async () => {
  comp.nextReference = async () => null;
  assert.equal((await review.requestReplace('1001001')).status, 202);
  await review.whenReplaced();
  let hooks = JSON.parse((await get('SELECT result_json FROM social_reviews ORDER BY id DESC LIMIT 1')).result_json).hooks;
  assert.deepEqual(hooks.map((h) => h.ref_video_id), ['2002001', '1003001']);

  comp.nextReference = async () => ({ ...ref('3003001', 'e', 50), line: 'stay hungry and stay humble every day' });
  review.setModelCall(async () => ({ result: { hook: 'Stay hungry and stay humble, friends.', move: 'Verdict' }, usage: {} }));
  assert.equal((await review.requestReplace('1003001')).status, 202);
  await review.whenReplaced();
  hooks = JSON.parse((await get('SELECT result_json FROM social_reviews ORDER BY id DESC LIMIT 1')).result_json).hooks;
  assert.deepEqual(hooks.map((h) => h.ref_video_id), ['2002001', '1003001']);
  assert.match((await review.current()).replace_errors['1003001'], /copied its reference/);
});

test('check: 429 once the day\'s cap is used', async () => {
  const now = new Date().toISOString();
  for (let i = 0; i < 20; i++) await run('INSERT OR IGNORE INTO social_hook_checks (ref_video_id, hook, checked_at) VALUES (?, ?, ?)', [`50${i}`, 'x', now]);
  assert.equal((await review.requestReplace('2002001')).status, 429);
  review.setModelCall(null);
});
