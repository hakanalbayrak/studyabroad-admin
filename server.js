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

// Rankings lookup via Gemini + Google Search Grounding
app.get('/api/lookup/rankings', auth, async (req, res) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name required' });
  const key = process.env.GEMINI_KEY;
  if (!key || key === 'your_gemini_key_here') {
    return res.status(503).json({ error: 'GEMINI_KEY not configured in environment variables.' });
  }
  try {
    const https = require('https');
    const prompt = `You are a university data assistant. Find the most recent world university rankings for "${name}".
Search for each of these ranking systems and return the rank number and year.
Return ONLY a valid JSON object, no markdown, no explanation:
{
  "qs_rank": <integer or null>,
  "qs_year": <4-digit year or null>,
  "the_rank": <integer or null>,
  "the_year": <4-digit year or null>,
  "shanghai_rank": <integer or null>,
  "shanghai_year": <4-digit year or null>,
  "leiden_rank": <integer or null>,
  "leiden_year": <4-digit year or null>,
  "sources": ["<url1>", "<url2>"]
}
For ranges like "201-300" use the lower bound (201). If a university is unranked or not found return null.`;

    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0, responseMimeType: 'text/plain' }
    });

    const geminiRes = await new Promise((resolve, reject) => {
      const req2 = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/gemini-2.0-flash:generateContent',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        }
      }, r => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => resolve({ status: r.statusCode, body: d }));
      });
      req2.on('error', reject);
      req2.write(body);
      req2.end();
    });

    if (geminiRes.status !== 200) {
      const err = JSON.parse(geminiRes.body);
      return res.status(502).json({ error: err.error?.message || 'Gemini API error', status: geminiRes.status });
    }

    const parsed = JSON.parse(geminiRes.body);
    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Extract JSON from response (strip any markdown fences if present)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(502).json({ error: 'Gemini returned unexpected format', raw: text });
    const rankings = JSON.parse(jsonMatch[0]);
    res.json(rankings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Protected API routes
app.use('/api/entities', auth, require('./routes/entities'));
app.use('/api/locations', auth, require('./routes/locations'));
app.use('/api/programs', auth, require('./routes/programs'));
app.use('/api/orbit', auth, require('./routes/orbit'));
app.use('/api/program-types', auth, require('./routes/programTypes'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
