require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const db = require('./db/connection');

async function startServer() {
  // Wait for sql.js to initialize if needed
  if (db._ready) await db._ready;

  const app = express();

  // Middleware
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Static files (frontend)
  app.use(express.static(path.join(__dirname, '..', 'frontend')));

  // API Routes
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/students', require('./routes/students'));
  app.use('/api/staff', require('./routes/staff'));
  app.use('/api/referrals', require('./routes/referrals'));
  app.use('/api/communications', require('./routes/communications'));
  app.use('/api/analytics', require('./routes/analytics'));
  app.use('/api/permissions', require('./routes/permissions'));
  app.use('/api/gmail', require('./routes/gmail'));
  app.use('/api/settings', require('./routes/settings'));
  app.use('/api/import', require('./routes/import'));

  // SPA fallback — serve index.html for non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
    }
  });

  // Error handler
  app.use(errorHandler);

  app.listen(config.port, () => {
    console.log(`Discipline Tracker running on port ${config.port} [${db._engine}]`);
    console.log(`  Frontend: http://localhost:${config.port}`);
    console.log(`  API: http://localhost:${config.port}/api`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
