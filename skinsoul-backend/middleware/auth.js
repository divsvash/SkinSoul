const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const token = header.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_dev_secret");

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Optional auth (user can be logged in OR anonymous)
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return next();
  }

  try {
    const token = header.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_dev_secret");
    req.user = decoded;
  } catch (err) {
    // ignore invalid token for optional auth
  }

  next();
}

module.exports = { requireAuth, optionalAuth };