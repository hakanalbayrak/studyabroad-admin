/*
 * External research agent hand-off. The agent pulls tasks from /agent/tasks.json (public, no secrets)
 * and POSTs findings here with a dedicated token. Results are only stored; an admin reviews and applies them.
 */
'use strict';
const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const sha = t => crypto.createHash('sha256').update(String(t)).digest('hex');
let ready = null;
function ensure() {
  if (!ready) {
    ready = (async () => {
      await db.query(`CREATE TABLE IF NOT EXISTS agent_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY, token_hash CHAR(64) NOT NULL, label VARCHAR(60) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY (token_hash))`);
      await db.query(`CREATE TABLE IF NOT EXISTS agent_results (
        id INT AUTO_INCREMENT PRIMARY KEY, token_id INT NOT NULL, school VARCHAR(200), level VARCHAR(20),
        payload MEDIUMTEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, KEY (school, level))`);
    })().catch(e => { ready = null; throw e; });
  }
  return ready;
}

// Public side: token-authenticated result upload
const pub = express.Router();
pub.post('/results', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    await ensure();
    const tok = req.get('X-Agent-Token');
    if (!tok) return res.status(401).json({ error: 'token required' });
    const [[t]] = await db.query('SELECT id FROM agent_tokens WHERE token_hash = ? LIMIT 1', [sha(tok)]);
    if (!t) return res.status(401).json({ error: 'invalid token' });
    const items = Array.isArray(req.body) ? req.body : (req.body && Array.isArray(req.body.results) ? req.body.results : null);
    if (!items || !items.length || items.length > 50) return res.status(400).json({ error: 'send a JSON list of 1-50 result objects' });
    let saved = 0;
    for (const it of items) {
      if (!it || typeof it !== 'object' || !it.school) continue;
      await db.query('INSERT INTO agent_results (token_id, school, level, payload) VALUES (?,?,?,?)',
        [t.id, String(it.school).slice(0, 200), String(it.level || '').slice(0, 20), JSON.stringify(it).slice(0, 60000)]);
      saved++;
    }
    res.json({ ok: true, saved });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin side (mounted in server.js behind requireRole('admin'))
async function createToken(req, res) {
  try {
    await ensure();
    const token = crypto.randomBytes(24).toString('hex');
    await db.query('INSERT INTO agent_tokens (token_hash, label) VALUES (?,?)', [sha(token), String((req.body || {}).label || 'research agent').slice(0, 60)]);
    res.json({ token });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
async function listResults(req, res) {
  try {
    await ensure();
    const [rows] = await db.query('SELECT id, school, level, payload, created_at FROM agent_results ORDER BY id');
    res.json({ results: rows.map(r => ({ id: r.id, created_at: r.created_at, ...JSON.parse(r.payload) })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
async function revokeTokens(req, res) {
  try {
    await ensure();
    const id = req.query.id ? parseInt(req.query.id, 10) : null;
    const [r] = id ? await db.query('DELETE FROM agent_tokens WHERE id = ?', [id]) : await db.query('DELETE FROM agent_tokens');
    res.json({ ok: true, revoked: r.affectedRows });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
module.exports = { pub, createToken, listResults, revokeTokens };
