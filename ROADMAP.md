# Roadmap

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

### WordPress integration
- WP on root domain for content/blog/marketing; Node app stays on subdomain.

### Additional account types
- Add new `role` values (e.g. `counselor`, `agent`) — no schema change needed.
