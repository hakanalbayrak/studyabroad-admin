# Apply Flow — Manual Verification Checklist

Created 2026-09-21, after completing the `/apply` form (identity fields +
scoped document upload) and adjusting it to only request transcript +
English proof at this stage. Backend behavior was smoke-tested via `curl`
against production, but the real browser flow has not been clicked through
yet. Run through this before considering Epic 3 fully closed.

## Shortcut mode (`/apply?uni=<id>` or `?uni=<id>&program=<id>`)

- [ ] University banner loads correctly (name, location, program chip if
      `?program=` was passed).
- [ ] Program dropdown appears and works when `?program=` is *not* passed.
- [ ] Intake chips auto-select the nearest upcoming intake.
- [ ] Required fields (first name, last name, email, phone) show inline
      errors when left empty; focuses the first invalid field.
- [ ] Academic profile section (education status, GPA, English level, test
      scores, SAT/GRE/GMAT, AP/IB tags) still works as before — this wasn't
      touched, just confirm nothing regressed.
- [ ] New "Kimlik Bilgileri" (identity) section appears: DOB, place of
      birth, nationality, residence country, address, high school — all
      optional, submission succeeds whether filled or left blank.
- [ ] On submit: moves to the document upload screen (not straight to
      success).

## Funnel mode (`/apply`, cold start, no `?uni=`)

- [ ] All 7 steps render in order: continent → country → program type →
      school → program → contact & profile → identity.
- [ ] Progress bar / step label shows "7" as the total and "Kimlik
      Bilgileri" as step 7's label.
- [ ] Back/next navigation works across all 7 steps, including the new
      step 7.
- [ ] Step 7 fields are optional — "Başvuruyu Gönder" on step 7 submits
      successfully with them blank.
- [ ] On submit: moves to the document upload screen (not straight to
      success).

## Document upload screen (both modes)

- [ ] Only two rows show: "Lise Transkripti" and "İngilizce Sınav Belgesi
      (varsa)" — no passport, diploma, YKS or ÖSYM rows.
- [ ] Uploading a PDF/JPG/PNG under 10MB for either row succeeds, row turns
      green, button shows "Yüklendi".
- [ ] Uploading an unsupported type (e.g. `.docx`) or a file over 10MB
      fails with a visible error, doesn't crash the screen.
- [ ] When the chosen program has a specific `english_req_type` (IELTS,
      TOEFL, Duolingo, PTE or Cambridge), the affiliate hint under
      "İngilizce Sınav Belgesi" shows the right provider name and link.
- [ ] When the program's English requirement is `None` (or unset), no
      affiliate hint shows.
- [ ] "Devam Et" moves to the success screen whether or not anything was
      uploaded (upload is optional, never blocks).

## Admin side

- [ ] New application appears in **Applications**, with the identity fields
      (DOB, place of birth, nationality, residence, address, high school)
      correctly shown in the detail view.
- [ ] Uploaded documents appear in **Document Review** with the correct
      `doc_type` label (`hs_transcript`, `english_score`) and can be
      downloaded.
- [ ] Issuing a pre-acceptance for a test application still works end to
      end (PDF generation, email, `/acceptance?ref=...` page renders).

## Mobile

- [ ] Both modes, all steps, and the document upload screen are usable on
      a phone-width viewport — no horizontal scroll, no clipped buttons.

## Cleanup

- [ ] Delete/close out any test applications created while verifying this
      (there is currently **no delete endpoint for `applications`** — only
      leads and English test results have one; either add one or handle
      test records manually via direct DB access if this becomes a
      recurring need).
