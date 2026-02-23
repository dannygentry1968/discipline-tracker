const db = require('../db/connection');

exports.getAll = (req, res) => {
  const settings = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  settings.forEach(s => obj[s.key] = s.value);
  res.json(obj);
};

exports.update = (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'settings object required' });
  }
  const upsert = db.prepare('INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, datetime("now"))');
  const save = db.transaction(() => {
    for (const [key, value] of Object.entries(settings)) {
      upsert.run(key, String(value));
    }
  });
  save();
  res.json({ message: 'Settings updated' });
};

// PBIS Resources
exports.getResources = (req, res) => {
  const resources = db.prepare('SELECT * FROM pbis_resources WHERE active = 1 ORDER BY sortOrder').all();
  res.json(resources);
};

exports.updateResource = (req, res) => {
  const b = req.body;
  db.prepare('UPDATE pbis_resources SET category=?, icon=?, title=?, subtitle=?, url=?, sortOrder=?, active=? WHERE id=?')
    .run(b.category, b.icon||null, b.title, b.subtitle||null, b.url, b.sortOrder||0, b.active!==undefined?(b.active?1:0):1, req.params.id);
  res.json({ message: 'Resource updated' });
};

exports.createResource = (req, res) => {
  const b = req.body;
  const result = db.prepare('INSERT INTO pbis_resources (category, icon, title, subtitle, url, sortOrder) VALUES (?,?,?,?,?,?)')
    .run(b.category, b.icon||null, b.title, b.subtitle||null, b.url, b.sortOrder||0);
  res.status(201).json({ id: result.lastInsertRowid, message: 'Resource created' });
};

exports.deleteResource = (req, res) => {
  db.prepare('UPDATE pbis_resources SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Resource deactivated' });
};
