const router = require('express').Router();
const db = require('../db');
const { requireRole } = require('../middleware/auth');

const userAuth = requireRole('enduser', 'admin', 'affiliate');

router.get('/saved', userAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT e.id, e.name, e.description_en, e.qs_rank, e.the_rank,
        el.city, el.country, su.created_at as saved_at
      FROM saved_universities su
      JOIN entities e ON e.id = su.entity_id
      LEFT JOIN entity_locations el ON el.id = (SELECT MIN(id) FROM entity_locations WHERE entity_id = e.id)
      WHERE su.user_id = ? ORDER BY su.created_at DESC`, [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/saved', userAuth, async (req, res) => {
  const { entity_id } = req.body;
  if (!entity_id) return res.status(400).json({ error: 'entity_id required' });
  try {
    const [[existing]] = await db.query(
      'SELECT id FROM saved_universities WHERE user_id=? AND entity_id=?',
      [req.user.id, entity_id]);
    if (existing) {
      await db.query('DELETE FROM saved_universities WHERE id=?', [existing.id]);
      res.json({ saved: false });
    } else {
      await db.query('INSERT INTO saved_universities (user_id, entity_id) VALUES (?,?)',
        [req.user.id, entity_id]);
      res.json({ saved: true });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/leads', userAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, student_name, program_name, university_name, status, created_at FROM leads WHERE user_id=? ORDER BY created_at DESC',
      [req.user.id]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/applications', userAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, university_name, program_name, country, status,
              desired_intake, preaccept_ref, preaccept_issued_at,
              (SELECT COUNT(*) FROM application_documents WHERE application_id = a.id) AS doc_count,
              created_at
       FROM applications a WHERE email = ? ORDER BY created_at DESC`,
      [req.user.email]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/profile', userAuth, async (req, res) => {
  try {
    const [[u]] = await db.query('SELECT id, email, name, role FROM users WHERE id = ?', [req.user.id]);
    res.json(u || {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/profile', userAuth, async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required.' });
  try {
    await db.query('UPDATE users SET name = ? WHERE id = ?', [name, req.user.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
