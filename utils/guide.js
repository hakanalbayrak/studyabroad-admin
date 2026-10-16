/*
 * University guides: SEO question-and-answer pages built from live database values
 * (programs, rankings, location) + admin-editable facts + optional hand-written answers.
 *
 *   data flow:  programs/entities (live)  +  guide_profiles.facts  +  country facts
 *               -> context tokens ({{tuition_range}} ...)
 *               -> answer per question (admin override with tokens, else auto default, else hidden)
 *               -> HTML article (/blog/<slug>), university page section, JSON for agents
 *
 * Nothing here is cached for long: admin edits and program updates show within a minute.
 */
'use strict';

const db = require('../db');
const { GROUPS, QUESTIONS, ENTITY_FACTS, COUNTRY_FACTS, COUNTRY_TR } = require('../content/guide/spec');
const blog = require('./blog');
const { esc, renderMarkdown, SITE } = blog;

// ── Storage ────────────────────────────────────────────────────────────────
let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = db.query(`CREATE TABLE IF NOT EXISTS guide_profiles (
      scope ENUM('entity','country') NOT NULL,
      ref VARCHAR(120) NOT NULL,
      slug VARCHAR(160) NULL,
      status ENUM('draft','published') NOT NULL DEFAULT 'draft',
      data JSON NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (scope, ref),
      UNIQUE KEY uq_guide_slug (slug)
    )`).catch(e => { tableReady = null; throw e; });
  }
  return tableReady;
}
const parseJson = v => { if (!v) return {}; if (typeof v === 'object') return v; try { return JSON.parse(v); } catch { return {}; } };

async function getProfile(scope, ref) {
  await ensureTable();
  const [[row]] = await db.query('SELECT * FROM guide_profiles WHERE scope = ? AND ref = ?', [scope, String(ref)]);
  return row ? { ...row, data: parseJson(row.data) } : { scope, ref: String(ref), slug: null, status: 'draft', data: {}, updated_at: null };
}

const cache = new Map();
function clearCache() { cache.clear(); }

async function saveProfile(scope, ref, { status, slug, data }) {
  await ensureTable();
  const cleanSlug = slug ? slugify(slug) : null;
  await db.query(
    `INSERT INTO guide_profiles (scope, ref, slug, status, data) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE slug = VALUES(slug), status = VALUES(status), data = VALUES(data)`,
    [scope, String(ref), cleanSlug, status === 'published' ? 'published' : 'draft', JSON.stringify(data || {})]);
  clearCache();
}

// ── Turkish helpers ────────────────────────────────────────────────────────
const TRMAP = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
function slugify(s) {
  return String(s || '').toLowerCase().replace(/[çğıöşüâîû]/g, ch => TRMAP[ch]).normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)/g, ' ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
}
const VOW = 'aeıioöuü';
const HARD = 'çfhkpsşt';
// Suffix chosen from how the word is pronounced (last vowel harmony, final sound).
function sounds(word) {
  let w = String(word || '').toLocaleLowerCase('tr').replace(/\(.*?\)/g, ' ').replace(/[^a-zçğıöşüâîû ]/g, '').trim();
  w = w.split(/\s+/).pop() || '';
  w = w.replace(/y$/, m => 'i');                    // "University": y is spoken as i
  let v = '';
  for (let i = w.length - 1; i >= 0; i--) if (VOW.includes(w[i]) || 'âîû'.includes(w[i])) { v = w[i]; break; }
  v = { â: 'a', î: 'i', û: 'u' }[v] || v || 'e';
  const last = w[w.length - 1] || 'e';
  return { v, endsVowel: VOW.includes(last), hard: HARD.includes(last) };
}
function suffix(word, kind) {
  const { v, endsVowel, hard } = sounds(word);
  const back = 'aıou'.includes(v), round = 'oöuü'.includes(v);
  if (kind === 'abl') return (hard ? 't' : 'd') + (back ? 'an' : 'en');
  if (kind === 'loc') return (hard ? 't' : 'd') + (back ? 'a' : 'e');
  if (kind === 'dat') return (endsVowel ? 'y' : '') + (back ? 'a' : 'e');
  if (kind === 'gen') return (endsVowel ? 'n' : '') + (round ? (back ? 'u' : 'ü') : (back ? 'ı' : 'i')) + 'n';
  return '';
}
const withSuffix = (name, kind, pron) => `${name}'${suffix(pron || name, kind)}`;

// ── Formatting ─────────────────────────────────────────────────────────────
const SYM = { EUR: '€', USD: '$', GBP: '£', AUD: 'A$', CAD: 'C$', AED: 'AED ' };
const money = (n, cur) => `${SYM[cur] || (cur + ' ')}${Math.round(n).toLocaleString('tr-TR')}`;
const LEVEL_TR = { 'Bachelor Programs': 'Lisans', 'Master Programs': 'Yüksek lisans', 'Foundation Programs': 'Foundation (hazırlık)',
  'Pathway Programs': 'Pathway', 'Pre-Master Programs': 'Pre-master', 'Diploma Programs': 'Diploma', 'Certificate Programs': 'Sertifika',
  'Other Credentials': 'Diğer' };
const lvl = t => LEVEL_TR[t] || t;
const MONTH_TR = { january: 'Ocak', february: 'Şubat', march: 'Mart', april: 'Nisan', may: 'Mayıs', june: 'Haziran', july: 'Temmuz', august: 'Ağustos',
  september: 'Eylül', october: 'Ekim', november: 'Kasım', december: 'Aralık', jan: 'Ocak', feb: 'Şubat', mar: 'Mart', apr: 'Nisan', jun: 'Haziran',
  jul: 'Temmuz', aug: 'Ağustos', sep: 'Eylül', sept: 'Eylül', oct: 'Ekim', nov: 'Kasım', dec: 'Aralık' };
const trMonth = s => String(s).replace(/[A-Za-z]+/g, w => MONTH_TR[w.toLowerCase()] || w);
const uniq = a => [...new Set(a.filter(x => x != null && x !== ''))];
const listTr = a => a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' ve ' + a[a.length - 1];
const numOr = (v, d = null) => { const n = parseFloat(v); return isNaN(n) ? d : n; };

// ── Live context from the database ─────────────────────────────────────────
async function loadContext(entityId) {
  const [[e]] = await db.query(
    `SELECT e.*, el.city, el.country, el.closest_airport_name, el.closest_airport_code, el.flight_duration_from_ist_min, el.latitude, el.longitude
     FROM entities e LEFT JOIN entity_locations el ON el.id = (SELECT MIN(id) FROM entity_locations WHERE entity_id = e.id)
     WHERE e.id = ?`, [entityId]);
  if (!e) return null;
  const [progs] = await db.query(
    `SELECT p.*, pt.name AS type_name FROM programs p
     JOIN program_types pt ON pt.id = p.program_type_id
     JOIN entity_locations el ON el.id = p.entity_location_id
     WHERE el.entity_id = ? AND p.status = 'active'`, [entityId]);
  return { e, progs };
}

function aggregate(progs) {
  const a = { count: progs.length, byType: {}, fields: {}, currency: 'EUR' };
  const cur = {}; progs.forEach(p => { if (p.tuition_fee != null) cur[p.tuition_currency || 'EUR'] = (cur[p.tuition_currency || 'EUR'] || 0) + 1; });
  a.currency = Object.keys(cur).sort((x, y) => cur[y] - cur[x])[0] || 'EUR';
  const fee = p => (p.tuition_fee != null && (p.tuition_currency || 'EUR') === a.currency && parseFloat(p.tuition_fee) > 0) ? parseFloat(p.tuition_fee) : null;
  const stats = list => { const f = list.map(fee).filter(x => x != null); return f.length ? { min: Math.min(...f), max: Math.max(...f), avg: f.reduce((s, x) => s + x, 0) / f.length, n: f.length } : null; };
  progs.forEach(p => {
    (a.byType[p.type_name] = a.byType[p.type_name] || []).push(p);
    if (p.field) a.fields[p.field] = (a.fields[p.field] || 0) + 1;
  });
  a.fee = stats(progs);
  a.feeByType = {}; Object.keys(a.byType).forEach(t => { a.feeByType[t] = stats(a.byType[t]); });
  const eng = progs.filter(p => p.english_req_type && p.english_req_type !== 'None' && numOr(p.english_req_score) != null);
  const byTest = {}; eng.forEach(p => { (byTest[p.english_req_type] = byTest[p.english_req_type] || []).push(numOr(p.english_req_score)); });
  a.english = Object.keys(byTest).map(t => { const s = byTest[t]; const lo = Math.min(...s), hi = Math.max(...s); return `${t} ${lo === hi ? lo : lo + ' – ' + hi}`; });
  a.gpa = uniq(progs.map(p => p.gpa_requirement && String(p.gpa_requirement).trim()));
  a.intakes = uniq([].concat(...progs.map(p => String(p.intake_months || '').split(/[,;&\/]|\band\b/i).map(s => trMonth(s.trim())))));
  a.deadlines = uniq(progs.map(p => p.application_deadline && String(p.application_deadline).trim()));
  a.languages = uniq(progs.map(p => p.language_of_instruction));
  a.scholarshipPrograms = progs.filter(p => Number(p.scholarship_available) === 1);
  a.scholarshipAmounts = uniq(progs.map(p => p.scholarship_amount));
  a.scholarshipConditions = uniq(progs.map(p => p.scholarship_conditions));
  a.intl = progs.filter(p => p.international_eligible == null || Number(p.international_eligible) === 1).length;
  a.placement = progs.filter(p => Number(p.placement_year) === 1).length;
  a.internship = progs.filter(p => Number(p.internship_available) === 1).length;
  a.topFields = Object.keys(a.fields).sort((x, y) => a.fields[y] - a.fields[x]);
  a.updated = progs.reduce((m, p) => (p.updated_at && new Date(p.updated_at) > m ? new Date(p.updated_at) : m), new Date(0));
  return a;
}

function feeRange(s, cur) { return !s ? '' : (s.min === s.max ? money(s.min, cur) : `${money(s.min, cur)} – ${money(s.max, cur)}`); }

function buildTokens(e, agg, facts, cf, names) {
  const t = {
    name: e.name, short: names.short, city: e.city || '', country: e.country || '', country_tr: COUNTRY_TR[e.country] || e.country || '',
    program_count: agg.count, bachelor_count: (agg.byType['Bachelor Programs'] || []).length, master_count: (agg.byType['Master Programs'] || []).length,
    tuition_range: feeRange(agg.fee, agg.currency) ? feeRange(agg.fee, agg.currency) + ' / yıl' : '',
    tuition_min: agg.fee ? money(agg.fee.min, agg.currency) : '', tuition_max: agg.fee ? money(agg.fee.max, agg.currency) : '',
    tuition_avg: agg.fee ? money(agg.fee.avg, agg.currency) : '',
    bachelor_tuition: agg.feeByType['Bachelor Programs'] ? feeRange(agg.feeByType['Bachelor Programs'], agg.currency) : '',
    master_tuition: agg.feeByType['Master Programs'] ? feeRange(agg.feeByType['Master Programs'], agg.currency) : '',
    english_range: agg.english.join(', '), gpa_range: agg.gpa.join(', '), intakes: listTr(agg.intakes), deadlines: listTr(agg.deadlines),
    languages: listTr(agg.languages), qs_rank: e.qs_rank || '', the_rank: e.the_rank || '', shanghai_rank: e.shanghai_rank || '',
    website: e.website_url || '', airport: e.closest_airport_name || '', airport_code: e.closest_airport_code || '',
  };
  ENTITY_FACTS.forEach(f => { const v = facts[f.key]; if (v != null && v !== '' && !Array.isArray(v)) t[f.key] = v; });
  COUNTRY_FACTS.forEach(f => { const v = cf[f.key]; if (v != null && v !== '' && !Array.isArray(v)) t['c_' + f.key] = v; });
  return t;
}
const fill = (s, tokens) => { const miss = []; const out = String(s || '').replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) => { if (tokens[k] == null || tokens[k] === '') { miss.push(k); return ''; } return tokens[k]; }); return { out, miss }; };

// ── Auto answers ───────────────────────────────────────────────────────────
// Each returns Markdown or null (null = not enough data, the question stays hidden).
const bullets = a => a.map(x => `- ${x}`).join('\n');
const has = v => v != null && v !== '' && !(Array.isArray(v) && !v.length);
const uniLink = c => `[${c.short} sayfasındaki tüm programlar](/university?id=${c.e.id})`;

const DEFAULTS = {
  admit(c) {
    const { e, t, agg, f } = c;
    const parts = [];
    parts.push(`${t.short}, ${t.country_tr ? t.country_tr + ' ülkesinin ' : ''}${t.city ? t.city + ' şehrinde bulunan ' : ''}${f.type_of_institution ? String(f.type_of_institution).toLocaleLowerCase('tr') + ' ' : ''}bir eğitim kurumudur.`);
    if (agg.count) parts.push(`PANELEDU’da ${t.short} için ${agg.count} aktif program listeleniyor ve bunların ${agg.intl} tanesi uluslararası öğrenci başvurusuna açık işaretli. Türkiye’den başvuran öğrenciler de bu programlara başvurabilir.`);
    const facts = [];
    if (t.tuition_range) facts.push(`**Yıllık ücret:** ${t.tuition_range}`);
    if (f.english_note) facts.push(`**İngilizce:** ${String(f.english_note).split('\n')[0]}`);
    else if (agg.english.length) facts.push(`**İngilizce:** ${agg.english.join(', ')}`);
    if (agg.intakes.length) facts.push(`**Başlangıç:** ${listTr(agg.intakes)}`);
    if (f.exam_required === 'none') facts.push('**Giriş sınavı:** yok');
    if (has(f.scholarship_note) || agg.scholarshipPrograms.length) facts.push('**Burs:** var');
    return parts.join(' ') + (facts.length ? '\n\n' + bullets(facts) : '') +
      `\n\nAşağıda ${t.short} için kabul şartlarını, ücretleri, burs ve konaklama bilgilerini ve başvuru adımlarını adım adım bulabilirsin. İstersen önce [sana uygun okulları](/match) görebilir ya da doğrudan [başvuru talebi](/apply) bırakabilirsin.`;
  },

  exam(c) {
    const { f, t } = c; const out = [];
    if (f.exam_required === 'none') out.push(`Hayır, ${t.short} için ayrı bir giriş sınavı gerekmiyor.`);
    else if (f.exam_required === 'optional') out.push('Giriş sınavı zorunlu değil, isteğe bağlı olarak sunulabiliyor.');
    else if (f.exam_required === 'conditional') out.push('Giriş sınavı herkes için şart değil; lise diplomanın o ülkedeki üniversitelere doğrudan giriş hakkı verip vermemesine göre istenebiliyor.');
    else if (f.exam_required === 'required') out.push('Evet, başvuruda giriş sınavı sonucu isteniyor.');
    if (f.exam_note) out.push(f.exam_note);
    if (!out.length) return null;
    return out.join('\n\n') + (t.english_range || f.english_note ? '\n\nİngilizce yeterlilik belgesi ayrı bir konudur, detayı aşağıda.' : '');
  },

  noexam(c) {
    const { f, t } = c;
    if (!['none', 'optional', 'conditional'].includes(f.exam_required)) return null;
    const base = f.exam_required === 'none' ? `Evet. ${t.short} için ayrı bir giriş sınavı yok; değerlendirme dosyana (notlar, motivasyon yazısı, İngilizce belgesi) göre yapılıyor.`
      : f.exam_required === 'optional' ? `Çoğu başvuruda evet; sınav sonucu isteğe bağlı olduğu için sınava girmeden de başvurabilirsin.`
      : `Diplomana bağlı. Lise diplomanın doğrudan giriş hakkı vermediği durumlarda sınav ya da hazırlık yılı gerekebilir; aksi halde sınavsız başvuru mümkün.`;
    return base + (f.exam_note ? '\n\n' + f.exam_note : '');
  },

  gpa(c) {
    const { f, agg, t } = c;
    if (f.gpa_note) return f.gpa_note;
    if (agg.gpa.length) return `${t.short} programlarında istenen asgari not ortalaması şöyle listeleniyor: ${agg.gpa.join(', ')}. Not sistemin farklıysa (4’lük, 100’lük, 10’luk) danışmanımız karşılığını hesaplar.`;
    return null;
  },

  english(c) {
    const { f, agg, t } = c;
    if (f.english_note) return f.english_note;
    if (agg.english.length) return `Evet, programlara göre şu minimum puanlar isteniyor: **${agg.english.join(', ')}**. Eğitim dili İngilizce olan bir okulda okuduysan bazı okullar belge istemeyebilir; bunu başvuruda kontrol et. Belgen yoksa [ücretsiz İngilizce seviye testimizle](/test) seviyeni görebilirsin.`;
    return null;
  },

  language(c) {
    const { agg, t } = c;
    if (!agg.languages.length) return null;
    return `${t.short} programlarının eğitim dili: **${listTr(agg.languages)}**.` + (agg.languages.length === 1 && agg.languages[0] === 'English' ? ' Yani Almanca bilmen gerekmiyor, ancak İngilizce şartını karşılaman gerekiyor.' : '');
  },

  prep(c) {
    const { f, agg, t } = c;
    const bridge = ['Foundation Programs', 'Pathway Programs', 'Pre-Master Programs'].filter(k => agg.byType[k]);
    if (!f.prep_note && !bridge.length) return null;
    const out = [];
    if (f.prep_note) out.push(f.prep_note);
    if (bridge.length) out.push(`Platformda ${t.short} için şu hazırlık yolları listeleniyor: ${bridge.map(k => `${lvl(k)} (${agg.byType[k].length} program)`).join(', ')}.`);
    return out.join('\n\n');
  },

  intakes(c) {
    const { f, agg, t } = c; const out = [];
    if (agg.intakes.length) out.push(`${t.short} programları şu dönemlerde başlıyor: **${listTr(agg.intakes)}**.`);
    if (agg.deadlines.length) out.push(`Listelenen başvuru son tarihleri: ${listTr(agg.deadlines)}.`);
    if (f.deadline_note) out.push(f.deadline_note);
    return out.length ? out.join('\n\n') + '\n\nBurs ve vize süreci için başvuruyu başlangıç tarihinden en az 6 ay önce yapmak güvenli bir plandır.' : null;
  },

  getaccepted(c) {
    const { f, t, agg } = c;
    const tips = [];
    if (agg.english.length || f.english_note) tips.push('İngilizce belgeni erkenden al; puan şartının biraz üzerinde olmak dosyanı güçlendirir.');
    tips.push('Not ortalamanı ve transkriptini eksiksiz, resmî çevirileriyle hazırla.');
    tips.push('Motivasyon yazını okula ve seçtiğin bölüme özel yaz; genel metinler fark yaratmaz.');
    if (f.exam_required && f.exam_required !== 'none') tips.push('Sınav ya da hazırlık gereken bir diploman varsa bunu başvuru öncesinde planla.');
    if (has(f.scholarship_note) || agg.scholarshipPrograms.length) tips.push('Burs notlara göre belirleniyorsa erken başvur; kontenjanlar sınırlı olabiliyor.');
    tips.push('Başvuruyu dönem başlangıcından en az 6 ay önce yap; vize ve konaklama için zaman kalsın.');
    return `${t.short} için kabul şansını artırmak adına:\n\n${bullets(tips)}`;
  },

  tuition(c) {
    const { agg, f, t } = c;
    if (!agg.fee) return f.tuition_note || null;
    const lines = Object.keys(agg.feeByType).filter(k => agg.feeByType[k]).map(k => `${lvl(k)}: ${feeRange(agg.feeByType[k], agg.currency)} / yıl (${agg.byType[k].length} program)`);
    return `${t.short} programlarının yıllık okul ücreti **${t.tuition_range}** arasında değişiyor (ortalama ${t.tuition_avg}).\n\n${bullets(lines)}` +
      (f.tuition_note ? `\n\n${f.tuition_note}` : '') +
      '\n\nÜcretler her yıl değişebilir ve burslarla düşebilir; başvurmadan önce resmî siteden de doğrula.';
  },

  scholarship(c) {
    const { f, agg, t } = c; const out = [];
    if (f.scholarship_note) out.push(f.scholarship_note);
    if (agg.scholarshipPrograms.length) out.push(`${t.short} için ${agg.scholarshipPrograms.length} programda burs imkânı işaretli.${agg.scholarshipAmounts.length ? ' Tutar: ' + agg.scholarshipAmounts.join(', ') + '.' : ''}${agg.scholarshipConditions.length ? ' Koşullar: ' + agg.scholarshipConditions.join('; ') + '.' : ''}`);
    if (!out.length) return null;
    return out.join('\n\n') + '\n\nBurs almak için genel olarak: yüksek not ortalaması, güçlü motivasyon yazısı ve erken başvuru en önemli üç etkendir.';
  },

  housing(c) { return c.f.housing_note || null; },

  living(c) {
    const { f, cf } = c; const out = [];
    if (f.living_note) out.push(f.living_note);
    else if (cf.living) out.push(cf.living);
    if (cf.blocked) out.push(cf.blocked);
    return out.length ? out.join('\n\n') : null;
  },

  parttime(c) { const out = [c.f.work_note, c.cf.work].filter(has); return out.length ? out.join('\n\n') : null; },

  location(c) {
    const { e, t } = c; if (!e.city && !e.country) return null;
    const out = [`${t.short}, **${t.country_tr}** ülkesinin **${t.city}** şehrinde bulunuyor.`];
    if (e.closest_airport_name) {
      const m = e.flight_duration_from_ist_min;
      out.push(`En yakın havalimanı ${e.closest_airport_name}${e.closest_airport_code ? ' (' + e.closest_airport_code + ')' : ''}${m ? `; İstanbul’dan uçuş yaklaşık ${Math.floor(m / 60)} saat ${m % 60} dakika` : ''}.`);
    }
    if (c.f.location_note) out.push(c.f.location_note);
    out.push(`Kampüsü [3D olarak gezebilirsin](/orbit?id=${e.id}).`);
    return out.join('\n\n');
  },

  visa(c) { return has(c.cf.visa) ? c.cf.visa : null; },

  type(c) { const { f, t } = c; return f.type_of_institution ? `${t.short}: **${f.type_of_institution}**.${f.founded_year ? ' Kuruluş yılı: ' + f.founded_year + '.' : ''}` : null; },

  size(c) {
    const { f, t } = c; const out = [];
    if (f.students_total) out.push(`${t.short} yaklaşık **${Number(f.students_total).toLocaleString('tr-TR')}** öğrenciye sahip${f.students_intl_note ? '; ' + f.students_intl_note : ''}.`);
    if (f.campus_note) out.push(f.campus_note);
    return out.length ? out.join('\n\n') : null;
  },

  equivalency(c) {
    const { cf, f } = c; if (!has(cf.denklik) && !has(f.recognition_note)) return null;
    return [cf.denklik, f.recognition_note].filter(has).join('\n\n');
  },

  recognition(c) {
    const { f, cf, e, t } = c; const out = [];
    if (f.accreditation) out.push(`**Akreditasyon ve tanınırlık:** ${f.accreditation}`);
    if (cf.recognition) out.push(cf.recognition);
    const ranks = rankLines(e); if (ranks.length) out.push(`${t.short} uluslararası sıralamalarda yer alıyor: ${ranks.join(', ')}.`);
    return out.length ? out.join('\n\n') : null;
  },

  jobs(c) { const out = [c.f.jobs_note, c.cf.stay && '', ].filter(has); return out.length ? out.join('\n\n') : null; },

  stay(c) { const out = [c.cf.stay].filter(has); return out.length ? out.join('\n\n') : null; },

  alumni(c) { return has(c.f.alumni_note) ? c.f.alumni_note : null; },
  startups(c) { return has(c.f.startup_note) ? c.f.startup_note : null; },

  programs(c) {
    const { agg, t, e } = c; if (!agg.count) return null;
    const lines = Object.keys(agg.byType).sort((a, b) => agg.byType[b].length - agg.byType[a].length).map(k => {
      const names = agg.byType[k].map(p => p.name).slice(0, 8);
      return `**${lvl(k)} (${agg.byType[k].length}):** ${names.join('; ')}${agg.byType[k].length > 8 ? ' ve diğerleri' : ''}`;
    });
    return `${t.short} için PANELEDU’da ${agg.count} program listeleniyor.\n\n${bullets(lines)}\n\nTüm programları, ücretleri ve şartları görmek için ${uniLink(c)}.`;
  },

  masters(c) {
    const { agg, t } = c; const m = agg.byType['Master Programs'];
    if (!m || !m.length) return null;
    return `Evet. ${t.short} için ${m.length} yüksek lisans programı listeleniyor${agg.feeByType['Master Programs'] ? ', yıllık ücret ' + feeRange(agg.feeByType['Master Programs'], agg.currency) : ''}.\n\n${bullets(m.slice(0, 10).map(p => `${p.name}${p.duration ? ' (' + p.duration + ' yıl)' : ''}`))}`;
  },

  ranking(c) {
    const { e, f, t } = c; const ranks = rankLines(e);
    if (!ranks.length && !f.ranking_note) return null;
    return [ranks.length ? `${t.short} için kayıtlı sıralamalar: ${bullets(ranks).replace(/^/, '\n\n')}` : '', f.ranking_note].filter(has).join('\n\n');
  },

  good(c) {
    const { f, e, t, agg } = c; if (f.good_note) return f.good_note;
    const pts = [];
    if (f.accreditation) pts.push(`Akreditasyon: ${f.accreditation}`);
    const ranks = rankLines(e); if (ranks.length) pts.push(`Sıralamalar: ${ranks.join(', ')}`);
    if (f.students_total) pts.push(`Yaklaşık ${Number(f.students_total).toLocaleString('tr-TR')} öğrenci${f.students_intl_note ? ', ' + f.students_intl_note : ''}`);
    if (agg.internship) pts.push(`${agg.internship} programda staj imkânı`);
    return pts.length >= 2 ? `${t.short} hakkında objektif veriler:\n\n${bullets(pts)}\n\nİyi okul, hedefine ve bütçene uyan okuldur; bu yüzden bölümünü, şehrini ve ücreti birlikte değerlendirmeni öneririz.` : null;
  },

  value(c) { return has(c.f.value_note) ? c.f.value_note : null; },

  whichmajor(c) {
    const { agg, t } = c; if (!agg.topFields.length) return null;
    const top = agg.topFields.slice(0, 6).map(k => `${k} (${agg.fields[k]} program)`);
    return `Bölüm seçerken önce kariyer hedefini, sonra ülkedeki iş piyasasını ve bütçeni düşün. ${t.short} en çok şu alanlarda program sunuyor:\n\n${bullets(top)}\n\n[Kısa sihirbazımızla](/match) hedefine, bütçene ve İngilizce seviyene uygun programları sıralayabilirsin.`;
  },

  howapply(c) {
    const { f, t } = c;
    const steps = Array.isArray(f.apply_steps) && f.apply_steps.length ? f.apply_steps : [
      'Bölümünü ve dönemini seç.', 'Gerekli belgeleri hazırla (aşağıdaki liste).', 'Online başvuru formunu doldur ve belgeleri yükle.',
      'Değerlendirme sonucunu bekle; kabul halinde kabul mektubunu al.', 'Depozito veya ilk ödemeyi yap, vize ve konaklama sürecine geç.'];
    return `${t.short} başvurusu adım adım şöyle ilerler:\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}\n\n` +
      `${f.apply_url ? `Resmî başvuru sayfası: [${f.apply_url}](${f.apply_url}). ` : ''}PANELEDU üzerinden de [başvuru talebi bırakabilirsin](/apply).`;
  },

  whatdo(c) {
    const { t, f, agg } = c;
    const todo = ['Programını ve başlangıç dönemini belirle.', 'Bütçeni ve burs ihtimallerini hesapla.'];
    if (agg.english.length || f.english_note) todo.push('İngilizce belgeni al ya da yenile.');
    todo.push('Transkript, diploma ve kimlik belgelerini hazırla; resmî çevirilerini yaptır.', 'Başvuruyu yap, kabulü bekle, vize ve konaklamayı planla.');
    return `${t.short} için başvurmadan önce şu sıralamayı izle:\n\n${todo.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  },

  docs(c) {
    const { f, t } = c;
    const docs = Array.isArray(f.docs) && f.docs.length ? f.docs : ['Pasaport veya kimlik', 'Lise diploması ve transkript (son yıllar)', 'Üniversite transkripti (yüksek lisans için)', 'İngilizce yeterlilik belgesi', 'Motivasyon mektubu', 'Özgeçmiş (CV)', 'Referans mektubu (isteniyorsa)'];
    return `${t.short} başvurusunda genellikle şu belgeler istenir:\n\n${bullets(docs)}\n\nİngilizce ya da Almanca dışındaki belgeler için yeminli çeviri gerekebilir. Güncel liste için resmî siteye bakmanı öneririz.`;
  },
};

function rankLines(e) {
  const r = [];
  if (e.qs_rank) r.push(`QS #${e.qs_rank}${e.qs_rank_year ? ' (' + e.qs_rank_year + ')' : ''}`);
  if (e.the_rank) r.push(`THE #${e.the_rank}${e.the_rank_year ? ' (' + e.the_rank_year + ')' : ''}`);
  if (e.shanghai_rank) r.push(`Shanghai #${e.shanghai_rank}${e.shanghai_rank_year ? ' (' + e.shanghai_rank_year + ')' : ''}`);
  if (e.leiden_rank) r.push(`Leiden #${e.leiden_rank}${e.leiden_rank_year ? ' (' + e.leiden_rank_year + ')' : ''}`);
  return r;
}
// jobs: combine school note + country post-study rules, but never show only a blank
DEFAULTS.jobs = c => {
  const out = [c.f.jobs_note, c.cf.stay].filter(has);
  return out.length ? out.join('\n\n') : null;
};

// ── Build ──────────────────────────────────────────────────────────────────
const plain = md => String(md || '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`>#]/g, '').replace(/^\s*(?:[-]|\d+\.)\s+/gm, '').replace(/\n{2,}/g, '\n').trim();

async function buildGuide(entityId, { preview = false } = {}) {
  const key = entityId + (preview ? ':p' : '');
  const hit = cache.get(key); if (hit && Date.now() - hit.at < 60e3) return hit.guide;
  const profile = await getProfile('entity', entityId);
  if (!preview && profile.status !== 'published') return null;
  const ctx = await loadContext(entityId); if (!ctx) return null;
  const { e, progs } = ctx;
  const countryProfile = e.country ? await getProfile('country', e.country) : { data: {} };
  const facts = profile.data.facts || {}, cf = countryProfile.data.facts || {};
  const agg = aggregate(progs);
  const shortName = facts.short_name || String(e.name).replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();
  const pron = facts.pron || shortName;
  const names = { short: shortName };
  const t = buildTokens(e, agg, facts, cf, names);
  const N = { N: shortName, N_abl: withSuffix(shortName, 'abl', pron), N_dat: withSuffix(shortName, 'dat', pron), N_loc: withSuffix(shortName, 'loc', pron), N_gen: withSuffix(shortName, 'gen', pron) };
  const c = { e, t, agg, f: facts, cf, ...N };
  const answers = profile.data.answers || {}, hidden = new Set(profile.data.hidden || []);
  const unresolved = new Set();
  const sections = [];
  for (const q of QUESTIONS) {
    if (hidden.has(q.id)) continue;
    let md = null, source = 'auto';
    const o = answers[q.id];
    if (has(o)) { const r = fill(o, t); md = r.out; r.miss.forEach(m => unresolved.add(`${q.id}:${m}`)); source = 'override'; }
    else if (DEFAULTS[q.id]) { try { md = DEFAULTS[q.id](c); } catch { md = null; } }
    if (!has(md)) continue;
    sections.push({ id: q.id, group: q.group, intro: !!q.intro, question: q.q(N), answer_md: md, answer_html: renderMarkdown(md).html, answer_text: plain(md), source });
  }
  const slug = profile.slug || slugify(e.name);
  const updated = [agg.updated, profile.updated_at ? new Date(profile.updated_at) : null, e.updated_at ? new Date(e.updated_at) : null].filter(Boolean).reduce((m, d) => d > m ? d : m, new Date(0));
  const intro = sections.find(s => s.intro);
  const guide = {
    entity_id: e.id, slug, status: profile.status, url: `${SITE}/blog/${slug}`, university_url: `${SITE}/university?id=${e.id}`,
    name: e.name, short_name: shortName, city: e.city, country: e.country, country_tr: COUNTRY_TR[e.country] || e.country,
    title: intro ? intro.question : `${N.N_abl} kabul alabilir miyim?`,
    meta_title: `${N.N_abl} Kabul Alabilir miyim? Şartlar, Ücret, Burs`,
    meta_description: `${shortName} kabul şartları, yıllık ücret, burs, yurt, başvuru belgeleri ve vize bilgisi. ${t.tuition_range ? 'Ücret: ' + t.tuition_range + '. ' : ''}Türk ve AB dışı öğrenciler için rehber.`.slice(0, 300),
    updated: updated.getTime() ? updated.toISOString() : null, verified_at: facts.verified_at || null, sources: Array.isArray(facts.sources) ? facts.sources : [],
    groups: GROUPS, sections, data: { tokens: t, programs: progs.length, unresolved: [...unresolved] },
  };
  if (preview) {
    guide.auto = {};
    for (const q of QUESTIONS) { try { const md = DEFAULTS[q.id] && DEFAULTS[q.id](c); if (has(md)) guide.auto[q.id] = md; } catch { /* no default */ } }
    guide.token_names = Object.keys(t).filter(k => t[k] !== '' && t[k] != null);
  }
  cache.set(key, { at: Date.now(), guide });
  return guide;
}

async function entityIdForSlug(slug) {
  await ensureTable();
  const [[r]] = await db.query("SELECT ref FROM guide_profiles WHERE scope = 'entity' AND slug = ? AND status = 'published'", [slug]);
  return r ? parseInt(r.ref) : null;
}
async function listPublished() {
  await ensureTable();
  const [rows] = await db.query("SELECT ref, slug, data, updated_at FROM guide_profiles WHERE scope = 'entity' AND status = 'published'");
  const out = [];
  for (const r of rows) {
    const g = await buildGuide(parseInt(r.ref)); if (!g) continue;
    const intro = g.sections.length;
    out.push({ slug: g.slug, title: g.short_name, summary: `${g.title} Şartlar, ücret, burs ve başvuru rehberi.`, category: 'Üniversite Rehberi', country: g.country_tr,
      tags: [g.country_tr, g.city].filter(Boolean), date: String(g.updated || r.updated_at || '').slice(0, 10) || '2026-10-16', readingTime: Math.max(3, Math.round(intro * 0.6)), entity_id: g.entity_id, guide: true });
  }
  return out;
}

// ── Rendering ──────────────────────────────────────────────────────────────
const jsonLd = g => [
  { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: g.sections.map(s => ({ '@type': 'Question', name: s.question, acceptedAnswer: { '@type': 'Answer', text: s.answer_text } })) },
];

function renderSectionsHtml(g) {
  return g.groups.map(gr => {
    const items = g.sections.filter(s => s.group === gr.id && !s.intro);
    if (!items.length) return '';
    return `<div class="guide-group" id="g-${gr.id}"><p class="guide-group-t">${esc(gr.title)}</p>${items.map(s => `<section class="guide-q" id="${s.id}"><h2>${esc(s.question)}</h2><div class="prose">${s.answer_html}</div></section>`).join('')}</div>`;
  }).join('');
}

function renderGuidePage(g) {
  const intro = g.sections.find(s => s.intro);
  const url = g.url;
  const toc = g.sections.filter(s => !s.intro).map(s => ({ id: s.id, text: s.question }));
  const ld = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.meta_description, inLanguage: 'tr', mainEntityOfPage: url, url,
      datePublished: (g.updated || '').slice(0, 10), dateModified: (g.updated || '').slice(0, 10), author: { '@type': 'Organization', name: 'PANELEDU' },
      publisher: { '@type': 'Organization', name: 'PANELEDU', logo: { '@type': 'ImageObject', url: SITE + '/img/mark.svg' } }, about: { '@type': 'CollegeOrUniversity', name: g.name, url: g.university_url } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + '/blog' },
      { '@type': 'ListItem', position: 3, name: g.country_tr, item: `${SITE}/blog?country=${encodeURIComponent(g.country_tr)}` }, { '@type': 'ListItem', position: 4, name: g.short_name, item: url }] },
    ...jsonLd(g),
  ];
  const head = blog.head({ title: `${g.meta_title} | PANELEDU`, description: g.meta_description, url, type: 'article',
    extra: '<link href="/css/guide.css?v=20261016" rel="stylesheet">' + ld.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('') });
  const upd = g.updated ? blog.fmtDate(g.updated) : '';
  const html = head + `
<body class="pe-theme"><main id="main">
<article class="post">
  <header class="post-head"><div class="pe-wrap">
    <nav class="crumbs" aria-label="Sayfa yolu"><a href="/">Ana Sayfa</a> / <a href="/blog">Blog</a> / <a href="/blog?country=${encodeURIComponent(g.country_tr)}">${esc(g.country_tr)}</a> / <span>${esc(g.short_name)}</span></nav>
    <p class="guide-uni"><span class="post-cat">${esc(g.country_tr)}</span> <span class="guide-uni-n">${esc(g.name)}</span></p>
    <h1>${esc(g.title)}</h1>
    <div class="byline"><span>PANELEDU Editör</span>${upd ? `<span>Güncelleme: ${upd}</span>` : ''}${g.verified_at ? `<span>Resmî kaynakla doğrulama: ${blog.fmtDate(g.verified_at)}</span>` : ''}</div>
  </div></header>
  <div class="pe-wrap post-layout">
    <div class="post-main">
      ${intro ? `<div class="prose guide-lead">${intro.answer_html}</div>` : ''}
      ${toc.length > 2 ? `<details class="toc-m"><summary>İçindekiler</summary><ol>${toc.map(t => `<li class="l2"><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></details>` : ''}
      ${renderSectionsHtml(g)}
      ${g.sources.length ? `<section class="guide-src"><h2>Kaynaklar</h2><ul>${g.sources.map(s => `<li><a href="${esc(s)}" rel="noopener nofollow" target="_blank">${esc(s.replace(/^https?:\/\//, ''))}</a></li>`).join('')}</ul></section>` : ''}
      <div class="blog-cta"><div><h2>${esc(g.short_name)} için başvuru talebi bırak</h2><p>Programları, ücretleri ve şartları gör; danışmanımız dosyanı birlikte hazırlasın.</p></div><a class="btn-grad" href="/university?id=${g.entity_id}">Programlara Bak</a></div>
    </div>
    ${toc.length > 2 ? `<aside class="toc-d" aria-label="İçindekiler"><strong>İçindekiler</strong><ol>${toc.map(t => `<li class="l2"><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></aside>` : ''}
  </div>
</article>
</main></body></html>`;
  return require('./chrome').injectChrome(html);
}

// Compact accordion for the university page
function renderUniversitySection(g) {
  const items = g.sections.slice(0, 40);
  return `<section class="pe-section-tight" id="rehber" aria-labelledby="rehber-h"><div class="pe-wrap guide-uni-sec">
  <h2 id="rehber-h" class="guide-uni-h">${esc(g.short_name)} hakkında sık sorulan sorular</h2>
  <p class="guide-uni-sub">Bu bilgiler veritabanındaki güncel program verilerinden oluşturulur. <a href="/blog/${esc(g.slug)}">Tam rehberi oku</a></p>
  ${items.map((s, i) => `<details class="guide-acc"${i === 0 ? ' open' : ''}><summary>${esc(s.question)}</summary><div class="prose">${s.answer_html}</div></details>`).join('')}
</div><script type="application/ld+json">${JSON.stringify(jsonLd(g)[0])}</script></section>`;
}

module.exports = { buildGuide, entityIdForSlug, listPublished, getProfile, saveProfile, clearCache, renderGuidePage, renderUniversitySection,
  slugify, suffix, withSuffix, QUESTIONS, GROUPS, ENTITY_FACTS, COUNTRY_FACTS, COUNTRY_TR, DEFAULTS };
