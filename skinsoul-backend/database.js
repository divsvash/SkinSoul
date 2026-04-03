// ============================================================
//  database.js
//  SQLite database setup using better-sqlite3.
//
//  SETUP:
//    1. Run: npm install better-sqlite3
//    2. This file creates skinsoul.db automatically on first run
//    3. Import with: const db = require('./database')
// ============================================================

const Database = require('better-sqlite3');
const path = require('path');

// Creates skinsoul.db in your project root folder
const db = new Database(path.join(__dirname, 'skinsoul.db'), {
  // Uncomment to see every SQL query in terminal (useful for debugging):
  // verbose: console.log,
});

// WAL mode = much better performance for concurrent reads/writes
db.pragma('journal_mode = WAL');
// Enforce foreign key constraints
db.pragma('foreign_keys = ON');

// ── Create all tables if they don't exist yet ─────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password    TEXT NOT NULL,
    age         INTEGER,
    city        TEXT DEFAULT 'Delhi',
    gender      TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    result       TEXT NOT NULL,
    duration_ms  INTEGER,
    analysed_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS lifestyles (
    user_id     TEXT PRIMARY KEY,
    diet        TEXT,
    exercise    TEXT,
    sleep       TEXT,
    medical     TEXT,
    skincare    TEXT,
    updated_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS water_logs (
    id       TEXT PRIMARY KEY,
    user_id  TEXT NOT NULL,
    date     TEXT NOT NULL,
    count    INTEGER DEFAULT 0,
    goal     INTEGER DEFAULT 8,
    logs     TEXT DEFAULT '[]',
    UNIQUE(user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

console.log('[DB] SQLite connected → skinsoul.db');

module.exports = db;