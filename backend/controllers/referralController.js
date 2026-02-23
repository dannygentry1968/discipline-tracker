const db = require('../db/connection');

// Helper: get full referral with joined data
function getFullReferral(id) {
  const ref = db.prepare(`SELECT r.*,
    s.firstName || ' ' || s.lastName AS studentName, s.grade AS studentGrade,
    s.parentEmail, s.parentFirstName, s.parentLastName,
    st.firstName || ' ' || st.lastName AS staffName, st.email AS staffEmail
    FROM referrals r
    JOIN students s ON r.studentId = s.id
    JOIN staff st ON r.staffId = st.id
    WHERE r.id = ?`).get(id);
  if (!ref) return null;

  ref.behaviors = db.prepare('SELECT behavior FROM referral_behaviors WHERE referralId = ?').all(id).map(b => b.behavior);
  ref.locations = db.prepare('SELECT location FROM referral_locations WHERE referralId = ?').all(id).map(l => l.location);
  ref.adminActions = db.prepare('SELECT action FROM referral_admin_actions WHERE referralId = ?').all(id).map(a => a.action);
  return ref;
}

exports.list = (req, res) => {
  const { type, grade, status, from, to, search, studentId } = req.query;
  let sql = `SELECT r.id, r.type, r.date, r.time, r.status, r.createdAt,
    s.firstName || ' ' || s.lastName AS studentName, s.grade AS studentGrade,
    st.firstName || ' ' || st.lastName AS staffName, st.email AS staffEmail
    FROM referrals r
    JOIN students s ON r.studentId = s.id
    JOIN staff st ON r.staffId = st.id WHERE 1=1`;
  const params = [];

  if (type) { sql += ' AND r.type = ?'; params.push(type); }
  if (grade) { sql += ' AND s.grade = ?'; params.push(grade); }
  if (status) { sql += ' AND r.status = ?'; params.push(status); }
  if (from) { sql += ' AND r.date >= ?'; params.push(from); }
  if (to) { sql += ' AND r.date <= ?'; params.push(to); }
  if (studentId) { sql += ' AND r.studentId = ?'; params.push(studentId); }
  if (search) {
    sql += ` AND (s.firstName || ' ' || s.lastName LIKE ? OR st.firstName || ' ' || st.lastName LIKE ? OR r.narrative LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  // Permission check: non-admin/counselor only see their own
  const perm = db.prepare('SELECT granted FROM permissions WHERE role = ? AND permission = "viewAllReferrals"').get(req.user.role);
  if (!perm || !perm.granted) {
    sql += ' AND r.staffId = ?';
    params.push(req.user.id);
  }

  sql += ' ORDER BY r.date DESC, r.createdAt DESC';
  const referrals = db.prepare(sql).all(...params);

  // Attach behaviors to each
  const getBehaviors = db.prepare('SELECT behavior FROM referral_behaviors WHERE referralId = ?');
  const getLocations = db.prepare('SELECT location FROM referral_locations WHERE referralId = ?');
  referrals.forEach(r => {
    r.behaviors = getBehaviors.all(r.id).map(b => b.behavior);
    r.locations = getLocations.all(r.id).map(l => l.location);
  });

  res.json(referrals);
};

exports.get = (req, res) => {
  const ref = getFullReferral(req.params.id);
  if (!ref) return res.status(404).json({ error: 'Referral not found' });
  res.json(ref);
};

exports.create = (req, res) => {
  const b = req.body;

  // Resolve student: by ID or by name lookup
  let studentId = b.studentId;
  if (!studentId && b.studentName) {
    const parts = b.studentName.trim().split(/[,\s]+/);
    let student;
    if (b.studentName.includes(',')) {
      student = db.prepare('SELECT id FROM students WHERE lastName LIKE ? AND firstName LIKE ?')
        .get(parts[0].trim()+'%', (parts[1]||'').trim()+'%');
    } else {
      student = db.prepare('SELECT id FROM students WHERE firstName LIKE ? AND lastName LIKE ?')
        .get(parts[0]+'%', (parts[1]||'')+'%');
    }
    if (student) studentId = student.id;
  }
  if (!studentId) return res.status(400).json({ error: 'Student not found. Create the student first.' });

  const result = db.prepare(`INSERT INTO referrals
    (type, studentId, staffId, date, time, narrative, interventions, status,
     aiTeacherAdvice, aiAdminAdvice, aiParentLetter, createdBy)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      b.type, studentId, b.staffId || req.user.id,
      b.date, b.time||null, b.narrative||null, b.interventions||null,
      b.status||'open',
      b.aiTeacherAdvice||null, b.aiAdminAdvice||null, b.aiParentLetter||null,
      req.user.id
    );

  const refId = result.lastInsertRowid;

  // Insert behaviors, locations, admin actions
  const insertBehavior = db.prepare('INSERT INTO referral_behaviors (referralId, behavior) VALUES (?, ?)');
  const insertLocation = db.prepare('INSERT INTO referral_locations (referralId, location) VALUES (?, ?)');
  const insertAction = db.prepare('INSERT INTO referral_admin_actions (referralId, action) VALUES (?, ?)');

  if (b.behaviors && Array.isArray(b.behaviors)) {
    b.behaviors.forEach(beh => insertBehavior.run(refId, beh));
  }
  if (b.locations && Array.isArray(b.locations)) {
    b.locations.forEach(loc => insertLocation.run(refId, loc));
  }
  if (b.adminActions && Array.isArray(b.adminActions)) {
    b.adminActions.forEach(act => insertAction.run(refId, act));
  }

  res.status(201).json({ id: refId, message: 'Referral created' });
};

exports.update = (req, res) => {
  const b = req.body;
  const existing = db.prepare('SELECT id FROM referrals WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Referral not found' });

  db.prepare(`UPDATE referrals SET
    type=?, date=?, time=?, narrative=?, interventions=?, status=?,
    adminNotes=?, conferenceNotes=?, parentConfNotes=?,
    detentionDates=?, suspensionDates=?, communityService=?, restorativeActions=?,
    aiTeacherAdvice=?, aiAdminAdvice=?, aiParentLetter=?
    WHERE id=?`).run(
      b.type, b.date, b.time||null, b.narrative||null, b.interventions||null, b.status||'open',
      b.adminNotes||null, b.conferenceNotes||null, b.parentConfNotes||null,
      b.detentionDates||null, b.suspensionDates||null, b.communityService||null, b.restorativeActions||null,
      b.aiTeacherAdvice||null, b.aiAdminAdvice||null, b.aiParentLetter||null,
      req.params.id
    );

  // Update junction tables
  if (b.behaviors) {
    db.prepare('DELETE FROM referral_behaviors WHERE referralId = ?').run(req.params.id);
    const ins = db.prepare('INSERT INTO referral_behaviors (referralId, behavior) VALUES (?, ?)');
    b.behaviors.forEach(beh => ins.run(req.params.id, beh));
  }
  if (b.locations) {
    db.prepare('DELETE FROM referral_locations WHERE referralId = ?').run(req.params.id);
    const ins = db.prepare('INSERT INTO referral_locations (referralId, location) VALUES (?, ?)');
    b.locations.forEach(loc => ins.run(req.params.id, loc));
  }
  if (b.adminActions) {
    db.prepare('DELETE FROM referral_admin_actions WHERE referralId = ?').run(req.params.id);
    const ins = db.prepare('INSERT INTO referral_admin_actions (referralId, action) VALUES (?, ?)');
    b.adminActions.forEach(act => ins.run(req.params.id, act));
  }

  res.json({ message: 'Referral updated' });
};

exports.updateStatus = (req, res) => {
  const { status } = req.body;
  if (!['open','in-review','resolved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  db.prepare('UPDATE referrals SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ message: 'Status updated' });
};

exports.delete = (req, res) => {
  const id = req.params.id;
  const del = db.transaction(() => {
    db.prepare('DELETE FROM referral_behaviors WHERE referralId = ?').run(id);
    db.prepare('DELETE FROM referral_locations WHERE referralId = ?').run(id);
    db.prepare('DELETE FROM referral_admin_actions WHERE referralId = ?').run(id);
    db.prepare('DELETE FROM communications WHERE referralId = ?').run(id);
    db.prepare('DELETE FROM referrals WHERE id = ?').run(id);
  });
  del();
  res.json({ message: 'Referral deleted' });
};
