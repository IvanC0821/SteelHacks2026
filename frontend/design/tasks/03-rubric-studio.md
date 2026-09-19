# Task 3: rubric studio and assignment setup (staff)

Owns `src/pages/rubric/**` and routes `/a/:assignmentId/rubric` and `/c/:courseId/new`. Read `design/BRIEF.md`, then `design/DESIGN.md`, then this file.

## New assignment (`/c/:courseId/new`, instructor only)

One content page (1040 measure): Title, optional due date and time (sent as ISO with timezone), and a question list editor: each row has an ID (auto `q1`, `q2`… editable, pattern `[a-zA-Z0-9_-]{1,40}`), Title, Prompt (textarea), Points. Add question, remove, reorder with up/down buttons (no drag). Total points shown live in `.v-score`. One primary **Create assignment** → `client.createAssignment` → redirect to its rubric route. 422 field errors land on the right rows. Note under the list: "Questions and points lock when the first rubric is published."

## Rubric studio (`/a/:assignmentId/rubric`)

Workspace route (rail collapsed). Header row: title "Homework 1 · Rubric", right, the primary **Publish rubric** whose disabled `title` is derived from the same checks the API makes (no criteria; a question with no criteria; per-question points that do not sum to the question's `max_points`; nothing changed since Rubric v{n}). Publishing calls `publishRubric`, toasts "Rubric v2 published", refetches.

Below the header, a **setup strip** of chips: Blank assignment (questions PDF), Instructor solution, Graded examples (n), each showing attached filename and page count or "Add" if missing. Clicking opens a Drawer "Assignment setup" with file cards per kind and an upload control (`client.upload(assignmentId, kind, file)`, PDF only, size limit from `capabilities.max_upload_bytes`, show progress state as busy, errors inline). A footnote: "Solutions and examples stay private to staff. New references attach to the next published rubric version."

Two panes:

- Left (flexible, ≥ 55%): the instructor solution in `PdfViewer` when one exists (fetch by the `documents` entry with kind `solution`, latest), else the blank assignment, else an EmptyState with "Add the instructor solution" opening the drawer.
- Right 360px: the draft editor. Per question a card: title, `max_points`, the criteria rows (description textarea auto-grow, category select over the seven categories, points number, remove). Points remaining per question shown live ("8 of 8 points assigned" turns deduction red when off). Add criterion. `instructor_notes` textarea at the bottom ("Notes to the model and TAs: alternative methods, strictness"). Saving is explicit: secondary **Save draft** (`saveRubricDraft`) with a dirty indicator; also autosave 1.5s after the last edit with the `role="status"` line "Draft saved 12:03". Above the cards: a **Request generated draft** secondary (`requestRubricDraft` → poll job → refetch; while running show "Generating a draft from your solution…" with Spinner; on `not_configured` show the capability sentence from the brief; on success a Notice "Generated draft loaded. Review every line before publishing." If the draft changed while the job ran the API refuses to overwrite; explain that).
- Published versions: a quiet line under the header "Rubric v1 published 2:14 pm" with a popover listing all versions (`rubrics[]`) and a read-only view of any version's criteria.

Empty state (no draft, no documents): a guided card "Set up Homework 1" with three steps (Add the instructor solution, Write or generate the rubric, Publish) each with its action.

## Phone

Header 52px, the setup strip scrolls horizontally, the solution collapses behind a "Show solution" toggle, the editor takes the width.

## Tests and proof

Vitest: the publish-gate reasons, the per-question points sum, the question-editor reducer (add/remove/reorder/ID uniqueness), ISO due-date construction. Screenshots in `design/screenshots/03/` as "Dana Whitfield": Homework 1 studio (published, draft dirty), Homework 2 studio (no rubric, empty state and then the editor with one criterion), the setup drawer, the new-assignment page, at 1440×900 and 390×844.
