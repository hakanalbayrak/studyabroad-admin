// One-off: backfill programs.field from the "Domain: X | notes" text the
// importer used to stash in description_en (fixed going forward in
// csvImport.js to write field directly). Delete this file + its
// server.js mount once run.
const router = require('express').Router();
const db = require('../db');

router.post('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, description_en FROM programs WHERE description_en LIKE 'Domain: %' AND (field IS NULL OR field = '')`
    );
    let updated = 0;
    for (const r of rows) {
      const parts = r.description_en.split(' | ');
      const domainPart = parts[0].replace(/^Domain:\s*/, '').trim();
      const rest = parts.slice(1).join(' | ') || null;
      await db.query('UPDATE programs SET field = ?, description_en = ? WHERE id = ?', [domainPart || null, rest, r.id]);
      updated++;
    }
    res.json({ considered: rows.length, updated });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
