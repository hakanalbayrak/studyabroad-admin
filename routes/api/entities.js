const express = require('express');
const router = express.Router();
const db = require('../../config/db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM entities ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM entities WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { name, type, website_url, logo_url, description_en, description_json, status } = req.body;
  try {
    const [result] = await db.query(
      'INSERT INTO entities (name, type, website_url, logo_url, description_en, description_json, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, type, website_url || null, logo_url || null, description_en || null,
       description_json ? JSON.stringify(description_json) : null, status || 'pending']
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { name, type, website_url, logo_url, description_en, description_json, status } = req.body;
  try {
    await db.query(
      'UPDATE entities SET name=?, type=?, website_url=?, logo_url=?, description_en=?, description_json=?, status=? WHERE id=?',
      [name, type, website_url || null, logo_url || null, description_en || null,
       description_json ? JSON.stringify(description_json) : null, status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM entities WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
