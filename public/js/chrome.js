/* Injects the shared PANELEDU top-nav and footer into any public page.
   Include AFTER /css/site.css and i18n.js. Add class "pe-theme" to <body>. */
(function () {
  'use strict';

  var NAV = [
    { href: '/',         key: 'nav.home',     label: 'Ana Sayfa' },
    { href: '/match',    key: 'nav.match',    label: 'Okul Bul' },
    { href: '/programs', key: 'nav.programs', label: 'Programlar' },
    { href: '/test',     key: 'nav.test',     label: 'İngilizce Testi' },
    { href: '/blog',     key: 'nav.blog',     label: 'Blog' }
  ];

  function currentLang() {
    return localStorage.getItem('paneleduLang') || 'tr';
  }

  /* Fallback toggle in case i18n.js is not included on a page */
  if (!window.panelangToggle) {
    window.panelangToggle = function () {
      var next = currentLang() === 'tr' ? 'en' : 'tr';
      localStorage.setItem('paneleduLang', next);
      location.reload();
    };
  }

  function navHtml() {
    var links = NAV.map(function (l) {
      return '<a href="' + l.href + '" data-i18n="' + l.key + '">' + l.label + '</a>';
    }).join('');
    var langLabel = currentLang() === 'tr' ? 'EN' : 'TR';
    return '' +
      '<nav class="pe-nav">' +
        '<div class="pe-nav-inner">' +
          '<a class="pe-brand pe-grad-text" href="/"><span class="dot"></span>PANELEDU</a>' +
          '<button class="pe-nav-toggle" aria-label="Menu" onclick="document.getElementById(\'peNavLinks\').classList.toggle(\'open\')">&#9776;</button>' +
          '<div class="pe-nav-links" id="peNavLinks">' +
            links +
            '<a class="btn-grad" href="/login" data-i18n="nav.login">Giriş</a>' +
            '<button class="pe-lang-btn" id="peLangBtn" onclick="panelangToggle()" title="Switch language / Dil değiştir">' + langLabel + '</button>' +
          '</div>' +
        '</div>' +
      '</nav>';
  }

  function footerHtml() {
    var year = (new Date()).getFullYear();
    return '' +
      '<footer class="pe-footer">' +
        '<div class="pe-footer-inner">' +
          '<div style="max-width:300px">' +
            '<h4 class="pe-grad-text">PANELEDU</h4>' +
            '<p data-i18n="f.tagline">Yurt dışında eğitim için sana en uygun üniversite ve programları bul, karşılaştır, 3D kampüs turu yap ve başvur.</p>' +
          '</div>' +
          '<div class="pe-footer-col">' +
            '<span class="h" data-i18n="f.explore">Keşfet</span>' +
            '<a href="/match" data-i18n="f.match">Okul Bul</a>' +
            '<a href="/programs" data-i18n="f.programs">Programlar</a>' +
            '<a href="/test" data-i18n="f.test">İngilizce Testi</a>' +
            '<a href="/" data-i18n="f.unis">Üniversiteler</a>' +
          '</div>' +
          '<div class="pe-footer-col">' +
            '<span class="h" data-i18n="f.account">Hesap</span>' +
            '<a href="/login" data-i18n="f.login">Giriş Yap</a>' +
            '<a href="/register" data-i18n="f.register">Kayıt Ol</a>' +
            '<a href="/portal" data-i18n="f.portal">Öğrenci Paneli</a>' +
          '</div>' +
          '<div class="pe-footer-col">' +
            '<span class="h" data-i18n="f.company">Şirket</span>' +
            '<a href="/about" data-i18n="f.about">Hakkımızda</a>' +
            '<a href="/about#contact" data-i18n="f.contact">İletişim</a>' +
            '<a href="/privacy" data-i18n="f.privacy">Gizlilik Politikası</a>' +
            '<a href="/terms" data-i18n="f.terms">Kullanım Koşulları</a>' +
          '</div>' +
        '</div>' +
        '<div class="pe-footer-bottom">© ' + year + ' PANELEDU · <span data-i18n="f.rights">Tüm hakları saklıdır.</span> · <a href="/privacy" style="color:inherit;opacity:.7" data-i18n="f.privacy">Gizlilik</a> · <a href="/terms" style="color:inherit;opacity:.7" data-i18n="f.terms">Koşullar</a></div>' +
      '</footer>';
  }

  function inject() {
    if (!document.querySelector('.pe-nav')) {
      document.body.insertAdjacentHTML('afterbegin', navHtml());
    }
    if (!document.querySelector('.pe-footer')) {
      document.body.insertAdjacentHTML('beforeend', footerHtml());
    }
    /* Re-apply translations after nav/footer are in the DOM */
    if (window.i18n && window.i18n.apply) window.i18n.apply();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
