const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'planner.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open SQLite DB:', err);
    process.exit(1);
  }
});

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

  // Records that a day's incomplete items were pulled forward, so the nightly
  // auto-rollover skips days already handled (manually or by a prior auto run).
  // `date` is the SOURCE day (its leftovers moved to date + 1).
  db.run(`CREATE TABLE IF NOT EXISTS pull_forward_runs (
    date TEXT PRIMARY KEY,
    trigger TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
