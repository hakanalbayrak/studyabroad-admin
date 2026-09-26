const router = require('express').Router();
const PDFDocument = require('pdfkit');
const path = require('path');

const FONT = path.join(__dirname, '../assets/fonts/LiberationSans-Regular.ttf');
const FONT_BOLD = path.join(__dirname, '../assets/fonts/LiberationSans-Bold.ttf');

router.post('/pdf', (req, res) => {
  try {
    const { programs = [], studentName = '', advisorNote = '' } = req.body;
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

      if (p.english_req_type && p.english_req_type !== 'None') {
        const engStr = p.english_req_score
          ? `${p.english_req_type} ${p.english_req_score}`
          : p.english_req_type;
        row('İngilizce Şartı:', engStr);
      }

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
