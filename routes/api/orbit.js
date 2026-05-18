const express = require('express');
const router = express.Router();
const db = require('../../config/db');

router.get('/location/:locationId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM orbit_configs WHERE entity_location_id = ?', [req.params.locationId]
    );
    res.json(rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/location/:locationId', async (req, res) => {
  const { orbit_center_lat, orbit_center_lng, orbit_altitude, orbit_pitch, orbit_initial_heading,
    orbit_range, orbit_rotation_type, orbit_rotation_speed, scan_target_lat, scan_target_lng,
    scan_effect_enabled, camera_v_offset, camera_h_offset } = req.body;
  const vals = [
    orbit_center_lat || null, orbit_center_lng || null, orbit_altitude || 400,
    orbit_pitch || -22, orbit_initial_heading || 0, orbit_range || 400,
    orbit_rotation_type || '360', orbit_rotation_speed || 0.12,
    scan_target_lat || null, scan_target_lng || null,
    scan_effect_enabled ? 1 : 0, camera_v_offset || 0, camera_h_offset || 0
  ];
  try {
    const [existing] = await db.query(
      'SELECT id FROM orbit_configs WHERE entity_location_id = ?', [req.params.locationId]
    );
    if (existing.length) {
      await db.query(
        `UPDATE orbit_configs SET orbit_center_lat=?, orbit_center_lng=?, orbit_altitude=?,
          orbit_pitch=?, orbit_initial_heading=?, orbit_range=?, orbit_rotation_type=?,
          orbit_rotation_speed=?, scan_target_lat=?, scan_target_lng=?, scan_effect_enabled=?,
          camera_v_offset=?, camera_h_offset=? WHERE entity_location_id=?`,
        [...vals, req.params.locationId]
      );
      res.json({ id: existing[0].id, updated: true });
    } else {
      const [result] = await db.query(
        `INSERT INTO orbit_configs (entity_location_id, orbit_center_lat, orbit_center_lng,
          orbit_altitude, orbit_pitch, orbit_initial_heading, orbit_range, orbit_rotation_type,
          orbit_rotation_speed, scan_target_lat, scan_target_lng, scan_effect_enabled,
          camera_v_offset, camera_h_offset)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.params.locationId, ...vals]
      );
      res.status(201).json({ id: result.insertId, updated: false });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
