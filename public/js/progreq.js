/* Program kartlarında "Kabul şartları" açılır bölümü.
 * Veri: programs.description_en içindeki "Admission (non-EU / Turkish applicants): ..." ve
 * "Maths/IB/AP requirements (international applicants): ..." bölümleri. */
(function () {
  var MARK = 'Maths/IB/AP requirements (international applicants):';
  var ADM = 'Admission (non-EU / Turkish applicants):';
  var VER = 'Official entry requirements (verified on school website):';
  var LABELS = { 'English': 'İngilizce', 'Academic': 'Akademik şart', 'Application fee': 'Başvuru ücreti', 'Turkey': 'Türkiye başvuruları', 'Programme note': 'Program notu', 'Source': 'Resmi kaynak', 'Admission': 'Kabul', 'IB': 'IB', 'AP': 'AP', 'A-level': 'A-Level', 'Maths test': 'Matematik testi',
    'Maths prerequisite': 'Matematik ön koşulu', 'Turkish Lise diploma': 'Türk Lise diploması', 'Note': 'Not', 'Typical offer': 'Tipik giriş şartı', 'Tests': 'Sınavlar' };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function split(block) {
    var re = /(?:^|\s)(Admission|Typical offer|IB|AP|A-level|Tests|Maths test|Maths prerequisite|Turkish Lise diploma|Note):\s/g, m, hits = [];
    while ((m = re.exec(block))) hits.push({ label: m[1], at: m.index + m[0].length, start: m.index });
    return hits.map(function (h, i) { return { label: h.label, text: block.slice(h.at, i + 1 < hits.length ? hits[i + 1].start : block.length).trim() }; });
  }
  function rows(desc) {
    desc = desc || '';
    var ver = [], vi = desc.indexOf(VER);
    if (vi >= 0) {
      var vb = desc.slice(vi + VER.length); desc = desc.slice(0, vi);
      var vre = /(?:^|\s)(English|Academic|Application fee|Turkey|Programme note|Source):\s/g, vm, vh = [];
      while ((vm = vre.exec(vb))) vh.push({ label: vm[1], at: vm.index + vm[0].length, start: vm.index });
      ver = vh.map(function (h, i) { return { label: h.label, text: vb.slice(h.at, i + 1 < vh.length ? vh[i + 1].start : vb.length).trim() }; });
    }
    var out = [], i = desc.indexOf(MARK), pre = i >= 0 ? desc.slice(0, i) : desc;
    var a = pre.indexOf(ADM);
    if (a >= 0) {
      var t = pre.slice(a + ADM.length), cut = t.search(/\s(Tuition per year:|Campus:)/);
      t = (cut >= 0 ? t.slice(0, cut) : t).trim();
      if (t) out.push({ label: 'Admission', text: t });
    }
    if (i >= 0) out = out.concat(split(desc.slice(i + MARK.length)));
    return out.concat(ver).filter(function (r) { return r.text; });
  }
  function html(p) {
    var r = rows(p && p.description_en);
    if (!r.length) return '';
    return '<details class="prog-reqs"><summary>' + (window._t ? window._t('p.reqs.title', 'Kabul şartları (IB / AP / matematik)') : 'Kabul şartları (IB / AP / matematik)') + '</summary><dl>' +
      r.map(function (x) { return '<dt>' + esc(LABELS[x.label] || x.label) + '</dt><dd>' + esc(x.text) + '</dd>'; }).join('') + '</dl></details>';
  }
  var st = document.createElement('style');
  st.textContent = '.prog-reqs{margin-top:10px;font-size:.84rem}.prog-reqs summary{cursor:pointer;font-weight:700;color:var(--text)}' +
    '.prog-reqs dl{margin:8px 0 0;display:grid;gap:6px}.prog-reqs dt{font-weight:700;font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}' +
    '.prog-reqs dd{margin:0 0 4px;line-height:1.5;overflow-wrap:anywhere}';
  document.head.appendChild(st);
  window.ProgReq = { html: html, rows: rows };
})();
