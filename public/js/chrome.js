/* Injects the shared PANELEDU top-nav and footer into any public page.
   Include AFTER /css/site.css and add class "pe-theme" to <body>. */
(function () {
  'use strict';

  var NAV = [
    { href: '/',         label: 'Ana Sayfa' },
    { href: '/match',    label: 'Okul Bul' },
    { href: '/programs', label: 'Programlar' }
  ];

  function navHtml() {
    var links = NAV.map(function (l) { return '<a href="' + l.href + '">' + l.label + '</a>'; }).join('');
    return '' +
      '<nav class="pe-nav">' +
        '<div class="pe-nav-inner">' +
          '<a class="pe-brand pe-grad-text" href="/"><span class="dot"></span>PANELEDU</a>' +
          '<button class="pe-nav-toggle" aria-label="Menu" onclick="document.getElementById(\'peNavLinks\').classList.toggle(\'open\')">&#9776;</button>' +
          '<div class="pe-nav-links" id="peNavLinks">' +
            links +
            '<a class="btn-grad" href="/login">Giriş</a>' +
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
            '<p>Yurt dışında eğitim için sana en uygun üniversite ve programları bul, karşılaştır, 3D kampüs turu yap ve başvur.</p>' +
          '</div>' +
          '<div class="pe-footer-col">' +
            '<span class="h">Keşfet</span>' +
            '<a href="/match">Okul Bul</a>' +
            '<a href="/programs">Programlar</a>' +
            '<a href="/">Üniversiteler</a>' +
          '</div>' +
          '<div class="pe-footer-col">' +
            '<span class="h">Hesap</span>' +
            '<a href="/login">Giriş Yap</a>' +
            '<a href="/register">Kayıt Ol</a>' +
            '<a href="/portal">Öğrenci Paneli</a>' +
          '</div>' +
        '</div>' +
        '<div class="pe-footer-bottom">© ' + year + ' PANELEDU · Tüm hakları saklıdır.</div>' +
      '</footer>';
  }

  function inject() {
    if (!document.querySelector('.pe-nav')) {
      document.body.insertAdjacentHTML('afterbegin', navHtml());
    }
    if (!document.querySelector('.pe-footer')) {
      document.body.insertAdjacentHTML('beforeend', footerHtml());
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
