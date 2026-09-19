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

The API server reaches application startup, but this managed workspace rejects binding
`127.0.0.1:8026` with `operation not permitted`. Therefore **real HTTP smoke execution remains
unverified** here. `scripts/smoke_http.py` is ready to run against a seeded local server outside
that restriction. API tests run in process and do not claim browser or network verification.

The test dependencies emit two deprecation warnings (Starlette's httpx adapter and AnyIO's
BlockingPortal alias). They do not fail the checks; no dependency upgrade was attempted without
package-index access. Dependencies were installed locally from existing dependency distributions
because outbound PyPI DNS was unavailable. The fresh-machine requirements install is not verified.

No frontend, OCR, live model integration, fine-tuning, model evaluation or public deployment is
included. Fictional scripted estimates of 2/4 and 4/4 are workflow fixtures, not empirical model
results. The destination GitHub repository URL is still needed before remote integration/push.
