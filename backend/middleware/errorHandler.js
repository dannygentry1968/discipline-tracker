function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}:`, err.message);
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: 'Record already exists', detail: err.message });
  }
  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    return res.status(400).json({ error: 'Referenced record not found', detail: err.message });
  }
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
}

module.exports = errorHandler;
