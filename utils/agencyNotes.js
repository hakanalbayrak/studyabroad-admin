/*
 * Agency notes per program (internal minimum requirements from the agency dataset).
 * Staff-only information: never returned by public endpoints.
 */
'use strict';
const db = require('../db');

let ready = null;
function ensureTable() {
  if (!ready) {
    ready = db.query(`CREATE TABLE IF NOT EXISTS program_agency_notes (
      program_id INT NOT NULL PRIMARY KEY,
      note TEXT NOT NULL,
      source VARCHAR(40) DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`).catch(e => { ready = null; throw e; });
  }
  return ready;
}
async function getMany(ids) {
  await ensureTable();
  const clean = [...new Set((ids || []).map(n => parseInt(n)).filter(n => n > 0))].slice(0, 400);
  if (!clean.length) return {};
  const [rows] = await db.query('SELECT program_id, note, source FROM program_agency_notes WHERE program_id IN (?)', [clean]);
  const map = {};
  rows.forEach(r => { map[r.program_id] = { note: r.note, source: r.source }; });
  return map;
}
async function setMany(items, source) {
  await ensureTable();
  let n = 0;
  for (const it of (items || []).slice(0, 1000)) {
    const id = parseInt(it.program_id); const note = String(it.note || '').trim().slice(0, 4000);
    if (!(id > 0)) continue;
    if (!note) { await db.query('DELETE FROM program_agency_notes WHERE program_id = ?', [id]); continue; }
    await db.query('INSERT INTO program_agency_notes (program_id, note, source) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE note = VALUES(note), source = VALUES(source)', [id, note, source || it.source || null]);
    n++;
  }
  return n;
}
module.exports = { getMany, setMany };
