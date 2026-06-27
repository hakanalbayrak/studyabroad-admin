require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { auth, requireRole, signToken } = require('./middleware/auth');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.static('public'));

// Serve admin panel at /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

// Serve university detail page at /university?id=...
app.get('/university', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/university.html'));
});

// Serve program search page at /programs
app.get('/programs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/programs.html'));
});

app.get('/match', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/match.html'));
});

app.get('/apply', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/apply.html'));
});

app.get('/acceptance', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/acceptance.html'));
});

app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/test.html'));
});

// Public portal pages
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public/register.html')));
app.get('/portal', (req, res) => res.sendFile(path.join(__dirname, 'public/portal/index.html')));
app.get('/affiliate', (req, res) => res.sendFile(path.join(__dirname, 'public/affiliate/index.html')));

// Seed first admin from env vars if no admin users exist
const bcrypt = require('bcryptjs');
async function seedAdmin() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;
  try {
    const [[count]] = await db.query("SELECT COUNT(*) as n FROM users WHERE role='admin'");
    if (count.n > 0) return;
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await db.query(
      'INSERT INTO users (email, password_hash, name, role, status) VALUES (?,?,?,?,?)',
      [process.env.ADMIN_EMAIL.toLowerCase(), hash, 'Admin', 'admin', 'active']
    );
    console.log('[auth] First admin user created:', process.env.ADMIN_EMAIL);
  } catch (e) { console.error('[auth] Seed admin failed:', e.message); }
}
seedAdmin();

// Auth routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin/users', require('./routes/users'));
app.use('/api/affiliate', require('./routes/affiliate'));
app.use('/api/user', require('./routes/userPortal'));
const applications = require('./routes/applications');
app.use('/api/public/applications', applications.publicRouter);
app.use('/api/admin/applications', requireRole('admin'), applications.adminRouter);

// English level test
app.post('/api/public/english-test', async (req, res) => {
  try {
    const { email, level, score, answers } = req.body || {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required.' });
    }
    if (!level || !score && score !== 0) return res.status(400).json({ error: 'Missing result data.' });
    await db.query(
      'INSERT INTO english_test_results (email, level, score, answers) VALUES (?, ?, ?, ?)',
      [email.toLowerCase().trim(), level, parseInt(score) || 0, JSON.stringify(answers || [])]
    );
    res.json({ ok: true });
    const { sendEnglishTestResult } = require('./utils/mailer');
    sendEnglishTestResult(email, level, score).catch(() => {});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/admin/english-test', requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, email, level, score, created_at FROM english_test_results ORDER BY created_at DESC LIMIT 500'
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Legacy admin login — maps to new JWT system for backward compatibility
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const [[user]] = await db.query(
      "SELECT id, email, name, role, password_hash, status FROM users WHERE email=? AND role='admin' LIMIT 1",
      [email.toLowerCase().trim()]
    );
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status !== 'active') return res.status(403).json({ error: 'Account inactive' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ token: signToken(user) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/logout', (req, res) => res.json({ success: true }));

// Health check (public)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Database connection test (public) — open in a browser to diagnose DB problems
app.get('/api/db-check', async (req, res) => {
  const mode = process.env.DB_SOCKET ? 'socket' : 'tcp';
  const config = {
    mode,
    socket: process.env.DB_SOCKET || null,
    host: process.env.DB_SOCKET ? null : (process.env.DB_HOST || 'localhost'),
    dbUser: process.env.DB_USER || null,
    dbName: process.env.DB_NAME || null
  };
  try {
    await db.query('SELECT 1');
    res.json({ database: 'connected', message: 'Database connection works.', config });
  } catch (e) {
    res.status(500).json({
      database: 'failed',
      error: e.message,
      config,
      hint: 'Check that DB_USER, DB_PASSWORD and DB_NAME match the cPanel MySQL settings.'
    });
  }
});

// ── Rankings lookup ──────────────────────────────────────────────────────────
// Primary source: Wikipedia's standardized university rankings infobox
// (QS_W, THE_W, ARWU_W params). Fallback: plain Gemini for missing fields.
const https = require('https');
const crypto = require('crypto');

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'StudyAbroadAdmin/1.0 (study abroad admin panel; contact via site)' } }, r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => {
        try { resolve(JSON.parse(d)); }
        catch (e) { reject(new Error('Non-JSON response from ' + new URL(url).hostname + ' (possibly rate-limited, try again in a minute): ' + d.slice(0, 80))); }
      });
    }).on('error', reject);
  });
}

// Parses infobox values like "55", "=58" (tied) or "101-150" / "551–600" (range → lower bound)
function parseRank(raw) {
  if (!raw) return null;
  const m = String(raw).match(/(\d+)/);
  return m ? parseInt(m[1]) : null;
}

async function lookupRankingsForName(name) {
  const out = {
    qs_rank: null, qs_year: null, the_rank: null, the_year: null,
    shanghai_rank: null, shanghai_year: null, leiden_rank: null, leiden_year: null,
    sources: []
  };

  // 1. Wikipedia rankings infobox — primary source.
  try {
    const search = await httpsGetJson(
      'https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=' +
      encodeURIComponent(name)
    );
    const title = search.query?.search?.[0]?.title;
    if (title) {
      const page = await httpsGetJson(
        'https://en.wikipedia.org/w/api.php?action=parse&format=json&prop=wikitext&page=' +
        encodeURIComponent(title)
      );
      const wikitext = page.parse?.wikitext?.['*'] || '';
      const grab = p => {
        const m = wikitext.match(new RegExp(p + '\\s*=\\s*([^|\\n<]+)'));
        return m ? m[1].trim() : null;
      };
      out.qs_rank = parseRank(grab('QS_W'));
      out.qs_year = parseRank(grab('QS_W_year'));
      out.the_rank = parseRank(grab('THE_W'));
      out.the_year = parseRank(grab('THE_W_year'));
      out.shanghai_rank = parseRank(grab('ARWU_W'));
      out.shanghai_year = parseRank(grab('ARWU_W_year'));
      if (out.qs_rank || out.the_rank || out.shanghai_rank) {
        out.sources.push('wikipedia');
      }
    }
  } catch (wikiErr) {
    out.sources.push('wikipedia-unavailable: ' + wikiErr.message.slice(0, 60));
  }

  // 2. Gemini fallback for anything still missing (plain generation, free tier)
  const key = process.env.GEMINI_KEY;
  const missing = ['qs', 'the', 'shanghai', 'leiden'].filter(k => !out[k + '_rank']);
  if (key && key !== 'your_gemini_key_here' && missing.length) {
    const prompt = `What are the most recent world university rankings for "${name}"?
Only answer for these systems: ${missing.join(', ')} (qs = QS World University Rankings, the = Times Higher Education, shanghai = ARWU/Shanghai Ranking, leiden = CWTS Leiden Ranking).
Return ONLY a JSON object like {"qs_rank":55,"qs_year":2025,...} using keys <system>_rank and <system>_year.
Use null when you are not confident. For ranges like 201-300 use the lower bound.`;
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0 }
    });
    try {
      const gem = await new Promise((resolve, reject) => {
        const rq = https.request({
          hostname: 'generativelanguage.googleapis.com',
          path: '/v1beta/models/gemini-flash-latest:generateContent',
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }
        }, r => {
          let d = '';
          r.on('data', c => d += c);
          r.on('end', () => resolve({ status: r.statusCode, body: d }));
        });
        rq.on('error', reject);
        rq.write(body);
        rq.end();
      });
      if (gem.status === 200) {
        const text = JSON.parse(gem.body).candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jm = text.match(/\{[\s\S]*\}/);
        if (jm) {
          const g = JSON.parse(jm[0]);
          let usedGemini = false;
          for (const k of missing) {
            if (g[k + '_rank']) {
              out[k + '_rank'] = parseRank(g[k + '_rank']);
              out[k + '_year'] = parseRank(g[k + '_year']);
              usedGemini = true;
            }
          }
          if (usedGemini) out.sources.push('gemini');
        }
      }
    } catch {}
  }

  return out;
}

app.get('/api/lookup/rankings', requireRole('admin'), async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    res.json(await lookupRankingsForName(name));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Bulk rankings job system ─────────────────────────────────────────────────
const bulkJobs = {};

async function processBulkRankings(jobId, entities) {
  const job = bulkJobs[jobId];
  job.total = entities.length;
  const delay = ms => new Promise(r => setTimeout(r, ms));

  for (const { id, name } of entities) {
    if (job.stopRequested) { job.status = 'stopped'; return; }
    try {
      const r = await lookupRankingsForName(name);
      await db.query(
        `UPDATE entities SET
          qs_rank=?, qs_rank_year=?, the_rank=?, the_rank_year=?,
          leiden_rank=?, leiden_rank_year=?, shanghai_rank=?, shanghai_rank_year=?
         WHERE id=?`,
        [r.qs_rank, r.qs_year, r.the_rank, r.the_year,
         r.leiden_rank, r.leiden_year, r.shanghai_rank, r.shanghai_year, id]
      );
      job.results.push({ id, name, ...r });
    } catch (e) {
      job.errors.push({ id, name, error: e.message });
    }
    job.processed++;
    if (job.processed < job.total && !job.stopRequested) await delay(1500);
  }
  job.status = 'done';
}

app.post('/api/bulk/rankings', requireRole('admin'), async (req, res) => {
  const { mode } = req.body;
  try {
    let entities;
    if (mode === 'missing') {
      const [rows] = await db.query(
        `SELECT id, name FROM entities WHERE qs_rank IS NULL AND the_rank IS NULL AND shanghai_rank IS NULL ORDER BY name`
      );
      entities = rows;
    } else {
      const [rows] = await db.query(`SELECT id, name FROM entities ORDER BY name`);
      entities = rows;
    }
    if (!entities.length) return res.json({ jobId: null, total: 0, message: 'No entities to process' });

    const jobId = crypto.randomBytes(8).toString('hex');
    bulkJobs[jobId] = { status: 'running', processed: 0, total: entities.length, results: [], errors: [], stopRequested: false };
    processBulkRankings(jobId, entities);
    res.json({ jobId, total: entities.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/bulk/rankings/:jobId', requireRole('admin'), (req, res) => {
  const job = bulkJobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.delete('/api/bulk/rankings/:jobId', requireRole('admin'), (req, res) => {
  const job = bulkJobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  job.stopRequested = true;
  res.json({ success: true });
});

// ── Bulk geo-lookup (Google Places → Nominatim fallback) ──────────────────────
const { resolveCoordinates } = require('./utils/geoLookup');
const { sendLeadNotification, sendLeadReply, sendApplicationReminder } = require('./utils/mailer');
const geoJobs = {};

async function processBulkGeo(jobId, locations) {
  const job = geoJobs[jobId];
  job.total = locations.length;
  const delay = ms => new Promise(r => setTimeout(r, ms));

  for (const loc of locations) {
    if (job.stopRequested) { job.status = 'stopped'; return; }
    try {
      const r = await resolveCoordinates({ name: loc.entity_name, city: loc.city, country: loc.country });
      if (r) {
        const updates = ['latitude=?', 'longitude=?'];
        const vals = [r.lat, r.lng];
        if (r.city) { updates.push('city=?'); vals.push(r.city); }
        vals.push(loc.location_id);
        await db.query(`UPDATE entity_locations SET ${updates.join(', ')} WHERE id=?`, vals);

        const [existing] = await db.query('SELECT id FROM orbit_configs WHERE entity_location_id=?', [loc.location_id]);
        if (!existing.length) {
          await db.query(
            `INSERT INTO orbit_configs (entity_location_id, orbit_center_lat, orbit_center_lng,
             orbit_altitude, orbit_pitch, orbit_initial_heading, orbit_range,
             orbit_rotation_type, orbit_rotation_speed, scan_effect_enabled)
             VALUES (?, ?, ?, 400, -45, 0, 400, '360', 0.12, 0)`,
            [loc.location_id, r.lat, r.lng]
          );
        } else {
          await db.query(
            'UPDATE orbit_configs SET orbit_center_lat=?, orbit_center_lng=? WHERE entity_location_id=? AND orbit_center_lat IS NULL',
            [r.lat, r.lng, loc.location_id]
          );
        }
        job.results.push({ entity_name: loc.entity_name, lat: r.lat, lng: r.lng, city: r.city || loc.city, display_name: r.display, source: r.source });
      } else {
        job.notFound.push({ entity_name: loc.entity_name });
      }
    } catch (e) {
      job.errors.push({ entity_name: loc.entity_name, error: e.message });
    }
    job.processed++;
    if (job.processed < job.total && !job.stopRequested) await delay(400);
  }
  job.status = 'done';
}

app.post('/api/bulk/geo-lookup', requireRole('admin'), async (req, res) => {
  const { mode } = req.body; // 'missing' (default) or 'all'
  try {
    const whereClause = mode === 'all' ? '1=1' : '(el.latitude IS NULL OR el.longitude IS NULL)';
    const [rows] = await db.query(`
      SELECT el.id as location_id, e.name as entity_name, el.city, el.country
      FROM entity_locations el
      JOIN entities e ON e.id = el.entity_id
      WHERE ${whereClause}
      ORDER BY e.name
    `);
    if (!rows.length) return res.json({ jobId: null, total: 0, message: 'All entities already have coordinates' });
    const jobId = crypto.randomBytes(8).toString('hex');
    geoJobs[jobId] = { status: 'running', processed: 0, total: rows.length, results: [], notFound: [], errors: [], stopRequested: false };
    processBulkGeo(jobId, rows);
    res.json({ jobId, total: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/bulk/geo-lookup/:jobId', requireRole('admin'), (req, res) => {
  const job = geoJobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.delete('/api/bulk/geo-lookup/:jobId', requireRole('admin'), (req, res) => {
  const job = geoJobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  job.stopRequested = true;
  res.json({ success: true });
});

// ── Bulk entity import ────────────────────────────────────────────────────────
app.post('/api/bulk/import', requireRole('admin'), async (req, res) => {
  const { names, type = 'university', status = 'active' } = req.body;
  if (!Array.isArray(names) || !names.length) return res.status(400).json({ error: 'names array required' });

  let created = 0, skipped = 0, errors = 0;
  for (const rawName of names) {
    const name = String(rawName).trim();
    if (!name) continue;
    try {
      const [existing] = await db.query('SELECT id FROM entities WHERE name = ?', [name]);
      if (existing.length) { skipped++; continue; }
      await db.query(
        'INSERT INTO entities (name, type, status) VALUES (?, ?, ?)',
        [name, type, status]
      );
      created++;
    } catch (e) {
      errors++;
    }
  }
  res.json({ created, skipped, errors });
});

// Public universities list (no auth — for the public orbit picker page)
app.get('/api/public/universities', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT e.id, e.name, e.type, e.description_en, e.featured,
        e.qs_rank, e.the_rank, e.shanghai_rank, e.leiden_rank,
        el.city, el.country, el.continent,
        el.latitude, el.longitude,
        oc.orbit_center_lat, oc.orbit_center_lng, oc.orbit_altitude,
        oc.orbit_pitch, oc.orbit_initial_heading, oc.orbit_range,
        oc.orbit_rotation_speed, oc.orbit_rotation_type,
        oc.scan_target_lat, oc.scan_target_lng, oc.scan_effect_enabled
      FROM entities e
      LEFT JOIN entity_locations el ON el.id = (
        SELECT MIN(id) FROM entity_locations WHERE entity_id = e.id
      )
      LEFT JOIN orbit_configs oc ON oc.entity_location_id = el.id
      WHERE e.status != 'inactive'
      ORDER BY e.featured DESC, e.name
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Public university detail with all programs
app.get('/api/public/universities/:id', async (req, res) => {
  try {
    const [[entity]] = await db.query(`
      SELECT e.id, e.name, e.type, e.website_url, e.logo_url, e.description_en,
        e.qs_rank, e.qs_rank_year, e.the_rank, e.the_rank_year,
        e.shanghai_rank, e.shanghai_rank_year, e.leiden_rank, e.leiden_rank_year,
        el.id as location_id, el.city, el.country, el.continent,
        el.latitude, el.longitude,
        el.closest_airport_name, el.closest_airport_code, el.flight_duration_from_ist_min,
        oc.orbit_center_lat, oc.orbit_center_lng, oc.orbit_altitude,
        oc.orbit_pitch, oc.orbit_initial_heading, oc.orbit_range,
        oc.orbit_rotation_speed, oc.orbit_rotation_type,
        oc.scan_target_lat, oc.scan_target_lng, oc.scan_effect_enabled
      FROM entities e
      LEFT JOIN entity_locations el ON el.id = (SELECT MIN(id) FROM entity_locations WHERE entity_id = e.id)
      LEFT JOIN orbit_configs oc ON oc.entity_location_id = el.id
      WHERE e.id = ? AND e.status != 'inactive'
    `, [req.params.id]);
    if (!entity) return res.status(404).json({ error: 'Not found' });

    const [programs] = await db.query(`
      SELECT p.id, p.name, p.language_of_instruction, p.duration,
        p.tuition_fee, p.tuition_currency, p.intake_months,
        p.english_req_type, p.english_req_score, p.gpa_requirement,
        p.scholarship_available, p.description_en,
        pt.name as type_name
      FROM programs p
      JOIN program_types pt ON pt.id = p.program_type_id
      JOIN entity_locations el ON el.id = p.entity_location_id
      WHERE el.entity_id = ? AND p.status = 'active'
      ORDER BY pt.name, p.name
    `, [req.params.id]);

    res.json({ ...entity, programs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Public programs search (filterable)
app.get('/api/public/programs', async (req, res) => {
  try {
    const { q, country, type, domain, max_fee, lang, eng_type, scholarship, entity_id } = req.query;
    let where = ['p.status = "active"', 'e.status != "inactive"'];
    const vals = [];
    if (entity_id) { where.push('e.id = ?'); vals.push(parseInt(entity_id)); }
    if (q) { where.push('(p.name LIKE ? OR e.name LIKE ?)'); vals.push(`%${q}%`, `%${q}%`); }
    if (country) { where.push('el.country = ?'); vals.push(country); }
    if (type) { where.push('pt.name = ?'); vals.push(type); }
    if (domain) { where.push('p.description_en LIKE ?'); vals.push(`%${domain}%`); }
    if (max_fee) { where.push('(p.tuition_fee IS NULL OR p.tuition_fee <= ?)'); vals.push(parseFloat(max_fee)); }
    if (lang) { where.push('p.language_of_instruction LIKE ?'); vals.push(`%${lang}%`); }
    if (eng_type) { where.push('p.english_req_type = ?'); vals.push(eng_type); }
    if (scholarship === '1') { where.push('p.scholarship_available = 1'); }

    const [rows] = await db.query(`
      SELECT p.id, p.name, p.language_of_instruction, p.duration,
        p.tuition_fee, p.tuition_currency, p.intake_months,
        p.english_req_type, p.english_req_score, p.gpa_requirement,
        p.requirements_json, p.field,
        p.scholarship_available, p.description_en,
        pt.name as type_name,
        e.id as university_id, e.name as university_name,
        e.qs_rank, e.the_rank,
        el.city, el.country
      FROM programs p
      JOIN program_types pt ON pt.id = p.program_type_id
      JOIN entity_locations el ON el.id = p.entity_location_id
      JOIN entities e ON e.id = el.entity_id
      WHERE ${where.join(' AND ')}
      ORDER BY e.name, p.name
      LIMIT ${Math.min(Math.max(parseInt(req.query.limit) || 500, 1), 10000)}
    `, vals);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Public filter options (distinct values for dropdowns)
app.get('/api/public/filter-options', async (req, res) => {
  try {
    const [[countries], [types]] = await Promise.all([
      db.query(`SELECT DISTINCT el.country FROM entity_locations el JOIN entities e ON e.id=el.entity_id WHERE e.status != 'inactive' AND el.country IS NOT NULL ORDER BY el.country`),
      db.query(`SELECT DISTINCT pt.name FROM program_types pt JOIN programs p ON p.program_type_id=pt.id WHERE p.status='active' ORDER BY pt.name`)
    ]);
    res.json({ countries: countries.map(r => r.country), types: types.map(r => r.name) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Submit a lead (public — no auth)
app.post('/api/public/leads', async (req, res) => {
  try {
    const { student_name, email, phone, message, program_id, program_name, university_id, university_name, country } = req.body;
    if (!student_name || !email) return res.status(400).json({ error: 'Name and email are required.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address.' });
    const [r] = await db.query(
      `INSERT INTO leads (student_name, email, phone, message, program_id, program_name, university_id, university_name, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [student_name.trim(), email.trim(), phone || null, message || null,
       program_id || null, program_name || null, university_id || null, university_name || null, country || null]
    );
    res.json({ id: r.insertId });
    sendLeadNotification({ student_name: student_name.trim(), email: email.trim(), phone, message, program_name, university_name, country });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin: list leads
app.get('/api/admin/leads', requireRole('admin'), async (req, res) => {
  try {
    const { status, q } = req.query;
    let where = [];
    const vals = [];
    if (status) { where.push('status = ?'); vals.push(status); }
    if (q) { where.push('(student_name LIKE ? OR email LIKE ? OR university_name LIKE ? OR program_name LIKE ?)'); vals.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`); }
    const [rows] = await db.query(
      `SELECT * FROM leads ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`,
      vals
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin: update lead status / notes
app.patch('/api/admin/leads/:id', requireRole('admin'), async (req, res) => {
  try {
    const { status, notes } = req.body;
    const sets = [], vals = [];
    if (status) { sets.push('status=?'); vals.push(status); }
    if (notes !== undefined) { sets.push('notes=?'); vals.push(notes); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });
    vals.push(req.params.id);
    await db.query(`UPDATE leads SET ${sets.join(', ')} WHERE id=?`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin: list replies for a lead
app.get('/api/admin/leads/:id/replies', requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, body, sent_by, created_at FROM lead_replies WHERE lead_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin: reply to a lead (emails the student + saves to history)
app.post('/api/admin/leads/:id/reply', requireRole('admin'), async (req, res) => {
  try {
    const body = (req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Reply message is required.' });
    const [[lead]] = await db.query('SELECT id, student_name, email, status FROM leads WHERE id = ?', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });

    const sent = await sendLeadReply(lead.email, lead.student_name, body);
    if (!sent) return res.status(500).json({ error: 'Email could not be sent. Check SMTP settings.' });

    await db.query('INSERT INTO lead_replies (lead_id, body, sent_by) VALUES (?, ?, ?)',
      [lead.id, body, req.user.email || 'admin']);
    // Move a brand-new lead to "contacted" once we've replied
    if (lead.status === 'new') await db.query("UPDATE leads SET status = 'contacted' WHERE id = ?", [lead.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin: lead stats count
app.get('/api/admin/leads/stats', requireRole('admin'), async (req, res) => {
  try {
    const [[counts]] = await db.query(
      `SELECT COUNT(*) as total,
        SUM(status='new') as new_count,
        SUM(status='contacted') as contacted,
        SUM(status='converted') as converted
       FROM leads`
    );
    res.json(counts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Admin: export leads as CSV
app.get('/api/admin/leads/export', requireRole('admin'), async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM leads ORDER BY created_at DESC`);
    const cols = ['id','created_at','student_name','email','phone','program_name','university_name','country','status','message','notes'];
    const escape = v => v == null ? '' : `"${String(v).replace(/"/g,'""')}"`;
    const csv = [cols.join(','), ...rows.map(r => cols.map(c => escape(r[c])).join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leads_${new Date().toISOString().slice(0,10)}.csv"`);
    res.send(csv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Protected API routes
app.use('/api/entities', requireRole('admin'), require('./routes/entities'));
app.use('/api/locations', requireRole('admin'), require('./routes/locations'));
app.use('/api/programs', requireRole('admin'), require('./routes/programs'));
app.use('/api/orbit', requireRole('admin'), require('./routes/orbit'));
app.use('/api/program-types', requireRole('admin'), require('./routes/programTypes'));
app.use('/api/bulk/csv-import', requireRole('admin'), require('./routes/csvImport'));

// Scheduled reminder endpoint — call from cPanel cron with CRON_SECRET
// e.g. curl -H "Authorization: Bearer SECRET" "https://paneledu.com/api/auto/remind"
app.get('/api/auto/remind', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.query.k;
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const [apps] = await db.query(
      `SELECT * FROM applications WHERE status IN ('submitted','reviewing')
       AND email IS NOT NULL
       AND created_at < DATE_SUB(NOW(), INTERVAL 3 DAY)
       ORDER BY created_at ASC LIMIT 50`
    );
    let sent = 0;
    for (const app of apps) {
      const ok = await sendApplicationReminder(app, '').catch(() => false);
      if (ok) sent++;
    }
    res.json({ ok: true, sent, total: apps.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// 404 handler — must be last
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public/404.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
