const db = require('../db/connection');

exports.getMatrix = (req, res) => {
  const perms = db.prepare('SELECT role, permission, granted FROM permissions ORDER BY role, permission').all();
  // Group by role
  const matrix = {};
  perms.forEach(p => {
    if (!matrix[p.role]) matrix[p.role] = {};
    matrix[p.role][p.permission] = !!p.granted;
  });
  res.json(matrix);
};

exports.updateRole = (req, res) => {
  const { role } = req.params;
  const { permissions } = req.body;
  if (!permissions || typeof permissions !== 'object') {
    return res.status(400).json({ error: 'permissions object required' });
  }

  const upsert = db.prepare('INSERT OR REPLACE INTO permissions (role, permission, granted) VALUES (?, ?, ?)');
  const update = db.transaction(() => {
    for (const [perm, granted] of Object.entries(permissions)) {
      upsert.run(role, perm, granted ? 1 : 0);
    }
  });
  update();
  res.json({ message: `Permissions updated for ${role}` });
};

exports.resetDefaults = (req, res) => {
  const defaults = {
    admin: { createReferral:1,editReferral:1,deleteReferral:1,viewAllReferrals:1,manageStudents:1,manageStaff:1,managePermissions:1,viewAnalytics:1,sendCommunications:1,adminDashboard:1,exportData:1,manageResources:1,manageSettings:1 },
    teacher: { createReferral:1,editReferral:0,deleteReferral:0,viewAllReferrals:0,manageStudents:0,manageStaff:0,managePermissions:0,viewAnalytics:1,sendCommunications:0,adminDashboard:0,exportData:0,manageResources:0,manageSettings:0 },
    staff: { createReferral:1,editReferral:0,deleteReferral:0,viewAllReferrals:0,manageStudents:0,manageStaff:0,managePermissions:0,viewAnalytics:0,sendCommunications:0,adminDashboard:0,exportData:0,manageResources:0,manageSettings:0 },
    counselor: { createReferral:1,editReferral:1,deleteReferral:0,viewAllReferrals:1,manageStudents:0,manageStaff:0,managePermissions:0,viewAnalytics:1,sendCommunications:1,adminDashboard:0,exportData:1,manageResources:0,manageSettings:0 },
    aide: { createReferral:1,editReferral:0,deleteReferral:0,viewAllReferrals:0,manageStudents:0,manageStaff:0,managePermissions:0,viewAnalytics:0,sendCommunications:0,adminDashboard:0,exportData:0,manageResources:0,manageSettings:0 }
  };

  const upsert = db.prepare('INSERT OR REPLACE INTO permissions (role, permission, granted) VALUES (?, ?, ?)');
  const reset = db.transaction(() => {
    for (const [role, perms] of Object.entries(defaults)) {
      for (const [perm, granted] of Object.entries(perms)) {
        upsert.run(role, perm, granted);
      }
    }
  });
  reset();
  res.json({ message: 'Permissions reset to defaults' });
};
