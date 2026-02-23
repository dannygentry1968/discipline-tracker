const { google } = require('googleapis');
const db = require('../db/connection');
const config = require('../config');

class GmailService {
  constructor() {
    this.oauth2Client = null;
    this.initOAuth();
  }

  initOAuth() {
    if (config.gmail.clientId && config.gmail.clientSecret) {
      this.oauth2Client = new google.auth.OAuth2(
        config.gmail.clientId,
        config.gmail.clientSecret,
        config.gmail.redirectUri
      );
      // Load stored tokens
      const tokenRow = db.prepare('SELECT value FROM settings WHERE key = "gmailTokens"').get();
      if (tokenRow && tokenRow.value) {
        try {
          this.oauth2Client.setCredentials(JSON.parse(tokenRow.value));
        } catch (e) {
          console.error('Failed to parse stored Gmail tokens:', e.message);
        }
      }
    }
  }

  getAuthUrl() {
    if (!this.oauth2Client) throw new Error('Gmail OAuth not configured. Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET.');
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/gmail.send']
    });
  }

  async handleCallback(code) {
    if (!this.oauth2Client) throw new Error('Gmail OAuth not configured');
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    // Store tokens
    db.prepare('INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, datetime("now"))')
      .run('gmailTokens', JSON.stringify(tokens));
    db.prepare('INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, datetime("now"))')
      .run('gmailConfigured', '1');
    return tokens;
  }

  isConfigured() {
    const row = db.prepare('SELECT value FROM settings WHERE key = "gmailConfigured"').get();
    return row && row.value === '1';
  }

  async sendEmail(to, subject, body, communicationId = null) {
    if (!this.oauth2Client) throw new Error('Gmail OAuth not configured');
    if (!this.isConfigured()) throw new Error('Gmail not connected. Admin must complete OAuth setup.');

    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    const sender = config.gmail.sender;

    // Build RFC 2822 email
    const raw = Buffer.from(
      `From: ${sender}\r\n` +
      `To: ${to}\r\n` +
      `Subject: ${subject}\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n\r\n` +
      body
    ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Log the attempt
    const logResult = db.prepare(`INSERT INTO email_logs (communicationId, toEmail, subject, status)
      VALUES (?, ?, ?, 'pending')`).run(communicationId, to, subject);
    const logId = logResult.lastInsertRowid;

    try {
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw }
      });

      db.prepare('UPDATE email_logs SET status = "sent", gmailMessageId = ?, sentAt = datetime("now") WHERE id = ?')
        .run(response.data.id, logId);

      if (communicationId) {
        db.prepare('UPDATE communications SET sentViaEmail = 1 WHERE id = ?').run(communicationId);
      }

      return { success: true, messageId: response.data.id, logId };
    } catch (err) {
      db.prepare('UPDATE email_logs SET status = "failed", errorMessage = ? WHERE id = ?')
        .run(err.message, logId);

      // If token expired, try to refresh
      if (err.code === 401 || err.message.includes('invalid_grant')) {
        db.prepare('INSERT OR REPLACE INTO settings (key, value, updatedAt) VALUES (?, ?, datetime("now"))')
          .run('gmailConfigured', '0');
      }

      throw err;
    }
  }

  getEmailLogs(limit = 50) {
    return db.prepare('SELECT * FROM email_logs ORDER BY createdAt DESC LIMIT ?').all(limit);
  }
}

module.exports = new GmailService();
