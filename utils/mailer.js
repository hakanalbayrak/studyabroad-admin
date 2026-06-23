const nodemailer = require('nodemailer');

let transport = null;

function getTransport() {
  if (transport) return transport;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER) return null;
  transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT) || 587,
    secure: parseInt(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS || '' }
  });
  return transport;
}

async function sendLeadNotification(lead) {
  const t = getTransport();
  if (!t) return; // SMTP not configured — skip silently

  const to = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  const subject = `New inquiry: ${lead.program_name || 'General'} — ${lead.university_name || ''}`.trim();

  const text = [
    `New student inquiry received on Study Abroad platform`,
    ``,
    `Student:   ${lead.student_name}`,
    `Email:     ${lead.email}`,
    `Phone:     ${lead.phone || '—'}`,
    ``,
    `Program:   ${lead.program_name || '—'}`,
    `University:${lead.university_name || '—'}`,
    `Country:   ${lead.country || '—'}`,
    ``,
    `Message:`,
    lead.message || '(none)',
    ``,
    `View all leads: ${process.env.APP_URL || ''}/admin`
  ].join('\n');

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#1e293b">
      <div style="background:#6366f1;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
        <strong>New Student Inquiry</strong>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 10px 10px">
        <table style="width:100%;border-collapse:collapse;font-size:.9rem">
          <tr><td style="padding:5px 0;color:#64748b;width:110px">Name</td><td style="padding:5px 0"><strong>${esc(lead.student_name)}</strong></td></tr>
          <tr><td style="padding:5px 0;color:#64748b">Email</td><td style="padding:5px 0"><a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a></td></tr>
          <tr><td style="padding:5px 0;color:#64748b">Phone</td><td style="padding:5px 0">${esc(lead.phone || '—')}</td></tr>
          <tr><td colspan="2" style="padding:12px 0 4px"><hr style="border:none;border-top:1px solid #e2e8f0"></td></tr>
          <tr><td style="padding:5px 0;color:#64748b">Program</td><td style="padding:5px 0">${esc(lead.program_name || '—')}</td></tr>
          <tr><td style="padding:5px 0;color:#64748b">University</td><td style="padding:5px 0">${esc(lead.university_name || '—')}</td></tr>
          <tr><td style="padding:5px 0;color:#64748b">Country</td><td style="padding:5px 0">${esc(lead.country || '—')}</td></tr>
          ${lead.message ? `<tr><td colspan="2" style="padding:12px 0 4px"><hr style="border:none;border-top:1px solid #e2e8f0"></td></tr>
          <tr><td style="padding:5px 0;color:#64748b;vertical-align:top">Message</td><td style="padding:5px 0">${esc(lead.message)}</td></tr>` : ''}
        </table>
        ${process.env.APP_URL ? `<div style="margin-top:16px"><a href="${process.env.APP_URL}/admin" style="background:#6366f1;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-size:.85rem">View in Admin Panel</a></div>` : ''}
      </div>
    </div>`;

  try {
    await t.sendMail({ from: `"Study Abroad" <${process.env.SMTP_USER}>`, to, subject, text, html });
  } catch (e) {
    console.error('[mailer] Failed to send lead notification:', e.message);
  }
}

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

module.exports = { sendLeadNotification };
