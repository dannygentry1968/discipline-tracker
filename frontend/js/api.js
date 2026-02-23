// ===== API Client =====
const API = {
  async fetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
    if (res.status === 401) {
      window.location.href = '/login.html';
      throw new Error('Not authenticated');
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  // Auth
  async login(email, password) { return this.fetch('/api/auth/login', { method:'POST', body:JSON.stringify({email,password}) }); },
  async logout() { return this.fetch('/api/auth/logout', { method:'POST' }); },
  async me() { return this.fetch('/api/auth/me'); },
  async changePassword(currentPassword, newPassword) { return this.fetch('/api/auth/change-password', { method:'POST', body:JSON.stringify({currentPassword,newPassword}) }); },

  // Students
  async getStudents(params={}) { const q = new URLSearchParams(params).toString(); return this.fetch('/api/students'+(q?'?'+q:'')); },
  async getStudent(id) { return this.fetch('/api/students/'+id); },
  async createStudent(data) { return this.fetch('/api/students', { method:'POST', body:JSON.stringify(data) }); },
  async updateStudent(id, data) { return this.fetch('/api/students/'+id, { method:'PUT', body:JSON.stringify(data) }); },
  async deleteStudent(id) { return this.fetch('/api/students/'+id, { method:'DELETE' }); },
  async bulkImportStudents(students, filename) { return this.fetch('/api/students/bulk-import', { method:'POST', body:JSON.stringify({students,filename}) }); },

  // Staff
  async getStaff(params={}) { const q = new URLSearchParams(params).toString(); return this.fetch('/api/staff'+(q?'?'+q:'')); },
  async getStaffMember(id) { return this.fetch('/api/staff/'+id); },
  async createStaff(data) { return this.fetch('/api/staff', { method:'POST', body:JSON.stringify(data) }); },
  async updateStaff(id, data) { return this.fetch('/api/staff/'+id, { method:'PUT', body:JSON.stringify(data) }); },
  async deleteStaff(id) { return this.fetch('/api/staff/'+id, { method:'DELETE' }); },
  async resetStaffPassword(id, password) { return this.fetch('/api/staff/'+id+'/reset-password', { method:'POST', body:JSON.stringify({password}) }); },
  async bulkImportStaff(staff, filename) { return this.fetch('/api/staff/bulk-import', { method:'POST', body:JSON.stringify({staff,filename}) }); },

  // Referrals
  async getReferrals(params={}) { const q = new URLSearchParams(params).toString(); return this.fetch('/api/referrals'+(q?'?'+q:'')); },
  async getReferral(id) { return this.fetch('/api/referrals/'+id); },
  async createReferral(data) { return this.fetch('/api/referrals', { method:'POST', body:JSON.stringify(data) }); },
  async updateReferral(id, data) { return this.fetch('/api/referrals/'+id, { method:'PUT', body:JSON.stringify(data) }); },
  async updateReferralStatus(id, status) { return this.fetch('/api/referrals/'+id+'/status', { method:'PATCH', body:JSON.stringify({status}) }); },
  async deleteReferral(id) { return this.fetch('/api/referrals/'+id, { method:'DELETE' }); },

  // Communications
  async getComms(params={}) { const q = new URLSearchParams(params).toString(); return this.fetch('/api/communications'+(q?'?'+q:'')); },
  async getComm(id) { return this.fetch('/api/communications/'+id); },
  async createComm(data) { return this.fetch('/api/communications', { method:'POST', body:JSON.stringify(data) }); },

  // Analytics
  async getAnalyticsSummary() { return this.fetch('/api/analytics/summary'); },
  async getAnalyticsBehaviors() { return this.fetch('/api/analytics/behaviors'); },
  async getAnalyticsLocations() { return this.fetch('/api/analytics/locations'); },
  async getAnalyticsGrades() { return this.fetch('/api/analytics/grades'); },
  async getAnalyticsDayOfWeek() { return this.fetch('/api/analytics/day-of-week'); },
  async getAnalyticsMonthly() { return this.fetch('/api/analytics/monthly'); },
  async getAnalyticsTimeBlocks() { return this.fetch('/api/analytics/time-blocks'); },
  async getAnalyticsStudents() { return this.fetch('/api/analytics/students'); },
  async getAnalyticsStaff() { return this.fetch('/api/analytics/staff'); },
  async getAnalyticsRecidivism() { return this.fetch('/api/analytics/recidivism'); },
  async exportReferrals() { return this.fetch('/api/analytics/export'); },

  // Permissions
  async getPermissions() { return this.fetch('/api/permissions'); },
  async updateRolePerms(role, permissions) { return this.fetch('/api/permissions/'+role, { method:'PUT', body:JSON.stringify({permissions}) }); },
  async resetPermissions() { return this.fetch('/api/permissions/reset', { method:'POST' }); },

  // Gmail
  async getGmailStatus() { return this.fetch('/api/gmail/status'); },
  async getGmailAuthUrl() { return this.fetch('/api/gmail/auth'); },
  async sendEmail(to, subject, body, communicationId) { return this.fetch('/api/gmail/send', { method:'POST', body:JSON.stringify({to,subject,body,communicationId}) }); },
  async getEmailLogs(limit) { return this.fetch('/api/gmail/logs'+(limit?'?limit='+limit:'')); },

  // Settings
  async getSettings() { return this.fetch('/api/settings'); },
  async updateSettings(settings) { return this.fetch('/api/settings', { method:'PUT', body:JSON.stringify({settings}) }); },
  async getResources() { return this.fetch('/api/settings/resources'); },
  async updateResource(id, data) { return this.fetch('/api/settings/resources/'+id, { method:'PUT', body:JSON.stringify(data) }); },
  async createResource(data) { return this.fetch('/api/settings/resources', { method:'POST', body:JSON.stringify(data) }); },

  // Import (file upload)
  async uploadForPreview(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/import/preview', { method:'POST', credentials:'include', body:fd });
    if (res.status === 401) { window.location.href='/login.html'; throw new Error('Not authenticated'); }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },
  async validateImport(filePath, mapping, type, sheet) {
    return this.fetch('/api/import/validate', { method:'POST', body:JSON.stringify({filePath,mapping,type,sheet}) });
  }
};
