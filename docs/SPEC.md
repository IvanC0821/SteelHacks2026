---
date: 2026-09-19
description: "Product contract for the fresh Verity backend"
tags: [project/verity]
---

# Verity backend contract

Related: [[README]]

Fresh implementation for SteelHacks 2026. The old HackCMU source and deployment are not used.
The authorized rebuild implements the workflow below. Frontend belongs to Claude Code;
model selection, inference hosting, OCR and weight training are deferred.

## Product

An instructor creates a course, enrolls students and TAs, and supplies questions,
private solutions, grading expectations and optional graded examples. Rubrics are
editable drafts until published. Every published version is immutable.

Students upload PDFs and assign one or more pages to every question. A page may
belong to several questions. Assessment freezes this mapping and rubric version.
Each revision is a new immutable attempt. Students see an estimated score and
possible-error categories with coaching prompts and real page anchors. Handwritten prompts
point to what to revisit without giving a worked answer. Known demo rubric requirements
have specific prompts; other requirements use category guidance. Uncertain or unreadable
work asks for clarification or human review rather than asserting an error. Fixture-mode
feedback explicitly labels scores and flags as simulated; no model has checked the paper.
No solution, criterion rationale,
raw model output or private reference reaches student responses.

Hand-in is explicit and freezes the latest attempt, even when a model is unavailable.
Later practice uploads are allowed before the deadline; they cannot replace the existing final.
Deadlines prevent new uploads, mapping changes and assessments. There is no automatic
deadline hand-in in this version. Every final paper enters the TA queue. Staff save
question scores and private reasons, then complete the whole-paper review. Releasing
the completed review makes final scores available to the student. No staff free text
is exposed to students in this build.

## Boundaries

- Bearer sessions identify users. Course membership determines access. Course creators
  are instructors; only they enroll staff/students and publish assignment/rubric setup.
- Questions carry public prompts/max points; private criteria live only in rubric versions.
  Question IDs and point totals lock after first publication. Later rubric versions must
  retain question coverage and point totals. Old attempts keep their original rubric.
- PDFs live outside public web roots. Downloads require authorization every time.
  Questions are student-readable only after publication; solutions and examples are staff-only.
- Text extraction is page-level provenance, not handwriting recognition. Empty/scanned
  pages need a transcription/OCR adapter or human review, never an automatic zero.
- The model proposes one outcome per allowed criterion: met, not_met, uncertain.
  Code validates coverage, categories, evidence and computes scores. Uncertain scores
  stay null. Raw provider exceptions/output are never reflected to students.
- Student wording comes from fixed category templates. Staff-only output may contain
  model rationales and approved rubric text; treat all document/model text as untrusted.
- Durable assessment and rubric-draft jobs use queued/running/succeeded/failed states.
  Duplicate starts return the existing job. Failed jobs are explicitly retried. Interrupted
  jobs become failed on process restart rather than silently repeated model calls.
- The default provider reports not_configured. The model team supplies the real adapter.
  Provider stubs are confined to automated tests. Arbitrary uploads never get canned grades.
- Reviews use a revision counter to reject concurrent overwrites; every mutation is audited.
  Human corrections do not retrain models, modify published rubrics or regrade other papers.
- First-attempt/latest analytics count students, distinguish unavailable results, and do
  not claim learning gains. Feedback reports are stored for staff disposition.

## Runtime

FastAPI + SQLite with atomic transactions and private PDF storage. One API process
for the hackathon. Local bearer-token provisioning; no public signup, password reset,
LMS, public deployment, distributed worker, or production identity provider included.
Use fictional data for the hackathon. API schema and frontend handoff ship with the backend.

## Acceptance

An API-driven end-to-end test must create a course and assignment, upload references,
publish a rubric, upload/map/assess two student attempts, retain both versions, hand
in, complete and release human review, and read teaching analytics. Separate checks
must reject cross-course access, other-student PDF access, solution leakage, malformed
provider output, missing/invalid mappings, stale review writes and invalid state transitions.
Restart must retain records and make interrupted jobs retryable. The default no-model
path and provider contract must both be tested. No AI accuracy claim follows from these checks.
