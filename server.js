require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { login, logout, auth } = require('./middleware/auth');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve admin panel at /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

// Auth endpoints
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const token = login(password);
  if (!token) return res.status(401).json({ error: 'Invalid password' });
  res.json({ token });
});

app.post('/api/admin/logout', auth, (req, res) => {
  logout(req.token);
  res.json({ success: true });
});

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database connection test (public) — open in a browser to diagnose DB problems
app.get('/api/db-check', async (req, res) => {
  const mode = process.env.DB_SOCKET ? 'socket' : 'tcp';
  const config = {
    mode,
    socket: process.env.DB_SOCKET || null,
    host: process.env.DB_SOCKET ? null : (process.env.DB_HOST || 'localhost'),
    dbUser: process.env.DB_USER || null,
    dbName: process.env.DB_NAME || null
  };
  try {
    await db.query('SELECT 1');
    res.json({ database: 'connected', message: 'Database connection works.', config });
  } catch (e) {
    res.status(500).json({
      database: 'failed',
      error: e.message,
      config,
      hint: 'Check that DB_USER, DB_PASSWORD and DB_NAME match the cPanel MySQL settings.'
    });
  }
});

// Protected API routes
app.use('/api/entities', auth, require('./routes/entities'));
app.use('/api/locations', auth, require('./routes/locations'));
app.use('/api/programs', auth, require('./routes/programs'));
app.use('/api/orbit', auth, require('./routes/orbit'));
app.use('/api/program-types', auth, require('./routes/programTypes'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
