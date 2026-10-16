/* Admin: University guides (SEO Q&A pages). Spec-driven: fields come from /api/admin/guide/spec. */
(function () {
  var spec = null, list = [], cur = null, curCountry = null, tab = 'facts';
  var $ = function (id) { return document.getElementById(id); };
  var E = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  async function jget(url) { var r = await api('GET', url); if (!r.ok) throw new Error((await r.json().catch(function () { return {}; })).error || r.status); return r.json(); }

  window.loadGuides = async function () {
    var wrap = $('guidesBody'); wrap.innerHTML = '<div class="text-center text-muted py-5">Yükleniyor…</div>';
    try {
      if (!spec) spec = await jget('/api/admin/guide/spec');
      list = await jget('/api/admin/guide/list');
      renderList();
    } catch (e) { wrap.innerHTML = '<div class="alert alert-danger">' + E(e.message) + '</div>'; }
  };

  function renderList() {
    var countries = Array.from(new Set(list.map(function (r) { return r.country; }).filter(Boolean))).sort();
    var fc = ($('guideCountry') || {}).value || '', q = (($('guideQ') || {}).value || '').toLowerCase();
    var rows = list.filter(function (r) { return (!fc || r.country === fc) && (!q || r.name.toLowerCase().indexOf(q) > -1); });
    var pub = list.filter(function (r) { return r.status === 'published'; }).length;
    $('guidesBody').innerHTML =
      '<div class="d-flex flex-wrap gap-2 align-items-center mb-3">' +
      '<select id="guideCountry" class="form-select form-select-sm" style="max-width:220px" onchange="guideFilter()" aria-label="Ülke"><option value="">Tüm ülkeler</option>' +
      countries.map(function (c) { return '<option' + (c === fc ? ' selected' : '') + '>' + E(c) + '</option>'; }).join('') + '</select>' +
      '<input id="guideQ" class="form-control form-control-sm" style="max-width:260px" placeholder="Okul ara" value="' + E(q) + '" oninput="guideFilter()" aria-label="Okul ara">' +
      '<span class="text-muted small ms-auto">' + pub + ' yayında / ' + list.length + ' okul</span>' +
      (fc ? '<button class="btn btn-outline-primary btn-sm" onclick="guideCountryEdit(\'' + E(fc) + '\')"><i class="bi bi-globe-europe-africa me-1"></i>' + E(fc) + ' ülke bilgileri</button>' : '') + '</div>' +
      '<div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Okul</th><th>Ülke</th><th class="text-end">Program</th><th>Rehber</th><th></th></tr></thead><tbody>' +
      rows.map(function (r) {
        var b = r.status === 'published' ? '<span class="badge text-bg-success">Yayında</span>' : r.status === 'draft' ? '<span class="badge text-bg-warning">Taslak</span>' : '<span class="badge text-bg-light border">Yok</span>';
        return '<tr><td>' + E(r.name) + '</td><td>' + E(r.country || '') + '</td><td class="text-end">' + r.programs + '</td><td>' + b + '</td><td class="text-end">' +
          '<button class="btn btn-sm btn-outline-primary" onclick="guideEdit(' + r.id + ')">Düzenle</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  window.guideFilter = function () { var a = $('guideCountry').value, b = $('guideQ').value; renderList(); $('guideCountry').value = a; var q = $('guideQ'); q.value = b; q.focus(); q.setSelectionRange(b.length, b.length); };

  function factField(f, val, idp) {
    var id = idp + f.key, v = val == null ? '' : val, hint = f.hint ? '<div class="form-text">' + E(f.hint) + '</div>' : '';
    var lab = '<label class="form-label small fw-semibold" for="' + id + '">' + E(f.label) + '</label>';
    if (f.type === 'textarea') return '<div class="mb-3">' + lab + '<textarea class="form-control form-control-sm" rows="3" id="' + id + '">' + E(v) + '</textarea>' + hint + '</div>';
    if (f.type === 'list') return '<div class="mb-3">' + lab + '<textarea class="form-control form-control-sm" rows="4" id="' + id + '">' + E(Array.isArray(v) ? v.join('\n') : v) + '</textarea>' + hint + '</div>';
    if (f.type === 'select') return '<div class="mb-3">' + lab + '<select class="form-select form-select-sm" id="' + id + '">' + f.options.map(function (o) { return '<option value="' + o + '"' + (o === v ? ' selected' : '') + '>' + (o || '(belirtilmedi)') + '</option>'; }).join('') + '</select>' + hint + '</div>';
    return '<div class="mb-3">' + lab + '<input class="form-control form-control-sm" id="' + id + '" type="' + (f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text') + '" value="' + E(v) + '">' + hint + '</div>';
  }
  function readFacts(fields, idp) {
    var out = {};
    fields.forEach(function (f) {
      var el = $(idp + f.key); if (!el) return; var v = el.value.trim();
      if (f.type === 'list') { var a = v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); if (a.length) out[f.key] = a; }
      else if (f.type === 'number') { if (v !== '') out[f.key] = Number(v); }
      else if (v !== '') out[f.key] = v;
    });
    return out;
  }

  window.guideEdit = async function (id) {
    $('guidesBody').innerHTML = '<div class="text-center text-muted py-5">Yükleniyor…</div>';
    try { cur = await jget('/api/admin/guide/entity/' + id); cur.id = id; tab = 'facts'; renderEditor(); }
    catch (e) { toast(e.message, 'error'); renderList(); }
  };

  function collect() {
    if (!cur) return;
    var data = cur.profile.data || {};
    if ($('gf_short_name') || $('gf_pron')) data.facts = readFacts(spec.entity_facts, 'gf_');
    if (document.querySelector('[data-gans]')) {
      data.answers = {}; data.hidden = [];
      document.querySelectorAll('[data-gans]').forEach(function (t) { var v = t.value.trim(); if (v) data.answers[t.getAttribute('data-gans')] = v; });
      document.querySelectorAll('[data-ghide]').forEach(function (c) { if (c.checked) data.hidden.push(c.getAttribute('data-ghide')); });
    }
    cur.profile.data = data;
    if ($('gStatus')) { cur.profile.status = $('gStatus').value; cur.profile.slug = $('gSlug').value.trim(); }
  }

  function renderEditor() {
    var g = cur.guide, p = cur.profile, data = p.data || {}, facts = data.facts || {};
    var tabs = [['facts', 'Bilgiler'], ['answers', 'Cevaplar'], ['preview', 'Önizleme']];
    var h = '<div class="d-flex flex-wrap gap-2 align-items-center mb-3">' +
      '<button class="btn btn-outline-secondary btn-sm" onclick="guideBack()"><i class="bi bi-arrow-left"></i> Liste</button>' +
      '<h5 class="mb-0 fw-bold">' + E(g.name) + '</h5><span class="text-muted small">' + E(g.country || '') + '</span>' +
      '<div class="ms-auto d-flex gap-2 align-items-center">' +
      '<select id="gStatus" class="form-select form-select-sm" style="width:auto" aria-label="Durum"><option value="draft"' + (p.status !== 'published' ? ' selected' : '') + '>Taslak</option><option value="published"' + (p.status === 'published' ? ' selected' : '') + '>Yayında</option></select>' +
      '<button class="btn btn-primary btn-sm" onclick="guideSave()"><i class="bi bi-check2"></i> Kaydet</button></div></div>' +
      '<div class="row g-2 mb-3"><div class="col-md-6"><label class="form-label small fw-semibold" for="gSlug">Bağlantı adresi</label><div class="input-group input-group-sm"><span class="input-group-text">/blog/</span><input id="gSlug" class="form-control" value="' + E(p.slug || g.slug) + '"></div></div>' +
      '<div class="col-md-6 small text-muted align-self-end">' + (p.status === 'published' ? '<a href="/blog/' + E(p.slug || g.slug) + '" target="_blank" rel="noopener">Yayındaki sayfa</a> · <a href="/university?id=' + g.entity_id + '#rehber" target="_blank" rel="noopener">Üniversite sayfası</a> · <a href="/api/public/universities/' + g.entity_id + '/guide" target="_blank" rel="noopener">JSON</a>' : 'Yayına almak için durumu "Yayında" yap ve kaydet.') + '</div></div>' +
      '<ul class="nav nav-tabs mb-3">' + tabs.map(function (t) { return '<li class="nav-item"><button class="nav-link' + (tab === t[0] ? ' active' : '') + '" onclick="guideTab(\'' + t[0] + '\')">' + t[1] + '</button></li>'; }).join('') + '</ul>';
    if (g.data.unresolved.length) h += '<div class="alert alert-warning py-2 small">Boş kalan alanlar: ' + g.data.unresolved.map(E).join(', ') + '</div>';
    if (tab === 'facts') {
      h += '<p class="text-muted small">Ücret, program sayısı, İngilizce puanı, dönemler ve burslar programlardan otomatik gelir. Burada sadece veritabanında olmayan bilgileri doldur; boş bırakılan sorular sayfada görünmez.</p><div class="row"><div class="col-lg-8">' +
        spec.entity_facts.map(function (f) { return factField(f, facts[f.key], 'gf_'); }).join('') + '</div></div>';
    } else if (tab === 'answers') {
      var groupOf = {}; spec.groups.forEach(function (x) { groupOf[x.id] = x.title; });
      h += '<p class="text-muted small">Her sorunun otomatik cevabı gri kutuda görünür. Kendi cevabını yazarsan onun yerine kullanılır. <code>{{tuition_range}}</code> gibi alanlar canlı değerlerle dolar. Kullanılabilir: ' +
        (g.token_names || []).map(function (n) { return '<code>{{' + E(n) + '}}</code>'; }).join(' ') + '</p>';
      spec.questions.forEach(function (q) {
        var sec = g.sections.filter(function (s) { return s.id === q.id; })[0];
        var qText = sec ? sec.question : q.id, auto = (g.auto || {})[q.id];
        h += '<div class="card mb-3"><div class="card-body py-3"><div class="d-flex justify-content-between align-items-start gap-2"><div><div class="small text-muted">' + E(groupOf[q.group] || '') + ' · ' + q.id + '</div><div class="fw-semibold">' + E(qText) + '</div></div>' +
          '<div class="form-check"><input class="form-check-input" type="checkbox" id="gh_' + q.id + '" data-ghide="' + q.id + '"' + ((data.hidden || []).indexOf(q.id) > -1 ? ' checked' : '') + '><label class="form-check-label small" for="gh_' + q.id + '">Gizle</label></div></div>' +
          (auto ? '<div class="small text-muted bg-light border rounded p-2 mt-2" style="white-space:pre-wrap;max-height:140px;overflow:auto">' + E(auto) + '</div>' : '<div class="small text-warning mt-2">Otomatik cevap yok (veri eksik). Cevap yazılmazsa soru gösterilmez.</div>') +
          '<textarea class="form-control form-control-sm mt-2" rows="3" data-gans="' + q.id + '" placeholder="Kendi cevabın (Markdown, boşsa otomatik kullanılır)" aria-label="Cevap: ' + q.id + '">' + E((data.answers || {})[q.id] || '') + '</textarea></div></div>';
      });
    } else {
      h += '<div class="alert alert-info py-2 small">Kaydedilmemiş değişiklikler önizlemeye yansımaz. ' + g.sections.length + ' soru gösteriliyor.</div><div class="border rounded p-3 bg-white">' +
        '<h4>' + E(g.title) + '</h4>' + g.sections.map(function (s) { return '<h6 class="mt-3 fw-bold">' + E(s.question) + ' <span class="badge text-bg-light border">' + s.source + '</span></h6><div class="small" style="white-space:pre-wrap">' + E(s.answer_md) + '</div>'; }).join('') + '</div>';
    }
    $('guidesBody').innerHTML = h;
  }
  window.guideTab = function (t) { collect(); tab = t; renderEditor(); };
  window.guideBack = function () { cur = null; loadGuides(); };
  window.guideSave = async function () {
    collect();
    var r = await api('PUT', '/api/admin/guide/entity/' + cur.id, { status: cur.profile.status, slug: cur.profile.slug, data: cur.profile.data });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) return toast(j.error || 'Kaydedilemedi', 'error');
    toast('Kaydedildi'); await window.guideEdit(cur.id);
  };

  // Country facts
  window.guideCountryEdit = async function (country) {
    $('guidesBody').innerHTML = '<div class="text-center text-muted py-5">Yükleniyor…</div>';
    try {
      var r = await jget('/api/admin/guide/country/' + encodeURIComponent(country)); curCountry = { name: country, data: r.data || {} };
      var facts = curCountry.data.facts || {};
      $('guidesBody').innerHTML = '<div class="d-flex gap-2 align-items-center mb-3"><button class="btn btn-outline-secondary btn-sm" onclick="guideBack()"><i class="bi bi-arrow-left"></i> Liste</button>' +
        '<h5 class="mb-0 fw-bold">' + E(country) + ' ülke bilgileri</h5><button class="btn btn-primary btn-sm ms-auto" onclick="guideCountrySave()"><i class="bi bi-check2"></i> Kaydet</button></div>' +
        '<p class="text-muted small">Bu metinler ülkedeki tüm okul rehberlerinde kullanılır (vize, çalışma hakkı, diploma denkliği). Değiştirince hepsi güncellenir.</p><div class="row"><div class="col-lg-8">' +
        spec.country_facts.map(function (f) { return factField(f, facts[f.key], 'cf_'); }).join('') + '</div></div>';
    } catch (e) { toast(e.message, 'error'); renderList(); }
  };
  window.guideCountrySave = async function () {
    var data = curCountry.data; data.facts = readFacts(spec.country_facts, 'cf_');
    var r = await api('PUT', '/api/admin/guide/country/' + encodeURIComponent(curCountry.name), { data: data });
    toast(r.ok ? 'Kaydedildi' : 'Kaydedilemedi', r.ok ? undefined : 'error');
  };
})();
