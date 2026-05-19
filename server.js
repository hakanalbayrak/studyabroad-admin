require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { login, logout, auth } = require('./middleware/auth');

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

// Protected API routes
app.use('/api/entities', auth, require('./routes/entities'));
app.use('/api/locations', auth, require('./routes/locations'));
app.use('/api/programs', auth, require('./routes/programs'));
app.use('/api/orbit', auth, require('./routes/orbit'));
app.use('/api/program-types', auth, require('./routes/programTypes'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
