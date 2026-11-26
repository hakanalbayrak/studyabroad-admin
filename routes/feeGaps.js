/*
 * Fee gaps (admin): institutions whose Bachelor/Master programmes still have no tuition fee, with links to
 * the official fee pages / PDFs so a person can look them up and enter the fee by hand.
 */
'use strict';
const express = require('express');
const db = require('../db');

let ready = null;
function ensure() {
  if (!ready) {
    ready = db.query(`CREATE TABLE IF NOT EXISTS fee_gap_links (
      entity_id INT NOT NULL PRIMARY KEY,
      links TEXT DEFAULT NULL,
      note VARCHAR(1000) DEFAULT NULL,
      status VARCHAR(20) DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`).catch(e => { ready = null; throw e; });
  }
  return ready;
}
const router = express.Router();

// All institutions with at least one Bachelor (1) / Master (24) programme lacking a fee.
router.get('/', async (req, res) => {
  try {
    await ensure();
    const [rows] = await db.query(`
      SELECT e.id, e.name, e.website_url, MIN(el.country) AS country,
             SUM(p.program_type_id = 1) AS bachelor, SUM(p.program_type_id = 24) AS master,
             g.links, g.note, g.status
      FROM programs p
      JOIN entity_locations el ON p.entity_location_id = el.id
      JOIN entities e ON el.entity_id = e.id
      LEFT JOIN fee_gap_links g ON g.entity_id = e.id
      WHERE p.program_type_id IN (1, 24) AND (p.tuition_fee IS NULL OR p.tuition_fee = 0)
      GROUP BY e.id, e.name, e.website_url, g.links, g.note, g.status
      ORDER BY country, (SUM(p.program_type_id = 1) + SUM(p.program_type_id = 24)) DESC`);
    res.json(rows.map(r => {
      let links = [];
      try { links = r.links ? JSON.parse(r.links) : []; } catch (e) { links = []; }
      return { ...r, bachelor: Number(r.bachelor), master: Number(r.master), links };
    }));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:entityId/programs', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.id, p.name, p.program_type_id, p.tuition_fee, p.tuition_currency, p.duration
      FROM programs p JOIN entity_locations el ON p.entity_location_id = el.id
      WHERE el.entity_id = ? AND p.program_type_id IN (1, 24) AND (p.tuition_fee IS NULL OR p.tuition_fee = 0)
      ORDER BY p.program_type_id, p.name`, [req.params.entityId]);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Replace links / note / status for an institution (links: [{url,label}]).
router.put('/:entityId', async (req, res) => {
  try {
    await ensure();
    const b = req.body || {};
    const links = Array.isArray(b.links) ? b.links.filter(l => l && /^https?:\/\//.test(l.url || '')).slice(0, 20)
      .map(l => ({ url: String(l.url).slice(0, 500), label: String(l.label || '').slice(0, 80) })) : [];
    await db.query(`INSERT INTO fee_gap_links (entity_id, links, note, status) VALUES (?,?,?,?)
      ON DUPLICATE KEY UPDATE links = VALUES(links), note = VALUES(note), status = VALUES(status)`,
      [req.params.entityId, JSON.stringify(links), b.note ? String(b.note).slice(0, 1000) : null, b.status ? String(b.status).slice(0, 20) : null]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk seed (several institutions at once): { items: [{entity_id, links, note, status}] }
router.post('/bulk', async (req, res) => {
  try {
    await ensure();
    let n = 0;
    for (const it of ((req.body || {}).items || []).slice(0, 500)) {
      const links = Array.isArray(it.links) ? it.links.filter(l => l && /^https?:\/\//.test(l.url || '')).slice(0, 20)
        .map(l => ({ url: String(l.url).slice(0, 500), label: String(l.label || '').slice(0, 80) })) : [];
      await db.query(`INSERT INTO fee_gap_links (entity_id, links, note, status) VALUES (?,?,?,?)
        ON DUPLICATE KEY UPDATE links = VALUES(links), note = VALUES(note), status = VALUES(status)`,
        [it.entity_id, JSON.stringify(links), it.note ? String(it.note).slice(0, 1000) : null, it.status ? String(it.status).slice(0, 20) : null]);
      n++;
    }
    res.json({ ok: true, saved: n });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Enter a fee by hand for one programme.
router.patch('/program/:id', async (req, res) => {
  try {
    const fee = parseFloat(req.body.tuition_fee);
    if (!(fee > 0)) return res.status(400).json({ error: 'Fee must be a positive number' });
    const cur = String(req.body.tuition_currency || '').toUpperCase().slice(0, 3);
    if (cur && !/^[A-Z]{3}$/.test(cur)) return res.status(400).json({ error: 'Currency must be a 3-letter code' });
    if (cur) await db.query('UPDATE programs SET tuition_fee = ?, tuition_currency = ? WHERE id = ?', [fee, cur, req.params.id]);
    else await db.query('UPDATE programs SET tuition_fee = ? WHERE id = ?', [fee, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
module.exports = router;
