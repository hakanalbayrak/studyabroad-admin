/*
 * Which pathway / admission provider (INTO, Navitas, Kaplan, Study Group, ONCAMPUS, Shorelight) a school belongs to.
 * Staff-only information: never returned by public endpoints.
 */
'use strict';
const db = require('../db');

const PROVIDERS = ['INTO', 'Navitas', 'Kaplan', 'Study Group', 'ONCAMPUS', 'Shorelight'];
let ready = null;
function ensureTable() {
  if (!ready) {
    ready = db.query(`CREATE TABLE IF NOT EXISTS entity_providers (
      entity_id INT NOT NULL, provider VARCHAR(40) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (entity_id, provider), KEY idx_provider (provider))`).catch(e => { ready = null; throw e; });
  }
  return ready;
}
async function getMap() {
  await ensureTable();
  const [rows] = await db.query('SELECT entity_id, provider FROM entity_providers ORDER BY provider');
  const map = {};
  rows.forEach(r => { (map[r.entity_id] = map[r.entity_id] || []).push(r.provider); });
  return map;
}
async function setProviders(entityId, list) {
  await ensureTable();
  const clean = [...new Set((list || []).filter(p => PROVIDERS.includes(p)))];
  await db.query('DELETE FROM entity_providers WHERE entity_id = ?', [entityId]);
  for (const p of clean) await db.query('INSERT INTO entity_providers (entity_id, provider) VALUES (?, ?)', [entityId, p]);
  return clean;
}
module.exports = { PROVIDERS, getMap, setProviders, ensureTable };
