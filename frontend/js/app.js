// ===== DISCIPLINE TRACKER APP =====
let APP = { user: null, permissions: {}, students: [], staff: [], currentPage: 'dashboard' };

// Constants
const GRADES = ['K','1','2','3','4','5','6'];
const MINOR_BEHAVIORS = ['Non-compliance','Off-task behavior','Calling out/disrupting','Inappropriate language','Inappropriate gestures','Verbal conflict','Running/horseplay','Out of assigned area','Property misuse','Technology misuse','Dress code violation','Other minor'];
const MAJOR_BEHAVIORS = ['Fighting/Physical aggression','Bullying/Harassment','Threats/Intimidation','Weapons','Vandalism/Property damage','Theft','Elopement','Defiance/Insubordination','Drug/Tobacco/Alcohol','Arson','Sexual harassment','Cheating/Copying','Other major'];
const LOCATIONS = ['Classroom','Hallway','Cafeteria','Playground','Restroom','Library','Office','Gym','Parking Lot','Bus','Bus Loading Zone','Special Event','Field Trip','Before School','After School','Other'];
const ADMIN_ACTIONS = ['Parent Contact','Student Conference','Loss of Privilege','Detention','In-School Suspension','Out-of-School Suspension','Behavior Contract','Restorative Circle','Peer Mediation','Community Service','Schedule Change','Counseling Referral','SST Referral','Threat Assessment','Other'];
const TIME_BLOCKS = ['Before School','Block 1 (8:00-9:30)','Block 2 (9:30-10:15)','Recess (10:15-10:30)','Block 3 (10:30-12:00)','Lunch (12:00-12:45)','Block 4 (12:45-2:00)','Block 5 (2:00-2:45)','After School'];

// ===== INIT =====
async function initApp() {
  try {
    const data = await API.me();
    APP.user = data.user;
    APP.permissions = data.permissions;
    updateSidebar();
    showPage('dashboard');
  } catch (e) {
    window.location.href = '/login.html';
  }
}

function hasPerm(p) { return APP.permissions[p] === true; }

// ===== UTILITY =====
function formatDate(d) { if(!d) return ''; return new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
function formatDateTime(d) { return new Date(d).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); }
function toast(msg, type) {
  const t = document.getElementById('toast');
  t.innerHTML = msg; t.style.background = type==='warn'?'#e67e22':type==='error'?'#e74c3c':'var(--success)';
  t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3500);
}
function makeBar(data, cssClass) {
  const sorted = Object.entries(data).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if(!sorted.length) return '<p style="color:var(--text-light);font-size:12px;padding:8px;">No data yet</p>';
  const m = Math.max(...sorted.map(s=>s[1]));
  return '<div class="bar-chart">'+sorted.map(([k,v])=>
    '<div class="bar-row"><span class="bar-label" title="'+k+'">'+k+'</span><div class="bar-track"><div class="bar-fill '+cssClass+'" style="width:'+Math.max(v/m*100,8)+'%">'+v+'</div></div></div>'
  ).join('')+'</div>';
}
function escHtml(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }

// ===== NAVIGATION =====
function showPage(page) {
  APP.currentPage = page;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const el = document.getElementById('page-'+page);
  if(el) el.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const nav = document.querySelector('[data-page="'+page+'"]');
  if(nav) nav.classList.add('active');
  document.getElementById('page-title').textContent = getPageTitle(page);
  renderCurrentPage(page);
}

function getPageTitle(page) {
  const t = {dashboard:'Dashboard','new-referral':'New Referral',referrals:'All Referrals',students:'Student Profiles',
    communications:'Communications',analytics:'Advanced Analytics','admin-dashboard':'Admin Dashboard',
    'manage-staff':'Manage Staff','manage-students':'Manage Students',permissions:'Permissions',
    resources:'PBIS Resources',settings:'Settings'};
  return t[page]||page;
}

async function renderCurrentPage(page) {
  switch(page) {
    case 'dashboard': await renderDashboard(); break;
    case 'new-referral': await initReferralForm(); break;
    case 'referrals': await renderReferrals(); break;
    case 'students': await renderStudentsList(); break;
    case 'communications': await renderComms(); break;
    case 'analytics': await renderAnalytics(); break;
    case 'admin-dashboard': await renderAdminDashboard(); break;
    case 'manage-staff': await renderManageStaff(); break;
    case 'manage-students': await renderManageStudents(); break;
    case 'permissions': await renderPermissions(); break;
    case 'resources': await renderResources(); break;
    case 'settings': await renderSettings(); break;
  }
}

function updateSidebar() {
  const u = APP.user;
  document.getElementById('user-name').textContent = u.firstName+' '+u.lastName;
  document.getElementById('user-role').textContent = u.title||u.role;
  // Show/hide admin nav items
  document.querySelectorAll('[data-perm]').forEach(el => {
    el.style.display = hasPerm(el.dataset.perm) ? '' : 'none';
  });
}

// ===== DASHBOARD =====
async function renderDashboard() {
  try {
    const summary = await API.getAnalyticsSummary();
    document.getElementById('dash-stats').innerHTML =
      '<div class="stat-card c-primary"><div class="stat-icon">📊</div><div class="stat-num">'+summary.total+'</div><div class="stat-label">Total Referrals</div></div>'+
      '<div class="stat-card c-danger"><div class="stat-icon">🔴</div><div class="stat-num">'+summary.majors+'</div><div class="stat-label">Major Referrals</div></div>'+
      '<div class="stat-card c-warning"><div class="stat-icon">🟡</div><div class="stat-num">'+summary.minors+'</div><div class="stat-label">Minor Referrals</div></div>'+
      '<div class="stat-card c-info"><div class="stat-icon">📂</div><div class="stat-num">'+summary.open+'</div><div class="stat-label">Open / In Review</div></div>'+
      '<div class="stat-card c-success"><div class="stat-icon">👤</div><div class="stat-num">'+summary.uniqueStudents+'</div><div class="stat-label">Students Involved</div></div>'+
      '<div class="stat-card c-primary"><div class="stat-icon">📅</div><div class="stat-num">'+summary.thisMonth+'</div><div class="stat-label">This Month</div></div>';

    const [behaviors, locations] = await Promise.all([API.getAnalyticsBehaviors(), API.getAnalyticsLocations()]);
    const behaviorMap = {}; behaviors.forEach(b=>behaviorMap[b.behavior]=b.count);
    const locationMap = {}; locations.forEach(l=>locationMap[l.location]=l.count);
    document.getElementById('dash-charts').innerHTML =
      '<div class="chart-box"><h3>📊 Top Behaviors</h3>'+makeBar(behaviorMap,'fill-red')+'</div>'+
      '<div class="chart-box"><h3>📍 By Location</h3>'+makeBar(locationMap,'fill-blue')+'</div>';

    const referrals = await API.getReferrals();
    const recent = referrals.slice(0,8);
    document.getElementById('dash-recent').innerHTML = recent.map(r=>
      '<tr><td>'+formatDate(r.date)+'</td><td><strong>'+escHtml(r.studentName)+'</strong></td><td>'+r.studentGrade+'</td>'+
      '<td><span class="badge badge-'+r.type+'">'+r.type.toUpperCase()+'</span></td>'+
      '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+r.behaviors.join(', ')+'</td>'+
      '<td><span class="badge badge-'+r.status+'">'+r.status+'</span></td>'+
      '<td><button class="btn btn-xs btn-outline" onclick="viewDetail('+r.id+')">View</button></td></tr>'
    ).join('');
  } catch(e) { console.error('Dashboard error:', e); }
}

// ===== REFERRAL FORM =====
async function initReferralForm() {
  const [students, staff] = await Promise.all([API.getStudents(), API.getStaff()]);
  APP.students = students; APP.staff = staff;
  const form = document.getElementById('referral-form-content');
  if (!form) return;

  // Build student datalist
  let studentOptions = students.map(s=>'<option value="'+escHtml(s.lastName+', '+s.firstName)+'">').join('');
  // Build behavior checkboxes
  let minorChecks = MINOR_BEHAVIORS.map(b=>'<label class="check-label"><input type="checkbox" name="behavior" value="'+b+'"> '+b+'</label>').join('');
  let majorChecks = MAJOR_BEHAVIORS.map(b=>'<label class="check-label"><input type="checkbox" name="behavior" value="'+b+'"> '+b+'</label>').join('');
  let locationChecks = LOCATIONS.map(l=>'<label class="check-label"><input type="checkbox" name="location" value="'+l+'"> '+l+'</label>').join('');
  let adminActionChecks = ADMIN_ACTIONS.map(a=>'<label class="check-label"><input type="checkbox" name="adminAction" value="'+a+'"> '+a+'</label>').join('');

  form.innerHTML = '<form id="referralForm" onsubmit="submitReferral(event)">'+
    '<div class="form-row"><div class="form-group"><label>Type *</label><select id="ref-type" required onchange="toggleMajorFields()"><option value="minor">Minor</option><option value="major">Major</option></select></div>'+
    '<div class="form-group"><label>Date *</label><input type="date" id="ref-date" required value="'+new Date().toISOString().split('T')[0]+'"></div>'+
    '<div class="form-group"><label>Time</label><input type="time" id="ref-time"></div></div>'+
    '<div class="form-row"><div class="form-group" style="flex:2"><label>Student Name *</label><input type="text" id="ref-student" list="student-list" required placeholder="Last, First" oninput="autoFillStudent()"><datalist id="student-list">'+studentOptions+'</datalist></div>'+
    '<div class="form-group"><label>Grade</label><input type="text" id="ref-grade" readonly></div></div>'+
    '<div class="card"><h3>Behavior(s) Observed *</h3><div id="minor-behaviors" class="checkbox-grid">'+minorChecks+'</div>'+
    '<div id="major-behaviors" class="checkbox-grid" style="display:none;margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">'+majorChecks+'</div></div>'+
    '<div class="card"><h3>Location(s) *</h3><div class="checkbox-grid">'+locationChecks+'</div></div>'+
    '<div class="form-group"><label>Narrative / What Happened</label><textarea id="ref-narrative" rows="4" placeholder="Describe the incident..."></textarea></div>'+
    '<div class="form-group"><label>Interventions Already Tried</label><textarea id="ref-interventions" rows="3" placeholder="What has been tried so far..."></textarea></div>'+
    '<div id="major-fields" style="display:none;"><div class="card"><h3>Admin Actions</h3><div class="checkbox-grid">'+adminActionChecks+'</div></div></div>'+
    '<button type="submit" class="btn btn-primary" style="width:100%;padding:14px;font-size:16px;">Submit Referral</button></form>';
}

function toggleMajorFields() {
  const isMajor = document.getElementById('ref-type').value === 'major';
  document.getElementById('major-behaviors').style.display = isMajor ? '' : 'none';
  document.getElementById('major-fields').style.display = isMajor ? '' : 'none';
}

function autoFillStudent() {
  const val = document.getElementById('ref-student').value;
  const match = APP.students.find(s => (s.lastName+', '+s.firstName) === val);
  document.getElementById('ref-grade').value = match ? match.grade : '';
}

async function submitReferral(e) {
  e.preventDefault();
  const behaviors = [...document.querySelectorAll('input[name="behavior"]:checked')].map(c=>c.value);
  const locations = [...document.querySelectorAll('input[name="location"]:checked')].map(c=>c.value);
  const adminActions = [...document.querySelectorAll('input[name="adminAction"]:checked')].map(c=>c.value);

  if (!behaviors.length) { toast('Select at least one behavior','warn'); return; }
  if (!locations.length) { toast('Select at least one location','warn'); return; }

  const studentName = document.getElementById('ref-student').value;
  const student = APP.students.find(s => (s.lastName+', '+s.firstName) === studentName);

  try {
    const data = {
      type: document.getElementById('ref-type').value,
      date: document.getElementById('ref-date').value,
      time: document.getElementById('ref-time').value || null,
      studentId: student ? student.id : null,
      studentName: studentName,
      staffId: APP.user.id,
      narrative: document.getElementById('ref-narrative').value,
      interventions: document.getElementById('ref-interventions').value,
      behaviors, locations, adminActions
    };
    await API.createReferral(data);
    toast('Referral submitted successfully!');
    showPage('referrals');
  } catch(err) {
    toast(err.message, 'error');
  }
}

// ===== ALL REFERRALS =====
async function renderReferrals() {
  try {
    const params = {};
    const fType = document.getElementById('filter-type')?.value;
    const fGrade = document.getElementById('filter-grade')?.value;
    const fStatus = document.getElementById('filter-status')?.value;
    const fSearch = document.getElementById('filter-search')?.value;
    if(fType) params.type=fType;
    if(fGrade) params.grade=fGrade;
    if(fStatus) params.status=fStatus;
    if(fSearch) params.search=fSearch;

    const referrals = await API.getReferrals(params);
    document.getElementById('referral-count').textContent = referrals.length+' referral'+(referrals.length!==1?'s':'');
    document.getElementById('all-referrals-table').innerHTML = referrals.map(r=>
      '<tr><td>'+formatDate(r.date)+'</td><td><strong>'+escHtml(r.studentName)+'</strong></td><td>'+r.studentGrade+'</td>'+
      '<td>'+escHtml(r.staffName)+'</td>'+
      '<td><span class="badge badge-'+r.type+'">'+r.type.toUpperCase()+'</span></td>'+
      '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+r.behaviors.join(', ')+'</td>'+
      '<td>'+r.locations.join(', ')+'</td>'+
      '<td><select onchange="updateStatus('+r.id+',this.value)" style="padding:3px 6px;border-radius:6px;border:1px solid var(--border);font-size:11px;">'+
      '<option value="open"'+(r.status==='open'?' selected':'')+'>Open</option>'+
      '<option value="in-review"'+(r.status==='in-review'?' selected':'')+'>In Review</option>'+
      '<option value="resolved"'+(r.status==='resolved'?' selected':'')+'>Resolved</option></select></td>'+
      '<td><button class="btn btn-xs btn-outline" onclick="viewDetail('+r.id+')">👁</button>'+
      (hasPerm('deleteReferral')?'<button class="btn btn-xs btn-outline" style="color:var(--accent);" onclick="deleteReferral('+r.id+')">🗑</button>':'')+
      '</td></tr>'
    ).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--text-light);padding:24px;">No referrals match filters.</td></tr>';
  } catch(e) { console.error(e); }
}

async function updateStatus(id, status) {
  try { await API.updateReferralStatus(id, status); toast('Status updated'); } catch(e) { toast(e.message,'error'); }
}

async function deleteReferral(id) {
  if(!confirm('Delete this referral permanently?')) return;
  try { await API.deleteReferral(id); toast('Referral deleted'); renderReferrals(); } catch(e) { toast(e.message,'error'); }
}

// ===== VIEW DETAIL =====
async function viewDetail(id) {
  try {
    const r = await API.getReferral(id);
    const modal = document.getElementById('modal');
    modal.innerHTML = '<div class="modal-content"><span class="modal-close" onclick="closeModal()">&times;</span>'+
      '<h2><span class="badge badge-'+r.type+'">'+r.type.toUpperCase()+'</span> Referral #'+r.id+'</h2>'+
      '<div class="detail-grid">'+
      '<div><strong>Student:</strong> '+escHtml(r.studentName)+'</div>'+
      '<div><strong>Grade:</strong> '+r.studentGrade+'</div>'+
      '<div><strong>Date:</strong> '+formatDate(r.date)+'</div>'+
      '<div><strong>Time:</strong> '+(r.time||'N/A')+'</div>'+
      '<div><strong>Staff:</strong> '+escHtml(r.staffName)+'</div>'+
      '<div><strong>Status:</strong> <span class="badge badge-'+r.status+'">'+r.status+'</span></div>'+
      '</div>'+
      '<div class="detail-section"><strong>Behaviors:</strong> '+r.behaviors.join(', ')+'</div>'+
      '<div class="detail-section"><strong>Locations:</strong> '+r.locations.join(', ')+'</div>'+
      (r.narrative?'<div class="detail-section"><strong>Narrative:</strong><p>'+escHtml(r.narrative)+'</p></div>':'')+
      (r.interventions?'<div class="detail-section"><strong>Interventions:</strong><p>'+escHtml(r.interventions)+'</p></div>':'')+
      (r.adminActions&&r.adminActions.length?'<div class="detail-section"><strong>Admin Actions:</strong> '+r.adminActions.join(', ')+'</div>':'')+
      (r.adminNotes?'<div class="detail-section"><strong>Admin Notes:</strong><p>'+escHtml(r.adminNotes)+'</p></div>':'')+
      (r.aiTeacherAdvice?'<div class="detail-section ai-advice"><strong>🎯 Teacher Strategies:</strong><pre>'+escHtml(r.aiTeacherAdvice)+'</pre></div>':'')+
      (r.aiAdminAdvice?'<div class="detail-section ai-advice"><strong>📋 Admin Guidance:</strong><pre>'+escHtml(r.aiAdminAdvice)+'</pre></div>':'')+
      (r.aiParentLetter?'<div class="detail-section ai-advice"><strong>📝 Parent Letter Draft:</strong><pre>'+escHtml(r.aiParentLetter)+'</pre></div>':'')+
      (r.parentEmail?'<div style="margin-top:16px;"><button class="btn btn-primary" onclick="sendParentEmail('+r.id+')">📧 Send Parent Letter via Gmail</button></div>':'')+
      '</div>';
    modal.style.display = 'flex';
  } catch(e) { toast(e.message,'error'); }
}

function closeModal() { document.getElementById('modal').style.display='none'; }

async function sendParentEmail(refId) {
  try {
    const r = await API.getReferral(refId);
    if(!r.parentEmail) { toast('No parent email on file','warn'); return; }
    if(!r.aiParentLetter) { toast('No parent letter generated','warn'); return; }
    const subject = 'Behavioral Incident Report - '+r.studentName+' - Rolling Hills Elementary';
    await API.sendEmail(r.parentEmail, subject, r.aiParentLetter, null);
    toast('Email sent to '+r.parentEmail);
  } catch(e) { toast('Email failed: '+e.message,'error'); }
}

// ===== STUDENTS LIST =====
async function renderStudentsList() {
  try {
    const params = {};
    const grade = document.getElementById('student-grade-filter')?.value;
    const search = document.getElementById('student-search')?.value;
    if(grade) params.grade=grade;
    if(search) params.search=search;

    const students = await API.getStudents(params);
    // Get referral counts per student
    const referrals = await API.getReferrals();
    const refCounts = {};
    referrals.forEach(r => {
      const key = r.studentName.toLowerCase();
      if(!refCounts[key]) refCounts[key]={major:0,minor:0};
      refCounts[key][r.type]++;
    });

    document.getElementById('students-table').innerHTML = students.map(s => {
      const key = (s.lastName+', '+s.firstName).toLowerCase();
      const counts = refCounts[key] || {major:0,minor:0};
      const total = counts.major+counts.minor;
      const tier = counts.major>=3?'high':(counts.major>=1||total>=4)?'medium':'low';
      return '<tr><td><strong>'+escHtml(s.firstName+' '+s.lastName)+'</strong></td><td>'+s.grade+'</td>'+
        '<td style="color:var(--accent);font-weight:600;">'+counts.major+'</td>'+
        '<td style="color:#e67e22;font-weight:600;">'+counts.minor+'</td>'+
        '<td><strong>'+total+'</strong></td>'+
        '<td>'+(s.teacherName||'—')+'</td>'+
        '<td><span class="badge badge-'+tier+'">'+(tier==='high'?'Tier 3':tier==='medium'?'Tier 2':'Tier 1')+'</span></td>'+
        '<td><button class="btn btn-xs btn-outline" onclick="viewStudentProfile('+s.id+')">Profile</button></td></tr>';
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-light);padding:24px;">No students found.</td></tr>';
  } catch(e) { console.error(e); }
}

async function viewStudentProfile(id) {
  try {
    const s = await API.getStudent(id);
    const referrals = await API.getReferrals({studentId:id});
    const modal = document.getElementById('modal');
    modal.innerHTML = '<div class="modal-content" style="max-width:700px;"><span class="modal-close" onclick="closeModal()">&times;</span>'+
      '<h2>👤 '+escHtml(s.firstName+' '+s.lastName)+'</h2>'+
      '<div class="detail-grid">'+
      '<div><strong>Grade:</strong> '+s.grade+'</div>'+
      '<div><strong>Student ID:</strong> '+(s.studentId||'—')+'</div>'+
      '<div><strong>Teacher:</strong> '+(s.teacherName||'—')+'</div>'+
      '<div><strong>Sex:</strong> '+(s.sex||'—')+'</div>'+
      '<div><strong>IEP:</strong> '+(s.iep?'Yes':'No')+'</div>'+
      '<div><strong>504:</strong> '+(s.plan504?'Yes':'No')+'</div>'+
      '<div><strong>SST:</strong> '+(s.sst?'Yes':'No')+'</div>'+
      '<div><strong>Parent:</strong> '+(s.parentFirstName?s.parentFirstName+' '+s.parentLastName:'—')+'</div>'+
      '<div><strong>Parent Email:</strong> '+(s.parentEmail||'—')+'</div>'+
      '<div><strong>Parent Phone:</strong> '+(s.parentPhone||'—')+'</div>'+
      '</div>'+
      '<h3 style="margin-top:16px;">Referral History ('+referrals.length+')</h3>'+
      (referrals.length?'<table style="font-size:12px;"><thead><tr><th>Date</th><th>Type</th><th>Behaviors</th><th>Status</th></tr></thead><tbody>'+
      referrals.map(r=>'<tr><td>'+formatDate(r.date)+'</td><td><span class="badge badge-'+r.type+'">'+r.type+'</span></td><td>'+r.behaviors.join(', ')+'</td><td><span class="badge badge-'+r.status+'">'+r.status+'</span></td></tr>').join('')+
      '</tbody></table>':'<p style="color:var(--text-light);font-size:12px;">No referrals.</p>')+
      '</div>';
    modal.style.display = 'flex';
  } catch(e) { toast(e.message,'error'); }
}

// ===== COMMUNICATIONS =====
async function renderComms() {
  try {
    const params = {};
    const filter = document.getElementById('comm-filter')?.value;
    const search = document.getElementById('comm-search')?.value;
    if(filter) params.type=filter;
    if(search) params.search=search;
    const comms = await API.getComms(params);
    const icons = {'parent-letter':'📝','teacher-strategy':'📘','admin-notification':'🔔','custom':'✉️'};
    document.getElementById('comm-list').innerHTML = comms.map(c=>
      '<div class="comm-item" style="border-left-color:'+(c.type==='parent-letter'?'var(--accent-minor)':c.type==='teacher-strategy'?'var(--success)':'var(--primary)')+';">'+
      '<div class="comm-meta">'+(icons[c.type]||'📄')+' '+c.type+' · '+formatDateTime(c.createdAt)+
      (c.referralId?' · <a href="#" onclick="viewDetail('+c.referralId+');return false;" style="color:var(--primary);">View Referral</a>':'')+
      (c.sentViaEmail?' · <span style="color:var(--success);">✉️ Sent</span>':'')+
      '</div>'+
      '<div style="font-weight:600;font-size:13px;margin-bottom:4px;">'+escHtml(c.subject)+'</div>'+
      '<div class="comm-body" style="white-space:pre-wrap;max-height:120px;overflow:hidden;font-size:12px;">'+escHtml(c.body.substring(0,300))+(c.body.length>300?'…':'')+'</div>'+
      '</div>'
    ).join('') || '<p style="color:var(--text-light);padding:20px;text-align:center;">No communications found.</p>';
  } catch(e) { console.error(e); }
}

// ===== ANALYTICS =====
async function renderAnalytics() {
  try {
    const [summary, dayOfWeek, timeBlocks, grades, monthly, recidivism] = await Promise.all([
      API.getAnalyticsSummary(), API.getAnalyticsDayOfWeek(), API.getAnalyticsTimeBlocks(),
      API.getAnalyticsGrades(), API.getAnalyticsMonthly(), API.getAnalyticsRecidivism()
    ]);

    const el = document.getElementById('analytics-content');
    const dayMap = {}; dayOfWeek.forEach(d=>dayMap[d.day]=d.count);
    const timeMap = {}; timeBlocks.forEach(t=>timeMap[t.timeBlock]=t.count);
    const gradeMap = {}; grades.forEach(g=>gradeMap['Grade '+g.grade]=g.count);

    el.innerHTML =
      '<div class="stats-row">'+
      '<div class="stat-card c-info"><div class="stat-icon">🔄</div><div class="stat-num">'+recidivism.length+'</div><div class="stat-label">Repeat Students (2+)</div></div>'+
      '<div class="stat-card c-primary"><div class="stat-icon">📊</div><div class="stat-num">'+(summary.total?(summary.majors/summary.total*100).toFixed(0):0)+'%</div><div class="stat-label">Major Referral Rate</div></div>'+
      '</div>'+
      '<div class="charts-grid">'+
      '<div class="chart-box"><h3>📅 By Day of Week</h3>'+makeBar(dayMap,'fill-blue')+'</div>'+
      '<div class="chart-box"><h3>⏰ By Time Block</h3>'+makeBar(timeMap,'fill-teal')+'</div>'+
      '</div>'+
      '<div class="charts-grid">'+
      '<div class="chart-box"><h3>🎓 By Grade Level</h3>'+makeBar(gradeMap,'fill-purple')+'</div>'+
      '<div class="chart-box"><h3>📈 Monthly Trend</h3>'+renderMonthlyChart(monthly)+'</div>'+
      '</div>'+
      '<div class="card"><h2>🔄 Recidivism Analysis</h2>'+renderRecidivismTable(recidivism)+'</div>'+
      '<div class="card"><h2>📥 Data Export</h2><div class="btn-group">'+
      '<button class="btn btn-primary" onclick="exportAllCSV()">📥 Export All Referrals (CSV)</button>'+
      '</div></div>';
  } catch(e) { console.error(e); }
}

function renderMonthlyChart(data) {
  if(!data.length) return '<p style="color:var(--text-light);font-size:12px;">No data</p>';
  const map = {}; data.forEach(d=>map[d.month]=d.total);
  return makeBar(map,'fill-green');
}

function renderRecidivismTable(data) {
  if(!data.length) return '<p style="color:var(--success);font-size:12px;">No repeat offenders.</p>';
  return '<table style="font-size:12px;"><thead><tr><th>Student</th><th>Grade</th><th>Total</th><th>Majors</th><th>Span</th></tr></thead><tbody>'+
    data.map(s=>{
      const span = s.firstDate&&s.lastDate?Math.round((new Date(s.lastDate)-new Date(s.firstDate))/86400000):0;
      return '<tr><td><strong>'+escHtml(s.name)+'</strong></td><td>'+s.grade+'</td><td>'+s.total+'</td><td style="color:var(--accent);">'+s.majors+'</td><td>'+span+' days</td></tr>';
    }).join('')+'</tbody></table>';
}

async function exportAllCSV() {
  try {
    const data = await API.exportReferrals();
    const headers = ['ID','Type','Date','Time','Student','Grade','Staff','Behaviors','Locations','Narrative','Status'];
    const rows = data.map(r=>[r.id,r.type,r.date,r.time,r.studentName,r.studentGrade,r.staffName,
      '"'+r.behaviors.join('; ')+'"','"'+r.locations.join('; ')+'"','"'+(r.narrative||'').replace(/"/g,'""')+'"',r.status]);
    const csv = headers.join(',')+'\n'+rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob([csv],{type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'referrals_export_'+new Date().toISOString().split('T')[0]+'.csv';
    a.click();
    toast('Export downloaded!');
  } catch(e) { toast(e.message,'error'); }
}

// ===== ADMIN DASHBOARD =====
async function renderAdminDashboard() {
  try {
    const [summary, referrals] = await Promise.all([API.getAnalyticsSummary(), API.getReferrals()]);
    const openMajors = referrals.filter(r=>r.type==='major'&&r.status!=='resolved');
    const el = document.getElementById('admin-content');
    el.innerHTML =
      '<div class="stats-row">'+
      '<div class="stat-card c-danger"><div class="stat-icon">⚠️</div><div class="stat-num">'+openMajors.length+'</div><div class="stat-label">Open Major Referrals</div></div>'+
      '<div class="stat-card c-primary"><div class="stat-icon">📊</div><div class="stat-num">'+summary.total+'</div><div class="stat-label">Total Referrals</div></div>'+
      '<div class="stat-card c-success"><div class="stat-icon">📅</div><div class="stat-num">'+summary.thisMonth+'</div><div class="stat-label">This Month</div></div>'+
      '</div>'+
      '<div class="card"><h2>⚠️ Open Major Referrals Queue</h2>'+
      (openMajors.length?'<table style="font-size:12px;"><thead><tr><th>Date</th><th>Student</th><th>Grade</th><th>Staff</th><th>Behaviors</th><th>Action</th></tr></thead><tbody>'+
      openMajors.map(r=>'<tr><td>'+formatDate(r.date)+'</td><td><strong>'+escHtml(r.studentName)+'</strong></td><td>'+r.studentGrade+'</td><td>'+escHtml(r.staffName)+'</td><td>'+r.behaviors.join(', ')+'</td><td><button class="btn btn-xs btn-primary" onclick="viewDetail('+r.id+')">Review</button></td></tr>').join('')+
      '</tbody></table>':'<p style="color:var(--success);font-size:12px;">No open major referrals!</p>')+
      '</div>';
  } catch(e) { console.error(e); }
}

// ===== MANAGE STAFF =====
async function renderManageStaff() {
  try {
    const staff = await API.getStaff();
    document.getElementById('staff-table').innerHTML = staff.map(s=>
      '<tr><td><strong>'+escHtml(s.firstName+' '+s.lastName)+'</strong></td><td>'+escHtml(s.email)+'</td>'+
      '<td>'+s.role+'</td><td>'+(s.grade||'—')+'</td><td>'+(s.title||'—')+'</td>'+
      '<td><span class="badge badge-'+(s.active?'success':'secondary')+'">'+(s.active?'Active':'Inactive')+'</span></td>'+
      '<td><button class="btn btn-xs btn-outline" onclick="editStaff('+s.id+')">✏️</button>'+
      '<button class="btn btn-xs btn-outline" onclick="resetStaffPw('+s.id+')">🔑</button></td></tr>'
    ).join('');
  } catch(e) { console.error(e); }
}

async function editStaff(id) {
  const s = id ? await API.getStaffMember(id) : {};
  const modal = document.getElementById('modal');
  modal.innerHTML = '<div class="modal-content"><span class="modal-close" onclick="closeModal()">&times;</span>'+
    '<h2>'+(id?'Edit':'Add')+' Staff Member</h2>'+
    '<form onsubmit="saveStaff(event,'+id+')">'+
    '<div class="form-row"><div class="form-group"><label>First Name *</label><input type="text" id="sf-fn" value="'+(s.firstName||'')+'" required></div>'+
    '<div class="form-group"><label>Last Name *</label><input type="text" id="sf-ln" value="'+(s.lastName||'')+'" required></div></div>'+
    '<div class="form-row"><div class="form-group"><label>Email *</label><input type="email" id="sf-email" value="'+(s.email||'')+'" required></div>'+
    '<div class="form-group"><label>Phone</label><input type="text" id="sf-phone" value="'+(s.phone||'')+'"></div></div>'+
    '<div class="form-row"><div class="form-group"><label>Role</label><select id="sf-role">'+
    ['admin','teacher','staff','counselor','aide'].map(r=>'<option value="'+r+'"'+(s.role===r?' selected':'')+'>'+r+'</option>').join('')+'</select></div>'+
    '<div class="form-group"><label>Grade</label><select id="sf-grade"><option value="">—</option>'+GRADES.map(g=>'<option'+(s.grade===g?' selected':'')+'>'+g+'</option>').join('')+'</select></div></div>'+
    '<div class="form-row"><div class="form-group"><label>Title</label><input type="text" id="sf-title" value="'+(s.title||'')+'"></div>'+
    '<div class="form-group"><label>Employee ID</label><input type="text" id="sf-eid" value="'+(s.employeeId||'')+'"></div></div>'+
    '<button type="submit" class="btn btn-primary" style="width:100%;">Save</button></form></div>';
  modal.style.display='flex';
}

async function saveStaff(e, id) {
  e.preventDefault();
  const data = {
    firstName:document.getElementById('sf-fn').value, lastName:document.getElementById('sf-ln').value,
    email:document.getElementById('sf-email').value, phone:document.getElementById('sf-phone').value,
    role:document.getElementById('sf-role').value, grade:document.getElementById('sf-grade').value,
    title:document.getElementById('sf-title').value, employeeId:document.getElementById('sf-eid').value
  };
  try {
    if(id) await API.updateStaff(id, data); else await API.createStaff(data);
    toast(id?'Staff updated':'Staff created');
    closeModal(); renderManageStaff();
  } catch(e) { toast(e.message,'error'); }
}

async function resetStaffPw(id) {
  if(!confirm('Reset password to default?')) return;
  try { await API.resetStaffPassword(id); toast('Password reset to default'); } catch(e) { toast(e.message,'error'); }
}

// ===== MANAGE STUDENTS =====
async function renderManageStudents() {
  try {
    const students = await API.getStudents();
    document.getElementById('manage-students-table').innerHTML = students.map(s=>
      '<tr><td><strong>'+escHtml(s.firstName+' '+s.lastName)+'</strong></td><td>'+(s.studentId||'—')+'</td>'+
      '<td>'+s.grade+'</td><td>'+(s.teacherName||'—')+'</td><td>'+(s.parentEmail||'—')+'</td>'+
      '<td>'+(s.iep?'<span class="badge badge-info">IEP</span>':'')+
      (s.plan504?'<span class="badge badge-warning">504</span>':'')+
      (s.sst?'<span class="badge badge-secondary">SST</span>':'')+'</td>'+
      '<td><button class="btn btn-xs btn-outline" onclick="editStudent('+s.id+')">✏️</button></td></tr>'
    ).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-light);padding:24px;">No students. Add students or import from CSV.</td></tr>';
  } catch(e) { console.error(e); }
}

async function editStudent(id) {
  const s = id ? await API.getStudent(id) : {};
  const staff = await API.getStaff();
  const modal = document.getElementById('modal');
  modal.innerHTML = '<div class="modal-content" style="max-width:700px;"><span class="modal-close" onclick="closeModal()">&times;</span>'+
    '<h2>'+(id?'Edit':'Add')+' Student</h2>'+
    '<form onsubmit="saveStudent(event,'+id+')">'+
    '<div class="form-row"><div class="form-group"><label>First Name *</label><input type="text" id="st-fn" value="'+(s.firstName||'')+'" required></div>'+
    '<div class="form-group"><label>Last Name *</label><input type="text" id="st-ln" value="'+(s.lastName||'')+'" required></div>'+
    '<div class="form-group"><label>Student ID</label><input type="text" id="st-sid" value="'+(s.studentId||'')+'"></div></div>'+
    '<div class="form-row"><div class="form-group"><label>Grade *</label><select id="st-grade" required>'+GRADES.map(g=>'<option'+(s.grade===g?' selected':'')+'>'+g+'</option>').join('')+'</select></div>'+
    '<div class="form-group"><label>Sex</label><select id="st-sex"><option value="">—</option><option value="M"'+(s.sex==='M'?' selected':'')+'>Male</option><option value="F"'+(s.sex==='F'?' selected':'')+'>Female</option></select></div>'+
    '<div class="form-group"><label>Ethnicity</label><input type="text" id="st-eth" value="'+(s.ethnicity||'')+'"></div></div>'+
    '<div class="form-row"><div class="form-group"><label>Date of Birth</label><input type="date" id="st-dob" value="'+(s.dateOfBirth||'')+'"></div>'+
    '<div class="form-group"><label>Home Language</label><input type="text" id="st-lang" value="'+(s.homeLanguage||'')+'"></div>'+
    '<div class="form-group"><label>Teacher</label><select id="st-teacher"><option value="">—</option>'+staff.filter(t=>t.role==='teacher').map(t=>'<option value="'+t.id+'"'+(s.teacherId===t.id?' selected':'')+'>'+t.firstName+' '+t.lastName+'</option>').join('')+'</select></div></div>'+
    '<div class="form-row"><label class="check-label" style="padding:8px;"><input type="checkbox" id="st-iep"'+(s.iep?' checked':'')+'> IEP</label>'+
    '<label class="check-label" style="padding:8px;"><input type="checkbox" id="st-504"'+(s.plan504?' checked':'')+'> 504 Plan</label>'+
    '<label class="check-label" style="padding:8px;"><input type="checkbox" id="st-sst"'+(s.sst?' checked':'')+'> SST</label></div>'+
    '<h3 style="margin-top:16px;">Parent/Guardian Information</h3>'+
    '<div class="form-row"><div class="form-group"><label>Parent First Name</label><input type="text" id="st-pfn" value="'+(s.parentFirstName||'')+'"></div>'+
    '<div class="form-group"><label>Parent Last Name</label><input type="text" id="st-pln" value="'+(s.parentLastName||'')+'"></div></div>'+
    '<div class="form-row"><div class="form-group"><label>Parent Email</label><input type="email" id="st-pemail" value="'+(s.parentEmail||'')+'"></div>'+
    '<div class="form-group"><label>Parent Phone</label><input type="text" id="st-pphone" value="'+(s.parentPhone||'')+'"></div></div>'+
    '<div class="form-row"><div class="form-group"><label>Secondary Parent Name</label><input type="text" id="st-spname" value="'+(s.secondaryParentName||'')+'"></div>'+
    '<div class="form-group"><label>Secondary Parent Email</label><input type="email" id="st-spemail" value="'+(s.secondaryParentEmail||'')+'"></div></div>'+
    '<div class="form-group"><label>Address</label><input type="text" id="st-addr" value="'+(s.address||'')+'"></div>'+
    '<div class="form-row"><div class="form-group"><label>City</label><input type="text" id="st-city" value="'+(s.city||'')+'"></div>'+
    '<div class="form-group"><label>State</label><input type="text" id="st-state" value="'+(s.state||'CA')+'"></div>'+
    '<div class="form-group"><label>Zip</label><input type="text" id="st-zip" value="'+(s.zip||'')+'"></div></div>'+
    '<div class="form-group"><label>Notes</label><textarea id="st-notes" rows="2">'+(s.notes||'')+'</textarea></div>'+
    '<button type="submit" class="btn btn-primary" style="width:100%;">Save Student</button></form></div>';
  modal.style.display='flex';
}

async function saveStudent(e, id) {
  e.preventDefault();
  const data = {
    firstName:document.getElementById('st-fn').value, lastName:document.getElementById('st-ln').value,
    studentId:document.getElementById('st-sid').value, grade:document.getElementById('st-grade').value,
    sex:document.getElementById('st-sex').value, ethnicity:document.getElementById('st-eth').value,
    dateOfBirth:document.getElementById('st-dob').value, homeLanguage:document.getElementById('st-lang').value,
    teacherId:document.getElementById('st-teacher').value||null,
    iep:document.getElementById('st-iep').checked, plan504:document.getElementById('st-504').checked,
    sst:document.getElementById('st-sst').checked,
    parentFirstName:document.getElementById('st-pfn').value, parentLastName:document.getElementById('st-pln').value,
    parentEmail:document.getElementById('st-pemail').value, parentPhone:document.getElementById('st-pphone').value,
    secondaryParentName:document.getElementById('st-spname').value, secondaryParentEmail:document.getElementById('st-spemail').value,
    address:document.getElementById('st-addr').value, city:document.getElementById('st-city').value,
    state:document.getElementById('st-state').value, zip:document.getElementById('st-zip').value,
    notes:document.getElementById('st-notes').value
  };
  try {
    if(id) await API.updateStudent(id, data); else await API.createStudent(data);
    toast(id?'Student updated':'Student created');
    closeModal(); renderManageStudents();
  } catch(e) { toast(e.message,'error'); }
}

// ===== PERMISSIONS =====
async function renderPermissions() {
  try {
    const matrix = await API.getPermissions();
    const roles = ['admin','teacher','staff','counselor','aide'];
    const perms = Object.keys(matrix.admin||{});
    const el = document.getElementById('permissions-content');
    el.innerHTML = '<div style="overflow-x:auto;"><table style="font-size:12px;"><thead><tr><th>Permission</th>'+
      roles.map(r=>'<th style="text-align:center;">'+r+'</th>').join('')+'</tr></thead><tbody>'+
      perms.map(p=>'<tr><td>'+p+'</td>'+roles.map(r=>'<td style="text-align:center;"><input type="checkbox" data-role="'+r+'" data-perm="'+p+'"'+(matrix[r]&&matrix[r][p]?' checked':'')+(r==='admin'?' disabled':'')+' onchange="togglePerm(this)"></td>').join('')+'</tr>').join('')+
      '</tbody></table></div>'+
      '<button class="btn btn-secondary" style="margin-top:16px;" onclick="resetPermsToDefault()">Reset to Defaults</button>';
  } catch(e) { console.error(e); }
}

async function togglePerm(el) {
  const role=el.dataset.role, perm=el.dataset.perm;
  try {
    const perms = {}; perms[perm]=el.checked;
    await API.updateRolePerms(role, perms);
    toast('Permission updated');
  } catch(e) { toast(e.message,'error'); el.checked=!el.checked; }
}

async function resetPermsToDefault() {
  if(!confirm('Reset all permissions to defaults?')) return;
  try { await API.resetPermissions(); toast('Permissions reset'); renderPermissions(); } catch(e) { toast(e.message,'error'); }
}

// ===== RESOURCES =====
async function renderResources() {
  try {
    const resources = await API.getResources();
    const byCategory = {};
    resources.forEach(r => { if(!byCategory[r.category]) byCategory[r.category]=[]; byCategory[r.category].push(r); });
    document.getElementById('resources-grid').innerHTML = Object.entries(byCategory).map(([cat,items])=>
      '<h3 style="margin-top:16px;margin-bottom:8px;">'+cat+'</h3>'+
      '<div class="quick-links-grid">'+items.map(l=>
        '<a class="quick-link" href="'+l.url+'" target="_blank" rel="noopener">'+
        '<div class="ql-icon">'+(l.icon||'📄')+'</div>'+
        '<div><div class="ql-text">'+escHtml(l.title)+'</div><div class="ql-sub">'+(l.subtitle||'')+'</div></div></a>'
      ).join('')+'</div>'
    ).join('');
  } catch(e) { console.error(e); }
}

// ===== SETTINGS =====
async function renderSettings() {
  try {
    const [settings, gmailStatus] = await Promise.all([API.getSettings(), API.getGmailStatus()]);
    const el = document.getElementById('settings-content');
    el.innerHTML =
      '<div class="card"><h2>📧 Gmail Integration</h2>'+
      '<p style="font-size:12px;color:var(--text-light);margin-bottom:12px;">Status: <strong style="color:'+(gmailStatus.configured?'var(--success)':'var(--accent)')+';">'+(gmailStatus.configured?'Connected ✓':'Not Connected')+'</strong></p>'+
      '<p style="font-size:12px;margin-bottom:12px;">Sender: '+(settings.gmailSender||'rollinghills.automation@gmail.com')+'</p>'+
      (!gmailStatus.configured?'<button class="btn btn-primary" onclick="connectGmail()">Connect Gmail</button>':
      '<p style="font-size:12px;color:var(--success);">Gmail is connected and ready to send parent communications.</p>')+
      '</div>'+
      '<div class="card"><h2>🏫 School Settings</h2>'+
      '<div class="form-group"><label>School Name</label><input type="text" id="set-school" value="'+(settings.schoolName||'')+'"></div>'+
      '<div class="form-group"><label>District</label><input type="text" id="set-district" value="'+(settings.district||'')+'"></div>'+
      '<div class="form-group"><label>Mascot</label><input type="text" id="set-mascot" value="'+(settings.mascot||'')+'"></div>'+
      '<button class="btn btn-primary" onclick="saveSettings()">Save Settings</button></div>'+
      '<div class="card"><h2>🔑 Change Password</h2>'+
      '<div class="form-group"><label>Current Password</label><input type="password" id="set-curpw"></div>'+
      '<div class="form-group"><label>New Password</label><input type="password" id="set-newpw"></div>'+
      '<button class="btn btn-secondary" onclick="changePassword()">Update Password</button></div>';
  } catch(e) { console.error(e); }
}

async function connectGmail() {
  try {
    const data = await API.getGmailAuthUrl();
    window.open(data.authUrl, '_blank');
    toast('Complete Gmail authorization in the new window');
  } catch(e) { toast(e.message,'error'); }
}

async function saveSettings() {
  try {
    await API.updateSettings({
      schoolName:document.getElementById('set-school').value,
      district:document.getElementById('set-district').value,
      mascot:document.getElementById('set-mascot').value
    });
    toast('Settings saved');
  } catch(e) { toast(e.message,'error'); }
}

async function changePassword() {
  try {
    await API.changePassword(document.getElementById('set-curpw').value, document.getElementById('set-newpw').value);
    toast('Password updated');
    document.getElementById('set-curpw').value='';
    document.getElementById('set-newpw').value='';
  } catch(e) { toast(e.message,'error'); }
}

// ===== BULK IMPORT =====
async function showBulkImport(type) {
  const modal = document.getElementById('modal');
  modal.innerHTML = '<div class="modal-content" style="max-width:700px;"><span class="modal-close" onclick="closeModal()">&times;</span>'+
    '<h2>📥 Bulk Import '+(type==='students'?'Students':'Staff')+'</h2>'+
    '<p style="font-size:13px;color:var(--text-light);margin-bottom:16px;">Upload a CSV or Excel file. You will map columns to fields before importing.</p>'+
    '<input type="file" id="import-file" accept=".csv,.xlsx,.xls" onchange="handleImportFile(\''+type+'\')" style="margin-bottom:16px;">'+
    '<div id="import-preview"></div></div>';
  modal.style.display='flex';
}

async function handleImportFile(type) {
  const file = document.getElementById('import-file').files[0];
  if(!file) return;
  try {
    const preview = await API.uploadForPreview(file);
    window._importData = { ...preview, type };
    renderImportMapping(preview, type);
  } catch(e) { toast(e.message,'error'); }
}

function renderImportMapping(preview, type) {
  const targetFields = type==='students' ?
    [{k:'firstName',l:'First Name *'},{k:'lastName',l:'Last Name *'},{k:'grade',l:'Grade *'},{k:'studentId',l:'Student ID'},{k:'sex',l:'Sex'},{k:'ethnicity',l:'Ethnicity'},{k:'dateOfBirth',l:'Date of Birth'},{k:'homeLanguage',l:'Home Language'},{k:'parentFirstName',l:'Parent First'},{k:'parentLastName',l:'Parent Last'},{k:'parentEmail',l:'Parent Email'},{k:'parentPhone',l:'Parent Phone'},{k:'teacherName',l:'Teacher'}] :
    [{k:'firstName',l:'First Name *'},{k:'lastName',l:'Last Name *'},{k:'email',l:'Email *'},{k:'role',l:'Role'},{k:'grade',l:'Grade'},{k:'title',l:'Title'},{k:'phone',l:'Phone'},{k:'employeeId',l:'Employee ID'}];

  const headers = preview.headers;
  document.getElementById('import-preview').innerHTML =
    '<h3>Map Columns ('+preview.totalRows+' rows found)</h3>'+
    '<table style="font-size:12px;"><tbody>'+
    targetFields.map(f=>'<tr><td style="font-weight:600;">'+f.l+'</td><td><select id="map-'+f.k+'" style="width:100%;padding:4px;">'+
      '<option value="">— Skip —</option>'+
      headers.map(h=>'<option value="'+escHtml(h)+'"'+(h.toLowerCase().includes(f.k.toLowerCase())?' selected':'')+'>'+escHtml(h)+'</option>').join('')+
    '</select></td></tr>').join('')+
    '</tbody></table>'+
    '<div style="margin-top:8px;max-height:200px;overflow:auto;"><table style="font-size:11px;"><thead><tr>'+headers.map(h=>'<th>'+escHtml(h)+'</th>').join('')+'</tr></thead><tbody>'+
    preview.preview.slice(0,5).map(row=>'<tr>'+headers.map(h=>'<td>'+escHtml(String(row[h]||''))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'+
    '<button class="btn btn-primary" style="width:100%;margin-top:16px;" onclick="executeImport()">Import '+preview.totalRows+' Records</button>';

  // Auto-detect column mapping
  targetFields.forEach(f => {
    const sel = document.getElementById('map-'+f.k);
    if(sel && !sel.value) {
      // Try fuzzy match
      const match = headers.find(h => h.toLowerCase().replace(/[_\s]/g,'').includes(f.k.toLowerCase()));
      if(match) sel.value = match;
    }
  });
}

async function executeImport() {
  const data = window._importData;
  if(!data) return;

  const targetFields = data.type==='students' ?
    ['firstName','lastName','grade','studentId','sex','ethnicity','dateOfBirth','homeLanguage','parentFirstName','parentLastName','parentEmail','parentPhone','teacherName'] :
    ['firstName','lastName','email','role','grade','title','phone','employeeId'];

  const mapping = {};
  targetFields.forEach(f => {
    const sel = document.getElementById('map-'+f);
    if(sel && sel.value) mapping[f] = sel.value;
  });

  // Apply mapping to preview data
  const mapped = data.preview.map(row => {
    const obj = {};
    for(const [target, source] of Object.entries(mapping)) {
      if(row[source] !== undefined) obj[target] = String(row[source]).trim();
    }
    return obj;
  });

  // Need to re-parse server-side; send mapping for full import
  try {
    const validation = await API.validateImport(data.filePath, mapping, data.type, null);
    if(validation.errors.length > 0 && !confirm('Found '+validation.errors.length+' errors. Continue importing '+validation.validRows+' valid rows?')) return;

    // Now do the actual import by sending mapped data
    // Re-fetch full parsed data with mapping applied
    const allRows = []; // We'll send to bulk-import endpoint
    // For simplicity, use the preview data from server
    // Actually, the validate endpoint already parsed; let's import via bulk endpoint

    // Parse file on client if needed, or trust server-side
    if(data.type === 'students') {
      const result = await API.bulkImportStudents(validation.preview.concat(mapped), data.filename);
      toast('Imported: '+result.imported+' new, '+result.updated+' updated'+(result.skipped?' ('+result.skipped+' skipped)':''));
    } else {
      const result = await API.bulkImportStaff(validation.preview.concat(mapped), data.filename);
      toast('Imported: '+result.imported+' new, '+result.updated+' updated'+(result.skipped?' ('+result.skipped+' skipped)':''));
    }
    closeModal();
    if(data.type==='students') renderManageStudents(); else renderManageStaff();
  } catch(e) { toast(e.message,'error'); }
}

// ===== LOGOUT =====
async function logout() {
  try {
    await API.logout();
  } catch(e) {}
  sessionStorage.clear();
  window.location.href='/login.html';
}

// Init on load
document.addEventListener('DOMContentLoaded', initApp);
