const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../db');
const { sendApplicationNotice, sendPreAcceptance, sendApplicationReminder, sendStatusUpdate } = require('../utils/mailer');
const { generatePreAcceptancePdf } = require('../utils/pdfgen');

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

// Public: fetch a pre-acceptance certificate by reference (for /acceptance page)
publicRouter.get('/acceptance/:ref', async (req, res) => {
  try {
    const [[a]] = await db.query(
      `SELECT preaccept_ref, first_name, last_name, university_name, program_name,
              country, preaccept_conditions, preaccept_issued_at, status, desired_intake
       FROM applications WHERE preaccept_ref = ? LIMIT 1`,
      [req.params.ref]
    );
    if (!a || !a.preaccept_issued_at) return res.status(404).json({ error: 'Belge bulunamadı.' });
    res.json(a);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ADMIN router (mounted behind requireRole('admin')) ───────────────────────
const adminRouter = express.Router();

// Issue a pre-acceptance (or conditional acceptance) for an application
adminRouter.post('/:id/preaccept', async (req, res) => {
  try {
    const conditional = !!req.body.conditional;
    const conditions = (req.body.conditions || '').trim() || null;
    const [[app]] = await db.query('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!app) return res.status(404).json({ error: 'Not found' });

    const ref = app.preaccept_ref ||
      ('PANELEDU-' + new Date().getFullYear() + '-' + String(app.id).padStart(5, '0'));
    const status = conditional ? 'conditional' : 'pre_accepted';
    await db.query(
      `UPDATE applications SET preaccept_ref = ?, preaccept_conditions = ?,
        preaccept_issued_at = NOW(), status = ? WHERE id = ?`,
      [ref, conditions, status, app.id]
    );
    res.json({ ok: true, ref });
    const url = (process.env.APP_URL || '') + '/acceptance?ref=' + encodeURIComponent(ref);
    sendPreAcceptance({ ...app, preaccept_conditions: conditions }, ref, url, conditional);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

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
      'SELECT id, doc_type, original_name, mime, size_bytes, uploaded_at, review_status FROM application_documents WHERE application_id = ? ORDER BY uploaded_at',
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

// Download pre-acceptance letter as PDF (admin)
adminRouter.get('/:id/preaccept-pdf', async (req, res) => {
  try {
    const [[app]] = await db.query('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!app) return res.status(404).json({ error: 'Not found' });
    if (!app.preaccept_ref) return res.status(400).json({ error: 'No pre-acceptance issued yet' });
    const conditional = app.status === 'conditional';
    const pdf = await generatePreAcceptancePdf(app, app.preaccept_ref, conditional);
    const filename = `preaccept-${app.preaccept_ref}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Download pre-acceptance letter as PDF (applicant via portal — needs upload_token)
publicRouter.get('/:id/preaccept-pdf', async (req, res) => {
  try {
    const token = req.query.token;
    const [[app]] = await db.query('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!app || !token || token !== app.upload_token) return res.status(403).json({ error: 'Not authorized' });
    if (!app.preaccept_ref) return res.status(400).json({ error: 'No pre-acceptance issued yet' });
    const conditional = app.status === 'conditional';
    const pdf = await generatePreAcceptancePdf(app, app.preaccept_ref, conditional);
    const filename = `preaccept-${app.preaccept_ref}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
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
    if (req.body.notifyApplicant && req.body.status) {
      const [[app]] = await db.query('SELECT * FROM applications WHERE id = ?', [req.params.id]);
      if (app) sendStatusUpdate(app, req.body.status);
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Send a reminder email to one applicant
adminRouter.post('/:id/remind', async (req, res) => {
  try {
    const [[app]] = await db.query('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    if (!app) return res.status(404).json({ error: 'Not found' });
    const sent = await sendApplicationReminder(app, (req.body.message || '').trim());
    res.json({ ok: sent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update document review status
adminRouter.patch('/:id/documents/:docId', async (req, res) => {
  try {
    const review_status = (req.body.review_status || 'pending').slice(0, 20);
    await db.query(
      'UPDATE application_documents SET review_status = ? WHERE id = ? AND application_id = ?',
      [review_status, req.params.docId, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Cross-application document list (for admin document review queue)
adminRouter.get('/documents', async (req, res) => {
  try {
    const status = req.query.status || '';
    const where = status ? 'AND d.review_status = ?' : '';
    const params = status ? [status] : [];
    const [rows] = await db.query(
      `SELECT d.id, d.application_id, d.doc_type, d.original_name, d.mime,
              d.size_bytes, d.uploaded_at, d.review_status,
              a.first_name, a.last_name, a.email, a.university_name, a.program_name, a.status AS app_status
       FROM application_documents d
       JOIN applications a ON a.id = d.application_id
       WHERE 1=1 ${where}
       ORDER BY d.uploaded_at DESC LIMIT 500`,
      params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk reminder — submitted / reviewing apps
adminRouter.post('/bulk-remind', async (req, res) => {
  try {
    const [apps] = await db.query(
      `SELECT * FROM applications WHERE status IN ('submitted','reviewing') AND email IS NOT NULL ORDER BY created_at DESC LIMIT 200`
    );
    let sent = 0;
    for (const app of apps) {
      const ok = await sendApplicationReminder(app, '').catch(() => false);
      if (ok) sent++;
    }
    res.json({ ok: true, sent });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = { publicRouter, adminRouter };
