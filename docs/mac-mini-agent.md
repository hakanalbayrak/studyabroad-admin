# Mac mini session: read the pages a cloud agent cannot open

Use this to let a Claude session on the Mac mini (home IP, real Chrome) read official school pages that block cloud fetchers (403/503) or need JavaScript. Results go to paneledu.com, where they are reviewed before anything is written to the catalogue.

## Before you start (once)
1. Open the Claude desktop app on the Mac mini and make sure the **Claude in Chrome** extension is installed and enabled in Chrome (Chrome must be open).
2. Start a new Claude Code session on the Mac (any empty folder).
3. Ask the cloud session for a fresh agent token (the old one was shown in chat); paste it where the prompt says `<TOKEN>`.

## Prompt to paste into the Mac session
```
Task: read official school pages that cloud fetchers cannot open, for paneledu.com.

1. Fetch the task list and rules: https://paneledu.com/agent/tasks.json
   Read the "instructions" field first. "tasks" = Part A (application fee per school and level). "tasks_tuition" = Part B (annual international tuition per institution; the same list also shows a manual_url for each).
2. Use Claude in Chrome (my real browser) for every page. Official school websites only. Browse at human pace (a few seconds between pages), one page at a time. Expand accordions, tabs and "show more" panels; open fee PDFs.
3. If a page shows a CAPTCHA or asks me to log in, do NOT try to get around it: stop on that item, tell me which URL it is, and continue with the next one (I can solve it myself if I am at the Mac).
4. Never guess. If an official page does not state a value, use null. Application fee = the fee paid when submitting the application; not tuition, deposit, registration, enrolment, test or visa fees.
5. Send results after every 5 items, Part A and Part B in separate requests:
   curl -s -X POST https://paneledu.com/api/agent/results -H "Content-Type: application/json" -H "X-Agent-Token: <TOKEN>" -d '<JSON list of result objects, format in the instructions>'
   Expected answer: {"ok":true,"saved":N}
6. When finished, tell me how many items you completed and which URLs you could not open.
```

## After it finishes
Tell the cloud session "Mac sonuçlarını oku": it reads the results from the inbox, filters them (official domain, explicit statements only, no deposit/registration/test fees) and writes only what is clear. Then rotate the agent token (`DELETE /api/admin/agent-token`).
