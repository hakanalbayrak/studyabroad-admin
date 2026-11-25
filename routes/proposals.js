const router = require('express').Router();
const db = require('../db');
const PDFDocument = require('pdfkit');
const path = require('path');

const FONT = path.join(__dirname, '../assets/fonts/LiberationSans-Regular.ttf');
const FONT_BOLD = path.join(__dirname, '../assets/fonts/LiberationSans-Bold.ttf');


// ── Saved proposals (staff only: mounted behind requireRole('admin','advisor')) ─────────────
let ready = null;
function ensure() {
  if (!ready) {
    ready = db.query(`CREATE TABLE IF NOT EXISTS staff_proposals (
      id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, owner_name VARCHAR(120) DEFAULT NULL,
      student_name VARCHAR(160) DEFAULT NULL, advisor_note TEXT DEFAULT NULL, program_ids TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY (user_id))`).catch(e => { ready = null; throw e; });
  }
  return ready;
}
// Official info written by the verification work (description_en block) -> short lines for the PDF.
function officialInfo(desc) {
  const MARK = 'Official entry requirements (verified on school website):';
  const i = String(desc || '').indexOf(MARK);
  if (i < 0) return {};
  const t = String(desc).slice(i + MARK.length);
  const grab = (label, next) => { const m = t.match(new RegExp(label + ':\\s*([\\s\\S]*?)(?:\\s(?:' + next + '):|$)')); return m ? m[1].trim() : null; };
  return {
    english: grab('English', 'Academic|Application fee|Turkey|Programme note|Source'),
    applicationFee: grab('Application fee', 'Turkey|Programme note|Source'),
    source: grab('Source', '$^')
  };
}
async function freshPrograms(ids) {
  ids = (ids || []).map(n => parseInt(n, 10)).filter(n => n > 0).slice(0, 200);
  if (!ids.length) return [];
  const [rows] = await db.query(`
    SELECT p.*, pt.name AS type_name, el.city, el.country, e.name AS university_name
    FROM programs p JOIN entity_locations el ON p.entity_location_id = el.id
    JOIN entities e ON el.entity_id = e.id JOIN program_types pt ON p.program_type_id = pt.id
    WHERE p.id IN (${ids.map(() => '?').join(',')})`, ids);
  const byId = new Map(rows.map(r => [r.id, r]));
  return ids.map(id => byId.get(id)).filter(Boolean).map(r => ({ ...r, official: officialInfo(r.description_en), description_en: undefined, description_json: undefined, requirements_json: undefined }));
}
router.get('/', async (req, res) => {
  try {
    await ensure();
    const admin = req.user.role === 'admin';
    const [rows] = await db.query(`SELECT id, user_id, owner_name, student_name, program_ids, updated_at FROM staff_proposals ${admin ? '' : 'WHERE user_id = ?'} ORDER BY updated_at DESC LIMIT 200`, admin ? [] : [req.user.id]);
    res.json(rows.map(r => ({ id: r.id, owner: r.owner_name, student_name: r.student_name, count: (JSON.parse(r.program_ids) || []).length, updated_at: r.updated_at, mine: r.user_id === req.user.id })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.post('/save', async (req, res) => {
  try {
    await ensure();
    const b = req.body || {};
    const ids = (Array.isArray(b.programIds) ? b.programIds : []).map(n => parseInt(n, 10)).filter(n => n > 0).slice(0, 200);
    if (!ids.length) return res.status(400).json({ error: 'En az bir program gerekli.' });
    const student = String(b.studentName || '').trim().slice(0, 160), note = String(b.advisorNote || '').slice(0, 4000);
    if (b.id) {
      const [[cur]] = await db.query('SELECT user_id FROM staff_proposals WHERE id = ?', [b.id]);
      if (!cur) return res.status(404).json({ error: 'Teklif bulunamadı.' });
      if (cur.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Bu teklif size ait değil.' });
      await db.query('UPDATE staff_proposals SET student_name=?, advisor_note=?, program_ids=? WHERE id=?', [student, note, JSON.stringify(ids), b.id]);
      return res.json({ ok: true, id: Number(b.id) });
    }
    const [r] = await db.query('INSERT INTO staff_proposals (user_id, owner_name, student_name, advisor_note, program_ids) VALUES (?,?,?,?,?)',
      [req.user.id, String(req.user.name || req.user.email || '').slice(0, 120), student, note, JSON.stringify(ids)]);
    res.json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.get('/:id', async (req, res, next) => {
  if (!/^\d+$/.test(req.params.id)) return next();
  try {
    await ensure();
    const [[r]] = await db.query('SELECT * FROM staff_proposals WHERE id = ?', [req.params.id]);
    if (!r) return res.status(404).json({ error: 'Teklif bulunamadı.' });
    if (r.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Bu teklif size ait değil.' });
    res.json({ id: r.id, student_name: r.student_name, advisor_note: r.advisor_note, programs: await freshPrograms(JSON.parse(r.program_ids)) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
router.delete('/:id', async (req, res) => {
  try {
    await ensure();
    const [[r]] = await db.query('SELECT user_id FROM staff_proposals WHERE id = ?', [req.params.id]);
    if (!r) return res.json({ ok: true });
    if (r.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Bu teklif size ait değil.' });
    await db.query('DELETE FROM staff_proposals WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/pdf', async (req, res) => {
  try {
    const { programs: sent = [], studentName = '', advisorNote = '' } = req.body;
    // Refresh fees and official info from the database; fall back to what the browser sent.
    let programs = sent;
    try {
      const fresh = await freshPrograms(sent.map(p => p.id));
      const map = new Map(fresh.map(p => [p.id, p]));
      programs = sent.map(p => map.get(parseInt(p.id, 10)) || p);
    } catch (e) { programs = sent; }
    if (!Array.isArray(programs) || !programs.length) {
      return res.status(400).json({ error: 'En az bir program gerekli.' });
    }

    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="paneledu-teklif.pdf"');
    doc.pipe(res);

    doc.registerFont('Regular', FONT);
    doc.registerFont('Bold', FONT_BOLD);

    const W = doc.page.width - 100;

    // ── Header ────────────────────────────────────────────────────
    doc.rect(50, 50, W, 68).fill('#6366f1');
    doc.fillColor('#ffffff')
       .fontSize(22).font('Bold')
       .text('PANELEDU', 50, 64, { width: W, align: 'center' })
       .fontSize(10).font('Regular')
       .text('Okul & Program Teklifi', 50, 90, { width: W, align: 'center' });

    let y = 138;

    if (studentName && studentName.trim()) {
      doc.fillColor('#1f2937').fontSize(10.5).font('Bold')
         .text('Öğrenci:  ', 50, y, { continued: true })
         .font('Regular').text(studentName.trim());
      y = doc.y + 4;
    }

    const dateStr = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.fillColor('#6b7280').fontSize(9).font('Regular')
       .text(`Tarih: ${dateStr}   •   Toplam Program: ${programs.length}`, 50, y);
    y = doc.y + 10;

    doc.moveTo(50, y).lineTo(50 + W, y).strokeColor('#e5e7eb').lineWidth(0.8).stroke();
    y += 16;

    // ── Programs ──────────────────────────────────────────────────
    for (let i = 0; i < programs.length; i++) {
      const p = programs[i];

      if (y > doc.page.height - 200) {
        doc.addPage();
        y = 50;
      }

      // Card header bar
      doc.rect(50, y, W, 22).fill('#eef2ff');
      doc.fillColor('#3730a3').fontSize(10.5).font('Bold')
         .text(`${i + 1}.  ${p.name || '—'}`, 60, y + 7, { width: W - 20 });
      y += 28;

      const row = (label, value) => {
        if (value === null || value === undefined || value === '' || value === false) return;
        const val = String(value);
        doc.fontSize(9).font('Bold').fillColor('#6b7280').text(label, 60, y, { lineBreak: false });
        doc.fontSize(9).font('Regular').fillColor('#1f2937').text(val, 185, y, { width: W - 145 });
        y = doc.y + 3;
      };

      row('Üniversite:', p.university_name);
      const loc = [p.city, p.country].filter(Boolean).join(', ');
      if (loc) row('Konum:', loc);
      if (p.type_name) row('Program Türü:', p.type_name);
      if (p.language_of_instruction) row('Eğitim Dili:', p.language_of_instruction);

      const fee = p.tuition_fee
        ? `${Number(p.tuition_fee).toLocaleString('tr-TR')} ${p.tuition_currency || 'EUR'}`
        : 'Talep üzerine';
      row('Yıllık Ücret:', fee);

      if (p.duration) row('Eğitim Süresi:', p.duration);
      if (p.official && p.official.applicationFee) row('Başvuru Ücreti:', String(p.official.applicationFee).replace(/\.$/, ''));

      if (p.english_req_type && p.english_req_type !== 'None') {
        const engStr = p.english_req_score
          ? `${p.english_req_type} ${p.english_req_score}`
          : p.english_req_type;
        row('İngilizce Şartı:', engStr);
      }

      if (p.official && p.official.english) row('Resmi İngilizce Skorları:', String(p.official.english).slice(0, 220));
      if (p.gpa_requirement) row('GPA Şartı:', String(p.gpa_requirement));
      if (p.intake_months) row('Kabul Dönemleri:', p.intake_months);

      if (p.scholarship_available) {
        const schol = p.scholarship_amount
          ? `Mevcut — ${p.scholarship_amount}`
          : 'Mevcut';
        doc.fontSize(9).font('Bold').fillColor('#059669').text(`✓ Burs İmkânı: ${schol}`, 60, y);
        y = doc.y + 2;
        if (p.scholarship_conditions) row('Burs Koşulları:', p.scholarship_conditions);
      }

      // Placement & internship
      const placements = [];
      if (p.placement_year) placements.push('Placement Year');
      if (p.internship_available) {
        const paid = p.internship_paid ? ` (${p.internship_paid})` : '';
        placements.push(`Internship${paid}`);
      }
      if (p.live_industry_projects) placements.push('Live Industry Projects');
      if (placements.length) row('Work Experience:', placements.join(' · '));
      if (p.employer_partnerships) row('Employer Partnerships:', p.employer_partnerships);
      if (p.professional_accreditation) row('Accreditation:', p.professional_accreditation);

      // Graduate outcomes
      if (p.graduate_outcome_source) {
        const src = p.graduate_outcome_date
          ? `${p.graduate_outcome_source} (${p.graduate_outcome_date})`
          : p.graduate_outcome_source;
        row('Graduate Outcome Data:', src);
      }

      // Deadlines
      if (p.application_deadline) row('Application Deadline:', p.application_deadline);
      if (p.deposit_deadline) row('Deposit Deadline:', p.deposit_deadline);
      if (p.scholarship_deadline) row('Scholarship Deadline:', p.scholarship_deadline);

      y += 10;

      if (i < programs.length - 1) {
        if (y > doc.page.height - 40) {
          doc.addPage();
          y = 50;
        } else {
          doc.moveTo(50, y).lineTo(50 + W, y).strokeColor('#f3f4f6').lineWidth(0.5).stroke();
          y += 10;
        }
      }
    }

    // ── Advisor note ──────────────────────────────────────────────
    if (advisorNote && advisorNote.trim()) {
      if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
      y += 12;
      doc.rect(50, y, W, 18).fill('#fef9c3');
      doc.fillColor('#92400e').fontSize(9.5).font('Bold').text('Danışman Notu', 60, y + 5);
      y += 24;
      doc.fillColor('#1f2937').fontSize(9).font('Regular')
         .text(advisorNote.trim(), 60, y, { width: W - 20 });
      y = doc.y + 12;
    }

    // ── Footer on every page ──────────────────────────────────────
    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i++) {
      doc.switchToPage(pageRange.start + i);
      doc.fillColor('#9ca3af').fontSize(7.5).font('Regular')
         .text(
           `PANELEDU — paneledu.com  •  Sayfa ${i + 1} / ${pageRange.count}`,
           50, doc.page.height - 28, { width: W, align: 'center' }
         );
    }

    doc.end();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

module.exports = router;
