// One-off migration: adds programs.source_url (deep link to the program's own
// page on the university's website) and backfills entities.website_url from
// the "Domain: xxx" text the CSV importer stashed into description_en.
// Delete this file + its server.js mount once run.
const router = require('express').Router();
const db = require('../db');

router.post('/', async (req, res) => {
  try {
    const [cols] = await db.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'programs' AND COLUMN_NAME = 'source_url'`
    );
    let columnAdded = false;
    if (!cols.length) {
      await db.query(`ALTER TABLE programs ADD COLUMN source_url VARCHAR(500) NULL AFTER description_en`);
      columnAdded = true;
    }

    // Backfill entities.website_url from "Domain: xxx" notes left by csvImport.js
    const [rows] = await db.query(`
      SELECT e.id, p.description_en
      FROM entities e
      JOIN entity_locations el ON el.entity_id = e.id
      JOIN programs p ON p.entity_location_id = el.id
      WHERE e.website_url IS NULL AND p.description_en LIKE 'Domain: %'
    `);
    const domainByEntity = {};
    for (const r of rows) {
      if (domainByEntity[r.id]) continue;
      const m = r.description_en.match(/^Domain:\s*([^\s|]+)/);
      if (m) domainByEntity[r.id] = m[1].replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
    let entitiesBackfilled = 0;
    for (const [id, domain] of Object.entries(domainByEntity)) {
      await db.query('UPDATE entities SET website_url = ? WHERE id = ? AND website_url IS NULL', [`https://${domain}`, id]);
      entitiesBackfilled++;
    }

    res.json({ columnAdded, entitiesBackfilled, entitiesConsidered: rows.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
