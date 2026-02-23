require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  dbPath: process.env.DB_PATH || './data/db.sqlite',
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/api/gmail/callback',
    sender: process.env.GMAIL_SENDER || 'rollinghills.automation@gmail.com'
  },
  school: {
    name: process.env.SCHOOL_NAME || 'Rolling Hills Elementary',
    district: process.env.SCHOOL_DISTRICT || 'Fairfield-Suisun Unified School District'
  }
};
