---
date: 2026-09-19
description: "Evidence and remaining verification limits for the initial backend rebuild"
tags: [project/verity]
---

# Verification

Related: [[README]] · [[SPEC]] · [[FRONTEND]]

The initial backend was built fresh in `/Users/a1111/code/SteelHacks2026`. No old Verity
application code, real student records, provider keys or deployment was used.

- 33 automated tests pass against the real FastAPI routes and temporary SQLite/PDF storage.
  They cover upload → map → assess → revise → hand in → TA review → release → analytics;
  identity/course/ownership checks; private reference/feedback projection; version preservation;
  missing-model behavior; malformed provider output; retry/restart recovery; page mapping;
  review revision conflicts; private identifier leakage; and rubric-generation edit races.
- Ruff lint and formatting checks pass. Python compilation succeeds.
- Six new fictional PDF fixtures parse and render; extracted text fits page bounds.
  The revised-work PDF was visually inspected.
- OpenAPI and response examples are generated from this application. Examples contain fictional
  data and fixture results, with no session tokens.
- A separate read-only review found private-identifier projection and reference-upload/rubric-job
  race defects. Both were fixed and covered by regression tests.

After the workspace access settings changed, the pinned requirements installed successfully
into a fresh Python 3.13 virtual environment. All 33 tests and Ruff lint/format checks passed
again in that environment.

**Live HTTP smoke passed** against a real Uvicorn server on a temporary loopback port, using
`scripts/smoke_http.py`. It uploaded/mapped two fictional attempts, polled their assessment jobs,
verified scripted estimates of 2/4 and 4/4, handed in the revision, saved/completed the TA review,
released its 4/4 grade and checked analytics. The temporary server was stopped after verification.
This verifies the HTTP workflow; no frontend/browser rendering or real model inference is claimed.

The test dependencies emit two deprecation warnings (Starlette's httpx adapter and AnyIO's
BlockingPortal alias). They do not fail the checks. Verification used the pinned versions without
an unrelated dependency upgrade. Fresh-environment installation was verified on this Mac; other
operating systems and Python versions have not been tested.

No frontend, OCR, live model integration, fine-tuning, model evaluation or public deployment is
included. Fictional scripted estimates of 2/4 and 4/4 are workflow fixtures, not empirical model
results. The authenticated GitHub CLI confirmed `IvanC0821/SteelHacks2026` already exists,
is private and was empty before publication. Ivan authorized pushing the complete project there.
The local publication branch is `main`; the backend and presentation files are included.
Runtime databases, session tokens and virtual environments are excluded from Git.
