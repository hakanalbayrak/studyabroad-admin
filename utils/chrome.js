// Server-side page chrome: shared nav, footer and head tags injected into every
// public HTML page, so crawlers, agents and no-JS clients see real navigation
// and the layout never shifts when scripts load. Translations are still applied
// client-side by /js/i18n.js through the data-i18n attributes.
const fs = require('fs');

const MARK = '<svg class="pe-mark" viewBox="0 0 40 40" width="30" height="30" aria-hidden="true" focusable="false"><rect x="5" y="5" width="32" height="32" rx="9" fill="#14142b"/><rect x="2" y="2" width="32" height="32" rx="9" fill="#2b44ff" stroke="#14142b" stroke-width="2"/><path d="M12 27V11h8a5 5 0 0 1 0 10h-8" fill="none" stroke="#ffd23f" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const NAV = [
  ['/',         'nav.home',     'Ana Sayfa'],
  ['/match',    'nav.match',    'Okul Bul'],
  ['/programs', 'nav.programs', 'Programlar'],
  ['/test',     'nav.test',     'İngilizce Testi'],
  ['/blog',     'nav.blog',     'Blog'],
];

const NAV_HTML =
  '<a class="pe-skip" href="#main" data-i18n="a11y.skip">İçeriğe geç</a>' +
  '<header class="pe-nav"><nav class="pe-nav-inner" aria-label="Ana menü">' +
    '<a class="pe-brand" href="/" aria-label="PANELEDU ana sayfa" translate="no">' + MARK + '<span>paneledu</span></a>' +
    '<button class="pe-nav-toggle" type="button" aria-label="Menü" aria-expanded="false" aria-controls="peNavLinks"><span></span><span></span><span></span></button>' +
    '<div class="pe-nav-links" id="peNavLinks">' +
      NAV.map(([h, k, l]) => '<a href="' + h + '" data-i18n="' + k + '">' + l + '</a>').join('') +
      '<a class="btn-grad" href="/login" data-i18n="nav.login">Giriş</a>' +
      '<button class="pe-lang-btn" id="peLangBtn" type="button" onclick="panelangToggle()" title="Switch language / Dil değiştir" aria-label="Switch language">EN</button>' +
    '</div>' +
  '</nav></header>';

const FOOTER_HTML =
  '<footer class="pe-footer"><div class="pe-footer-inner">' +
    '<div class="pe-footer-brand"><a class="pe-brand" href="/" aria-label="PANELEDU" translate="no">' + MARK + '<span>paneledu</span></a>' +
      '<p data-i18n="f.tagline">Yurt dışında eğitim için sana en uygun üniversite ve programları bul, karşılaştır, 3D kampüs turu yap ve başvur.</p></div>' +
    '<nav class="pe-footer-col" aria-label="Keşfet"><span class="h" data-i18n="f.explore">Keşfet</span>' +
      '<a href="/match" data-i18n="f.match">Okul Bul</a><a href="/programs" data-i18n="f.programs">Programlar</a>' +
      '<a href="/test" data-i18n="f.test">İngilizce Testi</a><a href="/blog" data-i18n="nav.blog">Blog</a></nav>' +
    '<nav class="pe-footer-col" aria-label="Hesap"><span class="h" data-i18n="f.account">Hesap</span>' +
      '<a href="/login" data-i18n="f.login">Giriş Yap</a><a href="/register" data-i18n="f.register">Kayıt Ol</a>' +
      '<a href="/portal" data-i18n="f.portal">Öğrenci Paneli</a></nav>' +
    '<nav class="pe-footer-col" aria-label="Şirket"><span class="h" data-i18n="f.company">Şirket</span>' +
      '<a href="/about" data-i18n="f.about">Hakkımızda</a><a href="/about#contact" data-i18n="f.contact">İletişim</a>' +
      '<a href="/privacy" data-i18n="f.privacy">Gizlilik Politikası</a><a href="/terms" data-i18n="f.terms">Kullanım Koşulları</a></nav>' +
  '</div><div class="pe-footer-bottom"><span>© ' + new Date().getFullYear() + ' PANELEDU</span>' +
  '<span data-i18n="f.note">Program bilgileri üniversitelerin resmi sayfalarından derlenir.</span></div></footer>';

const HEAD_TAGS =
  '<link rel="icon" type="image/svg+xml" href="/img/mark.svg">' +
  '<meta name="theme-color" content="#fff8e7">' +
  '<link rel="preload" as="font" type="font/woff2" href="/fonts/rubik-latin.woff2" crossorigin>' +
  '<link rel="preload" as="font" type="font/woff2" href="/fonts/unbounded-latin.woff2" crossorigin>';

const cache = new Map();
function injectChrome(html) {
  if (!/<body[^>]*class="[^"]*pe-theme/.test(html)) return html;
  let out = html;
  const wrap = !/id="main"/.test(out);
  if (!/class="pe-nav"/.test(out)) out = out.replace(/(<body[^>]*>)/, '$1' + NAV_HTML + (wrap ? '<main id="main">' : ''));
  if (!/class="pe-footer"/.test(out)) out = out.replace(/<\/body>/, (wrap ? '</main>' : '') + FOOTER_HTML + '</body>');
  if (!/rel="icon"/.test(out)) out = out.replace('</head>', HEAD_TAGS + '</head>');
  return out;
}

// Wraps res.sendFile so every .html page served by a route gets the chrome.
function chromeMiddleware(req, res, next) {
  const orig = res.sendFile.bind(res);
  res.sendFile = function (p, opts, cb) {
    if (typeof p === 'string' && p.endsWith('.html')) {
      try {
        const st = fs.statSync(p);
        let c = cache.get(p);
        if (!c || c.mtime !== st.mtimeMs) {
          c = { mtime: st.mtimeMs, html: injectChrome(fs.readFileSync(p, 'utf8')) };
          cache.set(p, c);
        }
        res.type('html').set('Cache-Control', 'public, max-age=300').send(c.html);
        return;
      } catch (e) { /* fall through to the default behaviour */ }
    }
    return orig(p, opts, cb);
  };
  next();
}

module.exports = { injectChrome, chromeMiddleware };
