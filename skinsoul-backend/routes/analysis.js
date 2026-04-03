// ============================================================
//  routes/analysis.js — AI Skin Image Analysis
//  Database: SQLite via better-sqlite3
//
//  POST /api/analysis/scan    — upload image, run AI analysis
//  GET  /api/analysis/history — last 10 scans (summary)
//  GET  /api/analysis/latest/result — most recent full result
//  GET  /api/analysis/:id     — single analysis by ID
// ============================================================

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { requireAuth } = require('../middleware/auth');
const { analyzeSkinImage } = require('../services/aiService');
const db = require('../database');

const router = express.Router();

// ── AI-specific rate limiter ─────────────────────────────────
const aiLimiter = rateLimit({
  windowMs: parseInt(process.env.AI_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: parseInt(process.env.AI_RATE_LIMIT_MAX) || 10,
  message: { error: 'AI analysis rate limit reached. Please wait a moment before scanning again.' },
  keyGenerator: (req) => req.user?.id || req.ip,
});

// ── Multer — memory storage ──────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10 MB
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG and WebP images are accepted.'));
    }
  },
});

// ── Helper: get lifestyle data for a user ────────────────────
function getUserLifestyle(userId) {
  const row = db.prepare('SELECT * FROM lifestyles WHERE user_id = ?').get(userId);
  if (!row) return null;

  // Get user info too so AI has full context
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

// ── POST /api/analysis/scan ──────────────────────────────────
router.post(
  '/scan',
  requireAuth,
  aiLimiter,
  upload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided. Please upload a JPEG or PNG photo.' });
      }

      // Optimise image with sharp — resize to max 1024px, saves API tokens
      const optimised = await sharp(req.file.buffer)
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const imageBase64 = optimised.toString('base64');
      const mimeType = 'image/jpeg';

      // Fetch full lifestyle + user context from database
      const lifestyle = getUserLifestyle(req.user.id);

      console.log(`[AI] Starting skin analysis for user: ${req.user.name}`);
      const startTime = Date.now();

      // Call Anthropic Claude Vision API
      const analysisResult = await analyzeSkinImage(imageBase64, mimeType, lifestyle);

      const duration = Date.now() - startTime;
      console.log(`[AI] Analysis complete in ${duration}ms. Score: ${analysisResult.skinScore}`);

      // Save result to SQLite
      const id = uuidv4();
      db.prepare(`
        INSERT INTO analyses (id, user_id, result, duration_ms)
        VALUES (?, ?, ?, ?)
      `).run(id, req.user.id, JSON.stringify(analysisResult), duration);

      // Keep only the last 10 analyses per user — delete older ones
      const allIds = db.prepare(
        'SELECT id FROM analyses WHERE user_id = ? ORDER BY analysed_at DESC'
      ).all(req.user.id).map(r => r.id);

      if (allIds.length > 10) {
        const toDelete = allIds.slice(10);
        const placeholders = toDelete.map(() => '?').join(',');
        db.prepare(`DELETE FROM analyses WHERE id IN (${placeholders})`).run(...toDelete);
      }

      res.json({
        success: true,
        analysisId: id,
        analysedAt: new Date().toISOString(),
        result: analysisResult,
      });

    } catch (err) {
      if (err.message?.includes('Only JPEG')) {
        return res.status(415).json({ error: err.message });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'Image too large. Maximum size is 10MB.' });
      }
      if (err.status === 401) {
        return res.status(500).json({ error: 'AI service authentication failed. Please contact support.' });
      }
      next(err);
    }
  }
);

// ── GET /api/analysis/history ────────────────────────────────
router.get('/history', requireAuth, (req, res) => {
  const rows = db.prepare(
    'SELECT id, analysed_at, result FROM analyses WHERE user_id = ? ORDER BY analysed_at DESC LIMIT 10'
  ).all(req.user.id);

  const analyses = rows.map(row => {
    const result = JSON.parse(row.result);
    return {
      id:             row.id,
      analysedAt:     row.analysed_at,
      skinScore:      result.skinScore,
      skinType:       result.skinType,
      hydrationLevel: result.hydrationLevel,
      concernCount:   result.concerns?.length || 0,
    };
  });

  res.json({ analyses, total: analyses.length });
});

// ── GET /api/analysis/latest/result ─────────────────────────
// NOTE: This route must come BEFORE /:id to avoid "latest" being treated as an ID
router.get('/latest/result', requireAuth, (req, res) => {
  const row = db.prepare(
    'SELECT * FROM analyses WHERE user_id = ? ORDER BY analysed_at DESC LIMIT 1'
  ).get(req.user.id);

  if (!row) {
    return res.status(404).json({ error: 'No analysis found. Please do a skin scan first.' });
  }

  res.json({
    analysisId: row.id,
    analysedAt: row.analysed_at,
    result:     JSON.parse(row.result),
  });
});

// ── GET /api/analysis/:id ────────────────────────────────────
router.get('/:id', requireAuth, (req, res) => {
  const row = db.prepare(
    'SELECT * FROM analyses WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);

  if (!row) {
    return res.status(404).json({ error: 'Analysis not found.' });
  }

  res.json({
    analysisId: row.id,
    analysedAt: row.analysed_at,
    result:     JSON.parse(row.result),
  });
});

module.exports = router;
