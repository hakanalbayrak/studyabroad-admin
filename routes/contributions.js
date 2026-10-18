const express = require('express');
const db = require('../db');

const TYPES = ['entity', 'program', 'ranking'];

const ENTITY_COLS = [
  'name', 'type', 'website_url', 'logo_url', 'description_en',
  'qs_rank', 'qs_rank_year', 'the_rank', 'the_rank_year',
  'leiden_rank', 'leiden_rank_year', 'shanghai_rank', 'shanghai_rank_year'
];
const LOCATION_COLS = ['campus_name', 'city', 'country', 'continent', 'latitude', 'longitude'];
const PROGRAM_COLS = [
  'entity_location_id', 'program_type_id', 'name', 'language_of_instruction',
  'duration', 'tuition_fee', 'tuition_currency', 'intake_months',
  'english_req_type', 'english_req_score', 'gpa_requirement', 'field',
  'scholarship_available', 'description_en'
];
const RANKING_COLS = [
  'qs_rank', 'qs_rank_year', 'the_rank', 'the_rank_year',
  'leiden_rank', 'leiden_rank_year', 'shanghai_rank', 'shanghai_rank_year'
];

function pick(obj, cols) {
  const out = {};
  cols.forEach(c => { if (obj[c] !== undefined && obj[c] !== null && obj[c] !== '') out[c] = obj[c]; });
  return out;
}

function parsePayload(c) {
  return typeof c.payload === 'string' ? JSON.parse(c.payload) : c.payload;
}

// ── PUBLIC (token-gated) — used by the future data agent, or manual submission ──
const publicRouter = express.Router();

publicRouter.post('/', async (req, res) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : req.query.token;
  if (!process.env.CONTRIBUTIONS_TOKEN || token !== process.env.CONTRIBUTIONS_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const { type, target_id, payload, source_url, submitted_by } = req.body || {};
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'type must be entity, program, or ranking.' });
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return res.status(400).json({ error: 'payload (object) is required.' });
    if (!source_url) return res.status(400).json({ error: 'source_url is required.' });
    const [r] = await db.query(
      'INSERT INTO contributions (type, target_id, payload, source_url, submitted_by) VALUES (?, ?, ?, ?, ?)',
      [type, target_id || null, JSON.stringify(payload), String(source_url).slice(0, 500), (submitted_by || null) && String(submitted_by).slice(0, 100)]
    );
    res.json({ ok: true, id: r.insertId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ADMIN (mounted behind requireRole('admin')) ──
const adminRouter = express.Router();

adminRouter.get('/', async (req, res) => {
  try {
    const { status, type } = req.query;
    const where = [], vals = [];
    if (status) { where.push('status = ?'); vals.push(status); }
    if (type) { where.push('type = ?'); vals.push(type); }
    const [rows] = await db.query(
      `SELECT * FROM contributions ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`,
      vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminRouter.get('/:id', async (req, res) => {
  try {
    const [[c]] = await db.query('SELECT * FROM contributions WHERE id = ?', [req.params.id]);
    if (!c) return res.status(404).json({ error: 'Not found' });
    let current = null;
    if (c.target_id) {
      if (c.type === 'entity' || c.type === 'ranking') {
        const [[row]] = await db.query('SELECT * FROM entities WHERE id = ?', [c.target_id]);
        current = row || null;
      } else if (c.type === 'program') {
        const [[row]] = await db.query('SELECT * FROM programs WHERE id = ?', [c.target_id]);
        current = row || null;
      }
    }
    res.json({ ...c, current });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminRouter.patch('/:id', async (req, res) => {
  try {
    if (req.body.payload === undefined || typeof req.body.payload !== 'object') {
      return res.status(400).json({ error: 'payload (object) is required.' });
    }
    const [r] = await db.query(
      'UPDATE contributions SET payload = ? WHERE id = ? AND status = ?',
      [JSON.stringify(req.body.payload), req.params.id, 'pending']
    );
    if (!r.affectedRows) return res.status(400).json({ error: 'Not found, or already reviewed.' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminRouter.post('/:id/approve', async (req, res) => {
  try {
    const [[c]] = await db.query('SELECT * FROM contributions WHERE id = ?', [req.params.id]);
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (c.status !== 'pending') return res.status(400).json({ error: 'Already reviewed.' });
    const payload = parsePayload(c);
    let resultId = c.target_id;

    if (c.type === 'entity') {
      const fields = pick(payload, ENTITY_COLS);
      if (c.target_id) {
        const sets = Object.keys(fields);
        if (sets.length) {
          await db.query(`UPDATE entities SET ${sets.map(k => `${k} = ?`).join(', ')} WHERE id = ?`, [...sets.map(k => fields[k]), c.target_id]);
        }
      } else {
        if (!fields.name || !fields.type) return res.status(400).json({ error: 'A new entity needs at least name and type.' });
        const loc = pick(payload, LOCATION_COLS);
        if (!loc.city || !loc.country || !loc.continent) {
          return res.status(400).json({ error: 'A new entity needs city, country and continent for its first location.' });
        }
        const ecols = Object.keys(fields);
        const [r] = await db.query(`INSERT INTO entities (${ecols.join(', ')}) VALUES (${ecols.map(() => '?').join(', ')})`, ecols.map(k => fields[k]));
        resultId = r.insertId;
        const lcols = Object.keys(loc);
        await db.query(
          `INSERT INTO entity_locations (entity_id, ${lcols.join(', ')}) VALUES (?, ${lcols.map(() => '?').join(', ')})`,
          [resultId, ...lcols.map(k => loc[k])]
        );
      }
    } else if (c.type === 'ranking') {
      if (!c.target_id) return res.status(400).json({ error: 'Ranking contributions need a target_id (existing entity).' });
      const fields = pick(payload, RANKING_COLS);
      const sets = Object.keys(fields);
      if (sets.length) {
        await db.query(`UPDATE entities SET ${sets.map(k => `${k} = ?`).join(', ')} WHERE id = ?`, [...sets.map(k => fields[k]), c.target_id]);
      }
    } else if (c.type === 'program') {
      const fields = pick(payload, PROGRAM_COLS);
      if (c.target_id) {
        const sets = Object.keys(fields);
        if (sets.length) {
          await db.query(`UPDATE programs SET ${sets.map(k => `${k} = ?`).join(', ')} WHERE id = ?`, [...sets.map(k => fields[k]), c.target_id]);
        }
      } else {
        if (!fields.entity_location_id || !fields.program_type_id || !fields.name) {
          return res.status(400).json({ error: 'A new program needs entity_location_id, program_type_id and name.' });
        }
        const pcols = Object.keys(fields);
        const [r] = await db.query(`INSERT INTO programs (${pcols.join(', ')}) VALUES (${pcols.map(() => '?').join(', ')})`, pcols.map(k => fields[k]));
        resultId = r.insertId;
      }
    }

    await db.query('UPDATE contributions SET status = ?, reviewed_at = NOW() WHERE id = ?', ['approved', c.id]);
    res.json({ ok: true, target_id: resultId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminRouter.post('/:id/reject', async (req, res) => {
  try {
    const [r] = await db.query(
      'UPDATE contributions SET status = ?, reviewer_note = ?, reviewed_at = NOW() WHERE id = ? AND status = ?',
      ['rejected', (req.body.note || '').slice(0, 2000), req.params.id, 'pending']
    );
    if (!r.affectedRows) return res.status(400).json({ error: 'Not found, or already reviewed.' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

adminRouter.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM contributions WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = { publicRouter, adminRouter };
