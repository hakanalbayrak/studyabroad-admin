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

// Reply to a student lead from the admin panel. Returns true if sent.
async function sendLeadReply(toEmail, studentName, body) {
  const t = getTransport();
  if (!t) return false;

  const subject = 'Re: Your study abroad inquiry';
  const safeBody = esc(body).replace(/\n/g, '<br>');
  const text = `Hi ${studentName || ''},\n\n${body}\n\n— Study Abroad Team`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#1e293b">
      <div style="background:#6366f1;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
        <strong>Study Abroad</strong>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 10px 10px;font-size:.92rem;line-height:1.55">
        <p>Hi ${esc(studentName || 'there')},</p>
        <p>${safeBody}</p>
        <p style="color:#64748b;margin-top:20px">— Study Abroad Team</p>
      </div>
    </div>`;

  try {
    await t.sendMail({ from: `"Study Abroad" <${process.env.SMTP_USER}>`, to: toEmail, subject, text, html });
    return true;
  } catch (e) {
    console.error('[mailer] Failed to send lead reply:', e.message);
    return false;
  }
}

// Send a passwordless sign-in code. Returns true if sent.
async function sendOtpCode(email, code) {
  const t = getTransport();
  if (!t) return false;

  const subject = `Your sign-in code: ${code}`;
  const text = `Your Study Abroad sign-in code is: ${code}\n\nIt expires in 10 minutes. If you didn't request this, ignore this email.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;color:#1e293b">
      <div style="background:#6366f1;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
        <strong>Study Abroad — Sign In</strong>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:24px 20px;border-radius:0 0 10px 10px;text-align:center">
        <p style="color:#64748b;margin:0 0 12px">Your sign-in code is</p>
        <div style="font-size:2rem;font-weight:700;letter-spacing:8px;color:#1e293b">${esc(code)}</div>
        <p style="color:#94a3b8;font-size:.82rem;margin-top:16px">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>
    </div>`;

  try {
    await t.sendMail({ from: `"Study Abroad" <${process.env.SMTP_USER}>`, to: email, subject, text, html });
    return true;
  } catch (e) {
    console.error('[mailer] Failed to send OTP code:', e.message);
    return false;
  }
}

// Application received: confirm to applicant + notify admin. Fire-and-forget.
async function sendApplicationNotice(app) {
  const t = getTransport();
  if (!t) return;
  const name = [app.first_name, app.last_name].filter(Boolean).join(' ') || 'there';
  const uni = app.university_name || 'your selected university';

  // Applicant confirmation
  if (app.email) {
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;color:#1e293b">
        <div style="background:#6366f1;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0"><strong>Application received</strong></div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 10px 10px;line-height:1.55">
          <p>Hi ${esc(name)},</p>
          <p>We've received your application for <strong>${esc(uni)}</strong>${app.program_name ? ' — ' + esc(app.program_name) : ''}.</p>
          <p>Our team will review it and get back to you shortly with the next steps.</p>
          <p style="color:#64748b;margin-top:18px">— Study Abroad Team</p>
        </div>
      </div>`;
    try {
      await t.sendMail({ from: `"Study Abroad" <${process.env.SMTP_USER}>`, to: app.email,
        subject: `Application received — ${uni}`,
        text: `Hi ${name},\n\nWe've received your application for ${uni}${app.program_name ? ' — ' + app.program_name : ''}. Our team will review it and contact you soon.\n\n— Study Abroad Team`,
        html });
    } catch (e) { console.error('[mailer] applicant confirmation failed:', e.message); }
  }

  // Admin notification
  const to = process.env.NOTIFY_EMAIL || process.env.SMTP_USER;
  if (to) {
    try {
      await t.sendMail({ from: `"Study Abroad" <${process.env.SMTP_USER}>`, to,
        subject: `New application: ${name} — ${uni}`,
        text: `New application #${app.id || ''}\n\nApplicant: ${name}\nEmail: ${app.email}\nPhone: ${app.phone || '—'}\nUniversity: ${uni}\nProgram: ${app.program_name || '—'}\nIntake: ${app.desired_intake || '—'}\n\nView in admin: ${process.env.APP_URL || ''}/admin`,
      });
    } catch (e) { console.error('[mailer] admin application notice failed:', e.message); }
  }
}

// Pre-acceptance / conditional acceptance notice to the applicant. Fire-and-forget.
async function sendPreAcceptance(app, ref, url, conditional) {
  const t = getTransport();
  if (!t || !app.email) return;
  const name = [app.first_name, app.last_name].filter(Boolean).join(' ') || 'there';
  const uni = app.university_name || 'your selected university';
  const heading = conditional ? 'Conditional Acceptance' : 'Pre-Acceptance';
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:540px;color:#1e293b">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6,#06b6d4);color:#fff;padding:20px;border-radius:12px 12px 0 0">
        <div style="font-size:.8rem;letter-spacing:.08em;text-transform:uppercase;opacity:.9">PANELEDU</div>
        <strong style="font-size:1.25rem">${esc(heading)} 🎉</strong>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:22px;border-radius:0 0 12px 12px;line-height:1.6">
        <p>Dear ${esc(name)},</p>
        <p>Congratulations! You have received a <strong>${esc(heading.toLowerCase())}</strong> for
           <strong>${esc(uni)}</strong>${app.program_name ? ' — ' + esc(app.program_name) : ''}.</p>
        ${app.preaccept_conditions ? `<p style="background:#f1f5f9;border-radius:8px;padding:12px"><strong>Conditions:</strong><br>${esc(app.preaccept_conditions)}</p>` : ''}
        <p>Reference: <strong>${esc(ref)}</strong></p>
        ${url ? `<p style="margin-top:18px"><a href="${url}" style="background:#6366f1;color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none;font-weight:700">View your acceptance letter</a></p>` : ''}
        <p style="color:#64748b;margin-top:18px">This is a PANELEDU preliminary assessment, not a final admission decision by the university. Our team will guide you through the remaining steps.</p>
        <p style="color:#64748b">— PANELEDU Team</p>
      </div>
    </div>`;
  try {
    await t.sendMail({ from: `"PANELEDU" <${process.env.SMTP_USER}>`, to: app.email,
      subject: `${heading} — ${uni} (${ref})`,
      text: `Dear ${name},\n\nCongratulations! You have received a ${heading.toLowerCase()} for ${uni}${app.program_name ? ' — ' + app.program_name : ''}.\n${app.preaccept_conditions ? '\nConditions: ' + app.preaccept_conditions + '\n' : ''}\nReference: ${ref}\n${url ? '\nView your acceptance letter: ' + url + '\n' : ''}\nThis is a PANELEDU preliminary assessment, not a final university admission decision.\n\n— PANELEDU Team`,
      html });
  } catch (e) { console.error('[mailer] pre-acceptance failed:', e.message); }
}

// Reminder email to an applicant (admin-triggered or cron). Returns true if sent.
async function sendApplicationReminder(app, customMessage) {
  const t = getTransport();
  if (!t || !app.email) return false;
  const name = [app.first_name, app.last_name].filter(Boolean).join(' ') || 'Öğrenci';
  const uni = app.university_name || 'seçilen üniversite';
  const msg = (customMessage || '').trim() ||
    'Başvurunuz inceleme sürecinde bulunmaktadır. Ekibimiz sizinle en kısa sürede iletişime geçecektir. Eksik belge ya da bilgi varsa lütfen bu e-postaya yanıt verin.';
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#1e293b">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6,#06b6d4);color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
        <strong>PANELEDU — Başvuru Hatırlatması</strong>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 10px 10px;line-height:1.6">
        <p>Sayın ${esc(name)},</p>
        <p>${esc(msg).replace(/\n/g,'<br>')}</p>
        <table style="width:100%;font-size:.9rem;margin:14px 0;border-collapse:collapse">
          <tr><td style="padding:4px 0;color:#64748b;width:130px">Üniversite</td><td style="padding:4px 0"><strong>${esc(uni)}</strong></td></tr>
          ${app.program_name ? `<tr><td style="padding:4px 0;color:#64748b">Program</td><td style="padding:4px 0"><strong>${esc(app.program_name)}</strong></td></tr>` : ''}
          ${app.desired_intake ? `<tr><td style="padding:4px 0;color:#64748b">Hedef dönem</td><td style="padding:4px 0">${esc(app.desired_intake)}</td></tr>` : ''}
        </table>
        <p style="color:#64748b;font-size:.88rem">Sorularınız için bu e-postaya yanıt verebilirsiniz.</p>
        <p style="color:#64748b;font-size:.88rem">— PANELEDU Ekibi</p>
      </div>
    </div>`;
  try {
    await t.sendMail({
      from: `"PANELEDU" <${process.env.SMTP_USER}>`,
      to: app.email,
      subject: `Başvuru hatırlatması — ${uni}`,
      text: `Sayın ${name},\n\n${msg}\n\nÜniversite: ${uni}${app.program_name ? '\nProgram: ' + app.program_name : ''}${app.desired_intake ? '\nHedef dönem: ' + app.desired_intake : ''}\n\n— PANELEDU Ekibi`,
      html
    });
    return true;
  } catch (e) {
    console.error('[mailer] reminder failed:', e.message);
    return false;
  }
}

const STATUS_LABELS_TR = {
  reviewing:    'inceleme aşamasına alındı',
  pre_accepted: 'ön kabul aldı',
  conditional:  'şartlı kabul aldı',
  rejected:     'reddedildi',
  completed:    'tamamlandı',
};

// Status change notification to applicant. Returns true if sent.
async function sendStatusUpdate(app, newStatus) {
  const t = getTransport();
  if (!t || !app.email) return false;
  const label = STATUS_LABELS_TR[newStatus];
  if (!label) return false;
  const name = [app.first_name, app.last_name].filter(Boolean).join(' ') || 'Öğrenci';
  const uni = app.university_name || 'seçilen üniversite';
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;color:#1e293b">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6,#06b6d4);color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
        <strong>PANELEDU — Başvuru Güncellemesi</strong>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:20px;border-radius:0 0 10px 10px;line-height:1.6">
        <p>Sayın ${esc(name)},</p>
        <p><strong>${esc(uni)}</strong> için yaptığınız başvuru <strong>${label}</strong>.</p>
        <p style="color:#64748b;font-size:.88rem">Sorularınız için bu e-postaya yanıt verebilirsiniz.</p>
        <p style="color:#64748b;font-size:.88rem">— PANELEDU Ekibi</p>
      </div>
    </div>`;
  try {
    await t.sendMail({
      from: `"PANELEDU" <${process.env.SMTP_USER}>`,
      to: app.email,
      subject: `Başvuru güncellemesi — ${uni}`,
      text: `Sayın ${name},\n\n${uni} için yaptığınız başvuru ${label}.\n\n— PANELEDU Ekibi`,
      html
    });
    return true;
  } catch (e) {
    console.error('[mailer] status update failed:', e.message);
    return false;
  }
}

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

module.exports = {
  sendLeadNotification, sendLeadReply, sendOtpCode,
  sendApplicationNotice, sendPreAcceptance,
  sendApplicationReminder, sendStatusUpdate,
};
