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
