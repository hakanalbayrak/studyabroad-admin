# Roadmap

## ⚡ Pending — needs action (as of 2026-07-15)

### 1. DB Migration ✅ DONE (2026-07-15)
All 14 new columns confirmed present in `programs` table.

### 2. SMTP config — add to .env on production server
File: `/home/matur124/studyabroad.kampanya.website/.env`
Currently the app has NO email settings; all notifications are silently skipped.
Steps:
  a. cPanel → Email Accounts → create `noreply@paneledu.com`
  b. Add these lines to .env (edit via File Manager → right-click .env → Edit):

```
SMTP_HOST=mail.paneledu.com
SMTP_PORT=465
SMTP_USER=noreply@paneledu.com
SMTP_PASS=<the password you set>
MAIL_FROM=noreply@paneledu.com
NOTIFY_EMAIL=hkn3958@gmail.com
APP_URL=https://paneledu.com
JWT_SECRET=<a long random string if not already set>
```

  c. Restart app: touch `/home/matur124/studyabroad.kampanya.website/tmp/restart.txt`
     (or use cPanel → Setup Node.js App → Restart)

### 3. Email deliverability — Resend domain verification
SMTP relay: Resend (smtp.resend.com), MAIL_FROM: info@paneledu.com ✅
DMARC record: live ✅ (confirmed via MXToolbox)
DKIM: NOT YET — paneledu.com is not verified in Resend dashboard.
      This is why emails land in spam: Resend cannot sign outgoing mail
      with a DKIM key for an unverified domain.

Fix (15 min):
  a. resend.com/domains → Add Domain → paneledu.com
  b. Copy the 3 DNS records Resend provides (DKIM TXT, SPF TXT, DMARC TXT)
  c. cPanel → Zone Editor → paneledu.com → add all 3 records
  d. Back in Resend → click Verify → wait for green status
  After verification all outgoing mail will carry Resend's DKIM signature → inbox.

### 4. Google Maps API key
File: `public/orbit/index.html` → `const GOOGLE_MAPS_KEY = '...'`
Previous key was revoked. Awaiting new key from user.

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

## In progress / next
- Programs page pagination (`/programs` still loads all at init)
- University logos (upload/link + display on cards)
- SEO meta tags (dynamic per university detail page)
- Sitemap / robots.txt
- Admin dashboard charts (lead funnel, conversions)

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

### Epic 1 — Simplified eligibility funnel (entry point)
Redesign `/programs` eligibility into a short, tap-friendly wizard:
- Education status: high-school graduate / 12th grade
- Fields of interest (multi-select, 4–5 broad areas): Business & Economics,
  Engineering, Medicine & Health, AI & Technology, Social Sciences (history,
  sociology, psychology…)
- English level: A1–A2 (Beginner) / B1–B2 (Intermediate) / C1–C2 (Advanced)
- Annual budget: €0–5k / €5–10k / €10–15k / €15k+
- Region: Europe / USA-Canada / Australia / UK
- AP / IB diploma: yes / no (optional, never mandatory)
- Output: ranked school list by **easiest acceptance + budget fit** (heuristic
  using ranking band, requirement gap vs profile, and budget).
- **Data prerequisite:** programs/entities need a **discipline/field tag** and a
  **country→region** mapping (neither exists yet).

### Epic 2 — Results list + richer 3D detail page
- Ranked results show location, fees, details, available departments.
- Click a school → expandable dropdown of departments.
- "View details" → the Orbit 3D page, redesigned as a larger window with corner
  info panels: departments, annual fee, language requirement, intake dates.

### Epic 3 — Application flow ("Apply now")
- Triggered by "Apply" → only now collect email + full applicant profile:
  name, surname, DOB, passport no., passport issue/expiry dates, place of birth,
  passport "issued by", nationality, country of residence, address, phone, email,
  high school, graduation GPA, field, English test score (or "will take on date"),
  desired intake.
- Document upload step (mandatory vs optional): passport, HS diploma, HS
  transcript, English score (if any), YKS result, ÖSYM placement.
- New tables: `applications`, `application_documents`.

### Epic 4 — Pre-acceptance ("ön kabul") engine
- System issues a **PANELEDU-branded** preliminary/conditional acceptance (NOT
  school logos): "Conditional acceptance — complete English by <date> / pay
  application fee to proceed." Speeds the funnel and creates momentum.

### Epic 5 — Admin: application & document management + reminders
- Admin receives applications, manages student docs & info, tracks status.
- Systematic **reminder emails** (deadlines, missing docs, next steps).

### Epic 6 — English level test (lead magnet)
- 20-question CEFR test (≈3 per level A1–C2). Email-gated result delivery.
- Result emailed, then upsell via affiliate links (IELTS course, etc.).

### Epic 7 — Affiliate marketing infrastructure
- Affiliate links/banners/buttons for IELTS, TOEFL, Duolingo, Pearson/PTE, AP,
  and language schools. Commission tracking. Placed on site + in emails.
- Needs: affiliate accounts/links from each provider (user to supply).

### Epic 8 — AI data agent (see "AI Data Agent" above)
- Prioritize a **partner school list** (user to supply) over raw QS top.
- Agent loads ranking + program data into admin via the review queue; fills the
  large gaps where ranking/requirement data is currently missing.

### Cross-cutting requirements
- **Mobile-first** everywhere (highest priority).
- **Payments** for application fees / pre-acceptance — provider TBD
  (iyzico/PayTR for TR; Paddle/Lemon Squeezy for global USD; Stripe only via a
  foreign entity). See payments discussion.

### WordPress integration
- WP on root domain for content/blog/marketing; Node app stays on subdomain.

### Additional account types
- Add new `role` values (e.g. `counselor`, `agent`) — no schema change needed.
