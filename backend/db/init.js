require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const db = require('./connection');
const bcrypt = require('bcryptjs');

async function init() {
// Wait for sql.js to initialize if needed
if (db._ready) await db._ready;

console.log('Initializing database...');

// ===== CREATE TABLES =====
db.exec(`
  -- Staff / Users
  CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employeeId TEXT UNIQUE,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'teacher' CHECK(role IN ('admin','teacher','staff','counselor','aide')),
    grade TEXT,
    title TEXT,
    room TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    passwordHash TEXT,
    lastLogin TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Students
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentId TEXT UNIQUE,
    firstName TEXT NOT NULL,
    lastName TEXT NOT NULL,
    grade TEXT NOT NULL,
    sex TEXT CHECK(sex IN ('M','F',NULL)),
    ethnicity TEXT,
    dateOfBirth TEXT,
    enrollmentDate TEXT,
    homeLanguage TEXT,
    iep INTEGER NOT NULL DEFAULT 0,
    plan504 INTEGER NOT NULL DEFAULT 0,
    sst INTEGER NOT NULL DEFAULT 0,
    address TEXT,
    city TEXT,
    state TEXT DEFAULT 'CA',
    zip TEXT,
    parentFirstName TEXT,
    parentLastName TEXT,
    parentEmail TEXT,
    parentPhone TEXT,
    secondaryParentName TEXT,
    secondaryParentEmail TEXT,
    secondaryParentPhone TEXT,
    teacherId INTEGER REFERENCES staff(id),
    notes TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Referrals
  CREATE TABLE IF NOT EXISTS referrals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('major','minor')),
    studentId INTEGER NOT NULL REFERENCES students(id),
    staffId INTEGER NOT NULL REFERENCES staff(id),
    date TEXT NOT NULL,
    time TEXT,
    narrative TEXT,
    interventions TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in-review','resolved')),
    adminNotes TEXT,
    conferenceNotes TEXT,
    parentConfNotes TEXT,
    detentionDates TEXT,
    suspensionDates TEXT,
    communityService TEXT,
    restorativeActions TEXT,
    aiTeacherAdvice TEXT,
    aiAdminAdvice TEXT,
    aiParentLetter TEXT,
    createdBy INTEGER REFERENCES staff(id),
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Referral junction tables (many-to-many)
  CREATE TABLE IF NOT EXISTS referral_behaviors (
    referralId INTEGER NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    behavior TEXT NOT NULL,
    PRIMARY KEY (referralId, behavior)
  );

  CREATE TABLE IF NOT EXISTS referral_locations (
    referralId INTEGER NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    location TEXT NOT NULL,
    PRIMARY KEY (referralId, location)
  );

  CREATE TABLE IF NOT EXISTS referral_admin_actions (
    referralId INTEGER NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    PRIMARY KEY (referralId, action)
  );

  -- Communications
  CREATE TABLE IF NOT EXISTS communications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referralId INTEGER REFERENCES referrals(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK(type IN ('parent-letter','teacher-strategy','admin-notification','custom')),
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    recipientEmail TEXT,
    recipientName TEXT,
    sentViaEmail INTEGER NOT NULL DEFAULT 0,
    createdBy INTEGER REFERENCES staff(id),
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Email logs (Gmail delivery tracking)
  CREATE TABLE IF NOT EXISTS email_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    communicationId INTEGER REFERENCES communications(id) ON DELETE SET NULL,
    toEmail TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sent','failed','bounced')),
    gmailMessageId TEXT,
    errorMessage TEXT,
    sentAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Permissions (role-based matrix)
  CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    permission TEXT NOT NULL,
    granted INTEGER NOT NULL DEFAULT 0,
    UNIQUE(role, permission)
  );

  -- Import logs (audit trail)
  CREATE TABLE IF NOT EXISTS import_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('students','staff')),
    filename TEXT NOT NULL,
    totalRows INTEGER NOT NULL DEFAULT 0,
    importedRows INTEGER NOT NULL DEFAULT 0,
    skippedRows INTEGER NOT NULL DEFAULT 0,
    errors TEXT,
    importedBy INTEGER REFERENCES staff(id),
    createdAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Settings (key-value store for school config)
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- PBIS Resources (admin-editable links)
  CREATE TABLE IF NOT EXISTS pbis_resources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    icon TEXT,
    title TEXT NOT NULL,
    subtitle TEXT,
    url TEXT NOT NULL,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_referrals_student ON referrals(studentId);
  CREATE INDEX IF NOT EXISTS idx_referrals_staff ON referrals(staffId);
  CREATE INDEX IF NOT EXISTS idx_referrals_date ON referrals(date);
  CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
  CREATE INDEX IF NOT EXISTS idx_referrals_type ON referrals(type);
  CREATE INDEX IF NOT EXISTS idx_students_grade ON students(grade);
  CREATE INDEX IF NOT EXISTS idx_students_teacher ON students(teacherId);
  CREATE INDEX IF NOT EXISTS idx_communications_referral ON communications(referralId);
  CREATE INDEX IF NOT EXISTS idx_email_logs_comm ON email_logs(communicationId);
`);

// ===== SEED DEFAULT PERMISSIONS =====
const defaultPerms = {
  admin: {
    createReferral:1, editReferral:1, deleteReferral:1, viewAllReferrals:1,
    manageStudents:1, manageStaff:1, managePermissions:1, viewAnalytics:1,
    sendCommunications:1, adminDashboard:1, exportData:1, manageResources:1, manageSettings:1
  },
  teacher: {
    createReferral:1, editReferral:0, deleteReferral:0, viewAllReferrals:0,
    manageStudents:0, manageStaff:0, managePermissions:0, viewAnalytics:1,
    sendCommunications:0, adminDashboard:0, exportData:0, manageResources:0, manageSettings:0
  },
  staff: {
    createReferral:1, editReferral:0, deleteReferral:0, viewAllReferrals:0,
    manageStudents:0, manageStaff:0, managePermissions:0, viewAnalytics:0,
    sendCommunications:0, adminDashboard:0, exportData:0, manageResources:0, manageSettings:0
  },
  counselor: {
    createReferral:1, editReferral:1, deleteReferral:0, viewAllReferrals:1,
    manageStudents:0, manageStaff:0, managePermissions:0, viewAnalytics:1,
    sendCommunications:1, adminDashboard:0, exportData:1, manageResources:0, manageSettings:0
  },
  aide: {
    createReferral:1, editReferral:0, deleteReferral:0, viewAllReferrals:0,
    manageStudents:0, manageStaff:0, managePermissions:0, viewAnalytics:0,
    sendCommunications:0, adminDashboard:0, exportData:0, manageResources:0, manageSettings:0
  }
};

const upsertPerm = db.prepare('INSERT OR REPLACE INTO permissions (role, permission, granted) VALUES (?, ?, ?)');
const seedPerms = db.transaction(() => {
  for (const [role, perms] of Object.entries(defaultPerms)) {
    for (const [perm, granted] of Object.entries(perms)) {
      upsertPerm.run(role, perm, granted);
    }
  }
});
seedPerms();
console.log('  Permissions seeded (5 roles x 13 permissions)');

// ===== SEED DEFAULT ADMIN ACCOUNT =====
const existingAdmin = db.prepare('SELECT id FROM staff WHERE email = ?').get('dannyg@fsusd.org');
if (!existingAdmin) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`INSERT INTO staff (employeeId, firstName, lastName, email, role, title, passwordHash)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run('E001', 'Danny', 'Gentry', 'dannyg@fsusd.org', 'admin', 'Principal', hash);
  console.log('  Default admin created (dannyg@fsusd.org / admin123)');
}

// ===== SEED DEFAULT STAFF =====
const staffSeed = [
  { eid:'E002', fn:'Gayle', ln:'Garcia', email:'gayleg@fsusd.org', role:'admin', title:'Vice Principal' },
  { eid:'E003', fn:'Tammy', ln:'Villanueva', email:'tammyv@fsusd.org', role:'staff', title:'Office Manager' },
  { eid:'E004', fn:'Robin', ln:'Avery', email:'robina@fsusd.org', role:'teacher', grade:'K', title:'Teacher' },
  { eid:'E005', fn:'Ashley', ln:'Erickson', email:'ashleye@fsusd.org', role:'teacher', grade:'1', title:'Teacher' },
  { eid:'E006', fn:'Erika', ln:'Guerrero', email:'erikag@fsusd.org', role:'teacher', grade:'2', title:'Teacher' },
  { eid:'E007', fn:'Cassandra', ln:'Carter', email:'cassandrac@fsusd.org', role:'teacher', grade:'3', title:'Teacher' },
  { eid:'E008', fn:'Tiffany', ln:'Smith', email:'tiffanys@fsusd.org', role:'teacher', grade:'4', title:'Teacher' },
  { eid:'E009', fn:'Karina', ln:'Trejo', email:'karinat@fsusd.org', role:'teacher', grade:'5', title:'Teacher' },
  { eid:'E010', fn:'Wil', ln:'Cook', email:'wilc@fsusd.org', role:'teacher', grade:'5', title:'Teacher' },
  { eid:'E011', fn:'Ariel', ln:'Moreno', email:'arielm@fsusd.org', role:'counselor', title:'Counselor' },
  { eid:'E012', fn:'Sarah', ln:'Johnson', email:'sarahj@fsusd.org', role:'aide', title:'Instructional Aide' },
  { eid:'E013', fn:'Marcus', ln:'Lee', email:'marcusl@fsusd.org', role:'aide', title:'Yard Duty' },
  { eid:'E014', fn:'Patricia', ln:'Chen', email:'patriciac@fsusd.org', role:'staff', title:'Librarian' }
];

const insertStaff = db.prepare(`INSERT OR IGNORE INTO staff (employeeId, firstName, lastName, email, role, grade, title, passwordHash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
const defaultHash = bcrypt.hashSync('password123', 10);
const seedStaff = db.transaction(() => {
  for (const s of staffSeed) {
    insertStaff.run(s.eid, s.fn, s.ln, s.email, s.role, s.grade || null, s.title, defaultHash);
  }
});
seedStaff();
console.log(`  ${staffSeed.length} staff members seeded`);

// ===== SEED PBIS RESOURCES =====
const resources = [
  { cat:'Schedules & Maps', icon:'📅', title:'Daily Bell Schedule', sub:'School start/end times and block schedule', url:'https://rhes.fsusd.org/o/rhes/page/daily-schedule', sort:1 },
  { cat:'Schedules & Maps', icon:'🗺️', title:'Campus Map', sub:'Building and playground layout', url:'https://rhes.fsusd.org/o/rhes/page/campus-map', sort:2 },
  { cat:'Discipline & PBIS', icon:'📋', title:'Major Referral Form', sub:'Submit a major behavior referral', url:'https://docs.google.com/forms/d/e/major-referral/viewform', sort:3 },
  { cat:'Discipline & PBIS', icon:'📝', title:'Minor Referral Form', sub:'Submit a minor behavior referral', url:'https://docs.google.com/forms/d/e/minor-referral/viewform', sort:4 },
  { cat:'Discipline & PBIS', icon:'🦅', title:'RedHawk PBIS Matrix', sub:'School-wide behavioral expectations', url:'https://rhes.fsusd.org/o/rhes/page/pbis', sort:5 },
  { cat:'Discipline & PBIS', icon:'📊', title:'PBIS Flowchart', sub:'Decision tree for behavior responses', url:'https://rhes.fsusd.org/o/rhes/page/pbis-flowchart', sort:6 },
  { cat:'Discipline & PBIS', icon:'🎯', title:'Behavior Intervention Guide', sub:'Tier 1-3 intervention strategies', url:'https://rhes.fsusd.org/o/rhes/page/behavior-guide', sort:7 },
  { cat:'Discipline & PBIS', icon:'📖', title:'Restorative Practices Guide', sub:'Restorative conversation scripts and protocols', url:'https://rhes.fsusd.org/o/rhes/page/restorative', sort:8 },
  { cat:'Important Documents', icon:'📑', title:'Staff Handbook', sub:'Policies, procedures, and expectations', url:'https://rhes.fsusd.org/o/rhes/page/staff-handbook', sort:9 },
  { cat:'Important Documents', icon:'🏫', title:'School Safety Plan', sub:'Emergency procedures and safety protocols', url:'https://rhes.fsusd.org/o/rhes/page/safety-plan', sort:10 },
  { cat:'Important Documents', icon:'📞', title:'Crisis Response Protocol', sub:'Steps for behavioral and safety crises', url:'https://rhes.fsusd.org/o/rhes/page/crisis-protocol', sort:11 },
  { cat:'Important Documents', icon:'💡', title:'Miri Center Resources', sub:'Counseling and SEL support programs', url:'https://rhes.fsusd.org/o/rhes/page/miri-center', sort:12 },
  { cat:'Important Documents', icon:'👨‍👩‍👧', title:'Parent Communication Templates', sub:'Letter and email templates for families', url:'https://rhes.fsusd.org/o/rhes/page/parent-templates', sort:13 },
  { cat:'Important Documents', icon:'📈', title:'SST Process Guide', sub:'Student Study Team referral procedures', url:'https://rhes.fsusd.org/o/rhes/page/sst-process', sort:14 },
  { cat:'Important Documents', icon:'🔗', title:'FSUSD District Resources', sub:'District-level support and policies', url:'https://www.fsusd.org', sort:15 },
  { cat:'Important Documents', icon:'📱', title:'Tech Support', sub:'Device and software help', url:'https://rhes.fsusd.org/o/rhes/page/tech-support', sort:16 }
];

const insertResource = db.prepare(`INSERT OR IGNORE INTO pbis_resources (category, icon, title, subtitle, url, sortOrder)
  VALUES (?, ?, ?, ?, ?, ?)`);
const seedResources = db.transaction(() => {
  resources.forEach(r => insertResource.run(r.cat, r.icon, r.title, r.sub, r.url, r.sort));
});
seedResources();
console.log(`  ${resources.length} PBIS resources seeded`);

// ===== SEED SCHOOL SETTINGS =====
const upsertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, datetime("now"))');
const seedSettings = db.transaction(() => {
  upsertSetting.run('schoolName', 'Rolling Hills Elementary');
  upsertSetting.run('district', 'Fairfield-Suisun Unified School District');
  upsertSetting.run('mascot', 'RedHawks');
  upsertSetting.run('gmailConfigured', '0');
  upsertSetting.run('gmailSender', 'rollinghills.automation@gmail.com');
});
seedSettings();
console.log('  School settings seeded');

console.log('Database initialization complete!');
process.exit(0);
}

init().catch(err => { console.error('Init failed:', err); process.exit(1); });
