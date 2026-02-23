const db = require('../db/connection');

exports.list = (req, res) => {
  const { type, search, referralId } = req.query;
  let sql = `SELECT c.*, st.firstName || ' ' || st.lastName AS createdByName
    FROM communications c LEFT JOIN staff st ON c.createdBy = st.id WHERE 1=1`;
  const params = [];

  if (type) { sql += ' AND c.type = ?'; params.push(type); }
  if (referralId) { sql += ' AND c.referralId = ?'; params.push(referralId); }
  if (search) { sql += ' AND (c.subject LIKE ? OR c.body LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY c.createdAt DESC';

  res.json(db.prepare(sql).all(...params));
};

exports.get = (req, res) => {
  const comm = db.prepare(`SELECT c.*, st.firstName || ' ' || st.lastName AS createdByName
    FROM communications c LEFT JOIN staff st ON c.createdBy = st.id WHERE c.id = ?`).get(req.params.id);
  if (!comm) return res.status(404).json({ error: 'Communication not found' });
  res.json(comm);
};

exports.create = (req, res) => {
  const b = req.body;
  const result = db.prepare(`INSERT INTO communications
    (referralId, type, subject, body, recipientEmail, recipientName, createdBy)
    VALUES (?,?,?,?,?,?,?)`).run(
      b.referralId||null, b.type, b.subject, b.body,
      b.recipientEmail||null, b.recipientName||null, req.user.id
    );
  res.status(201).json({ id: result.lastInsertRowid, message: 'Communication created' });
};

exports.delete = (req, res) => {
  db.prepare('DELETE FROM communications WHERE id = ?').run(req.params.id);
  res.json({ message: 'Communication deleted' });
};
