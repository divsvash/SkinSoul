// ============================================================
//  SkinSoul — server.js
//  Main Express application entry point
// ============================================================

require('dotenv').config();

// Initialise database first — creates skinsoul.db and all tables if needed
require('./database');

const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const analysisRoutes = require('./routes/analysis');
const lifestyleRoutes = require('./routes/lifestyle');
const reportRoutes = require('./routes/report');
const uvRoutes = require('./routes/uv');
const waterRoutes = require('./routes/water');

const { errorHandler } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// ── CORS ────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:3000', 'http://localhost:5500', 'http://127.0.0.1:5500'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

// ── Global rate limiter ──────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again.' },
});
app.use(globalLimiter);

// ── Body parsers ─────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Static frontend files ────────────────────────────────────
// Drop your HTML/CSS/JS in the /public folder
app.use(express.static(path.join(__dirname, 'public')));

// ── Request logger ───────────────────────────────────────────
app.use(requestLogger);

// ── API Routes ───────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/user',      userRoutes);
app.use('/api/analysis',  analysisRoutes);
app.use('/api/lifestyle', lifestyleRoutes);
app.use('/api/report',    reportRoutes);
app.use('/api/uv',        uvRoutes);
app.use('/api/water',     waterRoutes);

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'SkinSoul API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ai: !!process.env.ANTHROPIC_API_KEY ? 'connected' : 'missing key',
  });
});

// ── SPA fallback ─────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Error handler (must be last) ─────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌸 SkinSoul API running on http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   AI          : ${process.env.GEMINI_API_KEY ? '✓ GEMINI_API_KEY loaded' : '✗ GEMINI_API_KEY missing'}`);
  console.log(`   Frontend    : http://localhost:${PORT}\n`);
});

module.exports = app;