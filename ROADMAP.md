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
  continuing incrementally.

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
