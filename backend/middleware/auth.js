const db = require('../db/connection');

// Require authenticated session
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // Attach user to request
  const user = db.prepare('SELECT id, employeeId, firstName, lastName, email, role, grade, title, active FROM staff WHERE id = ?').get(req.session.userId);
  if (!user || !user.active) {
    req.session.destroy();
    return res.status(401).json({ error: 'Account inactive or not found' });
  }
  req.user = user;
  next();
}

// Require specific permission
function requirePerm(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    const perm = db.prepare('SELECT granted FROM permissions WHERE role = ? AND permission = ?').get(req.user.role, permission);
    if (!perm || !perm.granted) {
      return res.status(403).json({ error: 'Permission denied', required: permission });
    }
    next();
  };
}

// Require admin role
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requirePerm, requireAdmin };
