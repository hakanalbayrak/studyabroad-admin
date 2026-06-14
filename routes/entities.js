const router = require('express').Router();
const db = require('../db');
const { autoGeoLookup } = require('../utils/geoLookup');

// Entity list with location preview and program count
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT e.*,
        el.city, el.country, el.id as location_id,
        el.latitude, el.longitude,
        COALESCE((
          SELECT COUNT(*) FROM programs p
          WHERE p.entity_location_id IN (SELECT id FROM entity_locations WHERE entity_id = e.id)
        ), 0) as programs_count
      FROM entities e
      LEFT JOIN entity_locations el ON el.id = (
        SELECT MIN(id) FROM entity_locations WHERE entity_id = e.id
      )
      ORDER BY e.name
    `);
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

// Full entity detail for editing (entity + first location + orbit + programs)
router.get('/full/:id', async (req, res) => {
  try {
    const [[entity]] = await db.query('SELECT * FROM entities WHERE id = ?', [req.params.id]);
    if (!entity) return res.status(404).json({ error: 'Not found' });

    const [locations] = await db.query('SELECT * FROM entity_locations WHERE entity_id = ? LIMIT 1', [entity.id]);
    const location = locations[0] || null;

    let orbit = null;
    let programs = [];
    if (location) {
      const [orbits] = await db.query('SELECT * FROM orbit_configs WHERE entity_location_id = ? LIMIT 1', [location.id]);
      orbit = orbits[0] || null;
      const [progs] = await db.query('SELECT * FROM programs WHERE entity_location_id = ? ORDER BY id', [location.id]);
      programs = progs;
    }

    res.json({ entity, location, orbit, programs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM entities WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Transactional create: entity + location + orbit_config + programs
router.post('/full', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { entity, location, orbit, programs } = req.body;

    if (!entity?.name || !entity?.type) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'entity.name and entity.type are required' });
    }
    if (!location?.city || !location?.country || !location?.continent) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ error: 'location city, country and continent are required' });
    }

    const [entRes] = await conn.query(
      `INSERT INTO entities (name, type, website_url, logo_url, description_en,
        qs_rank, qs_rank_year, the_rank, the_rank_year,
        leiden_rank, leiden_rank_year, shanghai_rank, shanghai_rank_year, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entity.name, entity.type, entity.website_url || null, entity.logo_url || null,
       entity.description_en || null,
       entity.qs_rank || null, entity.qs_rank_year || null,
       entity.the_rank || null, entity.the_rank_year || null,
       entity.leiden_rank || null, entity.leiden_rank_year || null,
       entity.shanghai_rank || null, entity.shanghai_rank_year || null,
       entity.status || 'pending']
    );
    const entityId = entRes.insertId;

    const [locRes] = await conn.query(
      `INSERT INTO entity_locations (entity_id, campus_name, city, country, continent, address,
       latitude, longitude, closest_airport_name, closest_airport_code, flight_duration_from_ist_min, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entityId, location.campus_name || null, location.city, location.country, location.continent,
       location.address || null, location.latitude ?? null, location.longitude ?? null,
       location.closest_airport_name || null, location.closest_airport_code || null,
       location.flight_duration_from_ist_min ?? null, location.status || 'active']
    );
    const locationId = locRes.insertId;

    const o = orbit || {};
    await conn.query(
      `INSERT INTO orbit_configs (entity_location_id, orbit_center_lat, orbit_center_lng,
       orbit_altitude, orbit_pitch, orbit_initial_heading, orbit_range, orbit_rotation_type,
       orbit_rotation_speed, scan_target_lat, scan_target_lng, scan_effect_enabled, camera_v_offset, camera_h_offset)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [locationId,
       o.orbit_center_lat ?? null, o.orbit_center_lng ?? null,
       o.orbit_altitude ?? 400, o.orbit_pitch ?? -45, o.orbit_initial_heading ?? 0,
       o.orbit_range ?? 400, o.orbit_rotation_type || '360', o.orbit_rotation_speed ?? 0.12,
       o.scan_target_lat ?? null, o.scan_target_lng ?? null,
       o.scan_effect_enabled ? 1 : 0, o.camera_v_offset ?? 0, o.camera_h_offset ?? 0]
    );

    for (const p of (programs || [])) {
      if (!p.program_type_id || !p.name) continue;
      await conn.query(
        `INSERT INTO programs (entity_location_id, program_type_id, name, language_of_instruction,
         duration, tuition_fee, tuition_currency, intake_months, english_req_type, english_req_score,
         gpa_requirement, scholarship_available, description_en, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [locationId, p.program_type_id, p.name, p.language_of_instruction || 'English',
         p.duration || null, p.tuition_fee || null, p.tuition_currency || 'EUR',
         p.intake_months || null, p.english_req_type || 'None', p.english_req_score || null,
         p.gpa_requirement || null, p.scholarship_available ? 1 : 0,
         p.description_en || null, p.status || 'active']
      );
    }

    await conn.commit();
    res.status(201).json({ id: entityId });

    // Auto-fill coordinates in the background if none were provided
    if (!location.latitude && !location.longitude) {
      autoGeoLookup(locationId, entity.name, location.country);
    }
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
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

// Transactional update: entity + location + orbit_config + programs
router.put('/full/:id', async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { entity, location, orbit, programs } = req.body;
    const entityId = req.params.id;

    await conn.query(
      `UPDATE entities SET name=?, type=?, website_url=?, logo_url=?, description_en=?,
        qs_rank=?, qs_rank_year=?, the_rank=?, the_rank_year=?,
        leiden_rank=?, leiden_rank_year=?, shanghai_rank=?, shanghai_rank_year=?, status=?
       WHERE id=?`,
      [entity.name, entity.type, entity.website_url || null, entity.logo_url || null,
       entity.description_en || null,
       entity.qs_rank || null, entity.qs_rank_year || null,
       entity.the_rank || null, entity.the_rank_year || null,
       entity.leiden_rank || null, entity.leiden_rank_year || null,
       entity.shanghai_rank || null, entity.shanghai_rank_year || null,
       entity.status, entityId]
    );

    const [existingLocs] = await conn.query('SELECT id FROM entity_locations WHERE entity_id = ? LIMIT 1', [entityId]);
    let locationId;
    if (existingLocs.length) {
      locationId = existingLocs[0].id;
      await conn.query(
        `UPDATE entity_locations SET campus_name=?, city=?, country=?, continent=?, address=?,
         latitude=?, longitude=?, closest_airport_name=?, closest_airport_code=?,
         flight_duration_from_ist_min=?, status=? WHERE id=?`,
        [location.campus_name || null, location.city, location.country, location.continent,
         location.address || null, location.latitude ?? null, location.longitude ?? null,
         location.closest_airport_name || null, location.closest_airport_code || null,
         location.flight_duration_from_ist_min ?? null, location.status || 'active', locationId]
      );
    } else {
      const [locRes] = await conn.query(
        `INSERT INTO entity_locations (entity_id, campus_name, city, country, continent, address,
         latitude, longitude, closest_airport_name, closest_airport_code, flight_duration_from_ist_min, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [entityId, location.campus_name || null, location.city, location.country, location.continent,
         location.address || null, location.latitude ?? null, location.longitude ?? null,
         location.closest_airport_name || null, location.closest_airport_code || null,
         location.flight_duration_from_ist_min ?? null, location.status || 'active']
      );
      locationId = locRes.insertId;
    }

    const [existingOrbits] = await conn.query('SELECT id FROM orbit_configs WHERE entity_location_id = ? LIMIT 1', [locationId]);
    const o = orbit || {};
    const orbitVals = [
      o.orbit_center_lat ?? null, o.orbit_center_lng ?? null,
      o.orbit_altitude ?? 400, o.orbit_pitch ?? -45, o.orbit_initial_heading ?? 0,
      o.orbit_range ?? 400, o.orbit_rotation_type || '360', o.orbit_rotation_speed ?? 0.12,
      o.scan_target_lat ?? null, o.scan_target_lng ?? null,
      o.scan_effect_enabled ? 1 : 0, o.camera_v_offset ?? 0, o.camera_h_offset ?? 0
    ];
    if (existingOrbits.length) {
      await conn.query(
        `UPDATE orbit_configs SET orbit_center_lat=?, orbit_center_lng=?, orbit_altitude=?,
         orbit_pitch=?, orbit_initial_heading=?, orbit_range=?, orbit_rotation_type=?,
         orbit_rotation_speed=?, scan_target_lat=?, scan_target_lng=?, scan_effect_enabled=?,
         camera_v_offset=?, camera_h_offset=? WHERE id=?`,
        [...orbitVals, existingOrbits[0].id]
      );
    } else {
      await conn.query(
        `INSERT INTO orbit_configs (entity_location_id, orbit_center_lat, orbit_center_lng,
         orbit_altitude, orbit_pitch, orbit_initial_heading, orbit_range, orbit_rotation_type,
         orbit_rotation_speed, scan_target_lat, scan_target_lng, scan_effect_enabled, camera_v_offset, camera_h_offset)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [locationId, ...orbitVals]
      );
    }

    await conn.query('DELETE FROM programs WHERE entity_location_id = ?', [locationId]);
    for (const p of (programs || [])) {
      if (!p.program_type_id || !p.name) continue;
      await conn.query(
        `INSERT INTO programs (entity_location_id, program_type_id, name, language_of_instruction,
         duration, tuition_fee, tuition_currency, intake_months, english_req_type, english_req_score,
         gpa_requirement, scholarship_available, description_en, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [locationId, p.program_type_id, p.name, p.language_of_instruction || 'English',
         p.duration || null, p.tuition_fee || null, p.tuition_currency || 'EUR',
         p.intake_months || null, p.english_req_type || 'None', p.english_req_score || null,
         p.gpa_requirement || null, p.scholarship_available ? 1 : 0,
         p.description_en || null, p.status || 'active']
      );
    }

    await conn.commit();
    res.json({ success: true });

    // Auto-fill coordinates in the background if none were provided
    if (!location.latitude && !location.longitude) {
      autoGeoLookup(locationId, entity.name, location.country);
    }
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ error: e.message });
  } finally {
    conn.release();
  }
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
