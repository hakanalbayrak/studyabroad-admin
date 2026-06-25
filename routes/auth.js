const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireRole } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const [[user]] = await db.query(
      'SELECT id, email, name, role, password_hash, status FROM users WHERE email = ? LIMIT 1',
      [email.toLowerCase().trim()]
    );
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (user.status === 'inactive') return res.status(403).json({ error: 'Account is inactive' });
    if (user.status === 'pending') return res.status(403).json({ error: 'Account pending approval' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: signToken(user), role: user.role, name: user.name, email: user.email });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Name, email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?)',
      [email.toLowerCase().trim(), hash, name.trim(), 'enduser', 'active']
    );
    const user = { id: result.insertId, email: email.toLowerCase().trim(), role: 'enduser', name: name.trim() };
    res.status(201).json({ token: signToken(user), role: 'enduser', name: user.name, email: user.email });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: e.message });
  }
});

router.get('/me', requireRole('admin', 'affiliate', 'enduser'), (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role });
});

module.exports = router;
