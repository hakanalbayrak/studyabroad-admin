const router = require('express').Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.*, pt.name as program_type_name, el.city, el.country, e.name as entity_name
      FROM programs p
      JOIN entity_locations el ON p.entity_location_id = el.id
      JOIN entities e ON el.entity_id = e.id
      JOIN program_types pt ON p.program_type_id = pt.id
      ORDER BY e.name, p.name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM programs WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { entity_location_id, program_type_id, name, language_of_instruction, duration,
          tuition_fee, tuition_currency, intake_months, english_req_type, english_req_score,
          gpa_requirement, scholarship_available, description_en, status } = req.body;
  if (!entity_location_id || !program_type_id || !name) {
    return res.status(400).json({ error: 'entity_location_id, program_type_id, name are required' });
  }
  try {
    const [result] = await db.query(
      `INSERT INTO programs (entity_location_id, program_type_id, name, language_of_instruction,
       duration, tuition_fee, tuition_currency, intake_months, english_req_type, english_req_score,
       gpa_requirement, scholarship_available, description_en, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entity_location_id, program_type_id, name, language_of_instruction || 'English',
       duration || null, tuition_fee || null, tuition_currency || 'EUR',
       intake_months || null, english_req_type || 'None', english_req_score || null,
       gpa_requirement || null, scholarship_available ? 1 : 0, description_en || null, status || 'active']
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { entity_location_id, program_type_id, name, language_of_instruction, duration,
          tuition_fee, tuition_currency, intake_months, english_req_type, english_req_score,
          gpa_requirement, scholarship_available, description_en, status } = req.body;
  try {
    await db.query(
      `UPDATE programs SET entity_location_id=?, program_type_id=?, name=?, language_of_instruction=?,
       duration=?, tuition_fee=?, tuition_currency=?, intake_months=?, english_req_type=?,
       english_req_score=?, gpa_requirement=?, scholarship_available=?, description_en=?, status=?
       WHERE id=?`,
      [entity_location_id, program_type_id, name, language_of_instruction || 'English',
       duration || null, tuition_fee || null, tuition_currency || 'EUR',
       intake_months || null, english_req_type || 'None', english_req_score || null,
       gpa_requirement || null, scholarship_available ? 1 : 0, description_en || null, status, req.params.id]
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM programs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
