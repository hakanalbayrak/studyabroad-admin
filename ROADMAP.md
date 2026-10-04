# Roadmap

## ⚡ Pending — needs action (as of 2026-07-15)

### 1. DB Migration ✅ DONE (2026-07-15)
All 14 new columns confirmed present in `programs` table.

### 2. SMTP config ✅ DONE
Production `.env` has `SMTP_HOST=smtp.resend.com` — app sends via Resend, not
a cPanel mailbox. Superseded the original cPanel-mailbox plan.

### 3. Email deliverability — Resend domain verification ✅ DONE (2026-08-28)
SMTP relay: Resend (smtp.resend.com), MAIL_FROM: info@paneledu.com ✅
DMARC record: live ✅, `rua` now points to info@paneledu.com (moved 2026-08-28,
was hkn3958@gmail.com — stopped daily aggregate reports landing in personal inbox)
DKIM: paneledu.com shows "Verified" in Resend dashboard ✅
All outgoing mail now carries Resend's DKIM signature → inbox, not spam.

### 4. Google Maps API key ✅ DONE (2026-07-21)
File: `public/orbit/index.html` → `const GOOGLE_MAPS_KEY = '...'`
New key added, website restrictions (paneledu.com/*, *.paneledu.com/*,
studyabroad.kampanya.website/*) confirmed in Google Cloud Console.

---

## Done
- **Removed Finland from the catalog** (2026-09-25) — 8 entities, 144
  programs soft-deactivated (`status='inactive'`, reversible), per
  direction. Down to 17 countries, 22,897 active programs, 326 unis.
- **TR/EN language-consistency audit + fixes** (2026-09-25) — full pass
  over every public page against `public/js/i18n.js`. Fixed: the
  eligibility wizard (`match.html`) showing hardcoded English sub-labels
  and raw English `program_types.name` DB values inside Turkish copy;
  `apply.html` missing 15 dictionary keys that froze the whole Identity
  Info + document-upload screen in Turkish regardless of language, plus
  several unwired funnel-step headings/alerts; `test.html`'s CEFR result
  screen always showing Turkish explanations even after an English-mode
  test; `acceptance.html`'s congrats sentence not using an already-
  translated key; `university.html` printing the raw English type name
  with no translation at all; smaller fixes on `index.html`, `login.html`,
  `register.html`, `portal/index.html`. Added a shared
  `window.i18n.typeLabel()` helper (`m.type.*` keys) so program-type names
  translate consistently everywhere instead of each page reinventing it.
  **Follow-up also done (2026-09-25)**: `programs.html`'s eligibility side
  panel (was entirely English-only regardless of page language — the
  inverse bug) and `about.html`'s full body (mission, values, services,
  affiliate disclosure, company info, contact form) are now fully
  localized, including fixing several existing dictionary entries whose
  stored TR text no longer matched the live page copy. `eligibility.js`
  (the shared match engine) also got a soft `window.t()` hook so its
  criterion labels translate too. Verified: every `data-i18n*`/`t()`/`T()`
  key used anywhere in `public/` now resolves in both `T.tr` and `T.en`
  (595 keys each, no duplicates, no orphans).
- Homepage redesign — search-first, featured cards, paginated results
- Admin UX — save button at top, entity search bar, go-to-top button
- University comparison — side-by-side modal
- Multi-role accounts — admin / affiliate / enduser with JWT (`role VARCHAR(50)`, extensible)
- Affiliate portal + referral tracking (`?ref=CODE`)
- Student portal — saved universities + my inquiries
- Email notifications (SMTP via nodemailer) on new leads
- Lead reply from admin panel with threaded reply history
- Passwordless OTP email sign-in for end users
- Pruned catalog to 5 focus countries — Spain, Netherlands, United Kingdom,
  Germany, Hungary (`scripts/2026-08-09-prune-countries.sql`, soft-deactivated
  via `entities.status='inactive'`, reversible) (2026-08-11)
- Bulk-imported user-supplied catalog export via `/api/bulk/csv-import`
  (2026-09-25): 70 new universities, 70 new locations, 20,865 programs
  across 15 countries (AU, AT, BE, CA, CY, FR, DE, HU, IE, MT, NL, ES, UAE,
  UK, US), all credential levels (Bachelor's/Master's/Diploma/Grad
  Cert/Foundation-Pathway-IYO incl. pre-master/etc.), 0 errors. Credential
  levels now map onto the pre-seeded `program_types` instead of creating
  duplicates (`routes/csvImport.js`). **Note**: this pulls in universities
  from several countries outside the earlier 5-country focus pruning above
  — all created with `status='active'` and live in search. Confirmed
  intentional: the country focus has widened beyond the original 5.
- **Fixed `/programs` filters (2026-09-25)** — root cause: an earlier,
  unlogged bulk import (2026-06-14, 17,829 programs) had created
  `program_types` rows named after raw CSV credential-level strings, all
  silently defaulted to `category='undergraduate'` (no explicit category on
  insert, non-strict MySQL) — this is why the category filter only ever
  showed "undergraduate" and the type-chip row showed confusing duplicates
  (e.g. both "Bachelor Programs" and "Bachelor's Degree"). The 2026-09-25
  CSV import then duplicated most of the same programs under the correctly
  mapped types. One-off cleanup (`routes/catalogCleanup.js`, run once via
  admin API then removed): deduped 15,536 duplicate programs, remapped
  2,149 non-duplicate survivors onto the canonical types, fixed all 7
  affected `program_types.category` values, deleted the 6 now-empty broken
  type rows, reactivated 178 entities that were stuck `status='inactive'`
  from an earlier country-focus prune while still holding active programs,
  and removed **Work & Study** programs entirely (per direction) — also
  skipped going forward in `routes/csvImport.js`. Verified live:
  `/api/public/filter-options` now returns 18 countries, 8 clean program
  types, all 4 correct categories, 23,041 active programs across 334
  universities.
  **Known separate gap, not fixed here**: `programs.field` (discipline tag,
  used for the field-of-study filter chips) is NULL on effectively the
  entire catalog — the "fields" filter has been empty since before this
  session, not something today's import caused. Needs its own pass
  (backfill from the CSV's `Domain` column or similar) if wanted.
- **`programs.field` gap above — fixed (2026-09-26)**: the CSV's "Domain"
  column turned out to be the program's academic subject area (e.g.
  "Business & Economics, Analytics"), not a website domain (an assumption
  briefly and incorrectly acted on — see next bullet). `routes/csvImport.js`
  now writes it straight to `programs.field`; one-off backfill applied it to
  all 23,038 already-imported programs (90 distinct subject areas). The
  "Alan / Fakülte" filter on `/programs` is now populated for the first time.
- **New: per-program source page link (2026-09-26)** — added
  `programs.source_url`: a direct link to that exact program's page on the
  university's own website, editable per-program in the admin panel
  ("Program Page URL" field) and shown as a "view on university website"
  button on both `/programs` cards and university detail pages (falls back
  to the university's own `website_url` if no program-specific link is set
  yet). Piloted end-to-end on Bentley University's 5 programs (real links
  found via search, saved through the API, confirmed live on
  `/api/public/programs?entity_id=353`) — https://paneledu.com/university?id=353
  to check. **Not yet done**: the other ~23,000 imported programs have no
  `source_url` — the CSV export never contained one, so there's no bulk
  shortcut; it has to be found per program (or per university, for
  programs whose page can be found from the university's own listing).
  Scaling this up needs a decision on approach (manual admin entry over
  time vs. a larger automated research pass) — flagged for the user rather
  than run at full scale unattended.
  (Aside, discovered while investigating: an earlier attempt at
  backfilling `entities.website_url` from that same "Domain" column wrote
  garbage into 333 entities' `website_url` before the mix-up was caught;
  rolled back the same session, confirmed no lasting effect.)
- **Investigated the 4 active universities with zero programs** (2026-09-26,
  raised by user re: whether the uploaded Excel is complete):
  - **Alliant International University** — is in the source Excel, but its
    only row is credential level "Work & Study", which the importer skips
    per earlier direction to drop Work & Study programs entirely. Working
    as intended; entity is just an empty shell as a result.
  - **European School of Economics - London** — same story: all 15 of its
    Excel rows are "Work & Study", correctly all skipped.
  - **Constructor University** (id 2, pre-dates this session, 0 programs) —
    turned out to be a **duplicate entity**: the Excel has it as
    "Constructor (Jacobs) University, Bremen" (id 47, 26 programs, already
    live) — confirmed by the user to be the same school under an old name.
    Deactivated the empty id-2 duplicate (`status='inactive'`, reversible)
    and renamed id 47 to the school's current name, "Constructor
    University", for consistency.
  - **Tilburg University** (id 3, pre-dates this session) — genuinely
    absent from the Excel, no name variant found either. Confirmed to the
    user rather than guessed at. Per the user's request, manually researched
    and added its full-time English-taught programs directly from
    tilburguniversity.edu (search-indexed pages, since the site blocks
    direct fetches): **11 Bachelor's + 14 Master's = 25 programs**, each
    with a verified `source_url` to its real official program page. This is
    a solid subset, not Tilburg's entire English-taught catalog (~14
    Bachelor's + 50+ Master's exist in total) — picked the ones confirmable
    with a real, checkable link rather than guessing at the rest. Live:
    `/api/public/programs?entity_id=3` → 25 programs,
    https://paneledu.com/university?id=3 to check.
  - Piloted a second, smaller batch of source_url lookups (CY Tech, KEYCE
    Business School) to test how well this scales beyond well-known
    universities like Bentley: search results for smaller/private schools
    are dominated by third-party aggregators (Mastersportal, educations.com,
    MSM Unify) rather than the school's own site, and even once an official
    domain is found, individual guessed URLs can 404 — one candidate had to
    be discarded after fetch-verification failed. Only saved links verified
    by actually fetching the page (1 of 3 CY Tech programs; the 3 KEYCE
    ones were left unset rather than saving an unverified guess). Confirms
    full-catalog coverage needs either per-link verification (slow) or
    accepting lower confidence for smaller institutions — still awaiting
    direction from the user on which trade-off to take before scaling up.
- **source_url rollout, batch 2 — big/known universities first** (2026-09-27,
  per user direction): for large catalogs (dozens–hundreds of programs per
  university), verifying one specific deep link per program isn't practical
  at reasonable speed, so used a tiered approach:
  - Set `entities.website_url` (verified official domain) for the 19 active
    universities that carry a QS rank — Adelaide, Alberta, UCD, Arizona
    State, Nottingham Trent, Aberdeen, Charles University, Sussex,
    Tasmania, Bangor, Ajman, CQUniversity, Anglia Ruskin University,
    Charles Darwin, American University, Szeged, Oregon State, Australian
    Catholic University — instantly gives every one of their ~2,900
    combined programs a working fallback link (already live via the
    existing UI fallback logic, no further deploy needed).
  - For the smallest of these (**Anglia Ruskin University College** — an
    ARU foundation/pathway partner, real official domain turned out to be
    **arucollege.com**, not aru.ac.uk), went further and set a verified
    per-subject `source_url` on all 23 programs (11 subject pathways ×
    Foundation/First-Year-Degree, e.g. `/undergraduate/law-and-policing/`).
  - Remaining 18 ranked universities (32 to 485 programs each) still only
    have the entity-level fallback link, not per-program deep links — full
    per-program coverage for these would take substantially longer.
  - User asked about offloading this to their own Google AI Plus + a VPS
    agent to save this session's tokens. Checked feasibility: got a Gemini
    API key from the user, confirmed plain generateContent calls work, but
    the Google Search grounding tool (needed for real, non-hallucinated
    URLs) hit `RESOURCE_EXHAUSTED` immediately — grounding needs billing
    enabled on the linked Google Cloud project, separate from the AI Plus
    consumer subscription. User chose not to set up billing; continuing
    the lookups in this session instead with the built-in web search tool.
  - **Charles University** (32 programs, id 183) — went ahead and did full
    per-program `source_url` despite the size, since its 32 programs split
    cleanly across ~9 distinct faculties, each with its own domain (e.g.
    `lf1.cuni.cz`, `mff.cuni.cz`, `fsv.cuni.cz`, `pedf.cuni.cz`,
    `ftvs.cuni.cz`, `ujop.cuni.cz` for the Poděbrady FAST/MedFAST pathway
    programs). All 32 verified via search-indexed official pages, several
    exact per-program pages found (e.g. Computer Science, Economics and
    Finance, History and Area Studies), others linked to the right
    faculty's programme listing page where no single-program page could be
    confirmed. Live: `/api/public/programs?entity_id=183`.
  - **Ajman University** (39 programs, id 264) — single domain (ajman.ac.ae)
    but several different URL path conventions per college (a shared
    `academics/academic-programs-majors/programs/<slug>` catalog path for
    most majors, plus separate `medicine/`, `dentistry/`, `pharmacy/`,
    `engineering/`, `cba/`, `cad/` college-specific paths). Verified 38 of
    39 by actually fetching each candidate page (not just trusting a
    guessed slug — one candidate slug pattern was wrong and had to be
    re-searched, confirming this is worth doing per program). Left
    "Master in Digital Sociology" without a link — no official page found
    for it under any of the tried paths. Live:
    `/api/public/programs?entity_id=264`.
  - **University of Tasmania** (43 programs, id 296) — course pages here are
    keyed by internal course code (e.g. `p3h`, `b3a`, `24v1`), not a
    guessable name slug, so per-program search was unavoidable. Confirmed
    40 of 43 exact course pages (including all 4 joint Maritime Engineering
    variants — standalone, plus partner-university versions with AUT, ECU
    and Flinders). Left 3 unset (Bachelor of Applied Science in Marine
    Engineering, Bachelor of Music ± Honours) — no matching official page
    turned up under any query tried. Live:
    `/api/public/programs?entity_id=296`.
  - **University of Szeged** (57 programs, id 171) — unlike the last two,
    `u-szeged.hu` didn't block automated fetches, so its two central
    listing pages (`/english/bachelor-programmes`,
    `/english/master-programmes`) could just be read directly and gave
    exact links for almost everything in 2 requests instead of dozens of
    searches. Covered all 57, including the Béla Bartók Faculty of Arts'
    two prep courses (on its own `music.u-szeged.hu` subdomain) and the Law
    Faculty's "Gateway" pathway. Live: `/api/public/programs?entity_id=171`.
  - **Central Queensland University (CQUniversity)** (64 programs, id 204) —
    100% coverage. Course codes here (e.g. `cl86`, `700080`) came up
    reliably in search snippets without needing fetch verification, so this
    went faster than Tasmania despite being a bigger catalog. Live:
    `/api/public/programs?entity_id=204`.
  - **University of Alberta** (69 programs, id 239) — 59 of 69 confirmed
    (`ualberta.ca/en/undergraduate-programs/<degree-major-slug>.html`
    pattern, consistent across Business, ALES/Agriculture, Arts and
    Science faculties). Left 10 unset (Ancient and Medieval Studies,
    Chemical and Physical Sciences, Creativity and Culture, Environmental
    Economics and Policy, History, History of Art/Design/Visual Culture,
    Human Geography, Nutrition & Food Science General Program, Performance
    Based Pedagogy, Women's and Gender Studies) — no confirmed dedicated
    page found for these within a reasonable search budget. Live:
    `/api/public/programs?entity_id=239`.

  - **American University** (93 programs, id 107) — 100% coverage. Its
    central `/cas/advising/degrees.cfm` page listed almost every College of
    Arts & Sciences major with a direct link in one fetch; the other
    schools (Kogod Business, SIS, SPA, School of Communication, School of
    Education) needed individual searches. A handful of majors that are
    really specializations within one degree (e.g. Kogod's Management,
    Marketing, International Business) don't have their own page, so those
    point to the school's shared majors-list page instead of a dead-end
    guess. Live: `/api/public/programs?entity_id=107`.

  - **Charles Darwin University** (120 programs, id 198) — 109 of 120
    confirmed (`cdu.edu.au/study/course/<name>-<code>` pattern, code not
    guessable so needed per-program search, but many DB rows are really
    majors/specialisations within one course code — e.g. all 9 "Bachelor
    of Business - X" rows and all 4 "Bachelor of Environmental Science -
    X" rows share their base course's single page). Left 11 unset
    (Associate Degree of Exercise and Sport Science, Bachelor of Digital
    Enterprise, Bachelor of Education Secondary, Bachelor of Health
    Science/Master of Physiotherapy, Bachelor of Medical Laboratory
    Science Honours, Graduate Diploma of Indigenous Policy Development,
    Graduate Diploma of Specialist Education, Master of Arts, Master of
    Education, Master of Nutrition, Master of Pharmacy) — no confirmed
    page found. Live: `/api/public/programs?entity_id=198`.

  - **Australian Catholic University** (126 programs, id 282) — 84 of 126
    (67%). ACU's `acu.edu.au/course/<slug>` URLs are name-derived rather
    than opaque codes (e.g. "bachelor-of-nursing", double degrees as
    "bachelor-of-Xbachelor-of-Y" concatenated with no separator), and this
    held reliably across ~40 verified cases — but the site inconsistently
    indexes some pages with underscores instead of dashes, with no way to
    fetch-verify a guess here (site blocks automated fetches). To stay
    consistent with not saving unverified links, only rows with an actual
    search hit for that exact program got a `source_url`; plausible-but-
    unseen slugs (many similar dual-degree combos, a few standalone majors
    like Bachelor of Occupational Therapy, Bachelor of Creative Arts) were
    left unset rather than pattern-guessed. Live:
    `/api/public/programs?entity_id=282`.

  - **Anglia Ruskin University** (147 programs, id 86) — 115 of 147 (78%).
    `aru.ac.uk` doesn't block automated fetches and its course-search
    results page paginates through the *entire* catalogue (~22 pages),
    each with real names + URLs, so this was read directly rather than
    searched — much faster than a per-program search would have been for
    a catalogue this size. Left 32 unset where the DB's program name
    didn't clearly match anything in the harvested list (mostly narrower
    "Business with X" majors and a few others not offered as their own
    named course). Live: `/api/public/programs?entity_id=86`.

  **Status after this batch**: 11 universities now have real per-program
  links (ARU College, Charles University, Ajman, Tasmania, Szeged, CQU,
  Alberta, American University, Charles Darwin, ACU, Anglia Ruskin
  University ≈ 751 programs), all 19 QS-ranked universities have at least
  an entity-level fallback link. 8 large ranked universities remain
  untouched at the per-program level (Oregon State, Adelaide, UCD, Bangor,
  Sussex, Nottingham Trent, Aberdeen, Arizona State) — these range 162 to
  485 programs each, so covering all of them
  the same way is a multi-session effort, continuing incrementally.

  - **Oregon State University** (162 programs, id 97) — 147 of 162 (91%).
    This catalog turned out to be INTO OSU's pathway-provider listing, not
    a plain OSU export: every Bachelor's row carries an "-International
    Direct" suffix (INTO's direct-entry admission route into a normal OSU
    major), plus 32 rows that are literally INTO's own "Graduate Pathway
    in X" / "Undergraduate Transfer Program - X" tracks (not separate OSU
    degrees at all). Linked the real majors to their actual OSU catalog
    page at `catalog.oregonstate.edu` (the degree itself, not the INTO
    admission route) and pointed all 32 INTO-specific pathway/transfer
    rows at `intoosu.oregonstate.edu/programs`, the one real page that
    describes them. Left 15 unset (Design and Innovation Management,
    Ecampus Business Information Systems, Environmental Sciences,
    General Engineering, German, Management, Radiation Health Physics,
    Speech Communication, Women Gender and Sexuality Studies, Wood
    Innovation for Sustainability, Zoology) — existence confirmed via
    search but no exact catalog page URL surfaced. Live:
    `/api/public/programs?entity_id=97`.

  **Status after this batch**: 12 universities now have real per-program
  links (ARU College, Charles University, Ajman, Tasmania, Szeged, CQU,
  Alberta, American University, Charles Darwin, ACU, Anglia Ruskin
  University, Oregon State ≈ 898 programs), all 19 QS-ranked universities
  have at least an entity-level fallback link. 7 large ranked universities
  remain untouched at the per-program level (Adelaide, UCD, Bangor,
  Sussex, Nottingham Trent, Aberdeen, Arizona State) — these range 205 to
  485 programs each, so covering all of them is a multi-session effort,
  - **University of Adelaide** (205 programs, id 284): 123 saved (60%),
    settled here after several rounds. Adelaide's `degree-finder` uses
    opaque codes (e.g. `bada_bapda.html`) with no derivable pattern, and —
    worth flagging — the University of Adelaide merged with University of
    South Australia into "Adelaide University" on 31 March 2026; confirmed
    the old `adelaide.edu.au` domain and `/degree-finder/` URLs are still
    live under the merged entity. Also discovered a second, newer catalog
    at `adelaide.edu.au/study/degrees/<name-slug>/` from the post-merger
    site — cleaner and name-derived, but several programs were renamed in
    the merger (e.g. old "Bachelor of Criminology" → new "Bachelor of
    Criminology and Criminal Justice"), so it's only used where a clear
    match to our catalog's existing (pre-merger) program name was
    confirmed, not assumed. Remaining ~80 unset mostly need more targeted
    per-program searches than the ones tried so far turned up. Live:
    `/api/public/programs?entity_id=284`.

  - **University College Dublin** (238 programs, id 226) — 100% coverage,
    fastest of any large university this session. Every UCD program name
    in our catalog already carries UCD's own official programme code in
    parentheses at the end (e.g. "... (BSS3)", "MSc Finance FT (B269)"),
    and confirmed via search that `ucd.ie/courses/<code lowercased>` is
    UCD's own stable course-page URL keyed on that exact code (their
    admissions/CAO systems use the same codes as primary identifiers) —
    so instead of searching per program, extracted the code straight from
    each DB row's own name and built the URL directly, verified against
    a handful of codes via search before trusting the rest. Note: UCD also
    has prettier name-based aliases for some courses (e.g.
    `ucd.ie/courses/msc-behavioural-neuroscience`) that coexist with the
    code-based ones — used the code-based form throughout since it's the
    one guaranteed to exist for every program, not just the marketed few.
    Live: `/api/public/programs?entity_id=226`.

  - **Bangor University** (256 programs, id 60) — 210/256 overall (82%):
    Masters 90/96 (94%), Bachelor's 120/160 (75%). Two distinct methods per
    level since Bangor uses two different URL schemes:
    - *Masters*: direct slugify + fetch-verify loop against
      `bangor.ac.uk/courses/postgraduate-taught/<slug>`, retrying 301s
      (follow `Location`) and transient 403s with backoff; final 6 holdouts
      left unset rather than guessed.
    - *Bachelor's*: UCAS codes aren't embedded in our DB names here (unlike
      UCD), so instead harvested the full undergrad catalog by paging
      `bangor.ac.uk/courses?level_of_study=wt_undergraduate_programme&page=N`
      (11 pages) into a Name→URL table, then matched by normalizing both
      sides (stripping degree-type tokens/parentheticals, mapping
      Cymraeg↔Welsh) — got 104/160 this way, then closed most of the rest
      with targeted `WebSearch` hits for the remaining single-subject and
      joint-honours names.
    - **New failure mode found and handled**: a chunk of the WebSearch-
      matched URLs turned out to be real, Google-indexed Bangor pages that
      still 403 — but on inspection the response body is Bangor's own
      themed Drupal **"Access Denied"** page (`<title>Access denied |
      Bangor University</title>`, live `node/<id>` path), not a WAF/rate-
      limit block — confirmed by (a) re-checking a known-good URL
      immediately after in the same session still returning 200, and (b)
      fetching the same blocked URL from a second, independent network
      path (`WebFetch`) and getting the same 403. These are genuinely
      **discontinued/closed-admissions courses** still indexed by Google
      (one page explicitly said "not accepting Sept 2024 entry, see X
      instead"). Treated exactly like an unverifiable link: reverted all
      31 such matches (25 access-denied + 4 redirect-loop-to-nowhere + 2
      hard 404s) back to unset rather than keep a link that shows visitors
      an error page. Live: `/api/public/programs?entity_id=60`.

  - **University of Sussex** (264 programs, id 157) — 235/264 (89%).
    `sussex.ac.uk` isn't bot-blocked at all, so this one was pure
    slugify + direct-fetch-verify (`/study/undergraduate/courses/<slug>`
    and `/study/masters/courses/<slug>`), no search needed for the bulk of
    it — 263/264 on the very first pass. One caught-late bug worth noting
    for future universities: the verify loop originally followed redirects
    up to N hops and accepted whatever it landed on as "verified", but a
    wrong/stale slug on this site 302-redirects to the **generic**
    `/study/masters/courses` or `/study/undergraduate/courses` listing
    page, which itself then 200s — so "followed a redirect to a 200" is
    **not** proof of a real program page. That silently saved 60 programs
    pointing at the bare listing page instead of their own course. Caught
    it by spot-checking a saved URL and finding it 302'd when re-fetched
    without redirect-following; fixed by re-verifying with **no** redirect
    stored 200 (any 30x = fail), reverted the 60 bad saves, and reran.
    Recovered 29 of them (19 were integrated-masters degrees — MSci/MPhys/
    MChem/MEng/MMath — which Sussex files under `/undergraduate/courses/`
    even though our DB tags them "Master Programs"; 10 were subject-area
    names in our catalog, e.g. "Media and Communications", that map to
    Sussex's `/study/subjects/<slug>/masters` hub page rather than a single
    course). Remaining 29 unset: mostly single MA/MSc titles that Google
    still has indexed at a specific-looking URL but which 302 to the
    generic listing on the live site right now (re-confirmed via a second,
    independent fetch path) — same "stale index, dead/changed live page"
    situation as Bangor, left unset rather than guessed. Live:
    `/api/public/programs?entity_id=157`.

  - **Nottingham Trent University** (314 programs, id 162) — 219/314 (70%):
    Bachelor's 139/193 (72%), Master's 80/121 (66%). `ntu.ac.uk`'s WAF
    returns 403 to every direct fetch from this environment (plain curl,
    WebFetch, even a Googlebot UA), so unlike Bangor/Sussex/Adelaide above
    there was no fetch-verification path available at all — this one was
    pure `WebSearch`-title-match end to end: only saved a URL when the
    search result's own title named the exact program and degree type,
    batching 2-4 program names per query. Several systematic near-misses
    worth flagging for whoever continues this: (a) three DB rows specify
    "BA (Hons)" for what NTU's live site titles "BSc (Hons)" — Economics,
    Economics with Business, Economics with International Finance and
    Banking — left unset rather than save a wrong degree-type match;
    (b) a handful of DB program names carry old NTU titles that have since
    been renamed or discontinued (Childhood (SEN and Inclusion) → renamed
    "Special Educational Needs, Disability and Inclusion"; the three
    "Global Studies and X" joint honours — History, International
    Relations, Media — confirmed discontinued after September 2022; IT
    Security MSc → renamed "Cyber Security MSc"; "Human Rights and Justice
    LLM" → shortened to "Human Rights LLM", which the *other* DB row of
    that same name matched instead) — left the stale-named entries unset
    each time rather than assume the rename. The session's built-in
    WebSearch budget (200 calls) ran out partway through the alphabet, at
    "Property Development and Planning" — the remaining ~14% of the
    catalog (Psychology cluster through Zoology, roughly items 271-314)
    wasn't attempted this session; a follow-up session can pick up there.
    Live: `/api/public/programs?entity_id=162` —
    https://paneledu.com/university?id=162 to check.

  - **Arizona State University** (485 programs, id 101) — 481/485 (99%):
    Bachelor's 294/297 (99%), Master's 187/188 (99%), by far the largest
    university in this project's backlog. `asu.edu`/`degrees.asu.edu` isn't
    bot-blocked, but the real time-saver was `https://degrees.asu.edu/
    sitemap.xml` — a single fetch that lists **every** live degree page
    (507 bachelor's `/bachelors/major/<college>/<code>/<slug>` URLs + 829
    `/masters-phd/major/<college>/<code>/<slug>` URLs, the latter mixing
    Master's and PhD pages under one path). That turned this into a mostly
    offline slug-matching problem against our 485 DB rows instead of ~485
    individual WebSearches — the whole catalog was resolved without using
    WebSearch at all, then every one of the 461 distinct candidate URLs was
    still direct-fetched (all 200) and its page `<h1>` compared token-by-
    token against the DB program name/degree type before saving, per the
    non-negotiable verify rule. Notable finding worth flagging since it's
    unique to ASU in this project so far: **the DB's degree-type prefix is
    reversed** vs. every other university here — rows read "BA American
    Studies" / "MS Statistics" (degree first) instead of the usual
    "American Studies BA" suffix style, so matching had to strip the
    leading token and degree-check against the *end* of the fetched page's
    `<h1>` (e.g. "American Studies, BA") rather than the start. Two other
    ASU quirks surfaced during matching: (a) our DB's whole "Digital
    Culture" family (10 rows, base + 9 concentrations) is ASU's renamed
    "Media Arts and Sciences" program on the live site — slugs and titles
    read "media-arts-and-sciences[-concentration]", not "digital-culture"
    anywhere, caught only by noticing the slug-similarity score was ~0 for
    all 10 and manually cross-referencing the school's major list; (b) most
    "LLM Master of Laws (<concentration>)" DB rows (Business Law, Criminal
    Law, Health Law, Indian Gaming, International Law, Patent Practice,
    etc. — 11 of 17) don't get their own page at all, they're all
    concentrations documented on ASU's single general `laws-llm` page,
    while 3 concentrations (Biotechnology and Genomics, Global Legal
    Studies, Tribal Policy/Law/Government) do have their own distinct LLM
    pages — verified via each page's own content, not assumed. Left unset
    rather than guessed (4 programs): BA Environmental Science and BA
    Statistics (ASU's site only has BS versions of both under those exact
    subject names — no BA-titled page exists), MM Music Composition (only
    a DMA Music Composition page exists), and BS Food and Nutrition
    Entrepreneurship (no matching page found under nutrition, food, or
    entrepreneurship listings). Live: `/api/public/programs?entity_id=101`
    — https://paneledu.com/university?id=101 to check.

  - **University of Aberdeen** (433 programs, id 251) — 405/433 (93.5%):
    Bachelor's 299/301 (99.3%), Master's 106/132 (80.3%). `abdn.ac.uk` isn't
    bot-blocked, but the real discovery this time was Aberdeen's **"flexible
    degree" curriculum**: undergrads pick a main subject and can combine it
    with dozens of others, so the DB carries huge families of separate rows
    ("Accountancy", "Accountancy and French", "Accountancy and German", …)
    that don't get their own page on Aberdeen's site — only the single
    subject-area page for the *leading* subject does. Rather than searching
    all 301 Bachelor's rows individually, grouped them by leading subject
    first (95 distinct groups after handling DB spelling/hyphenation
    inconsistencies and a handful of atomic exceptions — e.g. "Molecular and
    Cellular Biology", "Philosophy, Politics and Economics", the Engineering
    family — whose own "and" isn't a joint-honours separator), searched and
    fetch-verified one URL per group, then bulk-applied it to every member
    row. This cut ~301 lookups down to ~95 and got Bachelor's to 99% (the 2
    holdouts — Mechanical Engineering with Biomechanics/with Subsea
    Technology — confirmed absent from Aberdeen's own live degree listing,
    left unset). Also found and reused Aberdeen's own site-search endpoint
    (`/study/undergraduate/degree-programmes/?q=<terms>&view=detailed`) to
    resolve tricky families like all 12 "Law with options in X" degrees and
    the 6 International Business language variants, each of which turned
    out to have its own dedicated page after all. Master's programmes are
    each individually named (no flexible-degree grouping), and a full fetch
    of Aberdeen's own postgraduate-taught listing page
    (`degree-programmes/?view=detailed&limit=All`) gave name→URL pairs
    directly for 99 of 132 in one shot; the rest needed per-program
    WebSearch. **Repeat of the Sussex pitfall, worth flagging again**: for
    the remaining ~25 Master's names, several old numeric-ID URLs found via
    search now 301-redirect to a *different*, live, 200-OK page — e.g.
    "Archaeology of the North" → generic "Archaeology"; "Comparative
    Literature" → renamed "Literatures, Environments and Places"; "Health
    Psychology" → merged into "Applied Health Sciences"; "Biomolecular
    Archaeology" → "Bioarchaeological Science"; several School-of-Biological-
    Sciences programmes (Ecology and Conservation, Environmental Science)
    now redirect to a generic "Exciting Changes Coming to Our Postgraduate
    Degrees in 2026" announcement page. All of these are genuinely
    discontinued/renamed programmes, not save-able matches — caught by
    always following redirects and checking the *final* URL/title, not the
    searched one, then left unset. One exception where a single umbrella
    page legitimately covers several DB rows: Aberdeen's MSc "Strategic
    Studies" page explicitly names its three pathways — Energy Security,
    International Law, Management — in the page body, so those 3 DB rows
    correctly point at that one shared page; a 4th DB row, "Strategic
    Studies and Diplomacy", isn't one of the named pathways and was left
    unset rather than assumed. Session also hit a mid-task infrastructure
    hiccup — the sandbox's Bash container reset partway through, losing all
    local scratch files (intermediate URL lists, save-tracking) though the
    97 programs already PUT to the live API by that point were unaffected;
    recovered by re-querying the live API for already-saved rows and
    rebuilding from there rather than restarting, which is also how the
    "Comparative Literature" redirect above got caught on a second pass.
    Live: `/api/public/programs?entity_id=251` —
    https://paneledu.com/university?id=251 to check.

  **Status after this batch**: 18 universities now have real per-program
  links (ARU College, Charles University, Ajman, Tasmania, Szeged, CQU,
  Alberta, American University, Charles Darwin, ACU, Anglia Ruskin
  University, Oregon State, Adelaide, UCD, Bangor, Sussex, Nottingham
  Trent, Arizona State University, Aberdeen), all 19 QS-ranked universities
  have at least an entity-level fallback link. That closes out this
  project's backlog of large ranked universities queued for per-program
  `source_url` coverage.

- **source_url rollout, batch 4 — pathway-provider colleges (2026-09-30)**:
  switched focus from direct-entry universities to the **Navitas, Kaplan
  and INTO pathway/foundation colleges** in the catalog (Study Group has
  no separately-named entity in our catalog currently — its partner
  universities, e.g. Aberdeen/Surrey/Sussex, are only present as the real
  direct-entry university, already covered above). Identified the correct
  set first by cross-referencing our 335 entity names against each
  provider's own official partner-college list (`navitas.com/study/
  colleges-campuses`, `kaplanpathways.com`, `intostudy.com`) rather than
  guessing from name patterns — this caught that "University of Aberdeen"
  and "University of Sussex" in our catalog are the real universities
  (confirmed: genuine BSc/MSc-named degrees matching the university's own
  site), not Study Group's foundation-year catalog, so no cross-contamination
  there.
  - **19 Navitas colleges** (UK: Birmingham City International College,
    Brunel Pathway College, Hertfordshire, International College Portsmouth,
    Robert Gordon, Keele, Plymouth; Canada: Fraser International College
    (SFU), Manitoba, Toronto Metropolitan, ULethbridge Calgary, Wilfrid
    Laurier; Netherlands: Twente Pathway College; Australia: Deakin
    College; plus ARU College, already 100% from a prior session) — each
    college's own course-listing page was harvested directly (all
    fetchable, no WAF blocks) and matched to our DB's Foundation/First-
    Year/Pre-Master's rows by subject, since these colleges group programs
    by broad subject area rather than by individual named degree.
    **Fraser International College is the one exception**: entity name
    says "(SFU)" but roughly 55 of its 71 DB rows turned out to be **real
    Simon Fraser University major names** (Accounting, Economics,
    Psychology, etc.) rather than FIC's own pathway pages — SFU confirmed
    these are BBA/degree *concentrations*, most without a standalone
    admissions page, so they were linked to SFU's own official A-Z program
    list (`sfu.ca/students/admission/programs/a-z/...`) instead of FIC's
    site, while FIC's actual ~16 "University Transfer Program" rows went to
    fraseric.ca. One Navitas partnership is confirmed **discontinued**:
    Leicester Global Study Centre's Navitas partnership ended September
    2024 — no live page exists anywhere for its 5 DB rows, left unset
    rather than link an archived/dead page.
  - **Kaplan Business School** (Australia, a Kaplan-owned school in its own
    right, not a pathway into another university) — 28/28 (100%), via
    Kaplan's own course directory page giving direct `/node/NNNN` links
    for every program, each verified live.
  - **INTO London** and **INTO Manchester** — INTO's own course pages
    live on `intostudy.com` under a university-slug path; discovered
    mid-task that INTO Manchester's granular old foundation names (8 DB
    rows: Aerospace/Chemical/Civil Engineering, Biosciences, Humanities
    and Social Sciences, Maths and Computer Science, Mechanical and
    Electrical Engineering, Pharmacy, Physical and Natural Sciences,
    Psychology) are still individually live today, just filed under the
    `the-university-of-manchester` slug rather than `into-manchester` —
    8/8 matched exactly once that was found. INTO London's older
    duration-variant rows (standard/extended terms of the same course)
    correctly share one URL each, matching this project's established
    precedent for that pattern.
  - **Overall for this batch: 287/308 (93%)** across all Navitas + Kaplan
    + INTO entities. Left unset: Leicester (5, partnership ended), TMUIC's
    Hospitality/Tourism and Professional Communication (2, no current
    page found), Brunel's Design foundation (1, no current page found),
    and 11 FIC "Bachelor Programs" rows too loosely defined to confidently
    match a specific SFU page (Behavioral Sciences, Computer Graphics and
    Multimedia, Environmental Health and Toxicology, Health Education,
    International Health, Media and Culture, Nutrition, Political Economy
    and Policy, Public Health Program Management, Visual Culture and
    Performance Studies, Technology and Society — this last one's search-
    indexed URL now 404s, a stale-index case like earlier universities in
    this project).

- **source_url rollout, batch 5 — SRH University Germany, all 9 campuses
  (2026-09-30)**: first org-cluster batch in this project — instead of one
  university, covered every SRH University campus entity in the catalog
  (Berlin 71, Cologne 4, Dresden 9, Fuerth 3, Hamburg 10, Heidelberg 23,
  Leipzig 6, Munich 9, Stuttgart 4 = 139 programs, verified via the admin
  API before starting; all had `source_url` unset). **Overall: 93/139
  (66.9%)**.
  - All 9 campuses share one unified site, `srh-university.de` — SRH merged
    5 previously independent SRH universities into this single domain in
    2024, and each program has one canonical page (`/en/<bachelor|master|
    mba>/<slug>/<code>/`) whose own subtitle line (e.g. "Bachelor of Arts |
    Berlin, Heidelberg, Leipzig") lists every campus that actually offers
    it — used as the ground-truth per-campus confirmation, always read from
    the raw fetched HTML (`curl`+`grep`) rather than trusted from a
    WebFetch/WebSearch summary, several of which turned out to hallucinate
    plausible-sounding "Location:" values not actually present on the page.
  - **Berlin 64/71 (90%), Dresden 9/9 (100%), Leipzig 5/6 (83%), Heidelberg
    15/23 (65%)** — harvested from each campus's own `/en/our-campuses/
    <city>/` page (Berlin) and `/en/programme-finder/locations/<city>`
    (Dresden, Heidelberg, Leipzig), which return clean name+URL lists
    server-rendered (no JS needed), then bulk-matched to DB rows by name
    and verified per-URL via direct fetch. Left unset: Berlin's Bachelor
    "User Experience Design & Content Creation" (its guessed URL 301-
    redirects to an unrelated program page — the same known "redirects to
    a generic/other page" pitfall this project has hit before), BSc
    Computer Science – Healthcare Management, Executive MBA General
    Management, Sustainable Battery Production Engineering, two Supply-
    Chain/Hotel-Management rows whose DB names don't match any current
    Berlin page; Heidelberg's Water Management/Technology, Blockchain
    Technology, International Business & Engineering, Global Business and
    Leadership (2 rows) and International Management and Leadership — all
    six of these last Heidelberg names return 404 or redirect to a generic
    category page on the current site, i.e. genuinely discontinued/
    renamed, not guessable; Leipzig's Automotive-Technology-and-Management
    IBA specialization (no page on `srh-university.de`, only on the
    separate `apply.srh.de` application portal, which isn't a program's own
    descriptive page).
  - **Cologne, Fuerth, Hamburg, Munich, Stuttgart: 0/30 (0%) — not a
    coverage gap, a real closure.** WebSearch turned up SRH's own 2026-08-04
    announcement (`srh-university.de/en/folder/news/2026/08-26/srh-
    university-to-realign-its-strategy/`): SRH is closing six locations
    (Bremen, Fürth, Hamburg, Cologne, Munich, Stuttgart) by end 2027/spring
    2028, no new enrolment from winter 2026/27, consolidating around five
    core sites (Berlin, Dresden, Gera, Heidelberg, Leipzig). This matches
    what the live site shows first-hand: each of these 5 campuses' own
    `/en/our-campuses/<city>/` page now states "Applications no longer
    possible at Campus <city>", the programme-finder returns no results
    filtered to them, and every DB program name for these 5 campuses that
    still has a live page on the unified site now lists only a *different*
    (surviving) campus in its own "Location:" line — e.g. Munich's B.A.
    Computer Science page says "Berlin, Heidelberg, Leipzig", not Munich.
    Several plausible guessed/search-indexed URLs for these rows do return
    HTTP 200, but only by redirecting to a generic category-listing page
    that doesn't name the specific campus — caught and rejected per this
    project's standing pitfall check, confirmed via raw HTML rather than
    tool summaries. Left unset rather than saved.
  - Live test links: `https://paneledu.com/university?id=42` (Berlin),
    `?id=323` (Cologne), `?id=43` (Dresden), `?id=322` (Fuerth), `?id=44`
    (Hamburg), `?id=45` (Heidelberg), `?id=321` (Leipzig), `?id=320`
    (Munich), `?id=287` (Stuttgart).

- **source_url rollout, batch 6 — Hungary, all universities (2026-09-30)**:
  first **country-based** batch rather than a named-university or org-cluster
  one — covered every Hungarian university in the catalog other than
  University of Szeged (already 100% from a prior session). Verified counts
  via the admin API before starting: 294 Hungary rows total, 237 across the
  9 target universities, all `source_url` unset. **Overall: 220/237 (93%)**.
  - **Budapest University of Economics and Business** (9, id 366) — 9/9
    (100%), **Hungarian University of Sports Science** (5, id 318) — 5/5
    (100%), **McDaniel College Budapest** (8, id 91) — 8/8 (100%), **Obuda
    University** (22, id 364) — 22/22 (100%): each university's own English
    site was reachable (not bot-blocked) and had either a per-program page
    or, for Obuda specifically, one unified long-form page per degree level
    (`/undergraduate-programs/`, `/graduate-programs/`) that lists every
    programme inline with no separate per-slug URLs — used as-is since it's
    still each program's genuine, specific description on the university's
    own site, not a generic listing page. McDaniel's three Pre-Medical DB
    rows (Extended/Intensive/Year) all point at one page,
    `mcdaniel.hu/home/pre-med-program/`, which explicitly documents all
    three track variants in its own body text.
  - **Budapest Corvinus University** (41, id 173) — 38/41 (93%): the live
    `uni-corvinus.hu` site is bilingual via `?lang=en` on the same URL
    (confirmed by title-checking each page, e.g. "Nemzetközi gazdálkodás"
    →"International Business"). A single fetch of the school's own masters-
    programme directory page yielded direct bachelor's/master's slugs for
    36 of 41 rows in one shot; the remaining 5 (two MBAs, Diversity &
    Inclusion Management MSc, Preparatory Programme) were resolved
    individually via WebSearch. Left unset: "MSc in General Management" (an
    older/duplicate-looking DB row with no live page of that exact name —
    the current "MSc Management" page never uses "General Management" as an
    alt title, so not assumed to be the same program) and "Full-time MBA" /
    "MSc in Diversity and Inclusion Management" (both had search-indexed
    URLs that now redirect to unrelated pages — the "redirects to a generic
    page" pitfall — confirmed via raw HTML, not saved).
  - **Budapest Metropolitan University** (34, id 170) — 31/34 (91%): the
    site's `/en/kepzesek` listing is a Next.js page that only server-renders
    ~12 items at a time, so the full catalog was reconstructed by querying
    its own filter combinations (`?kepzesi_szint=<alapkepzes|mesterkepzes>
    &kepzesi_terulet=<uzlet|muveszet|turizmus|kommunikacio>`) across both
    degree levels and all 4 subject areas. **Caught the known pitfall
    directly**: several plausible guessed slugs (e.g.
    `human-resource-counselling-ma`, `business-development-msc`) all
    returned HTTP 200 but were confirmed to be an identical ~117KB soft-404
    React shell (checked via response byte-size, not just status code) —
    left unset rather than saved. One shared preparatory-programs hub page
    (`/en/preparatory-programs`) legitimately covers 5 DB rows (English
    Preparatory Program, Intensive Preparatory Program, Pre-Master for
    Business/Communication, Professional Foundation for Art/Business
    Programs) since its own body text has a distinct section for each.
  - **International Business School (IBS) Budapest** (28, id 172) — 22/28
    (79%): full bachelor's + postgraduate catalogs harvested directly from
    `ibs-b.hu`'s own programme-listing pages. Notable finding: DB rows named
    "MSc in Strategic International Management with Finance/Marketing/AI
    and Cybersecurity" turned out to correspond to pages whose own URL slugs
    read differently (`msc-in-strategic-finance`, `msc-in-strategic-
    marketing`) — confirmed via each page's `og:title` meta tag, which does
    read "MSc in Strategic International Management with Finance" etc.,
    matching the DB exactly even though the URL doesn't. Left unset (6):
    MBA in Strategic Data-Driven Management, MSc Business Administration and
    Management, MSc International Business Economics, MSc Strategic Human
    Resource Management, and the "with Human Resource Management" / "with
    Hospitality" specialisations of Strategic International Management —
    all of these are referenced by name in the site's own newsletter-signup
    checkbox list (confirming the programs exist) but every guessed/
    search-indexed URL for them returns a genuine 404, not a live page.
  - **Pecs University** (89, id 174) — 84/89 (94%), by far the largest
    university in this batch: `international.pte.hu/study-programs/<slug>`
    resolved almost the whole catalog from one WebFetch of the site's own
    full program-directory page, which lists Bachelor's, Master's, one-tier
    and doctoral programmes with direct links. Left unset (5): "BA Classical
    Music" (the DB name is a generic label — the actual site only has
    instrument-specific pages: Piano/Guitar/Flute/Violin/Viola — no single
    page it unambiguously maps to), and BSc Electrical Engineering, BSc
    Mathematics, MSc Applied Mathematics, and MSc Nursing APRN (Emergency
    Care) — all four have a real, findable URL slug on the site, but every
    one of them currently serves an actual "Access denied" page (HTTP 403,
    confirmed by title-checking the raw response, not just the status code)
    rather than a soft-404 — i.e. genuinely unpublished/restricted pages,
    not guessable.
  - **University of Veterinary Medicine, Budapest** (1, id 90) — 1/1 (100%):
    `univet.hu/en/education/undergraduate-program/`, confirmed by title and
    body content.
  - Live test links: `https://paneledu.com/university?id=173` (Corvinus),
    `?id=170` (Metropolitan), `?id=366` (BGE), `?id=318` (Sports Science),
    `?id=172` (IBS), `?id=91` (McDaniel), `?id=364` (Obuda), `?id=174`
    (Pecs), `?id=90` (Veterinary Medicine).

- **source_url rollout, batch 7 — Czech Republic, all universities
  (2026-09-30)**: second country-based batch — covered every Czech
  university in the catalog other than Charles University (already 100%
  from a prior session). Verified counts via the admin API before
  starting: 172 Czech Republic rows total, 140 across the 7 target
  universities, all `source_url` unset. **Overall: 132/140 (94%)**.
  - **Brno University of Technology** (14, id 232) — 14/14 (100%),
    **Technical University of Liberec** (12, id 234) — 12/12 (100%),
    **Palacky University** (6, id 182) — 6/6 (100%), **Charles University
    - First Faculty of Medicine in Prague** (2, id 230) — 2/2 (100%): all
    four resolved fully. VUT and TUL both publish a central "English
    programmes" catalogue page per faculty/level on their own domain
    (`vutbr.cz`/`tul.cz`) with direct per-program links, harvested and
    matched by name in one pass each.
  - Palacky confirmed the project's known **pathway/foundation-year
    pitfall in reverse**: its "Petroleum Engineering" bachelor+master rows
    turned out to be a real, direct-entry degree — just run out of a
    satellite site (`petroleum.upol.cz`) covering a joint programme in
    Erbil/Olomouc — not a mislabeled pathway provider.
  - Charles University - First Faculty of Medicine's two rows
    ("MedCOMPLEX", "MedFAST (November intake)") **are** the pathway-
    provider pattern confirmed directly this time: these aren't the
    faculty's own program names anywhere on its site — they matched
    ÚJOP UK (Charles University's own Institute for Language and
    Preparatory Studies) foundation-year tracks "Medicine in English
    COMPLEX" (September intake) and "Medicine and Pharmacy in English
    FAST" (November intake) on `ujop.cuni.cz`, confirmed by intake month
    matching exactly. Still Charles University's own institute (not a
    third-party college), so saved as the direct, specific page.
  - **Prague University of Economics & Business** (14, id 236) — 13/14
    (93%): `admissions.vse.cz` and `vse.cz/english` between them list
    every bachelor's and master's programme with a direct subdomain link
    (`bba.vse.cz`, `ibb.vse.cz`, etc.) or a `vse.cz/english/study-at-vse/
    master-programmes/<slug>/` page. Left unset: "Management in Creative
    Industry" — the closest live programme, the Department of Arts
    Management's "Arts Management", is explicitly Czech-language only on
    its own site, not the same English-medium program our DB row names.
  - **Czech Technical University** (37, id 233) — 36/37 (97%): CTU's many
    faculties (FEL, FIT, FS, FA, FJFI, FD, FBMI, FSv, MIAS) each publish
    their own English-programme page; FJFI in particular has one clean
    listing page per degree level covering all 8 of its master's fields
    (Mathematical Physics, Nuclear and Particle Physics, Nuclear
    Engineering, Physical Electronics, Solid State Engineering, Plasma
    Physics and Thermonuclear Fusion, Quantum Technologies, Nuclear
    Chemistry) by exact name. Two MIAS rows ("Project and Process
    Innovation Management", "Sustainability and Climate Change
    Innovations") share MIAS's one Innovation Project Management MSc page
    since both are specialisation tracks within that single program, not
    separate pages. Left unset: "Nuclear Sciences and Physical
    Engineering" (bachelor) — no FJFI bachelor field carries this exact
    name (the closest, "Physical Engineering", is a distinct, separately-
    accredited program), so not assumed to be the same row.
  - **Ostrava Technical University** (55, id 235) — 49/55 (89%), the
    largest university in this batch: `vsb.cz`'s own central bachelor's
    and master's catalogue pages (`/degree-studies/<level>-degree/`) list
    every English-taught programme faculty-by-faculty with a
    `programmeId` query-string link, resolved and bulk-verified by
    fetching each page's own `<h1>Study programme ...</h1>` and confirming
    it matched the DB name exactly (49/49 verified, 0 mismatches). Left
    unset (6): "Applied Sciences and Technologies" and "Engineering"
    (bachelor) and "Petroleum Engineering" (bachelor) have no current
    catalogue entry under those names (Petroleum Engineering is
    master-only at VSB now); "Applied Mechanics" (master) is currently
    offered only as a *branch* inside the "Design and Simulation of
    Machines" programme, not its own page; "Information and Communication
    Security" and "Brownfields Technical Redevelopment" (both master) have
    stale search-indexed pages that return `programme not found` when
    fetched directly — genuinely discontinued, not guessable.
  - Live test links: `https://paneledu.com/university?id=232` (Brno UT),
    `?id=230` (Charles University FFM), `?id=233` (CTU), `?id=235`
    (Ostrava TU), `?id=182` (Palacky), `?id=236` (VSE), `?id=234` (TUL).

- **source_url rollout, batch 8 — Germany (non-SRH), 18 private/international
  universities (2026-09-30)**: third country-based batch — covered every
  German private/international university in the catalog other than the 9
  SRH University campuses (batch 5, separate agent) and pathway-provider
  colleges already covered elsewhere. Verified counts via the admin API
  before starting: exactly 400 rows across the 18 target entities, all
  `source_url` unset. **Overall: 355/400 (88.8%)**.
  - **Berlin International University of Applied Science (11) — 11/11
    (100%) and Whitecliffe University of Applied Sciences (11) — 11/11
    (100%)**: solved together — `berlin-international.de` 301-redirects to
    `whitecliffe.de` (a straight rebrand, confirmed by fetching the live
    site), and both catalog entities carry an *identical* 11-program list
    with sequential-but-separate DB ids, so both point at the same
    `whitecliffe.de/en/programs/<slug>/` pages.
  - **XU Exponential University (6) — 6/6 (100%)**, **Munich University of
    Digital Technologies/MUDT (6) — 6/6 (100%)**, **GISMA University Berlin
    (11) — 11/11 (100%)**, **Fresenius University of Applied Sciences (25)
    — 25/25 (100%)**, **Lancaster University Leipzig (15) — 15/15 (100%)**:
    all fully resolved via each institution's own program-listing pages
    (`xu-university.com`, `uni-munich.de`, `gisma.com/programmes`,
    `hs-fresenius.com/study-programs/`, `lancasterleipzig.de/study/`).
    Fresenius notably splits its fashion/design programmes onto a sister
    domain, `amdnet.com` (AMD Akademie Mode & Design, same corporate group)
    — confirmed via redirect chains from the Fresenius pages themselves,
    not guessed. Lancaster's shared Foundation and Pre-Master's pages each
    legitimately cover both a Business and a Computer Science DB row (one
    page, two tracks documented in its own body text).
  - **Constructor University (26) — 24/26 (92%)**: full bachelor's +
    master's catalogue harvested in two page-fetches from
    `constructor.university/programs/{undergraduate,graduate}-education`.
    Left unset: "BSc Data Science and Software Development" and "MA
    International Relations" — both older/legacy DB names with no current
    page of that exact title (the live MA in IR is a joint program with
    University of Bremen, not on Constructor's own program listing).
  - **University of Europe for Applied Sciences/UE Germany (55) — 53/55
    (96%)**: resolved almost the whole catalog in one shot from the site's
    own `programme-sitemap.xml` (WordPress/Yoast), which lists every
    bachelor/master/MBA/pre-course page directly — far faster than
    per-program search. "Corporate Management MSc" only has a live page in
    German (`/de/studiengaenge/master/corporate-management`), used anyway
    since it's still the program's own specific page. Left unset: "Creative
    Computing MA" (no matching page found) and "Digital Product Management
    BA" (its guessed URL redirects to the generic `/programmes` listing —
    the known pitfall, caught and rejected).
  - **Berlin School of Business and Innovation/BSBI (57) — 55/57 (96%)**,
    the largest single institution in this project so far: same
    sitemap-first approach on `berlinsbi.com/programme-sitemap.xml` (68
    program URLs enumerated directly). Several catalog rows only differ by
    academic partner (UCA, Uninettuno, Chichester, Roehampton, Concordia
    University Chicago) sharing near-identical names — resolved by
    following each partner-specific redirect to its own distinct page
    (e.g. `global-mba-uninettuno` → `global-mba-hamburg-chichester`,
    confirming a partnership rebrand) rather than assuming one generic
    page covers all partners. Left unset: "BA Economics and Business
    Administration" (its URL redirects into a broken `/programmes/
    licenciaturas/` path that itself 404s) and "Fashion & Luxury Brand
    Management Professional Master (BSBI)" (sitemap-listed URL 404s
    live despite being indexed).
  - **Macromedia University (29) — 26/29 (90%)**: resolved via the site's
    bachelor/master "all-courses" listing pages plus a few targeted
    searches for programs outside that index (Acting, Design B.A.,
    Management B.A.). Left unset: "Acting B.A." (its own cluster page now
    lists only Filmmaking — the program appears discontinued), "Design
    Management MA" and "UI/UX Design B.Sc." (both now 404/merged into
    other specializations, confirmed via direct fetch of the live cluster
    pages, not just search snippets).
  - **MDH University of Applied Sciences (21) — 18/21 (86%)**: MDH is
    Mediadesign Hochschule (confirmed by the exact program-name match: Art
    Market Management, Digital Film Design, Legal Tech, etc.) —
    `mediadesign.de/en/{bachelor,master}/` listing plus targeted searches
    for its Information Technology specialisation tracks. Left unset: the
    IT bachelor's "Artificial Intelligence and Data Analytics" and
    "Network Engineering and Cyber Security" tracks and the IT master's
    "Front-end Development and Usability" track — all three now redirect
    to the generic IT program page rather than a specific track page.
  - **Munich Business School (17) — 16/17 (94%)**: `munich-business-school.
    de`'s Master in International Business page documents 7 named
    specialisation sub-pages (Luxury Management, Corporate Finance, Global
    Family Business, etc.) each with its own URL, matched directly. Left
    unset: "Master International Business | Finance" — an old-style
    legacy DB name that's genuinely ambiguous between two current, already-
    used pages (the standalone "Master in Finance" and the "Corporate
    Finance" specialisation), not assumed to be either one.
  - **Schiller International University - Heidelberg (14) — 13/14 (93%)**:
    `schiller.edu/programs/` lists every bachelor/master/MBA program
    directly. Left unset: "BSc Applied Mathematics and Artificial
    Intelligence" — its guessed URL 301-redirects to the unrelated
    Computer Science program page (the known "redirects to a different
    real page" pitfall), and third-party listings note this program is
    only offered at Schiller's Madrid/Paris campuses, not Heidelberg.
  - **EU Business School - Munich Campus (38) — 34/38 (90%)**: the largest
    remaining gap category was its many "MBA in X" pathway programs
    (Dublin Business School / UVic-UCC partner degrees) — most resolved
    via `euruni.edu/en/MBA/<slug>-Munich.html` pages found through the
    school's own Bachelor's/Master's/MBA listing pages. Left unset (4):
    "MBA in Global Banking & Finance", "MBA in International Business",
    "MBA in International Marketing" and "MBA in Digital Business" — all
    four now redirect to the exact same generic `Scripts/Index.aspx?
    id=24005` fallback page (confirmed identical target across all four,
    the clearest case of the "redirects to a generic listing" pitfall
    seen in this project).
  - **IU - International University of Applied Sciences (32) — 19/32
    (59%)**, the weakest coverage in this batch: `iu.org`'s current
    on-campus catalogue (read directly from its own `sitemap.xml`, since
    the rendered pages return an oversized `Link:` preload header that
    breaks normal fetching) has been heavily consolidated into far fewer
    named programs than the DB reflects — e.g. the DB's 8 separate MBA
    specialisations beyond the ones still offered (Big Data Management,
    E-Sports Management, Innovation & Entrepreneurship, Salesforce & Sales
    Management, International Marketing) and the standalone Cyber Security
    *bachelor's* (its guessed URL now redirects to the Cyber Security
    *master's* page — a cross-level pitfall variant, caught and rejected)
    no longer exist as distinct current offerings. Left unset accordingly
    rather than mapping to a mismatched surviving page.
  - **Cologne Business School (19) — 9/19 (47%)**, the other weak point:
    `cbs.de` migrated from an older URL structure
    (`/en/courses/{bachelor,master}/...`) to a newer one
    (`/en/{bachelors,masters}-degree-germany/...`), and most of the old
    slugs now 301-redirect to a *generic* listing page rather than their
    new specific equivalent — caught via raw redirect-target inspection,
    not assumed fixed by a 200 status. Only programs findable directly on
    the new site structure were saved.
  - **PFH Private University of Applied Sciences (7) — 3/7 (43%)**: the
    weakest coverage in this batch. PFH's current English master's listing
    (`pfh.de/en/study-program-degree/master`) shows only General
    Management, MBA and UX Management & Design — its four Stade-campus
    engineering programs (Digitalization and Automation, Industrial
    Engineering, Lightweight Engineering & Composites, New Mobility and
    Modern Drive Concepts) all now redirect to the generic master listing
    page on both the English and German site, suggesting that campus's
    programs were discontinued or restructured; left unset rather than
    guessed.
  - Live test links: `https://paneledu.com/university?id=361` (Berlin
    International), `?id=363` (Whitecliffe), `?id=46` (BSBI), `?id=125`
    (Cologne Business School), `?id=47` (Constructor University), `?id=48`
    (EU Business School Munich), `?id=365` (Fresenius), `?id=124` (GISMA),
    `?id=181` (IU), `?id=49` (Lancaster University Leipzig), `?id=105`
    (Macromedia University), `?id=340` (MDH), `?id=176` (Munich Business
    School), `?id=316` (MUDT), `?id=227` (PFH), `?id=303` (Schiller
    International Heidelberg), `?id=143` (University of Europe/UE
    Germany), `?id=121` (XU Exponential University).
  - **Follow-up (2026-10-04) — IU, CBS, PFH re-pass; overall now 361/400
    (90.3%)**: only previously-empty rows touched, every URL checked by
    final-destination title/h1 (a 200 alone not trusted).
    - **PFH — 7/7 (100%)**: the four Stade/Göttingen engineering masters
      do have live pages, just not under `/study-program-degree/` (those
      slugs redirect to the generic master listing, which is why the first
      pass missed them) but as PFH's own landing pages
      `pfh.de/en/lp/master/{digitalization-and-automation,industrial-
      engineering,lightweight-engineering-composites,new-mobility-
      micromobility}`; h1 names each programme exactly. "New Mobility and
      Modern Drive Concepts" was matched to "New Mobility - Micromobility"
      because that page's own body text still describes "modern drive
      concepts", four semesters, taught in English.
    - **IU — 21/32 (66%)**: added "Bachelor's Pathway" (matched to the
      12-month English "IU Pathway Programme" bridging course into
      bachelor's degrees, `/on-campus/preparation-programmes/`) and
      "International Management - One Year Program" (matched to the 60
      ECTS / 12-month variant, `/masters/international-management-on-
      campus/60-ects/`). Left unset (11): the 5 legacy MBA specialisations
      (404 on-campus, only third-party/online listings remain), Bachelor
      Cyber Security (redirects to the master's page), "Business and IT"
      and "Industrial Engineering and Management" bachelors (nothing in
      `sitemap.xml`), "Data Science - One Year Program" (only a 120 ECTS /
      24-month Data Science page exists, already used by the other row),
      and "Management" / "Management - Two Years" (current page is titled
      "International Management", not clearly the same programme).
    - **CBS — 9/19 (47%), unchanged**: the 10 missing rows are former
      International Business tracks (Digital/Financial/Marketing/HR/
      International Trade/Management Consulting, bachelor + master
      variants and Digital Transformation Management). Their old
      `/en/courses/...` slugs now redirect to the generic bachelor listing
      or to the parent International Business page (h1 does not name the
      track), and the only remaining pages are already used by other rows
      or are generic `/en/topics/...` overviews. Left unset.

## In progress / next
- Programs page pagination (`/programs` still loads all at init) ✅ DONE (2026-07-21)
- University logos (upload/link + display on cards) ✅ DONE (2026-07-21)
- SEO meta tags (dynamic per university detail page) ✅ DONE (2026-07-21)
- Sitemap / robots.txt ✅ DONE (`public/sitemap.xml`, `public/robots.txt` live)
- Admin dashboard charts (lead funnel, conversions) ✅ DONE (2026-07-21)

### Durable critical-alert monitoring ✅ DONE (2026-08-28)
Replaced the temporary session-scoped Gmail-checking stopgap with a permanent,
app-side health check — scope decided: **critical errors only** (DB down /
deploy failed), not a Gmail security-mail scanner (that needs a separate
OAuth integration, out of scope for now).

- `POST /api/deploy` now writes each deploy's outcome to `logs/last-deploy.json`
  (`{ok, timestamp, output}`) and, on failure, immediately emails a critical
  alert via `sendCriticalAlert()` (`utils/mailer.js`).
- `GET /api/auto/monitor` (new, `CRON_SECRET`-gated, same pattern as
  `/api/auto/remind`): checks DB connectivity (`SELECT 1`) and the last
  deploy's outcome; emails a critical alert only if something is actually
  wrong, otherwise responds silently (`{ok: true, problems: []}`).
- Alert destination: `NOTIFY_EMAIL` (`info@paneledu.com`), via Resend — same
  verified sender as everything else.

**cPanel cron job: ✅ live (2026-09-18)** — confirmed working, returns
`{"ok":true,"problems":[]}`:
```
curl -s -H "Authorization: Bearer <CRON_SECRET>" -H "User-Agent: Mozilla/5.0" "https://paneledu.com/api/auto/monitor"
```

**Explicitly out of scope (not built):** scanning Gmail for security/abuse
notices from Google Cloud/registrar/hosting, and DMARC/SPF failure-rate
alerting — both would need a separate inbox-reading integration (OAuth),
which is a bigger, separate piece of work if wanted later.

## Future / larger

### AI Data Agent + Contribution Review Queue
Goal: an agent that compiles ranking data and English-taught Bachelor/Master
programs (with admission requirements) by reading official sources, and submits
its findings for admin review with a source link to verify accuracy.

**Design — split into two independent parts so the agent can never write live data directly:**

1. **Contribution Review Queue (admin panel) — build first, useful on its own**
   - New `contributions` table: `id, type (entity|program|ranking), target_id (nullable
     for new records), payload JSON, source_url, submitted_by, status
     (pending|approved|rejected), reviewer_note, created_at, reviewed_at`.
   - Admin "Review" section: list pending contributions; each shows proposed data
     **side-by-side with current data**, a clickable **source URL**, and
     Approve / Edit-then-approve / Reject buttons.
   - Approving writes the payload into the live `entities` / `programs` tables.
   - API: `POST /api/contributions` (token-gated, used by the agent),
     `GET /api/admin/contributions`, `POST /api/admin/contributions/:id/approve|reject`.

2. **The Agent (separate offline worker, not in the web app)**
   - Rankings: QS, Times (THE), Shanghai (ARWU), US News Global, Leiden.
     Leiden has a CSV download; others are published tables. Import once,
     refresh yearly. Most tractable, high accuracy.
   - Programs + requirements: LLM with web access reads each university's
     official catalog, extracts English-taught Bachelor/Master programs and
     requirements (IELTS/TOEFL, GPA, deadlines, tuition), and submits each as a
     contribution **with the exact source page URL**.
   - Runs in batches; output always lands in the review queue, never live.

**Feasibility notes / risks:**
   - Rankings ingestion is straightforward (finite, yearly).
   - Program extraction is feasible with current LLMs but accuracy varies —
     human review (the queue above) is mandatory. JS-rendered pages need a
     headless browser; some sites have anti-bot measures; data needs yearly
     refresh. Respect each source's Terms of Service.

## Big vision — full applicant funnel (paneledu.com) — planned 2026-06-27

A multi-epic plan to turn the site into an end-to-end study-abroad application
platform. Mobile-first is a HARD requirement across every epic (most users are
on phones — zero layout shift, fully responsive). No email is collected during
browsing; email is only captured at "Apply" or to view a test result.

**Full audit done 2026-09-20** — most of this section was stale: 6 of 8 epics
turned out to already be built (from earlier sessions, never logged here).
Re-verified against the actual code, file by file. Corrected below.

### Epic 1 — Simplified eligibility funnel ✅ DONE
`public/match.html` + `public/js/match.js` — 7-step chip wizard (education
status, degree, fields of interest, English level A1–C2 buckets, budget,
region, AP/IB), mobile-first, exactly matching the original spec. Ranks
client-side against `/api/public/programs` (`rankSchools`/`scoreProgram`,
match.js:117–153) by English fit + rank band + budget comfort + AP/IB bonus.
Discipline tag prerequisite: `programs.field` column, live in
`/api/public/filter-options` and `/programs` filter chips. One shortcut, not
a blocker: **region is a hardcoded JS map** (match.js:49–64), not DB-driven —
fine as long as the 5 focus countries don't grow much.

### Epic 2 — Results list + richer 3D detail page ✅ DONE
match.js results show ranked schools with "easiest acceptance" badges and
expandable department dropdowns. Orbit 3D page already has the corner info
panels (departments, fee, language, intake) — see the Orbit HUD design-
identity work above.

### Epic 3 — Application flow ("Apply now") ✅ BUILT (2026-09-21), needs live verification
Backend was already complete (`database/add_applications.sql`,
`routes/applications.js`). `public/apply.html` now also collects identity
info (DOB, place of birth, nationality, residence, address, high school —
optional, both in shortcut and funnel/cold-start mode) and, after a
successful submission, shows a document upload step scoped to **only
transcript + English test proof** (no passport/diploma/YKS/ÖSYM upload at
this stage, per direction 2026-09-21 — passport comes later in the process).
The English-proof row shows an affiliate link to the specific test
(IELTS/TOEFL/Duolingo/PTE/Cambridge) the chosen program requires when the
student doesn't have a score yet.
Verified via curl against production, then via an automated Playwright pass
against production (2026-09-22) — shortcut mode, funnel mode (all 7 steps),
document upload scoping, the IELTS affiliate hint, and mobile layout for
most steps all confirmed working. A few items are still open (admin-side
display — needs a human with admin login; mobile document-upload screen —
inconclusive due to sandbox network flakiness, not a suspected bug). See
`docs/APPLY_FLOW_CHECKLIST.md` for the itemized results.

### Epic 4 — Pre-acceptance ("ön kabul") engine ✅ DONE
`database/add_preacceptance.sql`, `routes/applications.js` (`POST
/:id/preaccept`), `utils/pdfgen.js` (PANELEDU-branded PDF, explicitly not a
university decision), `public/acceptance.html` (public verification by ref).

### Epic 5 — Admin: application & document management + reminders ✅ DONE
Admin panel has an Applications section and a Document Review queue.
Reminders: per-application, bulk, cron-callable (`/api/auto/remind`), plus
`scripts/remind.js` for stale applications.

### Epic 6 — English level test (lead magnet) ✅ DONE, verified live (2026-09-19)
20-question CEFR test, email-gated result delivery, admin panel section,
now also creates a lead (2026-09-19). Full details above.

### Epic 7 — Affiliate marketing infrastructure ✅ DONE (placeholders), verified live (2026-09-22)
Two separate things got conflated in the original plan:
1. **"Refer a lead to us" affiliate program — already built**:
   `users.affiliate_code`, `leads.referred_by`, `routes/affiliate.js`
   (dashboard, stats), `public/affiliate/index.html`.
2. **Provider-side links (IELTS/TOEFL/Duolingo/PTE/Cambridge) — tracked-
   redirect infrastructure built (2026-09-22)**: new `affiliate_links` table
   (provider_key, label, url, clicks), `GET /api/go/:provider` (counts the
   click, 302s to the current URL), admin **Affiliate Links** panel section
   (edit url/label per provider, see clicks — no deploy needed to change a
   destination). Every hardcoded provider URL (test.html result page,
   result email, apply.html's English-proof hint) now goes through
   `/api/go/<provider>`. Verified live: all 5 providers 302 correctly,
   unknown provider 404s.
- **Still placeholders**: URLs are currently the providers' plain pages, not
  real commission links — swap them in via the admin panel the moment real
  affiliate accounts/links are supplied (user to supply); no code change
  needed for that.

### Epic 8 — AI data agent + contribution review queue — PART 1 ✅ DONE (2026-09-24)
**Part 1 — Contribution Review Queue: built and deployed.**
- `contributions` table (`type`, `target_id`, `payload` JSON, `source_url`,
  `submitted_by`, `status`, `reviewer_note`) — migration run in production.
- `POST /api/contributions` — token-gated (`CONTRIBUTIONS_TOKEN`) public
  submit endpoint for the future agent (or manual entry); verified live
  (returns 403 without a valid token, confirming the route is mounted).
- Admin: `GET/PATCH /api/admin/contributions`, `POST /:id/approve`,
  `POST /:id/reject`, `DELETE /:id` — approve writes whitelisted columns
  into `entities`/`entity_locations`/`programs` (new record or update to an
  existing `target_id`), never accepts arbitrary payload keys.
- Admin panel "Contributions" section — list with status/type filters, a
  review modal showing live-vs-proposed data side by side with an editable
  JSON payload, Approve/Reject actions.

**Part 2 — the actual AI agent (reads ranking sites / university catalogs,
calls `POST /api/contributions`) — NOT STARTED.** The queue above is useful
standalone (manual contributions can already be submitted for review), but
nothing yet generates contributions automatically. Needs a decision on:
data sources, run cadence/trigger, and where the agent itself runs.
- Prioritize a **partner school list** (user to supply) over raw QS top.

### Cross-cutting requirements
- **Mobile-first**: consistently present across pages already built.
- **Account types**: already beyond admin-only — `admin`, `advisor`,
  `affiliate`, `enduser` roles all exist and are in use (middleware/auth.js,
  `users.role`). Adding more (e.g. `counselor`) needs no schema change.
- **Payments** for application fees / pre-acceptance — confirmed **not
  started**, provider TBD (iyzico/PayTR for TR; Paddle/Lemon Squeezy for
  global USD; Stripe only via a foreign entity).
- **WordPress integration** — confirmed **not started**.

### WordPress integration
- WP on root domain for content/blog/marketing; Node app stays on subdomain.

### Additional account types
- Add new `role` values (e.g. `counselor`, `agent`) — no schema change needed.
