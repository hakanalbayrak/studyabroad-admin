require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { login, logout, auth } = require('./middleware/auth');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve admin panel at /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

// Auth endpoints
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const token = login(password);
  if (!token) return res.status(401).json({ error: 'Invalid password' });
  res.json({ token });
});

app.post('/api/admin/logout', auth, (req, res) => {
  logout(req.token);
  res.json({ success: true });
});

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

app.get('/api/lookup/rankings', auth, async (req, res) => {
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

app.post('/api/bulk/rankings', auth, async (req, res) => {
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

app.get('/api/bulk/rankings/:jobId', auth, (req, res) => {
  const job = bulkJobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json(job);
});

app.delete('/api/bulk/rankings/:jobId', auth, (req, res) => {
  const job = bulkJobs[req.params.jobId];
  if (!job) return res.status(404).json({ error: 'Job not found' });
  job.stopRequested = true;
  res.json({ success: true });
});

// ── Bulk entity import ────────────────────────────────────────────────────────
app.post('/api/bulk/import', auth, async (req, res) => {
  const { names, type = 'university', status = 'pending' } = req.body;
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

// Protected API routes
app.use('/api/entities', auth, require('./routes/entities'));
app.use('/api/locations', auth, require('./routes/locations'));
app.use('/api/programs', auth, require('./routes/programs'));
app.use('/api/orbit', auth, require('./routes/orbit'));
app.use('/api/program-types', auth, require('./routes/programTypes'));
app.use('/api/bulk/csv-import', auth, require('./routes/csvImport'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
