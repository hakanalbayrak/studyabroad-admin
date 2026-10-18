/*
 * School matching engine (single source of truth for /match and the AI agent).
 *
 *   taxonomy  : fine-grained programs.field  ->  7 macro fields; country -> region;
 *               program type -> degree level
 *   matchProfile(profile, rows) : hard filters + weighted score + human-readable reasons
 *   PROFILE_SCHEMA : machine-readable description of the input (served to agents)
 *
 * Pure functions, no DB access here (the route in server.js loads candidate rows).
 */
'use strict';

// ── Fields ──────────────────────────────────────────────────────────────────
const FIELD_GROUPS = ['Business & Economics', 'Engineering', 'Medicine & Health', 'AI & Technology',
  'Social Sciences', 'Arts & Design', 'Natural Sciences'];

// First matching rule wins (order matters). Tested against all stored `programs.field` values.
const FIELD_RULES = [
  [/medic|dentist|nurs|pharm|health|veterin|nutrition|neuro|mental|biomedical|molecular|life sciences|pre-medical/i, 'Medicine & Health'],
  [/artificial|computer|software|cyber|ui\/ux|game|business analytics|data/i, 'AI & Technology'],
  [/business|account|financ|econom|human resources|marketing|supply chain|tourism|hospitality|sports|luxury|innovation/i, 'Business & Economics'],
  [/architect|design|animation|film|fashion|music|fine arts|interior|graphics|landscape|restoration|entertainment|creative|art history/i, 'Arts & Design'],
  [/engineer|aerospace|mechanic|mechatron|electrical|automotive|chemical|construction|civil|industrial|building information|maths, physics/i, 'Engineering'],
  [/chemistry|physics|science|environment|wildlife|food|agricult|biotech/i, 'Natural Sciences'],
  [/law|history|education|philosoph|international relations|language|literature|humanities|criminolog|psycholog|media|liberal|social|geograph/i, 'Social Sciences'],
];
const FIELD_OVERRIDE = {
  'Environmental, Energy / Sustainability': 'Natural Sciences', 'Humanities and Social Science': 'Social Sciences',
  'Interdisciplinary Social Sciences': 'Social Sciences', 'International Relations and Political Sciences': 'Social Sciences',
  'Literature and creative writing': 'Social Sciences', 'Liberal Arts and Sciences': 'Social Sciences',
  'Psychology (Neuro, Clinical, Developmental etc)': 'Social Sciences', 'Biotechnology, Biomedicine, Biochemistry': 'Natural Sciences',
  'Molecular Sciences & Biosciences': 'Natural Sciences', 'Geography, Landscape and Construction': 'Engineering',
  'Architecture and Engineering': 'Engineering', 'Business Analytics & Intelligence': 'Business & Economics',
};
function macroField(field) {
  if (!field) return null;
  if (FIELD_OVERRIDE[field]) return FIELD_OVERRIDE[field];
  for (const [re, g] of FIELD_RULES) if (re.test(field)) return g;
  return null;
}

// ── Regions ─────────────────────────────────────────────────────────────────
const REGIONS = {
  'Europe': ['Austria', 'Belgium', 'Cyprus', 'Czech Republic', 'France', 'Germany', 'Hungary', 'Ireland', 'Italy', 'Malta', 'Netherlands', 'Spain'],
  'USA/Canada': ['United States', 'Canada'],
  'UK': ['United Kingdom'],
  'Australia': ['Australia'],
  'Middle East': ['United Arab Emirates'],
};
const regionOf = c => Object.keys(REGIONS).find(r => REGIONS[r].includes(c)) || null;

// ── Degree levels ───────────────────────────────────────────────────────────
const DEGREE_TYPES = { bachelor: ['Bachelor Programs'], master: ['Master Programs'] };
// Preparation routes shown (with lower rank) when the student is short of the entry requirement.
const BRIDGE_TYPES = { bachelor: ['Foundation Programs', 'Pathway Programs'], master: ['Pre-Master Programs', 'Pathway Programs'] };

// ── English ─────────────────────────────────────────────────────────────────
function toIelts(test, score) {
  const s = parseFloat(score); if (isNaN(s)) return null;
  switch (String(test || '').toLowerCase()) {
    case 'ielts': return s;
    case 'toefl': return s < 60 ? 4.5 : s < 79 ? 5.5 : s < 94 ? 6.5 : s < 102 ? 7 : 7.5;
    case 'duolingo': return s < 85 ? 5 : s < 100 ? 6 : s < 115 ? 6.5 : s < 125 ? 7 : 7.5;
    case 'pte': return s < 50 ? 5 : s < 59 ? 6 : s < 65 ? 6.5 : s < 73 ? 7 : 7.5;
    case 'cambridge': return 7;
    default: return null;
  }
}
const LEVEL_IELTS = { 'A1-A2': 4.0, 'B1-B2': 5.5, 'C1-C2': 7.0 };
// Program requirement as IELTS-equivalent: the EASIEST accepted test (OR logic). null = none stated.
function programIelts(p) {
  let reqs = p.requirements_json;
  if (typeof reqs === 'string') { try { reqs = JSON.parse(reqs); } catch (e) { reqs = null; } }
  const vals = [];
  if (reqs && Array.isArray(reqs.english)) reqs.english.forEach(e => { const v = toIelts(e.test, e.min); if (v != null) vals.push(v); });
  if (!vals.length && p.english_req_type && p.english_req_type !== 'None') {
    const v = toIelts(p.english_req_type, p.english_req_score); if (v != null) vals.push(v);
  }
  return vals.length ? Math.min(...vals) : null;
}

// ── Budget ──────────────────────────────────────────────────────────────────
const FX = { EUR: 1, USD: 0.92, GBP: 1.17, AUD: 0.61, CAD: 0.68, AED: 0.25 };
const BUDGET_MAX = { '0-5k': 5000, '5-10k': 10000, '10-15k': 15000, '15k+': Infinity };
function feeEur(p) {
  if (p.tuition_fee == null || p.tuition_fee === '') return null;
  const f = parseFloat(p.tuition_fee); if (isNaN(f)) return null;
  return f * (FX[String(p.tuition_currency || 'EUR').toUpperCase()] || 1);
}

// ── Profile ─────────────────────────────────────────────────────────────────
const PROFILE_SCHEMA = {
  education: { type: 'enum', values: ['highschool', 'bachelor'], note: 'Current education. Default degree target follows from it.' },
  degree: { type: 'enum', values: ['bachelor', 'master'], note: 'Degree to study. Default: bachelor for highschool, master for bachelor.' },
  fields: { type: 'array<enum>', values: FIELD_GROUPS, note: 'Empty = any field.' },
  english: { type: 'enum', values: Object.keys(LEVEL_IELTS), note: 'Or send english_test + english_score for an exact test result.' },
  english_test: { type: 'enum', values: ['IELTS', 'TOEFL', 'Duolingo', 'PTE'] },
  english_score: { type: 'number' },
  budget: { type: 'enum', values: Object.keys(BUDGET_MAX), note: 'Yearly tuition ceiling in EUR. Unknown fees are kept and flagged.' },
  region: { type: 'enum', values: Object.keys(REGIONS), note: 'Optional. Or send countries[] for exact countries.' },
  countries: { type: 'array<string>', values: [].concat(...Object.values(REGIONS)) },
  apib: { type: 'boolean', note: 'Has AP/IB diploma (small admission boost).' },
  limit: { type: 'integer', note: 'Max schools returned (default 60, max 200).' },
};

function normalizeProfile(raw) {
  const r = raw || {};
  const pick = (v, list) => (list.includes(v) ? v : null);
  const education = pick(r.education, ['highschool', 'bachelor']) || 'highschool';
  const degree = pick(r.degree, ['bachelor', 'master']) || (education === 'bachelor' ? 'master' : 'bachelor');
  const arr = v => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(',') : []).map(s => String(s).trim()).filter(Boolean);
  let ielts = null;
  if (r.english_test && r.english_score != null) ielts = toIelts(r.english_test, r.english_score);
  if (ielts == null) ielts = LEVEL_IELTS[r.english] != null ? LEVEL_IELTS[r.english] : null;
  return {
    education, degree,
    fields: arr(r.fields).filter(f => FIELD_GROUPS.includes(f)),
    ielts,                                           // null = unknown, no English penalty
    budget: BUDGET_MAX[r.budget] != null ? r.budget : null,
    region: REGIONS[r.region] ? r.region : null,
    countries: arr(r.countries),
    apib: r.apib === true || r.apib === 'yes' || r.apib === '1' || r.apib === 1,
    limit: Math.min(Math.max(parseInt(r.limit) || 60, 1), 200),
  };
}

// Countries / types / fields the SQL prefilter should use, derived from the profile.
function sqlScope(profile) {
  const countries = profile.countries.length ? profile.countries : (profile.region ? REGIONS[profile.region] : []);
  return {
    types: [].concat(DEGREE_TYPES[profile.degree], BRIDGE_TYPES[profile.degree]),
    countries,
    groups: profile.fields,
  };
}

// ── Scoring ─────────────────────────────────────────────────────────────────
// Returns null when the program is excluded, else { ease, fee, reasons[], route }.
function scoreProgram(profile, p) {
  const isMain = DEGREE_TYPES[profile.degree].includes(p.type_name);
  const isBridge = !isMain && BRIDGE_TYPES[profile.degree].includes(p.type_name);
  if (!isMain && !isBridge) return null;
  if (p.international_eligible === 0) return null;

  const allowed = sqlScope(profile).countries;
  if (allowed.length && !allowed.includes(p.country)) return null;

  const group = macroField(p.field);
  if (profile.fields.length && !profile.fields.includes(group)) return null;

  const fee = feeEur(p);
  const max = profile.budget ? BUDGET_MAX[profile.budget] : Infinity;
  if (fee != null && fee > max) return null;

  const reasons = [];
  let ease = 0;

  // English: 0..40. Student meets the requirement -> full; within 1 band -> partial.
  const need = programIelts(p);
  if (profile.ielts == null) { ease += 25; }
  else if (need == null) { ease += 40; reasons.push('no_english_req'); }
  else if (profile.ielts >= need) { ease += 40; reasons.push('english_ok'); }
  else if (profile.ielts >= need - 1) { ease += 15; reasons.push('english_close'); }
  else { ease += 0; reasons.push('english_short'); }

  // Prestige: unranked / lower-ranked are easier to enter: 0..30
  const rank = parseInt(p.qs_rank) || parseInt(p.the_rank) || null;
  ease += !rank ? 30 : rank > 300 ? 28 : rank > 100 ? 20 : 10;
  if (rank && rank <= 200) reasons.push('top_ranked');

  // Budget comfort 0..15
  if (fee != null && max !== Infinity) { ease += Math.max(0, 15 * (1 - fee / max)); reasons.push('in_budget'); }
  else if (fee != null) ease += 8;
  else reasons.push('fee_unknown');

  if (profile.apib) ease += 10;
  if (Number(p.scholarship_available) === 1) { ease += 4; reasons.push('scholarship'); }
  if (Number(p.international_eligible) === 1) ease += 2;
  if (p.source_url) ease += 1;                      // verified official page exists

  if (isBridge) { ease -= 25; reasons.push('bridge_route'); }
  return { ease, fee, reasons, route: isBridge ? 'bridge' : 'direct', group };
}

function matchProfile(rawProfile, rows) {
  const profile = normalizeProfile(rawProfile);
  const byUni = new Map();
  for (const p of rows) {
    const s = scoreProgram(profile, p);
    if (!s) continue;
    let u = byUni.get(p.university_id);
    if (!u) {
      u = { university_id: p.university_id, university_name: p.university_name, city: p.city, country: p.country,
        region: regionOf(p.country), qs_rank: p.qs_rank, the_rank: p.the_rank, ease: -1e9, programs: [], reasons: new Set() };
      byUni.set(p.university_id, u);
    }
    u.programs.push({ id: p.id, name: p.name, type_name: p.type_name, field: p.field, group: s.group, fee_eur: s.fee == null ? null : Math.round(s.fee),
      duration: p.duration || null, route: s.route, ease: Math.round(s.ease), reasons: s.reasons, source_url: p.source_url || null });
    if (s.ease > u.ease) { u.ease = s.ease; u.reasons = new Set(s.reasons); }
  }
  const schools = [...byUni.values()].map(u => {
    u.programs.sort((a, b) => b.ease - a.ease);
    const fees = u.programs.map(p => p.fee_eur).filter(f => f != null);
    u.avg_fee_eur = fees.length ? Math.round(fees.reduce((a, b) => a + b, 0) / fees.length) : null;
    const d = {}; u.programs.forEach(p => { if (p.duration) d[p.duration] = (d[p.duration] || 0) + 1; });
    u.duration = Object.keys(d).sort((a, b) => d[b] - d[a])[0] || null;
    u.program_count = u.programs.length;
    u.programs = u.programs.slice(0, 12);
    u.ease = Math.round(u.ease); u.reasons = [...u.reasons];
    return u;
  });
  schools.sort((a, b) => b.ease - a.ease || (parseInt(a.qs_rank) || 9999) - (parseInt(b.qs_rank) || 9999));
  return { profile, total: schools.length, schools: schools.slice(0, profile.limit) };
}

module.exports = { FIELD_GROUPS, REGIONS, PROFILE_SCHEMA, macroField, regionOf, normalizeProfile, sqlScope, scoreProgram, matchProfile };
