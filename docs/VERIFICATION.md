---
date: 2026-09-19
description: "Backend verification evidence and integration limits"
tags: [project/verity]
---

# Verification

Related: [[README]] · [[SPEC]] · [[FRONTEND]]

The backend was built fresh in `/Users/a1111/code/SteelHacks2026`. No old Verity application
code, real student records, provider keys or deployment was used.

- 33 automated tests pass against the real FastAPI routes and temporary SQLite/PDF storage.
  They cover upload → map → assess → revise → hand in → TA review → release → analytics;
  identity/course/ownership checks; private reference/feedback projection; version preservation;
  missing-model behavior; malformed provider output; retry/restart recovery; page mapping;
  review revision conflicts; private identifier leakage; and rubric-generation edit races.
- Ruff lint and formatting checks pass. Python compilation succeeds.
- The OpenAPI contract is generated from the application without seeding records or model calls.
- A separate read-only review found private-identifier projection and reference-upload/rubric-job
  race defects. Both were fixed and covered by regression tests.
- The pinned requirements installed successfully into a fresh Python 3.13 virtual environment
  on this Mac. Other operating systems and Python versions have not been tested.

Tests generate minimal PDF parser inputs in memory and inject a test-only provider stub. The
stub's outcomes verify software behavior, including score arithmetic and unavailable results.
They do not measure model accuracy or constitute a training/evaluation dataset.

A real Uvicorn HTTP workflow also passed before removal of the standalone demo scripts.
That historical check exercised upload, assessment jobs, revision, hand-in, human review,
release and analytics with a stub provider. It was not a live-model test.

The pinned test dependencies emit two non-failing deprecation warnings (Starlette's httpx
adapter and AnyIO's BlockingPortal alias).

No frontend, OCR, live model integration, fine-tuning, model evaluation or public deployment
is included. The model team owns model integration and data creation. The repository contains
code, configuration, software documentation and tests; pitch files and demo datasets are kept
out of the current tree. Runtime databases, session tokens and virtual environments are ignored.
