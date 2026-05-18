const express = require('express');
const router = express.Router();
const db = require('../../config/db');

router.get('/', async (req, res) => {
  try {
    const { location_id } = req.query;
    let q = 'SELECT * FROM media';
    const params = [];
    if (location_id) { q += ' WHERE entity_location_id = ?'; params.push(location_id); }
    q += ' ORDER BY sort_order, id';
    const [rows] = await db.query(q, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM media WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { entity_location_id, type, url, caption, sort_order } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO media (entity_location_id, type, url, caption, sort_order) VALUES (?, ?, ?, ?, ?)',
      [entity_location_id, type, url, caption || null, sort_order || 0]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { type, url, caption, sort_order } = req.body;
  try {
    await db.query(
      'UPDATE media SET type=?, url=?, caption=?, sort_order=? WHERE id=?',
      [type, url, caption || null, sort_order || 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM media WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
