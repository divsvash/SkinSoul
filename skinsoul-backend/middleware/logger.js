function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const ms = Date.now() - start;
    const status = res.statusCode;

    console.log(`${req.method} ${req.path} → ${status} (${ms}ms)`);
  });

  next();
}

module.exports = { requestLogger };