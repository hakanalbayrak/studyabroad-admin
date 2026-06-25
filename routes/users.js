const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const adminOnly = requireRole('admin');

router.get('/', adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, email, name, role, status, affiliate_code, created_at FROM users ORDER BY role, name'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', adminOnly, async (req, res) => {
  const { email, password, name, role = 'enduser', status = 'active' } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Email, password and name required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const affiliate_code = role === 'affiliate' ? crypto.randomBytes(4).toString('hex').toUpperCase() : null;
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, name, role, status, affiliate_code) VALUES (?, ?, ?, ?, ?, ?)',
      [email.toLowerCase().trim(), hash, name.trim(), role, status, affiliate_code]
    );
    res.status(201).json({ id: result.insertId, email, name, role, status, affiliate_code });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  const { name, role, status, password } = req.body;
  try {
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      const hash = await bcrypt.hash(password, 12);
      await db.query('UPDATE users SET name=?, role=?, status=?, password_hash=? WHERE id=?',
        [name, role, status, hash, req.params.id]);
    } else {
      await db.query('UPDATE users SET name=?, role=?, status=? WHERE id=?',
        [name, role, status, req.params.id]);
    }
    if (role === 'affiliate') {
      const [[u]] = await db.query('SELECT affiliate_code FROM users WHERE id=?', [req.params.id]);
      if (!u.affiliate_code) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        await db.query('UPDATE users SET affiliate_code=? WHERE id=?', [code, req.params.id]);
      }
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', adminOnly, async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
