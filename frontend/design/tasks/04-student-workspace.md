# Task 4: student workspace

Owns `src/pages/student/**` and routes `/a/:assignmentId` (student role), `/s/:submissionId/pages`, `/s/:submissionId`. Read `design/BRIEF.md`, then `design/DESIGN.md`, then this file. Students never see criteria, decisions, solutions or staff reasons; the API already strips them, do not fetch staff routes.

## Assignment page (`/a/:assignmentId`, student)

Content page (1040 measure). Header row: "Homework 1", due date in the right slot as a sentence ("Due Thursday, 11:59 pm" or "Closed"). Body:

- If no attempts: a guided card "Upload your work" with a PDF drop zone (also a file button), the blank assignment link ("Open Homework 1 (PDF)") if `documents` has a `questions` kind, and one sentence about what happens next. Upload → `client.upload(id, "submission", file)` returns a submission → redirect to `/s/{id}/pages`.
- If attempts exist: a table of attempts, latest first: Attempt n, uploaded time, status (Not checked / Estimated 22 of 30 / Needs review / Handed in / Final score 27 of 30 when released), one action per row (Assign pages if unmapped, Check my work if mapped and not sealed, View feedback if sealed). Above it the primary for the latest attempt and a secondary **Upload revision** (disabled after the deadline with the reason). If a final exists, a chip "Handed in Sept 19, 4:12 pm" and the Final score `Score` when `review.status === "released"`.
- Capabilities `mode === "unconfigured"`: a Notice with the brief's sentence; Check my work is hidden, Hand in stays.

## Assign pages (`/s/:submissionId/pages`)

Workspace route. The stepper is the header: "1 Upload · 2 Assign pages · 3 Check". Left: `PageThumbnails` of the attempt PDF (fetched via `usePdfBlob`), each tile shows chips of the questions that claim it. Right 360px: the question list; the selected question is tinted; clicking tiles toggles that page for the selected question (a page may belong to several questions; a question may span pages). Under the list: "3 of 4 questions have pages" and the primary **Check my work** enabled when every question has ≥ 1 page. It saves the mapping (`saveMapping`, 1-based indices) and then starts the job (`startAssessment`), navigating to `/s/{id}` which shows the job state. A secondary **Save pages** saves without checking. Keyboard: number keys select the question, arrows move between tiles, space toggles.

## Feedback (`/s/:submissionId`)

Workspace route. Header row: left, "Homework 1 · Attempt 2" with a version popover (all attempts, first and latest kept distinct); right, the primary **Hand in** (only on the latest attempt, only when no final exists yet and before the deadline; Dialog "Hand in attempt 2? Later uploads stay practice and cannot replace it." → `handIn` → toast "Handed in"), secondary **Upload revision**.

- While the job runs (`job_id` set, poll `waitForJob`): the paper renders immediately; the right pane shows "Checking your work…" with a Spinner and `role="status"`, no percentage. `failed`: Notice with the error in plain words (`not_configured` → the capability sentence; `provider_failed` or `interrupted` → "The check did not finish." with **Retry** → `retryJob`). `succeeded`: refetch and render.
- Right pane 360px with the assessment: the total `Score` at the top (Estimated 22 of 30 · Test fixture chip when `mode === "fixture"`; `null` → "Needs review: a staff member will look at part of this paper"), then per question a card: title, question `Score` (estimated or Needs review), and the flag cards each with a numbered yellow chip (numbered across the whole paper in reading order so the pin on the page matches), category as a plain label, the message. Clicking a card scrolls the paper to the anchor's page and selects the pin; clicking a pin selects the card. Under each question: a quiet **Ask for help** and **Report this feedback** opening a Dialog with a message field → `createReport(kind: "help" | "incorrect_feedback")` → toast.
- Paper: `PdfViewer` with hint-tone marks from every flag anchor (`bbox` null → gutter pin), `hideMarks` on `h`.
- Released final: a green Notice at the top of the pane "Final score 27 of 30, released by your instructor" and per-question final scores next to the estimates, clearly separated ("Estimated" vs "Final").
- No assessment and not sealed: the pane offers **Check my work** (goes to the pages route if unmapped).

## Phone

Paper first, pane as a bottom sheet with the total visible in its collapsed handle; Hand in sticky in the sheet.

## Tests and proof

Vitest: mapping completeness and the 1-based payload, flag numbering across questions in reading order, the Hand in gate (latest, no final, before deadline), the job-state reducer. Screenshots in `design/screenshots/04/` as "Elena Petrova" (assignment page with one attempt, feedback), "Chloe Nguyen" (two attempts, handed in), "Amara Okafor" (released final), and a fresh upload flow you drive with a generated PDF from `tools/seed_dev.py`'s writer (drop the file, assign pages, check, wait, feedback), at 1440×900 and 390×844.
