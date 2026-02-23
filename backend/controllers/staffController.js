const db = require('../db/connection');
const bcrypt = require('bcryptjs');

exports.list = (req, res) => {
  const { role, active, search } = req.query;
  let sql = 'SELECT id, employeeId, firstName, lastName, email, phone, role, grade, title, room, active, lastLogin, createdAt FROM staff WHERE 1=1';
  const params = [];

  if (role) { sql += ' AND role = ?'; params.push(role); }
  if (active !== undefined) { sql += ' AND active = ?'; params.push(active === 'true' ? 1 : 0); }
  else { sql += ' AND active = 1'; }
  if (search) {
    sql += ' AND (firstName || " " || lastName LIKE ? OR email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY lastName, firstName';

  res.json(db.prepare(sql).all(...params));
};

exports.get = (req, res) => {
  const staff = db.prepare('SELECT id, employeeId, firstName, lastName, email, phone, role, grade, title, room, active, lastLogin, createdAt FROM staff WHERE id = ?').get(req.params.id);
  if (!staff) return res.status(404).json({ error: 'Staff not found' });
  res.json(staff);
};

exports.create = (req, res) => {
  const b = req.body;
  const hash = bcrypt.hashSync(b.password || 'password123', 10);
  const result = db.prepare(`INSERT INTO staff (employeeId, firstName, lastName, email, phone, role, grade, title, room, passwordHash)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      b.employeeId||null, b.firstName, b.lastName, b.email.toLowerCase().trim(),
      b.phone||null, b.role||'teacher', b.grade||null, b.title||null, b.room||null, hash
    );
  res.status(201).json({ id: result.lastInsertRowid, message: 'Staff created' });
};

exports.update = (req, res) => {
  const b = req.body;
  const existing = db.prepare('SELECT id FROM staff WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Staff not found' });

  db.prepare(`UPDATE staff SET employeeId=?, firstName=?, lastName=?, email=?, phone=?,
    role=?, grade=?, title=?, room=?, active=? WHERE id=?`).run(
      b.employeeId||null, b.firstName, b.lastName, b.email.toLowerCase().trim(),
      b.phone||null, b.role||'teacher', b.grade||null, b.title||null, b.room||null,
      b.active !== undefined ? (b.active?1:0) : 1, req.params.id
    );
  res.json({ message: 'Staff updated' });
};

exports.resetPassword = (req, res) => {
  const newPassword = req.body.password || 'password123';
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE staff SET passwordHash = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ message: 'Password reset' });
};

exports.delete = (req, res) => {
  db.prepare('UPDATE staff SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Staff deactivated' });
};

exports.bulkImport = (req, res) => {
  if (!req.body.staff || !Array.isArray(req.body.staff)) {
    return res.status(400).json({ error: 'staff array required' });
  }

  const defaultHash = bcrypt.hashSync('password123', 10);
  let imported = 0, updated = 0, skipped = 0;
  const errors = [];

  const importAll = db.transaction(() => {
    for (const [i, s] of req.body.staff.entries()) {
      try {
        if (!s.firstName || !s.lastName || !s.email) {
          skipped++;
          errors.push({ row: i+1, error: 'Missing required fields' });
          continue;
        }
        const email = s.email.toLowerCase().trim();
        const existing = db.prepare('SELECT id FROM staff WHERE email = ?').get(email);
        if (existing) {
          db.prepare('UPDATE staff SET firstName=?, lastName=?, role=?, grade=?, title=?, phone=? WHERE id=?')
            .run(s.firstName, s.lastName, s.role||'teacher', s.grade||null, s.title||null, s.phone||null, existing.id);
          updated++;
        } else {
          db.prepare(`INSERT INTO staff (employeeId, firstName, lastName, email, phone, role, grade, title, passwordHash)
            VALUES (?,?,?,?,?,?,?,?,?)`).run(
              s.employeeId||null, s.firstName, s.lastName, email, s.phone||null,
              s.role||'teacher', s.grade||null, s.title||null, defaultHash);
          imported++;
        }
      } catch (err) {
        skipped++;
        errors.push({ row: i+1, error: err.message });
      }
    }
  });

  importAll();

  db.prepare(`INSERT INTO import_logs (type, filename, totalRows, importedRows, skippedRows, errors, importedBy)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run('staff', req.body.filename||'bulk-import',
      req.body.staff.length, imported+updated, skipped,
      errors.length ? JSON.stringify(errors) : null, req.user.id);

  res.json({ imported, updated, skipped, total: req.body.staff.length, errors });
};
