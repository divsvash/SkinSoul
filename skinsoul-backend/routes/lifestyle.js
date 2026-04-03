// ============================================================
//  routes/lifestyle.js — Save & retrieve lifestyle profile
//  Database: SQLite via better-sqlite3
// ============================================================

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../database');

const router = express.Router();

const VALID_SECTIONS = ['diet', 'exercise', 'sleep', 'medical', 'skincare'];

// ── Helper: parse a row from the DB into a clean object ──────
function parseLifestyleRow(row) {
  if (!row) return null;
  return {
    userId:   row.user_id,
    diet:     row.diet     ? JSON.parse(row.diet)     : null,
    exercise: row.exercise ? JSON.parse(row.exercise) : null,
    sleep:    row.sleep    ? JSON.parse(row.sleep)    : null,
    medical:  row.medical  ? JSON.parse(row.medical)  : null,
    skincare: row.skincare ? JSON.parse(row.skincare) : null,
    updatedAt: row.updated_at,
  };
}

// ── GET /api/lifestyle ───────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM lifestyles WHERE user_id = ?').get(req.user.id);

  if (!row) {
    return res.json({ lifestyle: null, message: 'No lifestyle data saved yet.' });
  }

  res.json({ lifestyle: parseLifestyleRow(row) });
});

// ── PUT /api/lifestyle ───────────────────────────────────────
// Replace the entire lifestyle profile in one call
router.put('/', requireAuth, (req, res) => {
  const { diet, exercise, sleep, medical, skincare } = req.body;

  db.prepare(`
    INSERT INTO lifestyles (user_id, diet, exercise, sleep, medical, skincare, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      diet      = excluded.diet,
      exercise  = excluded.exercise,
      sleep     = excluded.sleep,
      medical   = excluded.medical,
      skincare  = excluded.skincare,
      updated_at = datetime('now')
  `).run(
    req.user.id,
    diet     ? JSON.stringify(diet)     : null,
    exercise ? JSON.stringify(exercise) : null,
    sleep    ? JSON.stringify(sleep)    : null,
    medical  ? JSON.stringify(medical)  : null,
    skincare ? JSON.stringify(skincare) : null,
  );

  const updated = db.prepare('SELECT * FROM lifestyles WHERE user_id = ?').get(req.user.id);
  res.json({ message: 'Lifestyle profile updated ✓', lifestyle: parseLifestyleRow(updated) });
});

// ── PATCH /api/lifestyle/:section ───────────────────────────
// Update just one section — diet, exercise, sleep, medical, or skincare
router.patch('/:section', requireAuth, (req, res) => {
  const { section } = req.params;

  if (!VALID_SECTIONS.includes(section)) {
    return res.status(400).json({
      error: `Invalid section. Must be one of: ${VALID_SECTIONS.join(', ')}`,
    });
  }

  const data = JSON.stringify(req.body);

  // Upsert: insert a new row if one doesn't exist, otherwise update just this column
  db.prepare(`
    INSERT INTO lifestyles (user_id, ${section}, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      ${section}  = excluded.${section},
      updated_at  = datetime('now')
  `).run(req.user.id, data);

  console.log(`[LIFESTYLE] ${req.user.name} updated section: ${section}`);

  res.json({
    message: `${section.charAt(0).toUpperCase() + section.slice(1)} profile saved ✓`,
    section,
    data: req.body,
  });
});

// ── DELETE /api/lifestyle ────────────────────────────────────
router.delete('/', requireAuth, (req, res) => {
  db.prepare('DELETE FROM lifestyles WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'Lifestyle data cleared.' });
});

module.exports = router;
