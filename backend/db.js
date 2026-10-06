const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// PLANNER_DB_PATH lets the tests open a throwaway file instead of the real database.
const DB_PATH = process.env.PLANNER_DB_PATH || path.join(__dirname, 'planner.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open SQLite DB:', err);
    process.exit(1);
  }
});

// Two processes may write at once (the backend and scripts/health-fetch.js): wait up to
// 5 s for the lock instead of failing with SQLITE_BUSY.
db.configure('busyTimeout', 5000);

db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    priority TEXT,
    priority_num INTEGER,
    text TEXT NOT NULL,
    status TEXT DEFAULT 'in_process',
    order_index INTEGER DEFAULT 0,
    forwarded_from TEXT,
    forwarded_to TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date)`);
  db.run(`ALTER TABLE tasks ADD COLUMN parent_id INTEGER`, () => {});

  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    hour INTEGER,
    start_at TEXT,
    end_at TEXT,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_appts_date ON appointments(date)`);

  // For DBs created before start_at/end_at existed: best-effort ALTER (ignore if already there).
  db.run(`ALTER TABLE appointments ADD COLUMN start_at TEXT`, () => {});
  db.run(`ALTER TABLE appointments ADD COLUMN end_at TEXT`, () => {});

  // Migrate legacy hour-only rows to start_at/end_at.
  db.run(
    `UPDATE appointments
        SET start_at = printf('%sT%02d:00', date, hour),
            end_at   = printf('%sT%02d:00', date, hour + 1)
      WHERE start_at IS NULL AND hour IS NOT NULL`
  );

  // SQLite can't ALTER away the legacy "hour INTEGER NOT NULL" constraint —
  // rebuild the table when the old schema is detected.
  db.get(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='appointments'`,
    (err, row) => {
      if (err || !row || !row.sql || !row.sql.includes('hour INTEGER NOT NULL')) return;
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(`CREATE TABLE appointments_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          hour INTEGER,
          start_at TEXT,
          end_at TEXT,
          text TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(
          `INSERT INTO appointments_new (id, date, hour, start_at, end_at, text, created_at, updated_at)
           SELECT id, date, hour, start_at, end_at, text, created_at, updated_at FROM appointments`
        );
        db.run('DROP TABLE appointments');
        db.run('ALTER TABLE appointments_new RENAME TO appointments');
        db.run(`CREATE INDEX IF NOT EXISTS idx_appts_date ON appointments(date)`);
        db.run('COMMIT', (commitErr) => {
          if (commitErr) console.error('appointments rebuild failed:', commitErr);
          else console.log('appointments table rebuilt (relaxed NOT NULL on hour)');
        });
      });
    }
  );

  db.run(`CREATE TABLE IF NOT EXISTS calendar_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    email TEXT,
    display_name TEXT,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_cal_provider ON calendar_accounts(provider)`);
  // Dedupe legacy rows from when "+ Connect" used to INSERT instead of UPSERT —
  // keep the most recent row per (provider, email); leave NULL-email rows alone.
  db.run(
    `DELETE FROM calendar_accounts
      WHERE email IS NOT NULL
        AND id NOT IN (
          SELECT MAX(id) FROM calendar_accounts
           WHERE email IS NOT NULL
           GROUP BY provider, email
        )`
  );
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_cal_provider_email
       ON calendar_accounts(provider, email)`
  );

  db.run(`CREATE TABLE IF NOT EXISTS daily_notes (
    date TEXT PRIMARY KEY,
    content TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS daily_note_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    text TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_note_entries_date ON daily_note_entries(date)`);
  db.run(`ALTER TABLE daily_note_entries ADD COLUMN parent_id INTEGER`, () => {});
  db.run(`ALTER TABLE daily_note_entries ADD COLUMN forwarded_to TEXT`, () => {});

  db.run(`CREATE TABLE IF NOT EXISTS daily_tracker (
    date TEXT PRIMARY KEY,
    content TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS master_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    category TEXT NOT NULL,
    text TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_master_ym ON master_tasks(year, month)`);

  db.run(`CREATE TABLE IF NOT EXISTS ongoing_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    parent_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ongoing_order ON ongoing_items(order_index)`);

  db.run(`CREATE TABLE IF NOT EXISTS quotes (
    date TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    author TEXT,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_text ON quotes(text)`);

  // Garmin Connect read results (garmin/service.js), keyed by endpoint name + sorted kwargs JSON.
  db.run(`CREATE TABLE IF NOT EXISTS garmin_cache (
    name TEXT NOT NULL,
    params TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    payload TEXT,
    PRIMARY KEY (name, params)
  )`);

  // Records that a day's incomplete items were pulled forward, so the nightly
  // auto-rollover skips days already handled (manually or by a prior auto run).
  // `date` is the SOURCE day (its leftovers moved to date + 1).
  // Claude reviews of the recent TikTok videos (social/review.js): the numbers the
  // model saw (stats_json) beside its text (result_json). Failed runs keep a row too,
  // with `error` set; the throttle counts every row.
  db.run(`CREATE TABLE IF NOT EXISTS social_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    generated_at TEXT NOT NULL,
    trigger TEXT,
    window_start TEXT,
    window_end TEXT,
    video_count INTEGER,
    newest_video_id TEXT,
    model TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    duration_ms INTEGER,
    stats_json TEXT,
    result_json TEXT,
    error TEXT
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_social_reviews_at ON social_reviews(generated_at)`);

  // Competitors card (social/competitors*.js). The watchlist lives here; the TikTok
  // tracker reads it from GET /api/social/competitors/handles and writes research.db.
  // status: watch | removed | dismissed (a proposed account the user said no to).
  db.run(`CREATE TABLE IF NOT EXISTS social_competitors (
    handle TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    added_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  db.run(`INSERT OR IGNORE INTO social_competitors (handle, status, added_at, updated_at)
    SELECT h, 'watch', datetime('now'), datetime('now') FROM (
      SELECT 'austingeorgas' AS h UNION ALL SELECT 'farzyspeaks' UNION ALL SELECT 'zancarver'
      UNION ALL SELECT 'rickyireland' UNION ALL SELECT 'scottygange')
    WHERE NOT EXISTS (SELECT 1 FROM social_competitors)`);
  // Small settings: the niche definition, the discovery hashtags, the own follower count.
  db.run(`CREATE TABLE IF NOT EXISTS social_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
  )`);
  // Haiku's niche score per video and niche text (niche_hash): 3 core, 2 in niche, 1 adjacent, 0 off.
  db.run(`CREATE TABLE IF NOT EXISTS social_competitor_relevance (
    video_id TEXT NOT NULL,
    niche_hash TEXT NOT NULL,
    score INTEGER NOT NULL,
    topic TEXT,
    model TEXT,
    scored_at TEXT NOT NULL,
    PRIMARY KEY (video_id, niche_hash)
  )`);
  // Hook move + format per video and prompt version (label_hash).
  db.run(`CREATE TABLE IF NOT EXISTS social_competitor_labels (
    video_id TEXT NOT NULL,
    label_hash TEXT NOT NULL,
    move TEXT,
    format TEXT,
    text_overlay INTEGER,
    model TEXT,
    labeled_at TEXT NOT NULL,
    PRIMARY KEY (video_id, label_hash)
  )`);
  // Top comments of on-niche outliers (read unsigned from TikTok's comment list), tagged by Haiku.
  db.run(`CREATE TABLE IF NOT EXISTS social_competitor_comments (
    video_id TEXT NOT NULL,
    cid TEXT NOT NULL,
    text TEXT,
    likes INTEGER,
    replies INTEGER,
    created_at INTEGER,
    read_at TEXT NOT NULL,
    tag TEXT,
    PRIMARY KEY (video_id, cid)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS social_comment_reads (
    video_id TEXT PRIMARY KEY,
    read_at TEXT NOT NULL,
    status TEXT,
    kept INTEGER
  )`);
  // The saved board: bookmarked competitor videos with a note.
  db.run(`CREATE TABLE IF NOT EXISTS social_competitor_saves (
    video_id TEXT PRIMARY KEY,
    note TEXT,
    saved_at TEXT NOT NULL
  )`);
  // One row per analysis job run (relevance, labels, comments), started before any work.
  db.run(`CREATE TABLE IF NOT EXISTS social_competitor_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    scored INTEGER,
    labeled INTEGER,
    comment_videos INTEGER,
    tagged INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    error TEXT,
    thumbs INTEGER
  )`);
  db.run('ALTER TABLE social_competitor_runs ADD COLUMN thumbs INTEGER', () => {});

  db.run(`CREATE TABLE IF NOT EXISTS pull_forward_runs (
    date TEXT PRIMARY KEY,
    trigger TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // The Health tab's store (health/ingest.js). One row per Garmin calendar date and
  // metric: `value` is the small JSON the cards read, `payload` the full response of
  // every Garmin call the metric was derived from (keyed by call), `taken_at` Garmin's
  // own timestamp for the reading (a write never moves it backwards), `final` set only
  // once the day is over and the watch has synced past midnight. Nothing here is a
  // cache: rows are never expired, only superseded by a newer reading.
  db.run(`CREATE TABLE IF NOT EXISTS health_days (
    date TEXT NOT NULL,
    metric TEXT NOT NULL,
    value TEXT,
    payload TEXT,
    taken_at TEXT,
    fetched_at INTEGER NOT NULL,
    final INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (date, metric)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS health_activities (
    activity_id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    type TEXT,
    name TEXT,
    start_local TEXT,
    duration_s REAL,
    distance_m REAL,
    calories INTEGER,
    avg_hr INTEGER,
    max_hr INTEGER,
    sets INTEGER,
    reps INTEGER,
    polyline TEXT,
    payload TEXT,
    taken_at TEXT,
    fetched_at INTEGER NOT NULL
  )`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_health_activities_date ON health_activities(date)`);
  // One row per ingest run, inserted with started_at before any work so a run that
  // dies shows as a row without finished_at. The call counters separate what the
  // run took from garmin_cache from what went to Garmin.
  db.run(`CREATE TABLE IF NOT EXISTS health_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    kind TEXT NOT NULL,
    dates TEXT,
    ok INTEGER,
    failed INTEGER,
    written INTEGER,
    unchanged INTEGER,
    stale INTEGER,
    errors TEXT,
    dry_run INTEGER NOT NULL DEFAULT 0,
    calls_total INTEGER,
    calls_cached INTEGER,
    calls_garmin INTEGER
  )`);
});

const run = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve({ lastID: this.lastID, changes: this.changes });
  });
});

const get = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const all = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

module.exports = { run, get, all };
