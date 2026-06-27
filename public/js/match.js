/*
 * Eligibility funnel engine (Epic 1).
 * Pure, dependency-free. Exposes window.Match.
 * Classifies programs by field, maps countries to regions, estimates English
 * band, normalizes budget, and ranks SCHOOLS by "easiest acceptance + fit".
 */
(function (global) {
  'use strict';

  // ── Field / discipline classification ──────────────────────────────────────
  var FIELD_KEYWORDS = {
    'Business & Economics': ['business','manage','economic','econom','finance','financ','accounting','account','marketing','market','mba','commerce','entrepreneur','administration','trade','banking','bank','logistics','supply chain','tourism','hospitality','real estate','human resource','advertis','retail','insurance','actuari'],
    'Engineering': ['engineer','mechanical','civil','electrical','electronic','mechatronic','aerospace','aeronautic','industrial','chemical','automotive','materials','manufacturing','energy','architect','construction','petroleum','mining','aviation','telecommunication'],
    'Medicine & Health': ['medicine','medical','nursing','nurse','dentistry','dental','pharmac','health','physiotherap','biomedical','veterinary','nutrition','dietet','midwifery','public health','therapy','therap','clinical','psychiatry','optometry','radiolog','anatomy','sport science','kinesiolog'],
    'AI & Technology': ['computer','comput','software','data','artificial intelligence',' ai ','ai ',' ai','information technology','information system','informat','computing','programming','robotic','cyber','machine learning','game','web develop','network','digital','blockchain','cloud'],
    'Social Sciences': ['history','sociolog','psycholog','political','philosoph','law','legal','international relations','communication','anthropolog','social','journalism','media','linguistic','language','literature','education','teaching','geography','archaeolog','criminolog','public policy','theolog','translation','culture','cultural']
  };
  var FIELD_LIST = Object.keys(FIELD_KEYWORDS);

  function classifyField(name) {
    if (!name) return null;
    var n = (' ' + String(name).toLowerCase() + ' ');
    for (var i = 0; i < FIELD_LIST.length; i++) {
      var kws = FIELD_KEYWORDS[FIELD_LIST[i]];
      for (var j = 0; j < kws.length; j++) {
        if (n.indexOf(kws[j]) > -1) return FIELD_LIST[i];
      }
    }
    return null;
  }

  // Explicit tag wins; else infer from the program name.
  function programField(p) {
    if (p && p.field && p.field !== 'Other') return p.field;
    if (p && p.field === 'Other') return 'Other';
    return classifyField(p && p.name);
  }

  // ── Country → region ───────────────────────────────────────────────────────
  var REGION = {
    'Europe': ['germany','france','netherlands','spain','italy','belgium','austria','switzerland','sweden','denmark','finland','norway','ireland','poland','portugal','czech republic','czechia','hungary','greece','romania','bulgaria','croatia','slovakia','slovenia','estonia','latvia','lithuania','luxembourg','malta','cyprus','iceland'],
    'USA/Canada': ['united states','usa','u.s.a.','us','america','canada'],
    'Australia': ['australia','new zealand'],
    'UK': ['united kingdom','uk','england','scotland','wales','northern ireland','britain','great britain']
  };
  var REGION_LIST = Object.keys(REGION);

  function regionOf(country) {
    if (!country) return null;
    var c = String(country).toLowerCase().trim();
    for (var i = 0; i < REGION_LIST.length; i++) {
      if (REGION[REGION_LIST[i]].indexOf(c) > -1) return REGION_LIST[i];
    }
    return null;
  }

  // ── English bands ──────────────────────────────────────────────────────────
  // Convert a test+score to an approximate IELTS-equivalent (rough, for banding).
  function toIelts(test, score) {
    var s = parseFloat(score);
    if (isNaN(s)) return null;
    switch (String(test || '').toLowerCase()) {
      case 'ielts': return s;
      case 'toefl': return s < 60 ? 4.5 : s < 79 ? 5.5 : s < 94 ? 6.5 : s < 102 ? 7 : 7.5;
      case 'duolingo': return s < 85 ? 5 : s < 100 ? 6 : s < 115 ? 6.5 : s < 125 ? 7 : 7.5;
      case 'pte': return s < 50 ? 5 : s < 59 ? 6 : s < 65 ? 6.5 : s < 73 ? 7 : 7.5;
      case 'cambridge': return 7;
      default: return null;
    }
  }

  function bandOf(ielts) {
    if (ielts == null) return 'none';
    if (ielts <= 5.0) return 'low';
    if (ielts <= 6.5) return 'medium';
    return 'high';
  }
  var BAND_RANK = { none: 0, low: 1, medium: 2, high: 3 };

  // Program's English band = the EASIEST accepted requirement (OR logic).
  function programEnglishBand(p) {
    var reqs = (window.Eligibility && window.Eligibility.parseReqs)
      ? window.Eligibility.parseReqs(p.requirements_json) : null;
    var ieltsEquivs = [];
    if (reqs && Array.isArray(reqs.english) && reqs.english.length) {
      reqs.english.forEach(function (e) { var v = toIelts(e.test, e.min); if (v != null) ieltsEquivs.push(v); });
    } else if (p.english_req_type && p.english_req_type !== 'None') {
      var v = toIelts(p.english_req_type, p.english_req_score);
      if (v != null) ieltsEquivs.push(v);
    }
    if (!ieltsEquivs.length) return 'none';
    return bandOf(Math.min.apply(null, ieltsEquivs)); // easiest accepted
  }

  var STUDENT_BAND = { 'A1-A2': 'low', 'B1-B2': 'medium', 'C1-C2': 'high' };
  function studentBand(level) { return STUDENT_BAND[level] || 'high'; }

  // ── Budget ─────────────────────────────────────────────────────────────────
  var FX = { EUR: 1, USD: 0.92, GBP: 1.17, AUD: 0.61, CAD: 0.68 };
  function tuitionEur(p) {
    if (p.tuition_fee == null || p.tuition_fee === '') return null;
    var fee = parseFloat(p.tuition_fee);
    if (isNaN(fee)) return null;
    return fee * (FX[(p.tuition_currency || 'EUR').toUpperCase()] || 1);
  }
  var BUDGET_MAX = { '0-5k': 5000, '5-10k': 10000, '10-15k': 15000, '15k+': Infinity };

  // ── Score a single program against the student profile ─────────────────────
  // Returns { pass, ease, fee } — ease higher = easier to get in + better fit.
  function scoreProgram(student, p) {
    // Hard filter: field
    if (student.fields && student.fields.length) {
      var f = programField(p);
      if (!f || student.fields.indexOf(f) === -1) return { pass: false };
    }
    // Hard filter: region
    if (student.region) {
      if (regionOf(p.country) !== student.region) return { pass: false };
    }
    // Hard filter: budget (unknown fee passes, flagged later)
    var fee = tuitionEur(p);
    var max = BUDGET_MAX[student.budget];
    if (max != null && fee != null && fee > max) return { pass: false };

    var ease = 0;
    // English fit
    var sb = BAND_RANK[studentBand(student.englishLevel)];
    var pb = BAND_RANK[programEnglishBand(p)];
    ease += sb >= pb ? 40 : (sb === pb - 1 ? 15 : 0);
    // Ranking ease (lower-ranked / unranked = easier admission)
    var rank = parseInt(p.qs_rank) || parseInt(p.the_rank) || null;
    ease += !rank ? 30 : rank > 300 ? 28 : rank > 100 ? 20 : 10;
    // Budget comfort (cheaper within range = more comfortable)
    if (fee != null && max != null && max !== Infinity) ease += Math.max(0, 15 * (1 - fee / max));
    else if (fee != null) ease += 8;
    // AP/IB helps admission
    if (student.apib) ease += 10;

    return { pass: true, ease: ease, fee: fee };
  }

  // ── Rank schools ───────────────────────────────────────────────────────────
  // programs: array from /api/public/programs. Returns sorted school objects.
  function rankSchools(student, programs) {
    var byUni = {};
    (programs || []).forEach(function (p) {
      var r = scoreProgram(student, p);
      if (!r.pass) return;
      var id = p.university_id;
      if (!byUni[id]) {
        byUni[id] = {
          university_id: id,
          university_name: p.university_name,
          city: p.city, country: p.country,
          region: regionOf(p.country),
          qs_rank: p.qs_rank, the_rank: p.the_rank,
          ease: 0, programs: [], fields: {}
        };
      }
      var u = byUni[id];
      u.programs.push({ id: p.id, name: p.name, type_name: p.type_name, field: programField(p), fee: r.fee, ease: r.ease, currency: p.tuition_currency });
      var ff = programField(p); if (ff) u.fields[ff] = true;
      if (r.ease > u.ease) u.ease = r.ease; // school score = best matching program
    });

    var schools = Object.keys(byUni).map(function (k) {
      var u = byUni[k];
      u.fieldList = Object.keys(u.fields);
      u.programs.sort(function (a, b) { return b.ease - a.ease; });
      return u;
    });
    // Primary: easiest acceptance first. Tiebreak: better-ranked school first.
    schools.sort(function (a, b) {
      if (b.ease !== a.ease) return b.ease - a.ease;
      var ra = parseInt(a.qs_rank) || 9999, rb = parseInt(b.qs_rank) || 9999;
      return ra - rb;
    });
    return schools;
  }

  global.Match = {
    FIELD_LIST: FIELD_LIST,
    REGION_LIST: REGION_LIST,
    classifyField: classifyField,
    programField: programField,
    regionOf: regionOf,
    programEnglishBand: programEnglishBand,
    studentBand: studentBand,
    tuitionEur: tuitionEur,
    scoreProgram: scoreProgram,
    rankSchools: rankSchools
  };
})(typeof window !== 'undefined' ? window : this);
