// ============================================================
//  routes/report.js — AI-Generated Skin Reports
//  Database: SQLite via better-sqlite3
// ============================================================

const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const {
  generatePersonalisedReport,
  generateDermatologistReport,
  generateSkinTip,
} = require('../services/aiService');
const db = require('../database');

const router = express.Router();

const reportLimiter = rateLimit({
  windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: 15,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { error: 'Report generation limit reached. Please wait a moment.' },
});

// ── Helper: get latest analysis from DB ──────────────────────
function getLatestAnalysis(userId) {
  const row = db.prepare(
    'SELECT * FROM analyses WHERE user_id = ? ORDER BY analysed_at DESC LIMIT 1'
  ).get(userId);

  if (!row) return null;
  return { id: row.id, analysedAt: row.analysed_at, result: JSON.parse(row.result) };
}

// ── Helper: get lifestyle data from DB ───────────────────────
function getLifestyle(userId) {
  const row = db.prepare('SELECT * FROM lifestyles WHERE user_id = ?').get(userId);
  if (!row) return null;

  const user = db.prepare('SELECT name, age, city, gender FROM users WHERE id = ?').get(userId);

  return {
    name:     user?.name,
    age:      user?.age,
    city:     user?.city,
    gender:   user?.gender,
    diet:     row.diet     ? JSON.parse(row.diet)     : null,
    exercise: row.exercise ? JSON.parse(row.exercise) : null,
    sleep:    row.sleep    ? JSON.parse(row.sleep)    : null,
    medical:  row.medical  ? JSON.parse(row.medical)  : null,
    skincare: row.skincare ? JSON.parse(row.skincare) : null,
  };
}

// ── GET /api/report/user ─────────────────────────────────────
router.get('/user', requireAuth, reportLimiter, async (req, res, next) => {
  try {
    const latest = getLatestAnalysis(req.user.id);
    if (!latest) {
      return res.status(404).json({
        error: 'No skin scan found. Please complete a skin scan first to generate your report.',
      });
    }

    const lifestyle = getLifestyle(req.user.id);
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);

    console.log(`[REPORT] Generating personalised report for ${req.user.name}`);

    const report = await generatePersonalisedReport(latest.result, lifestyle, user?.name || req.user.name);

    res.json({
      success:     true,
      generatedAt: new Date().toISOString(),
      basedOnScan: latest.analysedAt,
      report,
    });
  } catch (err) { next(err); }
});

// ── GET /api/report/clinical ─────────────────────────────────
router.get('/clinical', requireAuth, reportLimiter, async (req, res, next) => {
  try {
    const latest = getLatestAnalysis(req.user.id);
    if (!latest) {
      return res.status(404).json({ error: 'No skin scan found. Please complete a skin scan first.' });
    }

    const lifestyle = getLifestyle(req.user.id);
    const user = db.prepare('SELECT name, age, gender, city FROM users WHERE id = ?').get(req.user.id);

    console.log(`[REPORT] Generating clinical report for ${req.user.name}`);

    const clinicalReport = await generateDermatologistReport(latest.result, lifestyle, user || {});

    res.json({
      success:     true,
      generatedAt: new Date().toISOString(),
      patientName: user?.name,
      basedOnScan: latest.analysedAt,
      report:      clinicalReport,
    });
  } catch (err) { next(err); }
});

// ── GET /api/report/tip?concern=acne ────────────────────────
router.get('/tip', requireAuth, reportLimiter, async (req, res, next) => {
  try {
    const { concern } = req.query;
    const user = db.prepare('SELECT city FROM users WHERE id = ?').get(req.user.id);
    const city = user?.city || 'Delhi';

    const month  = new Date().getMonth();
    const season = month >= 2 && month <= 5 ? 'summer'
      : month >= 6 && month <= 8 ? 'monsoon'
      : month >= 9 && month <= 10 ? 'autumn'
      : 'winter';

    const tip = await generateSkinTip(concern || 'general skin health', city, season);
    res.json({ tip, city, season });
  } catch (err) { next(err); }
});

// ── GET /api/report/summary — lightweight, no AI call ───────
router.get('/summary', requireAuth, (req, res) => {
  const latest = getLatestAnalysis(req.user.id);
  if (!latest) {
    return res.status(404).json({ error: 'No analysis found.' });
  }

  const { skinScore, skinType, hydrationLevel, concerns, positives } = latest.result;

  res.json({
    lastScan:    latest.analysedAt,
    skinScore,
    skinType,
    hydrationLevel,
    topConcerns: (concerns  || []).slice(0, 3),
    positives:   (positives || []).slice(0, 3),
  });
});

module.exports = router;
