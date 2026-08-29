/*
 * Shared eligibility matching engine.
 * Pure, dependency-free. Used by the public programs page (and can be reused
 * by the admin preview). Exposes window.Eligibility.
 *
 * Requirements are stored per program in `requirements_json` with this schema:
 * {
 *   "education_level": "none|highschool|bachelor|master|phd",
 *   "gpa":            { "min": 3.0, "scale": "4.0" },          // scale: 4.0|4.3|5.0|10.0|20|100
 *   "qualifications": [ {"type":"IB","min":"32"}, {"type":"A-Level","min":"BBB"} ],  // OR
 *   "english":        [ {"test":"IELTS","min":6.5}, {"test":"TOEFL","min":90} ],     // OR
 *   "standardized":   [ {"test":"GRE","min":310} ]                                   // OR
 * }
 *
 * Student profile passed to matchProgram:
 * {
 *   level:        "none|highschool|bachelor|master|phd",
 *   gpa:          "3.2", gpaScale: "4.0",
 *   qualType:     "IB", qualValue: "34",
 *   english:      [ {test:"TOEFL", score:"95"} ],
 *   standardized: [ {test:"GRE", score:"315"} ],
 *   budget:       15000
 * }
 */
(function (global) {
  'use strict';

  // ── GPA scale normalization → 0..100 ──────────────────────────────────────
  var GPA_MAX = { '4.0': 4, '4.3': 4.3, '5.0': 5, '10.0': 10, '20': 20, '100': 100 };
  function normalizeGpa(value, scale) {
    var v = parseFloat(value);
    if (isNaN(v)) return null;
    var max = GPA_MAX[String(scale)] || 100;
    return (v / max) * 100;
  }

  // ── A-Level grades → points (A*=6 … E=1), compare best 3 ───────────────────
  var ALEVEL_PTS = { 'A*': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1 };
  function alevelPoints(str) {
    if (!str) return 0;
    var grades = String(str).toUpperCase().match(/A\*|[A-E]/g) || [];
    return grades.map(function (g) { return ALEVEL_PTS[g] || 0; })
      .sort(function (a, b) { return b - a; })
      .slice(0, 3)
      .reduce(function (s, x) { return s + x; }, 0);
  }

  function isAlevel(type) {
    var t = String(type || '').toLowerCase();
    return t.indexOf('a-level') > -1 || t.indexOf('a level') > -1 || t.indexOf('alevel') > -1;
  }

  // Does a student's qualification value meet the program's min for that type?
  function qualMeets(type, studentVal, reqMin) {
    if (!reqMin) return true;                 // type accepted, no minimum specified
    if (isAlevel(type)) return alevelPoints(studentVal) >= alevelPoints(reqMin);
    var sv = parseFloat(String(studentVal).replace(/[^\d.]/g, ''));
    var rv = parseFloat(String(reqMin).replace(/[^\d.]/g, ''));
    if (isNaN(sv) || isNaN(rv)) return true;  // non-numeric → don't block
    return sv >= rv;
  }

  // ── Education level ordering ───────────────────────────────────────────────
  var LEVEL_ORDER = { none: 0, highschool: 1, bachelor: 2, master: 3, phd: 4 };
  function levelMeets(studentLevel, requiredLevel) {
    if (!requiredLevel || requiredLevel === 'none') return true;
    var s = LEVEL_ORDER[studentLevel] != null ? LEVEL_ORDER[studentLevel] : 0;
    var r = LEVEL_ORDER[requiredLevel] != null ? LEVEL_ORDER[requiredLevel] : 0;
    return s >= r;
  }

  function num(x) { var n = parseFloat(x); return isNaN(n) ? null : n; }

  // ── Main matcher ───────────────────────────────────────────────────────────
  // Returns { eligible, anyCriteria, results:[{key,label,pass,detail}] }
  function matchProgram(student, reqs) {
    reqs = reqs || {};
    student = student || {};
    var results = [];
    var eligible = true;
    var anyCriteria = false;

    function add(key, label, pass, detail) {
      anyCriteria = true;
      results.push({ key: key, label: label, pass: pass, detail: detail || '' });
      if (!pass) eligible = false;
    }

    // Education level
    if (reqs.education_level && reqs.education_level !== 'none') {
      var lvlPass = student.level ? levelMeets(student.level, reqs.education_level) : false;
      add('level', 'Education level', lvlPass,
        lvlPass ? '' : 'Requires completed ' + reqs.education_level);
    }

    // GPA
    if (reqs.gpa && reqs.gpa.min != null && reqs.gpa.min !== '') {
      var label = 'GPA ' + reqs.gpa.min + '/' + (reqs.gpa.scale || '100');
      if (student.gpa != null && student.gpa !== '') {
        var sN = normalizeGpa(student.gpa, student.gpaScale || '100');
        var rN = normalizeGpa(reqs.gpa.min, reqs.gpa.scale || '100');
        var gpaPass = (sN != null && rN != null) ? sN >= rN : true;
        add('gpa', label, gpaPass, gpaPass ? '' : 'Below minimum');
      } else {
        add('gpa', label, false, 'Enter your GPA');
      }
    }

    // Qualifications (OR across accepted types)
    if (Array.isArray(reqs.qualifications) && reqs.qualifications.length) {
      var qPass = false;
      if (student.qualType) {
        for (var i = 0; i < reqs.qualifications.length; i++) {
          var q = reqs.qualifications[i];
          if (String(q.type || '').toLowerCase() === String(student.qualType).toLowerCase()
              && qualMeets(q.type, student.qualValue, q.min)) { qPass = true; break; }
        }
      }
      var accepted = reqs.qualifications.map(function (q) {
        return q.min ? (q.type + ' ' + q.min) : q.type;
      }).join(' or ');
      add('qual', 'Qualification', qPass, qPass ? '' : 'Accepts: ' + accepted);
    }

    // English (OR across accepted tests)
    if (Array.isArray(reqs.english) && reqs.english.length) {
      var ePass = false;
      var myEng = student.english || [];
      for (var j = 0; j < reqs.english.length; j++) {
        var er = reqs.english[j];
        var mine = myEng.find(function (t) {
          return String(t.test || '').toLowerCase() === String(er.test || '').toLowerCase();
        });
        if (mine && num(mine.score) != null && num(er.min) != null && num(mine.score) >= num(er.min)) {
          ePass = true; break;
        }
      }
      var engAccepted = reqs.english.map(function (e) { return e.test + ' ' + e.min; }).join(' or ');
      add('english', 'English', ePass, ePass ? '' : 'Accepts: ' + engAccepted);
    }

    // Standardized tests (OR)
    if (Array.isArray(reqs.standardized) && reqs.standardized.length) {
      var sPass = false;
      var myStd = student.standardized || [];
      for (var k = 0; k < reqs.standardized.length; k++) {
        var sr = reqs.standardized[k];
        var mineS = myStd.find(function (t) {
          return String(t.test || '').toLowerCase() === String(sr.test || '').toLowerCase();
        });
        if (mineS && num(mineS.score) != null && num(sr.min) != null && num(mineS.score) >= num(sr.min)) {
          sPass = true; break;
        }
      }
      var stdAccepted = reqs.standardized.map(function (s) { return s.test + ' ' + s.min; }).join(' or ');
      add('standardized', 'Standardized test', sPass, sPass ? '' : 'Needs: ' + stdAccepted);
    }

    return { eligible: eligible, anyCriteria: anyCriteria, results: results };
  }

  // Safely parse a requirements_json value (object, JSON string, or null)
  function parseReqs(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  global.Eligibility = {
    matchProgram: matchProgram,
    parseReqs: parseReqs,
    normalizeGpa: normalizeGpa,
    alevelPoints: alevelPoints,
    qualMeets: qualMeets,
    levelMeets: levelMeets
  };
})(typeof window !== 'undefined' ? window : this);
