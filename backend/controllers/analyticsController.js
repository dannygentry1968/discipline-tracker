const db = require('../db/connection');

exports.summary = (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM referrals').get().count;
  const majors = db.prepare('SELECT COUNT(*) as count FROM referrals WHERE type = "major"').get().count;
  const minors = db.prepare('SELECT COUNT(*) as count FROM referrals WHERE type = "minor"').get().count;
  const open = db.prepare('SELECT COUNT(*) as count FROM referrals WHERE status != "resolved"').get().count;
  const uniqueStudents = db.prepare('SELECT COUNT(DISTINCT studentId) as count FROM referrals').get().count;

  const thisMonth = db.prepare(`SELECT COUNT(*) as count FROM referrals
    WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')`).get().count;

  res.json({ total, majors, minors, open, uniqueStudents, thisMonth });
};

exports.byBehavior = (req, res) => {
  const data = db.prepare(`SELECT rb.behavior, COUNT(*) as count
    FROM referral_behaviors rb GROUP BY rb.behavior ORDER BY count DESC`).all();
  res.json(data);
};

exports.byLocation = (req, res) => {
  const data = db.prepare(`SELECT rl.location, COUNT(*) as count
    FROM referral_locations rl GROUP BY rl.location ORDER BY count DESC`).all();
  res.json(data);
};

exports.byGrade = (req, res) => {
  const data = db.prepare(`SELECT s.grade, COUNT(*) as count
    FROM referrals r JOIN students s ON r.studentId = s.id
    GROUP BY s.grade ORDER BY s.grade`).all();
  res.json(data);
};

exports.byDayOfWeek = (req, res) => {
  const data = db.prepare(`SELECT
    CASE CAST(strftime('%w', date) AS INTEGER)
      WHEN 0 THEN 'Sun' WHEN 1 THEN 'Mon' WHEN 2 THEN 'Tue'
      WHEN 3 THEN 'Wed' WHEN 4 THEN 'Thu' WHEN 5 THEN 'Fri' WHEN 6 THEN 'Sat'
    END as day, COUNT(*) as count
    FROM referrals GROUP BY strftime('%w', date) ORDER BY strftime('%w', date)`).all();
  res.json(data);
};

exports.byMonth = (req, res) => {
  const data = db.prepare(`SELECT strftime('%Y-%m', date) as month,
    SUM(CASE WHEN type='major' THEN 1 ELSE 0 END) as major,
    SUM(CASE WHEN type='minor' THEN 1 ELSE 0 END) as minor,
    COUNT(*) as total
    FROM referrals GROUP BY strftime('%Y-%m', date) ORDER BY month`).all();
  res.json(data);
};

exports.byTimeBlock = (req, res) => {
  const data = db.prepare(`SELECT
    CASE
      WHEN CAST(substr(time,1,2) AS INTEGER)*60 + CAST(substr(time,4,2) AS INTEGER) < 480 THEN 'Before School'
      WHEN CAST(substr(time,1,2) AS INTEGER)*60 + CAST(substr(time,4,2) AS INTEGER) < 570 THEN 'Block 1 (8:00-9:30)'
      WHEN CAST(substr(time,1,2) AS INTEGER)*60 + CAST(substr(time,4,2) AS INTEGER) < 615 THEN 'Block 2 (9:30-10:15)'
      WHEN CAST(substr(time,1,2) AS INTEGER)*60 + CAST(substr(time,4,2) AS INTEGER) < 630 THEN 'Recess (10:15-10:30)'
      WHEN CAST(substr(time,1,2) AS INTEGER)*60 + CAST(substr(time,4,2) AS INTEGER) < 720 THEN 'Block 3 (10:30-12:00)'
      WHEN CAST(substr(time,1,2) AS INTEGER)*60 + CAST(substr(time,4,2) AS INTEGER) < 765 THEN 'Lunch (12:00-12:45)'
      WHEN CAST(substr(time,1,2) AS INTEGER)*60 + CAST(substr(time,4,2) AS INTEGER) < 840 THEN 'Block 4 (12:45-2:00)'
      WHEN CAST(substr(time,1,2) AS INTEGER)*60 + CAST(substr(time,4,2) AS INTEGER) < 885 THEN 'Block 5 (2:00-2:45)'
      ELSE 'After School'
    END as timeBlock, COUNT(*) as count
    FROM referrals WHERE time IS NOT NULL
    GROUP BY timeBlock ORDER BY count DESC`).all();
  res.json(data);
};

exports.studentSummary = (req, res) => {
  const data = db.prepare(`SELECT
    s.id, s.firstName || ' ' || s.lastName AS name, s.grade,
    SUM(CASE WHEN r.type='major' THEN 1 ELSE 0 END) as major,
    SUM(CASE WHEN r.type='minor' THEN 1 ELSE 0 END) as minor,
    COUNT(*) as total,
    MAX(r.date) as lastDate
    FROM referrals r JOIN students s ON r.studentId = s.id
    GROUP BY s.id ORDER BY total DESC`).all();
  res.json(data);
};

exports.staffSummary = (req, res) => {
  const data = db.prepare(`SELECT
    st.id, st.firstName || ' ' || st.lastName AS name,
    SUM(CASE WHEN r.type='major' THEN 1 ELSE 0 END) as major,
    SUM(CASE WHEN r.type='minor' THEN 1 ELSE 0 END) as minor,
    COUNT(*) as total
    FROM referrals r JOIN staff st ON r.staffId = st.id
    GROUP BY st.id ORDER BY total DESC`).all();
  res.json(data);
};

exports.recidivism = (req, res) => {
  const data = db.prepare(`SELECT s.id, s.firstName || ' ' || s.lastName AS name, s.grade,
    COUNT(*) as total,
    SUM(CASE WHEN r.type='major' THEN 1 ELSE 0 END) as majors,
    MIN(r.date) as firstDate, MAX(r.date) as lastDate
    FROM referrals r JOIN students s ON r.studentId = s.id
    GROUP BY s.id HAVING COUNT(*) >= 2
    ORDER BY total DESC LIMIT 20`).all();
  res.json(data);
};

exports.exportAll = (req, res) => {
  const referrals = db.prepare(`SELECT r.*,
    s.firstName || ' ' || s.lastName AS studentName, s.grade AS studentGrade, s.studentId AS studentIdNum,
    st.firstName || ' ' || st.lastName AS staffName, st.email AS staffEmail
    FROM referrals r JOIN students s ON r.studentId = s.id JOIN staff st ON r.staffId = st.id
    ORDER BY r.date DESC`).all();

  const getBehaviors = db.prepare('SELECT behavior FROM referral_behaviors WHERE referralId = ?');
  const getLocations = db.prepare('SELECT location FROM referral_locations WHERE referralId = ?');
  const getActions = db.prepare('SELECT action FROM referral_admin_actions WHERE referralId = ?');

  referrals.forEach(r => {
    r.behaviors = getBehaviors.all(r.id).map(b => b.behavior);
    r.locations = getLocations.all(r.id).map(l => l.location);
    r.adminActions = getActions.all(r.id).map(a => a.action);
  });

  res.json(referrals);
};
