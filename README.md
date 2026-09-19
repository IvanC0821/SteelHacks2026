---
date: 2026-09-19
description: "Run and integrate the fresh Verity backend"
tags: [project/verity]
---

# Verity · SteelHacks 2026

Practice feedback under an instructor's rubric, followed by human review of every final paper.
Fresh backend implementation. Claude Code will build the frontend; the model is supplied later.

Working API: courses and memberships, private PDFs, published rubric versions, student page mapping,
immutable assessment attempts, jobs/retries, revisions, hand-in, TA review, grade release,
feedback reports, audit history and first/latest analytics. SQLite and local PDF storage persist
across restarts. The normal server runs with **no model configured**.

Related: [[docs/SPEC]] · [Frontend handoff](docs/FRONTEND.md) · [Model adapter](docs/MODEL.md).

This repository contains application code, configuration, API documentation and automated tests.
The model team owns model integration, training data and evaluation. Presentation materials live
separately and no demo dataset is bundled here.

## Install

Python 3.12+ and uv. Run from this repository root:

```sh
uv venv --python 3.13
uv pip install -r requirements.txt
```

`requirements.txt` pins the dependency versions used for verification. `pyproject.toml` is the
dependency manifest. Installation into a fresh Python 3.13 virtual environment, all 33 API tests,
and lint/format checks have passed. Package-index access is required
when dependencies are not cached. No old Verity application code was reused.

## Start the backend

```sh
PYTHONPATH=backend:. .venv/bin/python -m uvicorn verity.api:create_app --factory --host 127.0.0.1 --port 8026
```

Open `http://127.0.0.1:8026/docs` for interactive API documentation. Health is `/health`.
`GET /api/capabilities` tells the frontend whether assessment is configured. No missing-model
request is assigned a fake score. Staff can create/publish rubrics manually and review final papers.

Data defaults to `.data/`; override with `VERITY_DATA_DIR`. Run **one API process**. Jobs run in
background threads in that process. Interrupted queued/running jobs become failed/retryable on
restart. A retry is explicit to avoid silently repeating model calls.

## Local identities

```sh
PYTHONPATH=backend .venv/bin/python -m verity.cli "Instructor" --role instructor
PYTHONPATH=backend .venv/bin/python -m verity.cli "Student" --role student
```

Replace the names with the intended local users. Each command prints a user ID and a bearer token
that expires after 24 hours. Keep tokens private and use the current user's token as
`Authorization: Bearer <token>`. Use the same `VERITY_DATA_DIR` as the API server.

The instructor creates a course, then enrolls the returned user IDs through the course-members
endpoint. Staff create assignments and supply their own materials through the API. There is no
public signup or self-selected staff role. CLI access is trusted local administration.

## Verify

```sh
.venv/bin/python -m pytest -q
.venv/bin/ruff check backend scripts
.venv/bin/ruff format --check backend scripts
```

The tests exercise the real API with temporary databases, including role separation, private
solutions, malformed output, page mapping, version history, restart recovery and human review.
Minimal PDF inputs and a provider stub exist only under `backend/tests/`; they exercise software
behavior and are not model training or evaluation examples.

Regenerate the OpenAPI contract without creating users or documents:

```sh
PYTHONPATH=backend:. .venv/bin/python -m scripts.export_contract
```

## Deliberate limits

- No model weights, vendor API keys, paid calls or training run. Supply a provider using
  `VERITY_PROVIDER_FACTORY=your_module:create_provider`; see [the contract](docs/MODEL.md).
- Embedded PDF text extraction is available; handwriting OCR is not. Staff can add a sourced
  transcript before assessment. No exact annotation boxes are invented from page-only extraction.
- Explicit hand-in before the deadline. No automatic deadline finalization or replacement of an
  existing final. Later practice uploads remain separate from the handed-in paper.
- Local hackathon backend: no production identity provider, rate limiter, hostile-PDF sandbox,
  distributed worker, LMS integration or public deployment. Use fictional inputs.
- No frontend screens yet. [Claude's handoff](docs/FRONTEND.md) contains exact routes and states.

Text extraction behavior follows [pypdf's documented limits](https://pypdf.readthedocs.io/en/stable/user/extract-text.html).
API tests use [FastAPI's TestClient workflow](https://fastapi.tiangolo.com/tutorial/testing/).
