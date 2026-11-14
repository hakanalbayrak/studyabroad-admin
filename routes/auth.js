const router = require('express').Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { signToken, requireRole } = require('../middleware/auth');
const { sendOtpCode } = require('../utils/mailer');

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

// ── Passwordless OTP sign-in (end users) ──────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Request a one-time code by email

router.post('/otp/request', async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  try {
    // Block OTP for staff accounts — they must use password login
    const [[staff]] = await db.query(
      "SELECT role FROM users WHERE email = ? AND role IN ('admin','affiliate') LIMIT 1",
      [email]
    );
    if (staff) return res.status(403).json({ error: 'This account uses password sign-in. Please use the staff login.' });

    const code = String(crypto.randomInt(100000, 1000000)); // 6 digits
    // expire any prior unused codes for this email, then store the new one
    await db.query('UPDATE login_otps SET used = 1 WHERE email = ? AND used = 0', [email]);
    await db.query(
      'INSERT INTO login_otps (email, code, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
      [email, code]
    );

    const sent = await sendOtpCode(email, code);
    if (!sent) return res.status(500).json({ error: 'Could not send email. Please try again later.' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Verify the code → create user if new → return JWT
router.post('/otp/verify', async (req, res) => {
  const email = (req.body.email || '').toLowerCase().trim();
  const code = (req.body.code || '').trim();
  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Invalid email or code.' });
  try {
    const [[row]] = await db.query(
      'SELECT id FROM login_otps WHERE email = ? AND code = ? AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [email, code]
    );
    if (!row) return res.status(401).json({ error: 'Code is invalid or has expired.' });
    await db.query('UPDATE login_otps SET used = 1 WHERE id = ?', [row.id]);

    let [[user]] = await db.query('SELECT id, email, name, role, status FROM users WHERE email = ? LIMIT 1', [email]);
    if (!user) {
      const name = email.split('@')[0];
      const [result] = await db.query(
        "INSERT INTO users (email, password_hash, name, role, status) VALUES (?, '', ?, 'enduser', 'active')",
        [email, name]
      );
      user = { id: result.insertId, email, name, role: 'enduser', status: 'active' };
    }
    if (user.status === 'inactive') return res.status(403).json({ error: 'Account is inactive.' });
    res.json({ token: signToken(user), role: user.role, name: user.name, email: user.email });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/me', requireRole('admin', 'affiliate', 'enduser'), (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role });
});

module.exports = router;
