# Fictional homework fixtures

Renders the demo PDFs for `tools/seed_dev.py`: six students' handwriting-style Homework 1 papers
plus the instructor's typed question sheet and solution. **Everything is invented** — the course,
the names, the papers, the grades. No real student work is used anywhere.

```sh
node tools/fixtures/make.mjs            # PDFs -> out/
node tools/fixtures/make.mjs --preview  # also first-page PNGs -> preview/ (needs pdftoppm)
```

Playwright is resolved from `frontend/node_modules`, so install the frontend deps first; the
renderer itself has no dependencies of its own. Chromium must be present:
`cd frontend && npx playwright install chromium --only-shell`.

## What it produces

| File | Look |
|---|---|
| `out/questions.pdf` | typed, clean — the instructor's blank assignment |
| `out/solution.pdf` | typed, clean — staff-only instructor solution |
| `out/<first-name>-v1.pdf`, `-v2.pdf` | three pages of handwriting per student |

Page 1 is Q1 and Q2, page 2 is Q3, page 3 is Q4, matching the `mapping` in `seed_dev.py`. Every
page carries the header `<Student name> · Homework 1 · page n of 3 (fictional)`.

`seed_dev.py` uploads a file from `out/` when it exists and otherwise falls back to its own typed
writer, so the seed still runs on a machine without Node.

## How the content stays honest

`content.mjs` mirrors the mathematics in `seed_dev.py` version for version: v1 leaves row
operations unlabeled, writes the solution as a list, argues the subspace claim from two examples
and skips the verification; v2 fixes all four. Neither version states the zero vector, because the
seeded TA review says so in as many words. On top of that: Amara Okafor carries a sign slip into
her revision (again, the seeded review flags it), Dev Patel drops a minus sign in Q4, and Amara and
Chloe each strike out and rewrite one line on v1.

## Constraints worth remembering

- **Text must extract.** The backend anchors flags to pypdf page text, so no images and nothing
  that makes Chromium paint a run twice. `text-shadow` duplicated every word; `opacity` on a run
  made it come out letter-spaced; a space between two inline-blocks vanished entirely, which is
  why each word span carries its own trailing space under `white-space:pre`.
- **Size.** Gradients get rasterized on print and pushed each file past 700 KB. Flat fills plus
  positioned rule divs keep them near 60 KB, well under the 300 KB budget.
- **Determinism.** The baseline wobble comes from a seeded PRNG, so a rebuild is byte-stable.

Verify both after a change:

```sh
PYTHONPATH=backend:. .venv/bin/python -c "
import pathlib
from pypdf import PdfReader
for p in sorted(pathlib.Path('tools/fixtures/out').glob('*.pdf')):
    n = [len(pg.extract_text().strip()) for pg in PdfReader(str(p)).pages]
    print(p.name, round(p.stat().st_size/1024, 1), 'KB', n)
"
```

## Fonts

`fonts/` holds the subsetted woff2 faces used by the renderer, all SIL Open Font License:
Caveat and Patrick Hand for the handwriting (licenses alongside them), IBM Plex Sans and Serif for
the typed staff documents, matching the frontend.
