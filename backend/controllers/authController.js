const db = require('../db/connection');
const bcrypt = require('bcryptjs');

exports.login = (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM staff WHERE email = ? AND active = 1').get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  if (!user.passwordHash) return res.status(401).json({ error: 'Account not set up. Contact admin.' });

  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Update last login
  db.prepare('UPDATE staff SET lastLogin = datetime("now") WHERE id = ?').run(user.id);

  // Set session
  req.session.userId = user.id;
  req.session.role = user.role;

  // Get permissions
  const perms = db.prepare('SELECT permission, granted FROM permissions WHERE role = ?').all(user.role);
  const permMap = {};
  perms.forEach(p => permMap[p.permission] = !!p.granted);

  res.json({
    user: {
      id: user.id, employeeId: user.employeeId,
      firstName: user.firstName, lastName: user.lastName,
      email: user.email, role: user.role, grade: user.grade, title: user.title
    },
    permissions: permMap
  });
};

exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
};

exports.me = (req, res) => {
  const perms = db.prepare('SELECT permission, granted FROM permissions WHERE role = ?').all(req.user.role);
  const permMap = {};
  perms.forEach(p => permMap[p.permission] = !!p.granted);
  res.json({ user: req.user, permissions: permMap });
};

exports.changePassword = (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const user = db.prepare('SELECT passwordHash FROM staff WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return res.status(401).json({ error: 'Current password incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE staff SET passwordHash = ? WHERE id = ?').run(hash, req.user.id);
  res.json({ message: 'Password updated' });
};
