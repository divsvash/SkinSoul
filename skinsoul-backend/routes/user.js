// ============================================================
//  routes/user.js — User Profile CRUD
//  Database: SQLite via better-sqlite3
// ============================================================

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

// ── GET /api/user/profile ────────────────────────────────────
router.get('/profile', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, name, email, age, city, gender, created_at, updated_at FROM users WHERE id = ?'
  ).get(req.user.id);

  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
});

// ── PATCH /api/user/profile — update name, city, age, gender ─
router.patch('/profile', requireAuth, (req, res) => {
  const { name, city, age, gender } = req.body;

  const fields = [];
  const values = [];

  if (name !== undefined)   { fields.push('name = ?');   values.push(name.trim()); }
  if (city !== undefined)   { fields.push('city = ?');   values.push(city.trim()); }
  if (age !== undefined)    { fields.push('age = ?');    values.push(age); }
  if (gender !== undefined) { fields.push('gender = ?'); values.push(gender); }

  if (!fields.length) {
    return res.status(400).json({ error: 'No fields provided to update.' });
  }

  fields.push("updated_at = datetime('now')");
  values.push(req.user.id);

  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare(
    'SELECT id, name, email, age, city, gender, updated_at FROM users WHERE id = ?'
  ).get(req.user.id);

  res.json({ message: 'Profile updated.', user: updated });
});

module.exports = router;
