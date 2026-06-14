const router = require('express').Router();
const db = require('../db');
const multer = require('multer');
const csvParser = require('csv-parser');
const { Readable } = require('stream');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── Lookup tables ─────────────────────────────────────────────────────────────

const CONTINENT_MAP = {
  'Turkey': 'Europe', 'United Kingdom': 'Europe', 'Germany': 'Europe',
  'France': 'Europe', 'Netherlands': 'Europe', 'Spain': 'Europe',
  'Ireland': 'Europe', 'Italy': 'Europe', 'Belgium': 'Europe',
  'Switzerland': 'Europe', 'Austria': 'Europe', 'Denmark': 'Europe',
  'Finland': 'Europe', 'Hungary': 'Europe', 'Czech Republic': 'Europe',
  'Poland': 'Europe', 'Latvia': 'Europe', 'Lithuania': 'Europe',
  'Malta': 'Europe', 'Cyprus': 'Europe',
  'United States': 'North America', 'Canada': 'North America',
  'Australia': 'Oceania',
  'United Arab Emirates': 'Middle East',
  'Georgia': 'Asia',
};

const COUNTRY_CAPITAL = {
  'Turkey': 'Istanbul', 'United Kingdom': 'London', 'Germany': 'Berlin',
  'France': 'Paris', 'Netherlands': 'Amsterdam', 'Spain': 'Barcelona',
  'Ireland': 'Dublin', 'Italy': 'Rome', 'Belgium': 'Brussels',
  'Switzerland': 'Zurich', 'Austria': 'Vienna', 'Denmark': 'Copenhagen',
  'Finland': 'Helsinki', 'Hungary': 'Budapest', 'Czech Republic': 'Prague',
  'Poland': 'Warsaw', 'Latvia': 'Riga', 'Lithuania': 'Vilnius',
  'Malta': 'Valletta', 'Cyprus': 'Nicosia',
  'United States': 'New York', 'Canada': 'Toronto',
  'Australia': 'Sydney', 'United Arab Emirates': 'Dubai', 'Georgia': 'Tbilisi',
};

// Cities to look for in university names (order matters — more specific first)
const CITY_KEYWORDS = [
  'Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Gaziantep', 'Konya',
  'Adana', 'Mersin', 'Kayseri', 'Eskisehir', 'Trabzon', 'Samsun',
  'London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Leeds',
  'Bristol', 'Sheffield', 'Liverpool', 'Nottingham', 'Southampton', 'Cardiff',
  'Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Stuttgart',
  'Dusseldorf', 'Leipzig', 'Dresden', 'Mannheim',
  'Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille',
  'Amsterdam', 'Rotterdam', 'Eindhoven', 'Tilburg', 'Leiden', 'Delft',
  'Barcelona', 'Madrid', 'Valencia', 'Seville', 'Bilbao',
  'Dublin', 'Cork', 'Galway', 'Limerick',
  'Vienna', 'Graz', 'Innsbruck', 'Salzburg',
  'Zurich', 'Geneva', 'Basel', 'Lausanne',
  'Budapest', 'Prague', 'Warsaw', 'Krakow', 'Gdansk',
  'Riga', 'Vilnius', 'Tallinn', 'Valletta', 'Nicosia',
  'Copenhagen', 'Helsinki', 'Brussels',
  'Toronto', 'Vancouver', 'Montreal', 'Ottawa', 'Calgary',
  'New York', 'Los Angeles', 'Chicago', 'Boston', 'San Francisco',
  'Seattle', 'Atlanta', 'Miami', 'Dallas', 'Washington',
  'Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide',
  'Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman',
  'Tbilisi', 'Rome', 'Milan', 'Florence', 'Bologna',
  'Singapore', 'Seoul', 'Beijing', 'Shanghai', 'Tokyo',
];

function inferCity(universityName, country) {
  const nameLower = universityName.toLowerCase();
  for (const city of CITY_KEYWORDS) {
    if (nameLower.includes(city.toLowerCase())) return city;
  }
  return COUNTRY_CAPITAL[country] || country;
}

function parseFee(feesStr, feeUsdStr) {
  if (!feesStr) return { fee: null, currency: 'USD' };
  const m = feesStr.match(/([A-Z]{2,3})$/);
  const currency = m ? m[1] : 'USD';
  const num = parseFloat(feeUsdStr);
  return { fee: isNaN(num) || num === 0 ? null : num, currency };
}

function parseRequirements(req) {
  if (!req) return { gpa: null, engType: 'None', engScore: null };
  const gpaM = req.match(/(\d+)\s*%\+?/);
  const gpa = gpaM ? `${gpaM[1]}%` : null;

  let engType = 'None', engScore = null;
  if (/IELTS/i.test(req)) {
    engType = 'IELTS';
    const m = req.match(/IELTS[^0-9]*([0-9]+(?:\.[0-9]+)?)/i);
    if (m) engScore = m[1];
  } else if (/TOEFL/i.test(req)) {
    engType = 'TOEFL';
    const m = req.match(/TOEFL[^0-9]*([0-9]+)/i);
    if (m) engScore = m[1];
  } else if (/Duolingo/i.test(req)) {
    engType = 'Duolingo';
    const m = req.match(/Duolingo[^0-9]*([0-9]+)/i);
    if (m) engScore = m[1];
  } else if (/PTE/i.test(req)) {
    engType = 'PTE';
    const m = req.match(/PTE[^0-9]*([0-9]+)/i);
    if (m) engScore = m[1];
  } else if (/Cambridge/i.test(req)) {
    engType = 'Cambridge';
  }

  return { gpa, engType, engScore };
}

function normalizeDuration(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) return `${s} year${s === '1' ? '' : 's'}`;
  return s;
}

function normalizeIntake(raw) {
  return raw ? String(raw).trim() : null;
}

function inferLanguage(courseName) {
  const n = courseName.toLowerCase();
  if (/\(turkish\)|\bin turkish\b|\bturkish medium\b/.test(n)) return 'Turkish';
  if (/\(english\)|\bin english\b|\benglish medium\b/.test(n)) return 'English';
  if (/english[/ ]turkish|turkish[/ ]english/.test(n)) return 'English/Turkish';
  return 'English';
}

// ── Import endpoint ──────────────────────────────────────────────────────────

router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const rows = [];
  await new Promise((resolve, reject) => {
    Readable.from(req.file.buffer)
      .pipe(csvParser({ skipLines: 1 })) // skip "Data Export" header row
      .on('data', d => rows.push(d))
      .on('end', resolve)
      .on('error', reject);
  });

  // ── Pre-build caches ─────────────────────────────────────────────────────
  const entityCache = {};    // name → id
  const locationCache = {};  // name → location_id
  const ptCache = {};        // credential level → program_type_id

  // Load existing entities
  const [existingEntities] = await db.query('SELECT id, name FROM entities');
  for (const e of existingEntities) entityCache[e.name] = e.id;

  // Load existing locations
  const [existingLocs] = await db.query('SELECT id, entity_id FROM entity_locations');
  for (const l of existingLocs) locationCache[l.entity_id] = l.id;

  // Load existing program types
  const [existingPts] = await db.query('SELECT id, name FROM program_types');
  for (const p of existingPts) ptCache[p.name] = p.id;

  let entitiesCreated = 0, locationsCreated = 0, programsCreated = 0, errors = 0;

  for (const row of rows) {
    try {
      const uniName   = (row['University Name'] || '').trim();
      const country   = (row['Country Name'] || '').trim();
      const credLevel = (row['Credential Level'] || '').trim();
      const courseName= (row['Course Name'] || '').trim();
      if (!uniName || !courseName || !credLevel) continue;

      // 1. Entity
      let entityId = entityCache[uniName];
      if (!entityId) {
        const [r] = await db.query(
          'INSERT INTO entities (name, type, status) VALUES (?, ?, ?)',
          [uniName, 'university', 'pending']
        );
        entityId = r.insertId;
        entityCache[uniName] = entityId;
        entitiesCreated++;
      }

      // 2. Location (one per entity)
      let locationId = locationCache[entityId];
      if (!locationId) {
        const city = inferCity(uniName, country);
        const continent = CONTINENT_MAP[country] || 'Europe';
        const [r] = await db.query(
          `INSERT INTO entity_locations (entity_id, city, country, continent, status)
           VALUES (?, ?, ?, ?, 'active')`,
          [entityId, city, country, continent]
        );
        locationId = r.insertId;
        locationCache[entityId] = locationId;
        locationsCreated++;
      }

      // 3. Program type
      let ptId = ptCache[credLevel];
      if (!ptId) {
        const [r] = await db.query('INSERT INTO program_types (name) VALUES (?)', [credLevel]);
        ptId = r.insertId;
        ptCache[credLevel] = ptId;
      }

      // 4. Parse fields
      const { fee, currency } = parseFee(row['Fees'], row['Fee USD']);
      const { gpa, engType, engScore } = parseRequirements(row['Minimum Requirements']);
      const duration = normalizeDuration(row['Course Duration']);
      const intake = normalizeIntake(row['Intakes Duration']);
      const language = inferLanguage(courseName);
      const notes = [row['Domain'] ? `Domain: ${row['Domain']}` : '', row['Notes'] || ''].filter(Boolean).join(' | ') || null;

      // 5. Program
      await db.query(
        `INSERT INTO programs (entity_location_id, program_type_id, name, language_of_instruction,
         duration, tuition_fee, tuition_currency, intake_months, english_req_type, english_req_score,
         gpa_requirement, description_en, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
        [locationId, ptId, courseName, language, duration, fee, currency,
         intake, engType, engScore || null, gpa, notes]
      );
      programsCreated++;
    } catch (e) {
      errors++;
    }
  }

  res.json({ entitiesCreated, locationsCreated, programsCreated, errors, total: rows.length });
});

module.exports = router;
