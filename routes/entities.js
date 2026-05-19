const router = require('express').Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM entities ORDER BY name');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const [[{ count: entities }]] = await db.query('SELECT COUNT(*) as count FROM entities');
    const [[{ count: locations }]] = await db.query('SELECT COUNT(*) as count FROM entity_locations');
    const [[{ count: programs }]] = await db.query('SELECT COUNT(*) as count FROM programs');
    const [[{ count: orbits }]] = await db.query('SELECT COUNT(*) as count FROM orbit_configs');
    res.json({ entities, locations, programs, orbits });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM entities WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { name, type, website_url, logo_url, description_en, status } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
  try {
    const [result] = await db.query(
      'INSERT INTO entities (name, type, website_url, logo_url, description_en, status) VALUES (?, ?, ?, ?, ?, ?)',
      [name, type, website_url || null, logo_url || null, description_en || null, status || 'pending']
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { name, type, website_url, logo_url, description_en, status } = req.body;
  try {
    await db.query(
      'UPDATE entities SET name=?, type=?, website_url=?, logo_url=?, description_en=?, status=? WHERE id=?',
      [name, type, website_url || null, logo_url || null, description_en || null, status, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM entities WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
