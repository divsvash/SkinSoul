const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const { getUVIndex } = require('../services/uvService');
const db = require('../database');

const router = express.Router();

router.get('/', optionalAuth, async (req, res, next) => {
  try {
    let city = req.query.city;
    if (!city && req.user) {
      const user = db.prepare('SELECT city FROM users WHERE id = ?').get(req.user.id);
      city = user?.city;
    }
    city = city || 'Delhi';
    const uvData = await getUVIndex(city);
    res.json(uvData);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
