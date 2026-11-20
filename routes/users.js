const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const adminOnly = requireRole('admin');

router.get('/', adminOnly, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT u.id, u.email, u.name, u.role, u.status, u.affiliate_code, u.subscription_tier_id, u.created_at, st.name AS tier_name FROM users u LEFT JOIN subscription_tiers st ON st.id = u.subscription_tier_id ORDER BY u.role, u.name'
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
    const tier_id = req.body.subscription_tier_id ? parseInt(req.body.subscription_tier_id) : null;
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, name, role, status, affiliate_code, subscription_tier_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [email.toLowerCase().trim(), hash, name.trim(), role, status, affiliate_code, tier_id]
    );
    res.status(201).json({ id: result.insertId, email, name, role, status, affiliate_code });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already registered' });
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', adminOnly, async (req, res) => {
  const { name, role, status, password } = req.body;
  const tier_id = req.body.subscription_tier_id !== undefined
    ? (req.body.subscription_tier_id ? parseInt(req.body.subscription_tier_id) : null)
    : undefined;
  try {
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      const hash = await bcrypt.hash(password, 12);
      if (tier_id !== undefined) {
        await db.query('UPDATE users SET name=?, role=?, status=?, password_hash=?, subscription_tier_id=? WHERE id=?',
          [name, role, status, hash, tier_id, req.params.id]);
      } else {
        await db.query('UPDATE users SET name=?, role=?, status=?, password_hash=? WHERE id=?',
          [name, role, status, hash, req.params.id]);
      }
    } else {
      if (tier_id !== undefined) {
        await db.query('UPDATE users SET name=?, role=?, status=?, subscription_tier_id=? WHERE id=?',
          [name, role, status, tier_id, req.params.id]);
      } else {
        await db.query('UPDATE users SET name=?, role=?, status=? WHERE id=?',
          [name, role, status, req.params.id]);
      }
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
