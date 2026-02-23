// Simple validation helpers
function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter(f => !req.body[f] && req.body[f] !== 0);
    if (missing.length) {
      return res.status(400).json({ error: 'Missing required fields', fields: missing });
    }
    next();
  };
}

function validateEnum(field, allowed) {
  return (req, res, next) => {
    if (req.body[field] && !allowed.includes(req.body[field])) {
      return res.status(400).json({ error: `Invalid value for ${field}`, allowed });
    }
    next();
  };
}

module.exports = { requireFields, validateEnum };
