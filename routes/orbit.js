const router = require('express').Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT oc.*, el.city, el.country, el.campus_name, e.name as entity_name
      FROM orbit_configs oc
      JOIN entity_locations el ON oc.entity_location_id = el.id
      JOIN entities e ON el.entity_id = e.id
      ORDER BY e.name, el.city
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM orbit_configs WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { entity_location_id, orbit_center_lat, orbit_center_lng, orbit_altitude, orbit_pitch,
          orbit_initial_heading, orbit_range, orbit_rotation_type, orbit_rotation_speed,
          scan_target_lat, scan_target_lng, scan_effect_enabled, camera_v_offset, camera_h_offset } = req.body;
  if (!entity_location_id) return res.status(400).json({ error: 'entity_location_id is required' });
  try {
    const [result] = await db.query(
      `INSERT INTO orbit_configs (entity_location_id, orbit_center_lat, orbit_center_lng,
       orbit_altitude, orbit_pitch, orbit_initial_heading, orbit_range, orbit_rotation_type,
       orbit_rotation_speed, scan_target_lat, scan_target_lng, scan_effect_enabled,
       camera_v_offset, camera_h_offset)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entity_location_id, orbit_center_lat || null, orbit_center_lng || null,
       orbit_altitude || 400, orbit_pitch || -22.00, orbit_initial_heading || 0,
       orbit_range || 400, orbit_rotation_type || '360', orbit_rotation_speed || 0.12,
       scan_target_lat || null, scan_target_lng || null, scan_effect_enabled ? 1 : 0,
       camera_v_offset || 0, camera_h_offset || 0]
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { entity_location_id, orbit_center_lat, orbit_center_lng, orbit_altitude, orbit_pitch,
          orbit_initial_heading, orbit_range, orbit_rotation_type, orbit_rotation_speed,
          scan_target_lat, scan_target_lng, scan_effect_enabled, camera_v_offset, camera_h_offset } = req.body;
  try {
    await db.query(
      `UPDATE orbit_configs SET entity_location_id=?, orbit_center_lat=?, orbit_center_lng=?,
       orbit_altitude=?, orbit_pitch=?, orbit_initial_heading=?, orbit_range=?,
       orbit_rotation_type=?, orbit_rotation_speed=?, scan_target_lat=?, scan_target_lng=?,
       scan_effect_enabled=?, camera_v_offset=?, camera_h_offset=? WHERE id=?`,
      [entity_location_id, orbit_center_lat || null, orbit_center_lng || null,
       orbit_altitude || 400, orbit_pitch || -22.00, orbit_initial_heading || 0,
       orbit_range || 400, orbit_rotation_type || '360', orbit_rotation_speed || 0.12,
       scan_target_lat || null, scan_target_lng || null, scan_effect_enabled ? 1 : 0,
       camera_v_offset || 0, camera_h_offset || 0, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM orbit_configs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
