const router = require('express').Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT el.*, e.name as entity_name
      FROM entity_locations el
      JOIN entities e ON el.entity_id = e.id
      ORDER BY e.name, el.city
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM entity_locations WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { entity_id, campus_name, city, country, continent, address, latitude, longitude,
          closest_airport_name, closest_airport_code, flight_duration_from_ist_min, status } = req.body;
  if (!entity_id || !city || !country || !continent) {
    return res.status(400).json({ error: 'entity_id, city, country, continent are required' });
  }
  try {
    const [result] = await db.query(
      `INSERT INTO entity_locations
       (entity_id, campus_name, city, country, continent, address, latitude, longitude,
        closest_airport_name, closest_airport_code, flight_duration_from_ist_min, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entity_id, campus_name || null, city, country, continent, address || null,
       latitude || null, longitude || null, closest_airport_name || null,
       closest_airport_code || null, flight_duration_from_ist_min || null, status || 'active']
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM entity_locations WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
