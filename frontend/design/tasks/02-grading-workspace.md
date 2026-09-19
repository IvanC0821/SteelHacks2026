# Task 2: grading workspace (staff)

Owns `src/pages/grading/**` and routes `/a/:assignmentId/grade` and `/a/:assignmentId/grade/:submissionId`. Read `design/BRIEF.md`, then `design/DESIGN.md`, then this file. Use only the components, tokens and viewer from Task 1; if something is missing, build it inside your folder and list it in your report.

## What it is

The professor's 80% screen. The **final queue** (`client.finalQueue(assignmentId)`: handed-in papers only) graded one paper at a time beside the original PDF. Human decides; the automated assessment is a suggestion.

## Layout (1440×900)

- Rail collapsed (workspace route). One 52px `PageHeader` row: left, the student switcher (‹ prev · "Chloe Nguyen · 2 of 4" · roster popover listing every paper in the queue with its review status and estimate · next ›); center, nothing; right, the primary for the current state (see States).
- Below it three full-height panes: paper (flexible, target ≥ 65% of the window width), rubric pane 360px on the right. No left queue pane; the queue lives in the switcher.
- Paper: `PdfViewer` with the `ViewerToolbar`; marks are the flags of the automated assessment for the selected question (numbered from 1 in the order of `flags[]`, tone deduction), plus `hideMarks` bound to `h`. Selecting a mark selects its flag card in the panel and vice versa.
- Rubric pane, top to bottom:
  1. Question chips (q1 … q4 with title on hover, each showing the human score if saved, else the estimate in muted, else a dash). Keyboard: `[` and `]` move between questions.
  2. The question prompt in `.v-copy-14`, and the mapped pages ("Pages 2, 3", clicking scrolls the paper).
  3. **Rubric v{n}** criteria for this question from `submission.rubric.criteria`: each row shows the description, category chip, points in `.v-score` delta style, and, when an assessment exists, the automated decision as a lavender "AI suggested" chip reading Met / Not met / Uncertain with its rationale expandable (staff may read rationales). Clicking a criterion toggles it in a local tally that fills the score field (met criteria sum) but the field stays editable; the field is the truth.
  4. Score field (number, 0 to `max_points`, `.v-score` size) and Reason textarea (required by the API, min 1 char; placeholder "Private to staff").
  5. Flag cards for this question (numbered to match the paper), category, message, page.
- Footer of the pane: the primary **Save and next** (saves this question's score and reason via `client.saveReview(id, revision, {[qid]: {score, reason}})`, merging with previously saved questions since the API replaces the map), secondary **Skip**. Below it one progress sentence: "2 of 4 questions saved".

## States and the header primary

- Review `not_started` or `in_progress`: header primary is **Complete review**, enabled only when every question has a saved score and no assessment job is queued or running; disabled `title` gives the reason ("Save Q3 and Q4 first"). Calls `completeReview`.
- `completed`: instructor sees **Release scores** (two-step confirm in a Dialog, toast "Scores released to Chloe Nguyen"); TA sees a chip "Completed, awaiting release" and **Reopen** is instructor-only (Dialog with a required reason).
- `released`: read-only fields, chip Released, instructor can Reopen.
- Every mutation returns the new review; keep `revision` in state and send it back. On `ApiError.conflict` with code `stale_review_reload`, refetch the submission, show a Notice "Someone else saved this review. Your unsaved changes are kept in the fields; compare and save again.", and do not overwrite silently.
- `assessment === null`: a quiet Notice in the pane "No automated estimate for this paper" and no AI chips. `mode === "fixture"`: a Test fixture chip beside the estimate.
- Empty queue: EmptyState "No papers handed in yet."

## Keyboard

`1`…`9` toggle the nth criterion of the current question, `[` `]` questions, `j` `k` papers, `Enter` in the reason field does not submit, `⌘/Ctrl+Enter` = Save and next, `h` hide marks. Document the map in a `?` popover.

## Phone (390×844)

Header 52px with the switcher condensed to "2 / 4" and arrows; paper on top (60% height), rubric pane as a bottom sheet that expands; Save and next sticky.

## Tests and proof

Vitest: the criterion tally → score fill, the merge of saved questions into the `saveReview` payload, the Complete gate reasons, the stale-conflict reducer. Screenshots in `design/screenshots/02/` as "Sam Reyes": queue paper 1 (Amara, released), paper 2 (Ben, in progress, Q1 and Q2 saved), paper 3 (Chloe, not started) at 1440×900 and 390×844, the roster popover, the conflict notice (trigger it by saving with a stale revision in a second client in a small script or by editing the revision in state in a dev-only way and then removing that code). Verify the paper width in the screenshot and report it.
