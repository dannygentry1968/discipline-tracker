const db = require('../db/connection');

exports.list = (req, res) => {
  const { grade, search, active } = req.query;
  let sql = `SELECT s.*, st.firstName || ' ' || st.lastName AS teacherName
    FROM students s LEFT JOIN staff st ON s.teacherId = st.id WHERE 1=1`;
  const params = [];

  if (grade) { sql += ' AND s.grade = ?'; params.push(grade); }
  if (active !== undefined) { sql += ' AND s.active = ?'; params.push(active === 'true' ? 1 : 0); }
  else { sql += ' AND s.active = 1'; }
  if (search) {
    sql += ' AND (s.firstName || " " || s.lastName LIKE ? OR s.studentId LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }
  sql += ' ORDER BY s.lastName, s.firstName';

  const students = db.prepare(sql).all(...params);
  res.json(students);
};

exports.get = (req, res) => {
  const student = db.prepare(`SELECT s.*, st.firstName || ' ' || st.lastName AS teacherName
    FROM students s LEFT JOIN staff st ON s.teacherId = st.id WHERE s.id = ?`).get(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  res.json(student);
};

exports.create = (req, res) => {
  const b = req.body;
  const result = db.prepare(`INSERT INTO students
    (studentId, firstName, lastName, grade, sex, ethnicity, dateOfBirth, enrollmentDate,
     homeLanguage, iep, plan504, sst, address, city, state, zip,
     parentFirstName, parentLastName, parentEmail, parentPhone,
     secondaryParentName, secondaryParentEmail, secondaryParentPhone,
     teacherId, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(
      b.studentId||null, b.firstName, b.lastName, b.grade,
      b.sex||null, b.ethnicity||null, b.dateOfBirth||null, b.enrollmentDate||null,
      b.homeLanguage||null, b.iep?1:0, b.plan504?1:0, b.sst?1:0,
      b.address||null, b.city||null, b.state||'CA', b.zip||null,
      b.parentFirstName||null, b.parentLastName||null, b.parentEmail||null, b.parentPhone||null,
      b.secondaryParentName||null, b.secondaryParentEmail||null, b.secondaryParentPhone||null,
      b.teacherId||null, b.notes||null
    );
  res.status(201).json({ id: result.lastInsertRowid, message: 'Student created' });
};

exports.update = (req, res) => {
  const b = req.body;
  const existing = db.prepare('SELECT id FROM students WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Student not found' });

  db.prepare(`UPDATE students SET
    studentId=?, firstName=?, lastName=?, grade=?, sex=?, ethnicity=?, dateOfBirth=?,
    enrollmentDate=?, homeLanguage=?, iep=?, plan504=?, sst=?,
    address=?, city=?, state=?, zip=?,
    parentFirstName=?, parentLastName=?, parentEmail=?, parentPhone=?,
    secondaryParentName=?, secondaryParentEmail=?, secondaryParentPhone=?,
    teacherId=?, notes=?, active=?, updatedAt=datetime('now')
    WHERE id=?`).run(
      b.studentId||null, b.firstName, b.lastName, b.grade,
      b.sex||null, b.ethnicity||null, b.dateOfBirth||null, b.enrollmentDate||null,
      b.homeLanguage||null, b.iep?1:0, b.plan504?1:0, b.sst?1:0,
      b.address||null, b.city||null, b.state||'CA', b.zip||null,
      b.parentFirstName||null, b.parentLastName||null, b.parentEmail||null, b.parentPhone||null,
      b.secondaryParentName||null, b.secondaryParentEmail||null, b.secondaryParentPhone||null,
      b.teacherId||null, b.notes||null, b.active !== undefined ? (b.active?1:0) : 1,
      req.params.id
    );
  res.json({ message: 'Student updated' });
};

exports.delete = (req, res) => {
  // Soft delete
  db.prepare('UPDATE students SET active = 0, updatedAt = datetime("now") WHERE id = ?').run(req.params.id);
  res.json({ message: 'Student deactivated' });
};

exports.bulkImport = (req, res) => {
  if (!req.body.students || !Array.isArray(req.body.students)) {
    return res.status(400).json({ error: 'students array required' });
  }

  const insert = db.prepare(`INSERT INTO students
    (studentId, firstName, lastName, grade, sex, ethnicity, dateOfBirth,
     homeLanguage, iep, plan504, sst, parentFirstName, parentLastName,
     parentEmail, parentPhone, secondaryParentName, secondaryParentEmail,
     secondaryParentPhone, teacherId, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);

  const upsert = db.prepare(`UPDATE students SET
    firstName=?, lastName=?, grade=?, sex=?, ethnicity=?, dateOfBirth=?,
    homeLanguage=?, iep=?, plan504=?, sst=?, parentFirstName=?, parentLastName=?,
    parentEmail=?, parentPhone=?, secondaryParentName=?, secondaryParentEmail=?,
    secondaryParentPhone=?, teacherId=?, notes=?, updatedAt=datetime('now')
    WHERE studentId=?`);

  let imported = 0, updated = 0, skipped = 0;
  const errors = [];

  const importAll = db.transaction(() => {
    for (const [i, s] of req.body.students.entries()) {
      try {
        if (!s.firstName || !s.lastName || !s.grade) {
          skipped++;
          errors.push({ row: i+1, error: 'Missing required fields (firstName, lastName, grade)' });
          continue;
        }

        // Resolve teacher by name or email
        let teacherId = s.teacherId || null;
        if (!teacherId && s.teacherName) {
          const parts = s.teacherName.trim().split(/\s+/);
          const teacher = db.prepare('SELECT id FROM staff WHERE firstName LIKE ? AND lastName LIKE ?')
            .get(parts[0]+'%', (parts[1]||'')+'%');
          if (teacher) teacherId = teacher.id;
        }

        // Check for existing by studentId
        if (s.studentId) {
          const existing = db.prepare('SELECT id FROM students WHERE studentId = ?').get(s.studentId);
          if (existing) {
            upsert.run(s.firstName, s.lastName, s.grade, s.sex||null, s.ethnicity||null,
              s.dateOfBirth||null, s.homeLanguage||null, s.iep?1:0, s.plan504?1:0, s.sst?1:0,
              s.parentFirstName||null, s.parentLastName||null, s.parentEmail||null, s.parentPhone||null,
              s.secondaryParentName||null, s.secondaryParentEmail||null, s.secondaryParentPhone||null,
              teacherId, s.notes||null, s.studentId);
            updated++;
            continue;
          }
        }

        insert.run(s.studentId||null, s.firstName, s.lastName, s.grade,
          s.sex||null, s.ethnicity||null, s.dateOfBirth||null, s.homeLanguage||null,
          s.iep?1:0, s.plan504?1:0, s.sst?1:0,
          s.parentFirstName||null, s.parentLastName||null, s.parentEmail||null, s.parentPhone||null,
          s.secondaryParentName||null, s.secondaryParentEmail||null, s.secondaryParentPhone||null,
          teacherId, s.notes||null);
        imported++;
      } catch (err) {
        skipped++;
        errors.push({ row: i+1, error: err.message });
      }
    }
  });

  importAll();

  // Log the import
  db.prepare(`INSERT INTO import_logs (type, filename, totalRows, importedRows, skippedRows, errors, importedBy)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      'students', req.body.filename || 'bulk-import',
      req.body.students.length, imported + updated, skipped,
      errors.length ? JSON.stringify(errors) : null, req.user.id
    );

  res.json({ imported, updated, skipped, total: req.body.students.length, errors });
};

exports.export = (req, res) => {
  const students = db.prepare(`SELECT s.*, st.firstName || ' ' || st.lastName AS teacherName
    FROM students s LEFT JOIN staff st ON s.teacherId = st.id WHERE s.active = 1
    ORDER BY s.grade, s.lastName`).all();
  res.json(students);
};
