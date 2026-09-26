// Rollback for the previous version of this file: "Domain" in the CSV import
// turned out to be the academic subject area (e.g. "Business & Economics"),
// not a website domain, so the website_url backfill it did was wrong data.
// This clears it back out. Delete this file + its server.js mount once run.
const router = require('express').Router();
const db = require('../db');

router.post('/', async (req, res) => {
  try {
    const [result] = await db.query(
      `UPDATE entities SET website_url = NULL WHERE website_url LIKE 'https://%' AND website_url NOT LIKE 'https://%.%'`
    );
    res.json({ cleared: result.affectedRows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
