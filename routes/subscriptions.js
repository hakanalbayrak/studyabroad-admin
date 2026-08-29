const router = require('express').Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM subscription_tiers ORDER BY level');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { name, level, price_monthly, price_currency, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const [r] = await db.query(
      'INSERT INTO subscription_tiers (name, level, price_monthly, price_currency, description) VALUES (?,?,?,?,?)',
      [name.trim(), parseInt(level) || 1, parseFloat(price_monthly) || 0, (price_currency || 'USD').slice(0, 3), (description || '').trim() || null]
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', async (req, res) => {
  const { name, level, price_monthly, price_currency, description } = req.body;
  try {
    await db.query(
      'UPDATE subscription_tiers SET name=?, level=?, price_monthly=?, price_currency=?, description=? WHERE id=?',
      [name.trim(), parseInt(level) || 1, parseFloat(price_monthly) || 0, (price_currency || 'USD').slice(0, 3), (description || '').trim() || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM subscription_tiers WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
