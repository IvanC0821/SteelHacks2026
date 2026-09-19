---
date: 2026-09-19
description: "Claude Code handoff with routes, response states and frontend acceptance"
tags: [project/verity]
---

# Claude Code frontend handoff

Build the interface against this fresh backend. Related: [[README]] · [[SPEC]] · [[MODEL]].
Use `docs/openapi.json` for request schemas and `docs/examples.json` for real API response examples.
The response examples are fictional fixture results; do not turn them into hardcoded application data.

## Run and connect

Follow the root README's install and demo commands. API defaults to `http://127.0.0.1:8026`.
Allowed frontend origins default to `http://localhost:3000` and `http://localhost:5173`; override
`VERITY_CORS_ORIGINS` with comma-separated exact origins if needed. No wildcard credentials.

Use the current identity's bearer token on every `/api` call. For local development, paste a token
from `.data/demo-credentials.json` into a session setup screen or inject it in a local server session.
Do not embed instructor/TA tokens in a student bundle or commit local credentials. The production
authentication UX is a separate integration; the backend currently provisions expiring local tokens.

API errors use `detail.code`. Validation adds `detail.fields` with field paths/types. Handle 401
as expired session, 403 as denied, 409 as a state conflict requiring refresh/action, 422 as invalid input.
There are no student solution/rationale fields to hide in CSS; the API removes them.

## Screens and calls

| Screen/action | Request |
|---|---|
| Identity and capabilities | `GET /api/me`, `GET /api/capabilities` |
| Course navigation | `GET /api/courses` |
| Assignment list | `GET /api/courses/{id}/assignments` |
| Assignment setup/details | `GET /api/assignments/{id}` |
| Staff create course | `POST /api/courses` with `{name}` |
| Staff roster | `GET /api/courses/{id}/members` |
| Instructor enroll user | `POST /api/courses/{id}/members` with `{user_id,role}` |
| Instructor create assignment | `POST /api/courses/{id}/assignments` with `{title,questions,due_at?}` |
| Upload PDF | `POST /api/assignments/{id}/documents?kind=...` multipart field `file` |
| Original PDF | `GET /api/documents/{id}/file` with authorization |
| Edit draft rubric | `PUT /api/assignments/{id}/rubric-draft` with `{criteria,instructor_notes}` |
| Request generated draft | `POST /api/assignments/{id}/rubric-jobs` |
| Publish reviewed rubric | `POST /api/assignments/{id}/rubric-publish` |
| Attempt history | `GET /api/assignments/{id}/submissions` |
| Attempt details/results | `GET /api/submissions/{id}` |
| Map pages | `PUT /api/submissions/{id}/mapping` with `{questions:{q1:[1,2],q2:[2]}}` |
| Check work | `POST /api/submissions/{id}/assessment-jobs` |
| Poll job | `GET /api/jobs/{id}` |
| Retry failed job | `POST /api/jobs/{id}/retry` |
| Hand in | `POST /api/submissions/{id}/hand-in` |
| TA final queue | `GET /api/assignments/{id}/submissions?final_only=true` |
| Save question review | `PUT /api/submissions/{id}/review` with `{expected_revision,questions:{q1:{score,reason}}}` |
| Finish whole paper | `POST /api/submissions/{id}/review/complete` with `{expected_revision}` |
| Instructor release | `POST /api/submissions/{id}/review/release` with `{expected_revision}` |
| Instructor reopen | `POST /api/submissions/{id}/review/reopen` with `{expected_revision,reason}` |
| Student report/help | `POST /api/submissions/{id}/reports` with `{question_id,kind,message}` |
| Reports list | `GET /api/assignments/{id}/reports` |
| Staff resolve report | `PUT /api/reports/{id}` with `{status,staff_note}` |
| Overview/teaching | `GET /api/assignments/{id}/analytics` |

Upload kinds: `questions`, `solution`, `graded_example` are instructor actions. `submission` is a
student action and returns a new submission object. Reference uploads return document metadata.
Published question documents are student-readable; solution/example documents are staff-only.
Every original PDF requires an authenticated fetch. Fetch a Blob and create/revoke an object URL
for PDF.js; do not put bearer tokens in download query strings.

## Student flow

1. Open published assignment. Upload creates an attempt, then load its PDF and page thumbnails.
2. Map all questions; support shared pages and multi-page answers. Indices are **1-based**.
3. Start a job, poll until `succeeded` or `failed`, then refetch the submission. The initial 202
   means queued, not finished. Failed jobs can be retried. Duplicate starts reuse the existing job.
4. `assessment.score` is an estimate, and may be null. Display null as unavailable, never zero.
   `assessment.mode === "fixture"` must visibly say “Scripted demo”; it is not live model output.
5. Render `questions[].flags[]` using provided message/category. An anchor's bbox is normalized,
   origin at top-left. With bbox null, highlight/select the page without inventing a precise marker.
   Anchor IDs are local to a flag; key with submission/question/flag/anchor IDs.
6. After checking, the attempt is sealed. To change work or mapping, upload a revision. All attempts
   remain accessible. There is no attempt cap. Keep first/latest views distinct.
7. Hand in explicitly, even if no assessment exists. Only latest may be handed in, only one final
   per student/assignment. Later practice uploads cannot replace it. The deadline prevents new
   uploads/checks/mapping/hand-in; no automatic hand-in is implemented.
8. A final score appears only once review status is `released`. Reopening returns it to pending.
   The provisional automated estimate remains independently labeled.

No artificial progress percentages or promised assessment latency. Explain `not_configured`
with “Automated assessment is not connected yet. You can still hand in for staff review.”

## Staff flow

Create questions with stable IDs and total points, upload references, edit or request a rubric,
review it, then publish. Question setup is immutable in this initial API; create a new assignment
for a different question set. Later rubric versions retain question IDs and total points. Adding
references requires publication to attach them to a new version. Past attempts keep prior versions.

The grading screen uses the **final queue**, not the latest practice attempt. Show original PDF,
mapped question, that attempt's rubric, optional automated decisions, and editable human score/reason.
Each save returns a new review `revision`; send it as `expected_revision` next time. On
`stale_review_reload`, reload and reconcile rather than retrying an overwrite. Completion requires
all questions and no pending assessment job. TAs complete; instructors release/reopen.

Staff reasons remain private. Student reports include no private resolution note. Resolution never
changes a score automatically. Corrections do not propagate into other papers or model weights.

Analytics `first` means the earliest upload, `latest` the most recent upload, including practice after
hand-in. Missing/uncertain scores are excluded from means. Show sample count with averages; empty
means are null. Category counts are distinct students per question. Rubric IDs indicate potentially
mixed standards. Changes in flags/estimates are not evidence of learning.

## Acceptance before live demo

Verify real PDF upload/rendering, shared-page mapping, revision history, clear model/fixture states,
polling failure/retry, original final paper in TA queue, concurrent review conflict, released score,
small-screen navigation and keyboard access. Do not add a frontend-only role switch with access to
all users' tokens. A separately labeled local demo harness may select local fictional sessions.
