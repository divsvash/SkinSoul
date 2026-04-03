// ============================================================
//  routes/water.js — Daily Water Intake Tracker
//  Database: SQLite via better-sqlite3
// ============================================================

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

// ── Helper: today's date as YYYY-MM-DD ───────────────────────
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// ── Helper: get or create today's log row ───────────────────
function ensureToday(userId) {
  const today = todayKey();

  // Try to fetch existing row
  let row = db.prepare(
    'SELECT * FROM water_logs WHERE user_id = ? AND date = ?'
  ).get(userId, today);

  // Create it if it doesn't exist
  if (!row) {
    db.prepare(
      'INSERT OR IGNORE INTO water_logs (id, user_id, date) VALUES (?, ?, ?)'
    ).run(uuidv4(), userId, today);

    row = db.prepare(
      'SELECT * FROM water_logs WHERE user_id = ? AND date = ?'
    ).get(userId, today);
  }

  return row;
}

// ── GET /api/water — today's count and goal ──────────────────
router.get('/', requireAuth, (req, res) => {
  const row = ensureToday(req.user.id);
  res.json({
    date:  todayKey(),
    count: row.count,
    goal:  row.goal,
  });
});

// ── POST /api/water/add — log one glass ─────────────────────
router.post('/add', requireAuth, (req, res) => {
  const row = ensureToday(req.user.id);

  if (row.count >= row.goal) {
    return res.json({
      message:     "You've already hit your water goal today! 🎉",
      count:       row.count,
      goal:        row.goal,
      goalReached: true,
    });
  }

  // Append timestamp to the logs JSON array
  const logs = JSON.parse(row.logs || '[]');
  logs.push(new Date().toISOString());

  db.prepare(`
    UPDATE water_logs
    SET count = count + 1, logs = ?
    WHERE user_id = ? AND date = ?
  `).run(JSON.stringify(logs), req.user.id, todayKey());

  const updated = db.prepare(
    'SELECT * FROM water_logs WHERE user_id = ? AND date = ?'
  ).get(req.user.id, todayKey());

  res.json({
    message:     `Glass logged! ${updated.count}/${updated.goal} 💧`,
    count:       updated.count,
    goal:        updated.goal,
    goalReached: updated.count >= updated.goal,
  });
});

// ── PATCH /api/water/goal — update daily goal ───────────────
router.patch('/goal', requireAuth, (req, res) => {
  const { goal } = req.body;

  if (!goal || goal < 1 || goal > 20) {
    return res.status(400).json({ error: 'Goal must be between 1 and 20 glasses.' });
  }

  ensureToday(req.user.id); // Make sure the row exists first

  db.prepare(`
    UPDATE water_logs SET goal = ? WHERE user_id = ? AND date = ?
  `).run(parseInt(goal), req.user.id, todayKey());

  res.json({ message: 'Daily water goal updated.', goal: parseInt(goal) });
});

// ── DELETE /api/water/reset — reset today's count to 0 ──────
router.delete('/reset', requireAuth, (req, res) => {
  ensureToday(req.user.id);

  db.prepare(`
    UPDATE water_logs SET count = 0, logs = '[]' WHERE user_id = ? AND date = ?
  `).run(req.user.id, todayKey());

  res.json({ message: "Today's water log reset.", count: 0 });
});

// ── GET /api/water/history — last 7 days ────────────────────
router.get('/history', requireAuth, (req, res) => {
  const days = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);

    const row = db.prepare(
      'SELECT count, goal FROM water_logs WHERE user_id = ? AND date = ?'
    ).get(req.user.id, key);

    days.push({ date: key, count: row?.count || 0, goal: row?.goal || 8 });
  }

  res.json({ history: days });
});

module.exports = router;
