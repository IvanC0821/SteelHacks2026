# Fictional 21-127 local demo

Click the course name in the sidebar to switch between enrolled courses. In a compact
paper workspace, use the graduation-cap icon; on mobile, open navigation first.
Selection follows course, assignment, and submission URLs, survives reload, and is
preserved when switching between the existing demo identities if both have access.

The new course has two published five-question homeworks (50 points each), question
PDFs, manually authored rubrics, and staff-only reference solutions. Everyone in the
existing demo course roster is enrolled with the same role. There are no new accounts,
automatic assessments, or changes to the existing linear-algebra course.

## Reproduce locally

1. Start the backend and frontend against the existing demo data. Do not reseed/reset
   the existing course merely to add this one.
2. Build the original fictional materials:
   `.venv/bin/python -m tools.build_concepts127`
3. Add them using the existing demo instructor session:
   `.venv/bin/python -m tools.seed_concepts127`
4. Reload the frontend so its membership list includes the new course.

The builder needs ReportLab, pylatexenc, and pypdf. It uses macOS Arial Unicode for
math glyph coverage; on other systems, set `VERITY_PDF_FONT` to a Unicode-capable TTF
and `VERITY_PDF_BOLD_FONT` to a bold TTF. It does not execute uploaded/untrusted TeX.
The seeder permits loopback URLs only, is idempotent, refuses to overwrite edited
assignment/rubric content, verifies student access boundaries, and makes no model calls.
It never prints bearer tokens or provider credentials.

## Files

- `output/pdf/21-127/21-127-upload-samples.zip`: four student PDF/TeX pairs,
  both question sheets, and author notes explaining the intended errors.
- Student A for each homework is correct. Student B has intentional errors;
  creative homework B also has two fully correct answers with harmless detours.
- Every student PDF has exactly five pages: page 1 maps to q1, etc.
- `.tex` is an editable companion, **not an accepted upload type**. PDFs have the same
  arguments but use ReportLab typography rather than a TeX engine.
- `.data/21-127-private/`: generated reference PDFs, not in the student ZIP or frontend
  assets. The backend protects their uploaded copies through staff authorization.
- `.data/concepts127-seed.json`: local course/assignment IDs and the page mapping;
  no credentials. This and the private reference directory are Git-ignored.

All mathematical content is original fictional practice material; it does not reproduce
official handouts or actual student submissions. Rubrics explicitly accept valid
alternatives and harmless sidetracks. Intended controls are not a promise of model output.
Clicking the app's assessment action uses the configured provider and may incur charges.

## Verification

- Backend: `.venv/bin/pytest -q`
- Frontend: `cd frontend` then `npm test`, `npm run build`, `npm run lint`
- Live read-only UI check: `cd frontend` then `node tools/check-course-switching.mjs`
  (desktop/mobile, deep links, reload, identity changes, compact navigation; blocks
  model-job requests and saves screenshots to the ignored design/screenshots folder).

These changes are local; they do not deploy or modify the Vercel site.
