#!/usr/bin/env node
// Scheduled reminder script — run directly from cPanel cron:
//   /usr/local/bin/node /home/USER/studyabroad-admin/scripts/remind.js
// No HTTP involved; reads DB and sends emails directly.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const db = require('../db');
const { sendApplicationReminder } = require('../utils/mailer');

async function main() {
  const [apps] = await db.query(
    `SELECT * FROM applications
     WHERE status IN ('submitted','reviewing')
       AND email IS NOT NULL
       AND created_at < DATE_SUB(NOW(), INTERVAL 3 DAY)
     ORDER BY created_at ASC
     LIMIT 50`
  );

  console.log(`[remind] ${apps.length} stale application(s) found`);

  let sent = 0;
  for (const app of apps) {
    try {
      const ok = await sendApplicationReminder(app, '');
      if (ok) { sent++; console.log(`[remind] sent to ${app.email}`); }
    } catch (e) {
      console.error(`[remind] failed for ${app.email}:`, e.message);
    }
  }

  console.log(`[remind] done — ${sent}/${apps.length} sent`);
  process.exit(0);
}

main().catch(e => { console.error('[remind] fatal:', e.message); process.exit(1); });
