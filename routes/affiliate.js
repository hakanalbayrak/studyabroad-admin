const router = require('express').Router();
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const affiliateAuth = requireRole('affiliate', 'admin');

router.get('/dashboard', affiliateAuth, async (req, res) => {
  try {
    const [[user]] = await db.query(
      'SELECT id, name, email, affiliate_code FROM users WHERE id=?', [req.user.id]
    );
    const code = user.affiliate_code;
    const [[stats]] = await db.query(`
      SELECT COUNT(*) as total,
        SUM(status='new') as new_count,
        SUM(status='contacted') as contacted,
        SUM(status='converted') as converted,
        SUM(status='closed') as closed
      FROM leads WHERE referred_by=?`, [code]);
    const [leads] = await db.query(`
      SELECT id, student_name, email, program_name, university_name, country, status, created_at
      FROM leads WHERE referred_by=? ORDER BY created_at DESC LIMIT 50`, [code]);
    res.json({ user, stats, leads });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
