const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { sendApplicationNotice } = require('../utils/mailer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'applications');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Multer disk storage (documents) ─────────────────────────────────────────
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 10).replace(/[^.\w]/g, '');
    cb(null, crypto.randomBytes(18).toString('hex') + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => cb(null, ALLOWED.includes(file.mimetype))
});

// Empty string → null; pass through valid date-ish strings
const d = v => (v && String(v).trim() !== '' ? String(v).trim() : null);

const APPLICANT_COLS = [
  'university_id','university_name','program_id','program_name','country',
  'first_name','last_name','email','phone','date_of_birth','place_of_birth',
  'nationality','residence_country','address','passport_no','passport_issue_date',
  'passport_expiry_date','passport_issued_by','high_school','graduation_gpa',
  'field_of_interest','english_test_type','english_test_score',
  'english_test_planned_date','desired_intake','notes'
];

// ── PUBLIC router ────────────────────────────────────────────────────────────
const publicRouter = express.Router();

// Create an application. Returns { id, upload_token }.
publicRouter.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) {
      return res.status(400).json({ error: 'A valid email is required.' });
    }
    if (!b.first_name && !b.last_name) {
      return res.status(400).json({ error: 'Name is required.' });
    }
    const token = crypto.randomBytes(24).toString('hex');
    const vals = APPLICANT_COLS.map(c => d(b[c]));
    const [r] = await db.query(
      `INSERT INTO applications (upload_token, ${APPLICANT_COLS.join(', ')})
       VALUES (?, ${APPLICANT_COLS.map(() => '?').join(', ')})`,
      [token, ...vals]
    );
    res.json({ id: r.insertId, upload_token: token });
    // fire-and-forget notification (applicant confirmation + admin heads-up)
    sendApplicationNotice({ id: r.insertId, ...b });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Upload one document for an application (needs the upload_token).
publicRouter.post('/:id/documents', upload.single('file'), async (req, res) => {
  try {
    const token = req.body.token || req.query.token;
    const docType = (req.body.doc_type || 'other').slice(0, 50);
    if (!req.file) return res.status(400).json({ error: 'No file (or unsupported type). Allowed: PDF, JPG, PNG.' });
    const [[app]] = await db.query('SELECT id, upload_token FROM applications WHERE id = ?', [req.params.id]);
    if (!app || !token || token !== app.upload_token) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'Not authorized for this application.' });
    }
    await db.query(
      `INSERT INTO application_documents (application_id, doc_type, original_name, stored_name, mime, size_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [app.id, docType, (req.file.originalname || '').slice(0, 255), req.file.filename, req.file.mimetype, req.file.size]
    );
    res.json({ ok: true, doc_type: docType, name: req.file.originalname });
  } catch (e) {
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN router (mounted behind requireRole('admin')) ───────────────────────
const adminRouter = express.Router();

adminRouter.get('/', async (req, res) => {
  try {
    const { status, q } = req.query;
    const where = [], vals = [];
    if (status) { where.push('status = ?'); vals.push(status); }
    if (q) { where.push('(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR university_name LIKE ?)'); vals.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`); }
    const [rows] = await db.query(
      `SELECT a.*, (SELECT COUNT(*) FROM application_documents WHERE application_id = a.id) AS doc_count
       FROM applications a ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY a.created_at DESC LIMIT 500`, vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminRouter.get('/stats', async (req, res) => {
  try {
    const [[c]] = await db.query(
      `SELECT COUNT(*) total,
         SUM(status='submitted') submitted,
         SUM(status='reviewing') reviewing,
         SUM(status IN ('pre_accepted','conditional')) accepted
       FROM applications`
    );
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminRouter.get('/:id', async (req, res) => {
  try {
    const [[app]] = await db.query('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!app) return res.status(404).json({ error: 'Not found' });
    delete app.upload_token; // don't expose the upload secret
    const [docs] = await db.query(
      'SELECT id, doc_type, original_name, mime, size_bytes, uploaded_at FROM application_documents WHERE application_id = ? ORDER BY uploaded_at',
      [req.params.id]
    );
    res.json({ ...app, documents: docs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminRouter.get('/:id/documents/:docId/download', async (req, res) => {
  try {
    const [[doc]] = await db.query(
      'SELECT * FROM application_documents WHERE id = ? AND application_id = ?',
      [req.params.docId, req.params.id]
    );
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(UPLOAD_DIR, doc.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
    res.download(filePath, doc.original_name || doc.stored_name);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminRouter.patch('/:id', async (req, res) => {
  try {
    const sets = [], vals = [];
    if (req.body.status) { sets.push('status = ?'); vals.push(String(req.body.status).slice(0, 30)); }
    if (req.body.notes !== undefined) { sets.push('notes = ?'); vals.push(req.body.notes || null); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });
    vals.push(req.params.id);
    await db.query(`UPDATE applications SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = { publicRouter, adminRouter };
