const router = require('express').Router();
const { requireAuth, requirePerm } = require('../middleware/auth');
const gmailService = require('../services/gmailService');

router.use(requireAuth);

// Get Gmail status
router.get('/status', (req, res) => {
  res.json({
    configured: gmailService.isConfigured(),
    oauthReady: !!gmailService.oauth2Client
  });
});

// Start OAuth flow (admin only)
router.get('/auth', requirePerm('manageSettings'), (req, res) => {
  try {
    const url = gmailService.getAuthUrl();
    res.json({ authUrl: url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// OAuth callback
router.get('/callback', async (req, res) => {
  try {
    await gmailService.handleCallback(req.query.code);
    // Redirect back to settings page
    res.redirect('/#settings?gmail=connected');
  } catch (err) {
    res.redirect('/#settings?gmail=error&message=' + encodeURIComponent(err.message));
  }
});

// Send email
router.post('/send', requirePerm('sendCommunications'), async (req, res) => {
  const { to, subject, body, communicationId } = req.body;
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'to, subject, and body required' });
  }
  try {
    const result = await gmailService.sendEmail(to, subject, body, communicationId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email', detail: err.message });
  }
});

// Email logs
router.get('/logs', requirePerm('viewAnalytics'), (req, res) => {
  const logs = gmailService.getEmailLogs(parseInt(req.query.limit) || 50);
  res.json(logs);
});

module.exports = router;
