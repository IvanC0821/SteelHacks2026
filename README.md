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

The [presentation folder](presentation/README.md) includes the editable pitch deck, exact spoken
script, fictional illustration records and blank evaluation worksheet for the team.

## Install

Python 3.12+ and uv. Run from this repository root:

```sh
uv venv --python 3.13
uv pip install -r requirements.txt
```

`requirements.txt` pins the dependency versions used for verification. `pyproject.toml` is the
dependency manifest. This workspace's network could not reach PyPI, so its isolated `.venv` was
populated from locally installed dependency distributions. No old Verity application code was reused.
The install commands above require package-index access on a fresh machine.

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

## Fictional demo

```sh
PYTHONPATH=backend:. .venv/bin/python -m scripts.seed_demo
VERITY_PROVIDER_FACTORY=scripts.demo_data:create_provider PYTHONPATH=backend:. .venv/bin/python -m uvicorn verity.api:create_app --factory --host 127.0.0.1 --port 8026
```

The seeder creates an instructor, TA, two students, one published assignment, private solution
and downloadable questions. Tokens expire after 24 hours and live in the ignored
`.data/demo-credentials.json`. Never ship that file to a browser bundle or commit it.
Use each role's own token as `Authorization: Bearer <token>`.

Fresh PDFs are in `demo/pdfs/`. `attempt-1.pdf` has the right values without required reasoning;
`attempt-2.pdf` adds elimination steps; `alternative.pdf` uses substitution. `unreadable.pdf` is
blank and receives no score. The demo provider accepts **only these exact PDF hashes, question,
mapping and rubric**. Every result says `mode: fixture`. These outcomes demonstrate the application
workflow, not Nemotron inference, model accuracy, fine-tuning or learning gains.

For a full HTTP rehearsal against a disposable seeded database:

```sh
PYTHONPATH=backend:. .venv/bin/python -m scripts.smoke_http
```

This creates two attempts, hands in the second, saves a TA review and releases its grade. Use a
new `--data-dir` with the seeder and the matching `VERITY_DATA_DIR` on the server for a fresh live demo.

Provision another local identity:

```sh
PYTHONPATH=backend .venv/bin/python -m verity.cli "Fictional student" --role student
```

An instructor enrolls the returned user ID through the course-members endpoint. There is no
public signup or self-selected staff role. CLI access is trusted local administration.

## Verify

```sh
.venv/bin/python -m pytest -q
.venv/bin/ruff check backend scripts
.venv/bin/ruff format --check backend scripts
```

The tests exercise the real API with temporary databases, including role separation, private
solutions, malformed output, page mapping, version history, restart recovery and human review.

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
