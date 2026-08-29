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
          gpa_requirement, scholarship_available, description_en, status,
          placement_year, internship_available, international_eligible, internship_paid,
          employer_partnerships, live_industry_projects, professional_accreditation,
          graduate_outcome_source, graduate_outcome_date,
          scholarship_amount, scholarship_conditions,
          application_deadline, deposit_deadline, scholarship_deadline } = req.body;
  if (!entity_location_id || !program_type_id || !name) {
    return res.status(400).json({ error: 'entity_location_id, program_type_id, name are required' });
  }
  try {
    const [result] = await db.query(
      `INSERT INTO programs (entity_location_id, program_type_id, name, language_of_instruction,
       duration, tuition_fee, tuition_currency, intake_months, english_req_type, english_req_score,
       gpa_requirement, scholarship_available, description_en, status,
       placement_year, internship_available, international_eligible, internship_paid,
       employer_partnerships, live_industry_projects, professional_accreditation,
       graduate_outcome_source, graduate_outcome_date,
       scholarship_amount, scholarship_conditions,
       application_deadline, deposit_deadline, scholarship_deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
               ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entity_location_id, program_type_id, name, language_of_instruction || 'English',
       duration || null, tuition_fee || null, tuition_currency || 'EUR',
       intake_months || null, english_req_type || 'None', english_req_score || null,
       gpa_requirement || null, scholarship_available ? 1 : 0, description_en || null, status || 'active',
       placement_year ? 1 : 0,
       internship_available ? 1 : 0,
       international_eligible !== false ? 1 : 0,
       internship_paid || null,
       employer_partnerships || null,
       live_industry_projects ? 1 : 0,
       professional_accreditation || null,
       graduate_outcome_source || null,
       graduate_outcome_date || null,
       scholarship_amount || null,
       scholarship_conditions || null,
       application_deadline || null,
       deposit_deadline || null,
       scholarship_deadline || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  const { entity_location_id, program_type_id, name, language_of_instruction, duration,
          tuition_fee, tuition_currency, intake_months, english_req_type, english_req_score,
          gpa_requirement, scholarship_available, description_en, status,
          placement_year, internship_available, international_eligible, internship_paid,
          employer_partnerships, live_industry_projects, professional_accreditation,
          graduate_outcome_source, graduate_outcome_date,
          scholarship_amount, scholarship_conditions,
          application_deadline, deposit_deadline, scholarship_deadline } = req.body;
  try {
    await db.query(
      `UPDATE programs SET entity_location_id=?, program_type_id=?, name=?, language_of_instruction=?,
       duration=?, tuition_fee=?, tuition_currency=?, intake_months=?, english_req_type=?,
       english_req_score=?, gpa_requirement=?, scholarship_available=?, description_en=?, status=?,
       placement_year=?, internship_available=?, international_eligible=?, internship_paid=?,
       employer_partnerships=?, live_industry_projects=?, professional_accreditation=?,
       graduate_outcome_source=?, graduate_outcome_date=?,
       scholarship_amount=?, scholarship_conditions=?,
       application_deadline=?, deposit_deadline=?, scholarship_deadline=?
       WHERE id=?`,
      [entity_location_id, program_type_id, name, language_of_instruction || 'English',
       duration || null, tuition_fee || null, tuition_currency || 'EUR',
       intake_months || null, english_req_type || 'None', english_req_score || null,
       gpa_requirement || null, scholarship_available ? 1 : 0, description_en || null, status,
       placement_year ? 1 : 0,
       internship_available ? 1 : 0,
       international_eligible !== false ? 1 : 0,
       internship_paid || null,
       employer_partnerships || null,
       live_industry_projects ? 1 : 0,
       professional_accreditation || null,
       graduate_outcome_source || null,
       graduate_outcome_date || null,
       scholarship_amount || null,
       scholarship_conditions || null,
       application_deadline || null,
       deposit_deadline || null,
       scholarship_deadline || null,
       req.params.id]
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
