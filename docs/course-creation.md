# Create a course from a grading PDF

In instructor view, open the course picker and choose **Create course**. With only one
course (or none), Create course is shown directly in the sidebar.

1. Enter the course name and optionally select a grading/deduction PDF.
2. Click **Autofill deductions** to send its extracted text to the configured provider.
3. Review/edit the rules, penalties, exceptions, and quoted source pages. Add or remove
   rules if needed, then click **Create course**.
4. Enroll existing student/TA accounts from the new course's roster, and add homeworks.

The PDF must be unencrypted, 1–40 pages, and at most 15 MiB. Autofill requires readable
embedded text on every page (no handwriting/OCR) and at most 60,000 extracted characters.
If there are no explicit deductions, the draft may be empty; the model is instructed
not to fabricate rules from homework solutions or generic proof-writing expectations.
Every extracted rule must cite an actual source page and quote. Extracted penalty text
must appear verbatim within that quote. Missing penalties remain unspecified, not zero.
Manual entry and course creation still work without a configured model.

Autofill is an explicit provider call and may incur charges. Currently the OpenRouter
adapter uses `OPENROUTER_RUBRIC_MODEL` (falling back to its assessment model). API keys
remain on the backend; the UI discloses third-party processing before sending text.
An extraction failure is reported without a hidden retry or silently creating a course.
Re-extraction replaces the editable draft; selecting a different PDF clears the old one.

## Storage and grading

Creating saves the instructor-reviewed rules and private PDF in the backend's existing
`VERITY_DATA_DIR`. It enrolls only the creating instructor. Students see course membership
and homeworks, not the raw deduction configuration or source PDF. Enrolled TAs/instructors
can read the saved rules and download the source from the course home.

Saved rules are included in **new homework rubric-generation contexts**. They are not
extra penalties added on top of published homework criteria. Existing deterministic
scoring still follows the published homework rubric; an instructor must review/publish
that rubric. Publication snapshots course rules so later changes cannot rewrite past
assessment inputs. This version does not add editing of an already-created course's rules.

Records survive app restarts if the same persistent backend data directory is retained.
A frontend Git push/Vercel deployment does not seed the deployed backend or migrate data.
Deploy both frontend and backend changes to use this flow outside the local app, and
provide a valid instructor session. The local demo role switch is not production login.

## API

- `POST /api/course-deduction-drafts`: instructor-only multipart `file`. Returns
  `{draft: {rules, notes}, page_count, provider_id}`; does not persist an upload or course.
- `POST /api/courses/from-pdf`: instructor-only multipart `name`, `deductions` (JSON),
  `request_id` (retry key), optional `file`. Atomically saves the reviewed course and PDF.
  Identical retries by the same instructor return the existing course; a changed body
  with the same key is rejected. Use a new key for a new submission.
- Each rule has `description`, nullable textual `penalty`, nullable `source_page`, and
  `source_quote`. Textual penalties preserve ranges, units, caps, and application scope.
- `GET /api/courses/{id}`: membership-authorized detail; only staff receive deductions.
- `GET /api/courses/{id}/deductions-pdf`: enrolled staff only.
- Existing `POST /api/courses` (name-only) remains compatible.

## Checks

Run the backend tests and frontend tests/build/lint. For an isolated real UI/backend
test: `cd frontend && node tools/check-course-creation.mjs`. This starts a temporary
fixture-only backend on port 8037, tests upload/extract/edit/save/reload/download and
mobile layout, then stops it. It never changes the real demo's courses or calls a model.
