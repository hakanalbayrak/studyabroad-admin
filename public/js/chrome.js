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
    var lang = document.getElementById('peLangBtn');
    if (lang) lang.textContent = (localStorage.getItem('paneleduLang') || 'tr') === 'tr' ? 'EN' : 'TR';
    if (window.i18n && window.i18n.apply) window.i18n.apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
