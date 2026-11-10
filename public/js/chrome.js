/* Client behaviour for the server-rendered nav and footer (see utils/chrome.js).
   Marks the current page, wires the mobile menu and re-applies translations.
   If a page was served without the chrome, it is injected here as a fallback. */
(function () {
  'use strict';

  if (!window.panelangToggle) {
    window.panelangToggle = function () {
      var next = (localStorage.getItem('paneleduLang') || 'tr') === 'tr' ? 'en' : 'tr';
      localStorage.setItem('paneleduLang', next);
      location.reload();
    };
  }

  function init() {
    var nav = document.querySelector('.pe-nav');
    if (!nav) return;
    var path = location.pathname.replace(/\/$/, '') || '/';
    nav.querySelectorAll('.pe-nav-links a:not(.btn-grad)').forEach(function (a) {
      var h = a.getAttribute('href');
      if (h === path || (h !== '/' && path.indexOf(h + '/') === 0)) a.setAttribute('aria-current', 'page');
    });
    var btn = nav.querySelector('.pe-nav-toggle'), links = document.getElementById('peNavLinks');
    if (btn && links) {
      btn.addEventListener('click', function () {
        var open = links.classList.toggle('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && links.classList.contains('open')) { links.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
      });
    }
    // Signed-in visitors see their name and a link to their own dashboard instead of "Giriş".
    try {
      var tok = localStorage.getItem('sa_token'), role = localStorage.getItem('sa_role'), nm = (localStorage.getItem('sa_name') || '').split(' ')[0];
      var cta = nav.querySelector('.pe-nav-links .btn-grad');
      if (tok && cta) {
        cta.href = role === 'admin' ? '/admin' : role === 'affiliate' ? '/affiliate' : '/portal';
        cta.removeAttribute('data-i18n');
        cta.textContent = nm || (role === 'admin' ? 'Admin' : 'Panel');
      }
    } catch (e) { /* storage unavailable */ }
    var lang = document.getElementById('peLangBtn');
    if (lang) lang.textContent = (localStorage.getItem('paneleduLang') || 'tr') === 'tr' ? 'EN' : 'TR';
    if (window.i18n && window.i18n.apply) window.i18n.apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* Staff-only provider tags (admin + advisor): shows which provider a school belongs to on school links.
   The mapping endpoint rejects anyone else, so visitors never see it. */
(function () {
  try {
    var role = localStorage.getItem('sa_role'), token = localStorage.getItem('sa_token');
    if (!token || (role !== 'admin' && role !== 'advisor')) return;
    fetch('/api/staff/providers', { headers: { Authorization: 'Bearer ' + token } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.map) return;
      var map = d.map;
      function tag(list) { var s = document.createElement('span'); s.className = 'staff-prov'; s.title = 'Provider (staff only)'; s.textContent = list.join(' · '); return s; }
      function paint() {
        document.querySelectorAll('a[href*="/university?id="]:not(.prog-name a)').forEach(function (a) {
          if (a.dataset.provDone) return;
          var m = a.getAttribute('href').match(/id=(\d+)/); var list = m && map[m[1]];
          a.dataset.provDone = '1'; if (list && list.length) a.insertAdjacentElement('afterend', tag(list));
        });
        document.querySelectorAll('[data-uid]').forEach(function (el) {
          if (el.dataset.provDone) return; el.dataset.provDone = '1';
          var l = map[el.getAttribute('data-uid')]; if (l && l.length) el.insertAdjacentElement('afterend', tag(l));
        });
        var h = document.getElementById('uName');
        if (h && !h.dataset.provDone) {
          var m2 = location.search.match(/id=(\d+)/); var l2 = m2 && map[m2[1]];
          h.dataset.provDone = '1'; if (l2 && l2.length) h.insertAdjacentElement('afterend', tag(l2));
        }
      }
      paint(); new MutationObserver(paint).observe(document.body, { childList: true, subtree: true });
    }).catch(function () { /* optional */ });
  } catch (e) { /* storage unavailable */ }
})();
