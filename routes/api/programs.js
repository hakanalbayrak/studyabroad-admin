const express = require('express');
const router = express.Router();
const db = require('../../config/db');

router.get('/types', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM program_types ORDER BY sort_order');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { location_id, entity_id } = req.query;
    let q = `SELECT p.*, pt.name AS program_type_name, el.city, el.country, e.name AS entity_name
      FROM programs p
      JOIN program_types pt ON pt.id = p.program_type_id
      JOIN entity_locations el ON el.id = p.entity_location_id
      JOIN entities e ON e.id = el.entity_id`;
    const params = [];
    const where = [];
    if (location_id) { where.push('p.entity_location_id = ?'); params.push(location_id); }
    if (entity_id) { where.push('el.entity_id = ?'); params.push(entity_id); }
    if (where.length) q += ' WHERE ' + where.join(' AND ');
    q += ' ORDER BY e.name, p.name';
    const [rows] = await db.query(q, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM programs WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { entity_location_id, program_type_id, name, language_of_instruction, duration,
    tuition_fee, tuition_currency, intake_months, english_req_type, english_req_score,
    gpa_requirement, scholarship_available, description_en, status } = req.body;
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const { entity_location_id, program_type_id, name, language_of_instruction, duration,
    tuition_fee, tuition_currency, intake_months, english_req_type, english_req_score,
    gpa_requirement, scholarship_available, description_en, status } = req.body;
  try {
    await db.query(
      `UPDATE programs SET entity_location_id=?, program_type_id=?, name=?,
        language_of_instruction=?, duration=?, tuition_fee=?, tuition_currency=?,
        intake_months=?, english_req_type=?, english_req_score=?, gpa_requirement=?,
        scholarship_available=?, description_en=?, status=? WHERE id=?`,
      [entity_location_id, program_type_id, name, language_of_instruction || 'English',
       duration || null, tuition_fee || null, tuition_currency || 'EUR',
       intake_months || null, english_req_type || 'None', english_req_score || null,
       gpa_requirement || null, scholarship_available ? 1 : 0, description_en || null, status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM programs WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
