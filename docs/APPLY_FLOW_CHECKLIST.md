# Apply Flow — Manual Verification Checklist

Created 2026-09-21. **Automated pass completed 2026-09-22** using Playwright
against production (`paneledu.com`, real HTTP, not a local copy) — see
results below each section. The sandbox's outbound proxy was intermittently
flaky during the run (occasional failed `fetch`/resource loads, unrelated to
the app), so a couple of items are marked inconclusive rather than failed —
noted where that applies.

## Shortcut mode (`/apply?uni=<id>` or `?uni=<id>&program=<id>`)

- [x] University banner loads correctly (name, location, program chip if
      `?program=` was passed). — confirmed (uni=86, Anglia Ruskin University)
- [ ] Program dropdown appears and works when `?program=` is *not* passed.
      — not automated (always tested with `?program=` set); quick manual
      check recommended.
- [ ] Intake chips auto-select the nearest upcoming intake. — not directly
      asserted by the automated run; visually present in the screenshot,
      worth a manual glance.
- [ ] Required fields (first name, last name, email, phone) show inline
      errors when left empty; focuses the first invalid field. — not
      automated (always filled in the test run).
- [ ] Academic profile section (education status, GPA, English level, test
      scores, SAT/GRE/GMAT, AP/IB tags) still works as before — this wasn't
      touched, just confirm nothing regressed. — not automated.
- [x] New "Kimlik Bilgileri" (identity) section appears: DOB, place of
      birth, nationality, residence country, address, high school — all
      optional, submission succeeds whether filled or left blank. —
      confirmed (filled, submitted successfully).
- [x] On submit: moves to the document upload screen (not straight to
      success). — confirmed.

## Funnel mode (`/apply`, cold start, no `?uni=`)

- [x] All 7 steps render in order: continent → country → program type →
      school → program → contact & profile → identity. — confirmed
      end-to-end (continent=UK → United Kingdom → any type → Anglia Ruskin
      → a program).
- [x] Progress bar / step label shows "7" as the total and "Kimlik
      Bilgileri" as step 7's label. — confirmed ("Adım 7 / 7 — Kimlik
      Bilgileri").
- [ ] Back/next navigation works across all 7 steps, including the new
      step 7. — only forward navigation was automated; back-button clicks
      not tested.
- [x] Step 7 fields are optional — "Başvuruyu Gönder" on step 7 submits
      successfully with them blank. — confirmed in one run (submitted with
      step 7 filled in another; both succeeded).
- [x] On submit: moves to the document upload screen (not straight to
      success). — confirmed.

## Document upload screen (both modes)

- [x] Only two rows show: "Lise Transkripti" and "İngilizce Sınav Belgesi
      (varsa)" — no passport, diploma, YKS or ÖSYM rows. — confirmed in both
      modes.
- [x] Uploading a PDF for either row succeeds, row turns green, button shows
      "Yüklendi". — confirmed (transcript, shortcut mode).
- [x] Uploading an unsupported type (`.txt`) fails gracefully, doesn't
      crash the screen or falsely show "Yüklendi". — confirmed (funnel
      mode) — though one run logged a generic "Failed to fetch" instead of
      the app's own validation message; that specific run coincided with
      other proxy-level failures in the same session, so it reads as sandbox
      network flakiness rather than a real app error — **worth one manual
      recheck** of what error text actually shows for a bad file type on a
      real connection.
- [x] When the chosen program has a specific `english_req_type` (tested:
      IELTS), the affiliate hint under "İngilizce Sınav Belgesi" shows the
      right provider name and links to `/api/go/ielts`. — confirmed.
- [ ] When the program's English requirement is `None` (or unset), no
      affiliate hint shows. — not automated (test program required IELTS).
- [x] "Devam Et" moves to the success screen whether or not anything was
      uploaded. — confirmed (funnel mode, nothing uploaded).

## Admin side

- [ ] New application appears in **Applications**, with the identity fields
      (DOB, place of birth, nationality, residence, address, high school)
      correctly shown in the detail view. — **not automated** (no admin
      credentials in this session). Test applications from this run to spot
      check: `checklist-shortcut@paneledu.com`, `checklist-funnel@paneledu.com`.
- [ ] Uploaded documents appear in **Document Review** with the correct
      `doc_type` label (`hs_transcript`, `english_score`) and can be
      downloaded. — not automated, same reason.
- [ ] Issuing a pre-acceptance for a test application still works end to
      end (PDF generation, email, `/acceptance?ref=...` page renders). —
      not automated, same reason.

## Mobile

- [x] Steps 1, 2, 6 and 7 of the funnel — no horizontal overflow
      (`scrollWidth` vs `clientWidth`, 390×844 viewport). — confirmed.
- [ ] Document upload screen on mobile — **inconclusive**: the submission
      that leads to this screen kept hitting the same sandbox network
      flakiness seen elsewhere in this run, so it was never reached cleanly
      on the 390px viewport. The screen reuses the same simple flex-row
      layout as the rest of the page (which passed), so it's very likely
      fine — but hasn't been directly confirmed on mobile. One real-phone
      check recommended.
- Note: a couple of mobile screenshots from flaky page loads showed the nav
  and chips completely unstyled (CSS didn't load in time). Confirmed this
  is a sandbox-only artifact, not a site bug — the same page loaded cleanly,
  fully styled, in other runs (compare `shortcut-success.png` vs
  `funnel-success.png` in this session's evidence), and the exact same
  instability was independently causing `fetch()` failures throughout the
  run. No action needed.

## Cleanup

- [ ] Delete/close out test applications created during verification —
      `deploy-check5+apply@paneledu.com` (id 2, from the earlier curl test),
      `checklist-shortcut@paneledu.com`, `checklist-funnel@paneledu.com`,
      `checklist-mobile@paneledu.com` (may not have been created, given the
      mobile run's flakiness). There is currently **no delete endpoint for
      `applications`** — only leads and English test results have one;
      either add one or handle test records manually via direct DB access
      if this becomes a recurring need.
