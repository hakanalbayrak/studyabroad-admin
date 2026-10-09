// File-based blog: posts live in content/blog/*.md (front matter + Markdown).
// Pages are rendered on the server, so crawlers and AI agents get complete HTML
// with structured data (BlogPosting, BreadcrumbList, FAQPage) without running JS.
// To publish a post, add a .md file (see content/blog/_TEMPLATE.md) and deploy.
const fs = require('fs');
const path = require('path');
const { injectChrome } = require('./chrome');

const DIR = path.join(__dirname, '..', 'content', 'blog');
const SITE = 'https://paneledu.com';
const PER_PAGE = 12;

const LEGACY = []; // all posts are Markdown files now

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => String(s).toLowerCase()
  .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
function fmtDate(d) { const x = new Date(d); return isNaN(x) ? '' : `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`; }

// ── Front matter (small YAML subset: scalars, [a, b], "- item" lists, "- q: / a:" maps)
function scalar(v) {
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1);
  if (v === 'true') return true; if (v === 'false') return false;
  return v;
}
function parseFrontMatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {}, lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, val] = kv;
    if (val.startsWith('[') && val.endsWith(']')) { meta[key] = val.slice(1, -1).split(',').map(scalar).filter(x => x !== ''); continue; }
    if (val !== '') { meta[key] = scalar(val); continue; }
    const items = [];
    while (i + 1 < lines.length && /^\s+-\s/.test(lines[i + 1])) {
      i++;
      const first = lines[i].replace(/^\s+-\s+/, '');
      const mm = first.match(/^([A-Za-z_]\w*):\s*(.*)$/);
      if (mm) {
        const obj = { [mm[1]]: scalar(mm[2]) };
        while (i + 1 < lines.length && /^\s{3,}[A-Za-z_]\w*:/.test(lines[i + 1]) && !/^\s+-\s/.test(lines[i + 1])) {
          i++; const k2 = lines[i].match(/^\s+([A-Za-z_]\w*):\s*(.*)$/); obj[k2[1]] = scalar(k2[2]);
        }
        items.push(obj);
      } else items.push(scalar(first));
    }
    meta[key] = items;
  }
  return { meta, body: m[2] };
}

// ── Markdown
function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, alt, src, cap) =>
    `<img src="${src}" alt="${alt}" loading="lazy" decoding="async">`);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
    const ext = /^https?:\/\//.test(u) && !u.startsWith(SITE);
    return `<a href="${u}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [], toc = [], used = {};
  let i = 0;
  const idFor = t => { let b = slugify(t) || 'bolum', id = b, n = 2; while (used[id]) id = b + '-' + n++; used[id] = 1; return id; };
  const isBlockStart = l => /^(#{1,4}\s|>|```|\s*[-*]\s|\s*\d+\.\s|---+\s*$|\|)/.test(l);
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^```(\w*)/))) {
      const buf = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++; out.push(`<pre><code>${esc(buf.join('\n'))}</code></pre>`); continue;
    }
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
      const lvl = Math.max(2, m[1].length), text = m[2].trim(), id = idFor(text);
      if (lvl <= 3) toc.push({ level: lvl, id, text });
      out.push(`<h${lvl} id="${id}"><a class="anchor" href="#${id}" aria-label="Bağlantı">#</a>${inline(text)}</h${lvl}>`); i++; continue;
    }
    if (/^---+\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (l.startsWith('>')) {
      const buf = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      let kind = 'note', title = '';
      const cm = buf[0].match(/^\[!(tip|warn|info|note)\]\s*(.*)$/i);
      if (cm) { kind = cm[1].toLowerCase(); title = cm[2]; buf.shift(); }
      out.push(`<aside class="callout callout-${kind}">${title ? `<strong class="callout-t">${inline(title)}</strong>` : ''}${renderMarkdown(buf.join('\n')).html}</aside>`); continue;
    }
    if (l.trim().startsWith('|') && lines[i + 1] && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const row = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = row(l); i += 2; const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(row(lines[i++]));
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    if ((m = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/))) {
      const ordered = /\d/.test(m[2]), items = [];
      while (i < lines.length && (m = lines[i].match(/^(\s*)([-*]|\d+\.)\s+(.*)$/))) {
        const indent = m[1].length; let text = m[3]; i++;
        const sub = [];
        while (i < lines.length && /^\s{2,}([-*]|\d+\.)\s+/.test(lines[i]) && lines[i].match(/^(\s*)/)[1].length > indent) sub.push(lines[i++].trim().replace(/^([-*]|\d+\.)\s+/, ''));
        items.push(`<li>${inline(text)}${sub.length ? `<ul>${sub.map(s => `<li>${inline(s)}</li>`).join('')}</ul>` : ''}</li>`);
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`); continue;
    }
    if (l.startsWith('<')) { const buf = []; while (i < lines.length && lines[i].trim()) buf.push(lines[i++]); out.push(buf.join('\n')); continue; }
    if ((m = l.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/))) {
      out.push(`<figure><img src="${esc(m[2])}" alt="${esc(m[1])}" loading="lazy" decoding="async">${m[3] ? `<figcaption>${esc(m[3])}</figcaption>` : ''}</figure>`); i++; continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) buf.push(lines[i++]);
    if (!buf.length) { buf.push(lines[i++]); }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return { html: out.join('\n'), toc };
}

// ── Loading
let cache = { sig: '', posts: [] };
function loadPosts() {
  let files = [];
  try { files = fs.readdirSync(DIR).filter(f => f.endsWith('.md') && !f.startsWith('_')); } catch { /* no content dir */ }
  const sig = files.map(f => f + fs.statSync(path.join(DIR, f)).mtimeMs).join('|');
  if (sig === cache.sig) return cache.posts;
  const posts = files.map(f => {
    const { meta, body } = parseFrontMatter(fs.readFileSync(path.join(DIR, f), 'utf8'));
    const slug = meta.slug || f.replace(/\.md$/, '');
    const { html, toc } = renderMarkdown(body);
    const words = body.split(/\s+/).filter(Boolean).length;
    return { ...meta, slug, html, toc, readingTime: Math.max(1, Math.round(words / 200)),
      title: meta.title || slug, summary: meta.summary || '', category: meta.category || 'Rehber', tags: meta.tags || [],
      date: meta.date || new Date(fs.statSync(path.join(DIR, f)).mtimeMs).toISOString().slice(0, 10), author: meta.author || 'PANELEDU Editör' };
  }).filter(p => !p.draft);
  cache = { sig, posts: [...posts, ...LEGACY].sort((a, b) => String(b.date).localeCompare(String(a.date))) };
  return cache.posts;
}

// ── Templates
function head({ title, description, url, type = 'website', extra = '' }) {
  return `<!DOCTYPE html>
<html lang="tr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="alternate" type="application/rss+xml" title="PANELEDU Blog" href="${SITE}/blog/feed.xml">
<meta property="og:type" content="${type}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary">
<link href="/vendor/bootstrap.min.css" rel="stylesheet"><link href="/css/site.css?v=20261009" rel="stylesheet"><link href="/css/icons.css" rel="stylesheet"><link href="/css/blog.css?v=20261009" rel="stylesheet">
<script src="/js/i18n.js"></script>${extra}
</head>`;
}

function card(p, big) {
  return `<a class="post-card${big ? ' post-card-big' : ''}" href="/blog/${esc(p.slug)}">
  <span class="post-cat">${esc(p.category)}</span>
  <h${big ? 2 : 3} class="post-title">${esc(p.title)}</h${big ? 2 : 3}>
  <p class="post-excerpt">${esc(p.summary)}</p>
  <span class="post-meta"><span>${fmtDate(p.date)}</span><span>${p.readingTime} dk okuma</span></span>
</a>`;
}

function renderIndex(query = {}) {
  const all = loadPosts();
  const cats = [...new Set(all.map(p => p.category))].sort();
  const cat = cats.includes(query.cat) ? query.cat : '';
  const list = cat ? all.filter(p => p.category === cat) : all;
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const page = Math.min(Math.max(parseInt(query.page) || 1, 1), pages);
  const slice = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const [first, ...rest] = page === 1 ? slice : [null, ...slice];
  const url = `${SITE}/blog${cat ? '?cat=' + encodeURIComponent(cat) : ''}`;
  const ld = { '@context': 'https://schema.org', '@type': 'Blog', name: 'PANELEDU Blog', url: SITE + '/blog', inLanguage: 'tr',
    blogPost: all.slice(0, 20).map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}`, datePublished: p.date })) };
  const html = head({ title: 'Blog ve Rehberler | PANELEDU', description: 'Yurt dışında eğitim kararını kolaylaştıran ülke karşılaştırmaları, burs rehberleri, sınav ve başvuru yazıları.', url,
    extra: `<script type="application/ld+json">${JSON.stringify(ld)}</script>` }) + `
<body class="pe-theme"><main id="main">
<section class="blog-head"><div class="pe-wrap">
  <span class="pe-eyebrow">Blog</span>
  <h1>Rehberler ve karşılaştırmalar</h1>
  <p class="lead">Yurt dışında eğitim kararını kolaylaştıran ülke rehberleri, burs ve başvuru yazıları.</p>
  ${cats.length > 1 ? `<nav class="cat-row" aria-label="Kategoriler"><a class="fchip${cat ? '' : ' sel'}" href="/blog">Tümü (${all.length})</a>${cats.map(c => `<a class="fchip${c === cat ? ' sel' : ''}" href="/blog?cat=${encodeURIComponent(c)}">${esc(c)} (${all.filter(p => p.category === c).length})</a>`).join('')}</nav>` : ''}
</div></section>
<section class="pe-section-tight"><div class="pe-wrap">
  ${first ? card(first, true) : '<p class="blog-empty">İlk rehberler hazırlanıyor. Bu arada programları ve üniversiteleri inceleyebilirsin.</p>'}
  ${rest.length ? `<div class="post-grid">${rest.map(p => card(p)).join('')}</div>` : ''}
  ${pages > 1 ? `<nav class="pager" aria-label="Sayfalar">${Array.from({ length: pages }, (_, i) => `<a class="${i + 1 === page ? 'active' : ''}" href="/blog?${cat ? 'cat=' + encodeURIComponent(cat) + '&' : ''}page=${i + 1}">${i + 1}</a>`).join('')}</nav>` : ''}
</div></section>
<section class="pe-section-tight"><div class="pe-wrap"><div class="blog-cta">
  <div><h2>Sana uygun programı bul</h2><p>Birkaç soruyla bütçene, dereceye ve bölgene uygun okul listeni oluştur.</p></div>
  <a class="btn-grad" href="/match">Okul Bul</a>
</div></div></section>
</main></body></html>`;
  return injectChrome(html);
}

function relatedFor(post, all) {
  const score = p => (p.category === post.category ? 2 : 0) + p.tags.filter(t => post.tags.includes(t)).length;
  return all.filter(p => p.slug !== post.slug).map(p => [score(p), p]).sort((a, b) => b[0] - a[0] || String(b[1].date).localeCompare(String(a[1].date))).slice(0, 3).map(x => x[1]);
}

function renderPost(slug) {
  const all = loadPosts();
  const post = all.find(p => p.slug === slug && !p.legacy);
  if (!post) return null;
  const url = `${SITE}/blog/${post.slug}`;
  const ld = [
    { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, description: post.summary, inLanguage: 'tr', mainEntityOfPage: url, url,
      datePublished: post.date, dateModified: post.updated || post.date, author: { '@type': 'Organization', name: post.author }, publisher: { '@type': 'Organization', name: 'PANELEDU', logo: { '@type': 'ImageObject', url: SITE + '/img/mark.svg' } },
      keywords: post.tags.join(', '), articleSection: post.category },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Ana Sayfa', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + '/blog' }, { '@type': 'ListItem', position: 3, name: post.title, item: url }] },
  ];
  if (Array.isArray(post.faq) && post.faq.length) ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: post.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  const ctaMap = { match: ['Sana uygun okulu bul', 'Birkaç soruyla bütçene ve hedefine uygun program listesi çıkar.', '/match', 'Okul Bul'],
    test: ['İngilizce seviyeni öğren', '20 soruluk ücretsiz CEFR testi ile hangi programlara uygun olduğunu gör.', '/test', 'Testi Başlat'],
    programs: ['Programları keşfet', '23.000’den fazla programı ülke, bölüm ve ücrete göre filtrele.', '/programs', 'Programlar'] };
  const cta = ctaMap[post.cta] || ctaMap.match;
  const toc = post.toc.length > 10 ? post.toc.filter(t => t.level === 2) : post.toc;
  const related = relatedFor(post, all);
  const html = head({ title: `${post.title} | PANELEDU`, description: post.summary, url, type: 'article', extra: ld.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('') }) + `
<body class="pe-theme"><main id="main">
<article class="post">
  <header class="post-head"><div class="pe-wrap">
    <nav class="crumbs" aria-label="Sayfa yolu"><a href="/">Ana Sayfa</a> / <a href="/blog">Blog</a> / <a href="/blog?cat=${encodeURIComponent(post.category)}">${esc(post.category)}</a></nav>
    <h1>${esc(post.title)}</h1>
    ${post.summary ? `<p class="dek">${esc(post.summary)}</p>` : ''}
    <div class="byline"><span>${esc(post.author)}</span><time datetime="${esc(post.date)}">${fmtDate(post.date)}</time>${post.updated ? `<span>Güncelleme: ${fmtDate(post.updated)}</span>` : ''}<span>${post.readingTime} dk okuma</span></div>
  </div></header>
  <div class="pe-wrap post-layout">
    <div class="post-main">
      ${toc.length > 2 ? `<details class="toc-m"><summary>İçindekiler</summary><ol>${toc.map(t => `<li class="l${t.level}"><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></details>` : ''}
      ${Array.isArray(post.takeaways) && post.takeaways.length ? `<aside class="takeaways"><strong>Kısaca</strong><ul>${post.takeaways.map(t => `<li>${inline(t)}</li>`).join('')}</ul></aside>` : ''}
      <div class="prose">${post.html}</div>
      ${Array.isArray(post.faq) && post.faq.length ? `<section class="faq"><h2>Sık sorulan sorular</h2>${post.faq.map(f => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</section>` : ''}
      <div class="blog-cta"><div><h2>${cta[0]}</h2><p>${cta[1]}</p></div><a class="btn-grad" href="${cta[2]}">${cta[3]}</a></div>
      <div class="share"><button class="btn-ghost" type="button" onclick="navigator.clipboard&&navigator.clipboard.writeText(location.href.split('#')[0]).then(()=>{this.textContent='Bağlantı kopyalandı'})"><i class="bi bi-link-45deg"></i> Bağlantıyı kopyala</button></div>
    </div>
    ${toc.length > 2 ? `<aside class="toc-d" aria-label="İçindekiler"><strong>İçindekiler</strong><ol>${toc.map(t => `<li class="l${t.level}"><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></aside>` : ''}
  </div>
</article>
${related.length ? `<section class="pe-section-tight"><div class="pe-wrap"><h2 class="rel-h">Bunları da oku</h2><div class="post-grid">${related.map(p => card(p)).join('')}</div></div></section>` : ''}
</main></body></html>`;
  return injectChrome(html);
}

function renderFeed() {
  const items = loadPosts().slice(0, 30).map(p => `<item><title>${esc(p.title)}</title><link>${SITE}/blog/${p.slug}</link><guid>${SITE}/blog/${p.slug}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><category>${esc(p.category)}</category><description>${esc(p.summary)}</description></item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>PANELEDU Blog</title><link>${SITE}/blog</link><description>Yurt dışında eğitim rehberleri</description><language>tr</language>${items}</channel></rss>`;
}

module.exports = { loadPosts, renderIndex, renderPost, renderFeed, parseFrontMatter, renderMarkdown, SITE };
