const express = require('express');
const router = express.Router();
const db = require('../../config/db');

router.get('/', async (req, res) => {
  try {
    const { entity_id } = req.query;
    let q = `SELECT el.*, e.name AS entity_name
      FROM entity_locations el
      JOIN entities e ON e.id = el.entity_id`;
    const params = [];
    if (entity_id) { q += ' WHERE el.entity_id = ?'; params.push(entity_id); }
    q += ' ORDER BY e.name, el.city';
    const [rows] = await db.query(q, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM entity_locations WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { entity_id, campus_name, city, country, continent, address, latitude, longitude,
    closest_airport_name, closest_airport_code, flight_duration_from_ist_min, status } = req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO entity_locations (entity_id, campus_name, city, country, continent, address,
        latitude, longitude, closest_airport_name, closest_airport_code,
        flight_duration_from_ist_min, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entity_id, campus_name || null, city, country, continent, address || null,
       latitude || null, longitude || null, closest_airport_name || null,
       closest_airport_code || null, flight_duration_from_ist_min || null, status || 'active']
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { entity_id, campus_name, city, country, continent, address, latitude, longitude,
    closest_airport_name, closest_airport_code, flight_duration_from_ist_min, status } = req.body;
  try {
    await db.query(
      `UPDATE entity_locations SET entity_id=?, campus_name=?, city=?, country=?, continent=?,
        address=?, latitude=?, longitude=?, closest_airport_name=?, closest_airport_code=?,
        flight_duration_from_ist_min=?, status=? WHERE id=?`,
      [entity_id, campus_name || null, city, country, continent, address || null,
       latitude || null, longitude || null, closest_airport_name || null,
       closest_airport_code || null, flight_duration_from_ist_min || null, status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM entity_locations WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
