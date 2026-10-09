# PANELEDU design system: "Campus Pop"

Chosen 2026-10-09 (option D of the second design round). Cream canvas, ink outlines, cobalt brand, sun-yellow actions, hard shadows. Built for students on phones: big tap targets, short pages, fast first paint.

Reference systems used while designing live in `docs/design-references/` (Wise, Stripe, Linear, Notion, Vercel, Airbnb, Apple, Revolut, Shopify). Design skills live in `.claude/skills/` (taste-skill family, web-design-guidelines). Run the web-design-guidelines review on any page you change.

## Tokens (defined in `public/css/site.css`)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#fff8e7` | page canvas (cream) |
| `--surface` | `#ffffff` | cards, inputs, nav |
| `--surface-2` | `#fff1c9` | warm bands |
| `--text` / `--line` | `#14142b` | ink: text and every outline |
| `--muted` | `#5a5a78` | secondary text |
| `--accent` | `#2b44ff` | cobalt: links, brand, primary-info surfaces |
| `--sun` | `#ffd23f` | the one primary action per view, selected chips |
| `--mist` | `#e6e9ff` | soft cobalt tint (chips, hover) |
| `--ok` / `--danger` | `#12a150` / `#e5484d` | semantic only |

Shape: radius `--r` 14px (cards), `--r-s` 10px (controls); border `--bw` 2px ink; shadows are hard offsets (`--shadow` 4px, `--shadow-s` 2px, `--shadow-lg` 6px), never blurred. Hover lifts a card by 2px and grows the shadow; active presses it in.

Type: **Unbounded** (display, 700-800, tight tracking) for headings, prices and the wordmark; **Rubik** for everything else. Both are self-hosted in `public/fonts/` (Latin plus a Turkish subset: ğ Ğ ş Ş İ). Never load fonts from a CDN.

## Components

- `.btn-grad` primary (yellow, despite the legacy name), `.btn-ghost` secondary, `.btn-cobalt` brand button. 44px minimum height.
- `.pe-card` (+ `.pop` for the hard shadow), `.pe-chip`, `.pe-eyebrow`, `.pe-wrap` (max 1180px container), `.pe-section` / `.pe-section-tight` (the only vertical rhythm; do not add ad-hoc big margins), `.pe-band`.
- Nav and footer are **server-rendered** by `utils/chrome.js` (injected into every HTML page that has `<body class="pe-theme">`). Edit the nav/footer there, not in pages. `public/js/chrome.js` only adds behaviour.
- Icons: `public/css/icons.css` is a trimmed Bootstrap Icons build (about 12 KB font). If you use a new `bi-*` icon, rebuild it: collect used `bi-` names, subset `fonts/bi.woff2` with pyftsubset, regenerate the CSS (see git history of `css/icons.css`).
- Bootstrap 5.3.2 CSS/JS are self-hosted in `public/vendor/` (grid, forms, modal only). Do not re-add CDN links.

## Rules

1. One yellow button per view. Cobalt is for brand and information, not for competing actions.
2. No dead space: sections use `pe-section(-tight)` padding only; empty states have a message and a next action; no placeholder "coming soon" cards.
3. Mobile first: test at 390px. No horizontal scroll. Filters become a full-screen sheet. Sticky bars must not cover focused elements (`scroll-padding-top` is set).
4. Speed: no render-blocking third-party hosts; fonts preloaded; lists paginated on the server (`/api/public/programs/search`); long lists use "show more".
5. Agent and SEO friendly: real links and buttons, server-rendered nav/footer, URL state for filters (`/programs?country=Germany&type=Master%20Programs`), JSON-LD on home, university and blog pages, `/sitemap.xml` (dynamic), `/llms.txt`, `/blog/feed.xml`.
6. Turkish is the default language; every user-facing string goes through `data-i18n` keys in `public/js/i18n.js` (both `tr` and `en`).
7. No emoji as icons, no gradients, no blurred shadows, no em dashes in copy.

## Blog

Posts are Markdown files in `content/blog/` (copy `_TEMPLATE.md`). The filename is the URL slug. Front matter supports `title`, `date`, `updated`, `category`, `tags`, `summary`, `author`, `cta` (match, test, programs), `takeaways` (list), `faq` (list of q/a, emitted as FAQPage JSON-LD) and `draft: true`. Body supports headings, lists, tables, images with captions, code, and callouts (`> [!tip] Title`, also `warn`, `info`, `note`). The index, RSS feed, sitemap, related posts, table of contents, BlogPosting and BreadcrumbList JSON-LD are generated automatically. Publishing = commit the `.md` file and deploy.

## Emails and PDFs

`utils/emailBrand.js` restyles every HTML email sent through `utils/mailer.js` (cobalt header with the logo, ink-outlined body, yellow buttons, one shared footer). Write new emails in the existing container/header/body pattern and they inherit the look. `utils/pdfgen.js` uses the same palette.
