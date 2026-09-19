# Task 5: course home, staff assignment page, overview, reports, landing

Owns `src/pages/course/**` and `src/pages/landing/**` and routes `/` (signed out), `/c/:courseId`, `/a/:assignmentId` (staff role), `/a/:assignmentId/overview`, `/a/:assignmentId/reports`. Read `design/BRIEF.md`, then `design/DESIGN.md`, then this file.

## Course home (`/c/:courseId`)

Content page. Header row: course name; instructor gets the primary **New assignment** (→ `/c/:id/new`). Body: assignment rows (borderless table): title, status model derived from the assignment and (for staff) `finalQueue` counts fetched per row: **Rubric not published** → **Rubric v1, no papers yet** → **Grading r of s** with a thin bar → **All reviewed** → **Released**; students see Not started / Estimated / Handed in / Final score. One action per row that matches the status (Set up rubric, Grade, Review, Open). Below the table for staff: a compact roster (`members`) grouped by role, and for the instructor an **Enroll** control (user ID field, role select) that calls `enroll` and explains where IDs come from ("Printed by the local setup command"). Empty course: EmptyState "No assignments yet" with the primary.

## Staff assignment page (`/a/:assignmentId`, staff)

Header row with the title and Tabs: Overview · Rubric (link to Task 3) · Grade (link to Task 2) · Reports. Default tab is Overview. Keep the header identical in height and tab position across the three staff routes so switching does not jump (Task 2 and 3 use `PageHeader` too; check at 1440 and 390 and report any drift).

## Overview (`/a/:assignmentId/overview`)

From `client.analytics(id)`:

- Three tiles in a divided row: Handed in (`final_submissions` of `students_with_attempts` students), Reviewed (`reviewed`), Released (`released`); numerals in `.v-score` at 20px; `open_reports` as a fourth quiet tile linking to Reports when > 0.
- **Scores by question**: horizontal bars, one per question, latest mean as the bar (teal-600), first mean as a tick (line-strong), label "Q1 · Solve the system", value "4.0 of 8, n = 5" right-aligned; drawn only when at least one question has `latest.scored_students > 0`, otherwise EmptyState "No estimates yet". Title the block with the finding when there is one (largest first-to-latest change), else "Scores by question".
- **Most flagged**: per question the top categories from `latest.students_by_category` as chips with counts ("notation 5", "presentation 4"), distinct students.
- The `interpretation` sentence from the API as the footnote, verbatim. A "Mixed rubric versions" warning chip on a question whose `rubric_ids` has more than one entry.

## Reports (`/a/:assignmentId/reports`)

Table of `client.reports(id)`: student, question, kind (Help / Feedback disputed), message, time, status chip; row action **Resolve** opens a Dialog with status (Resolved / Dismissed) and a required staff note → `resolveReport`; footnote "Resolving never changes a score." Open reports first.

## Landing (`/`, signed out)

One calm page on the design system: the mark and wordmark, one line ("Practice feedback under your instructor's rubric. Every final paper is reviewed by a person."), three short numbered steps for students and three for staff, a **Continue** primary to `/session`, and a footnote "SteelHacks 2026 · fictional demo data". No marketing tagline, no hero image, no gradient. Signed-in users never see it (the shell redirects).

## Phone

Tiles stack two by two, bars keep their labels above the bar, tables become stacked rows with the action at the end.

## Tests and proof

Vitest: the assignment status model, the bar scale (max_points → width), the finding selection, the report ordering. Screenshots in `design/screenshots/05/` as "Dana Whitfield": course home, staff assignment Overview, Reports, and the landing page signed out, at 1440×900 and 390×844; plus the course home as "Chloe Nguyen".
