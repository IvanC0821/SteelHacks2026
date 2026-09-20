# Verity frontend

React + TypeScript + Vite interface for Verity: practice feedback on handwritten math homework
under an instructor's rubric, followed by human review of every final paper. Fictional data only —
see the repo root [README](../README.md) and [`docs/FRONTEND.md`](../docs/FRONTEND.md) for the
backend contract, and [`design/BRIEF.md`](design/BRIEF.md) for the design system and vocabulary.

## Run

The backend must already be running (repo root, one process):

```sh
PYTHONPATH=backend:. .venv/bin/python -m uvicorn verity.api:create_app --factory --host 127.0.0.1 --port 8026
```

Then, from `frontend/`:

```sh
npm install
npm run dev
```

Open **`http://localhost:5173`** — not `127.0.0.1`. The backend's CORS allow-list only accepts the
`localhost` origin. `VITE_API_BASE` overrides the API origin if you're not using the default
`http://127.0.0.1:8026` (see `src/api/session.ts`).

## Seed fictional data

The local demo opens without copying tokens. Choose **Student** or **Instructor / TA** on
`/session`, then switch views using **View as** at the bottom of the sidebar (inside navigation
on phones). The combined staff view uses the simple feedback-by-question graph and the
instructor account's controls. Backend TA/instructor permissions remain distinct.

`frontend/.dev/session.json` (gitignored) holds the existing demo accounts. The Vite development
server reads it at request time; credentials are not embedded in source or the built assets.
The switcher is loopback-only, absent from production builds, and can be disabled locally with
`VERITY_DEMO=0 npm run dev`. Without a local demo file, the normal token setup is available.
To create or refresh the fictional local accounts:

```sh
frontend/tools/reseed.sh
```

The script never touches a running backend process — it only checks `GET /health`, then reseeds
the fixed course "21-241 Linear Algebra (fictional section)" from the repo root with the right
`PYTHONPATH` and virtualenv (`python -m tools.seed_dev`), and prints every identity's role and user
id. Re-running it creates a fresh course each time; the previous one stays in the database. Because
it rewrites `.dev/session.json`, re-run it whenever you need a clean course, and re-read the file
at run time rather than caching ids — other tooling may reseed too.

The dropdown uses **Dana Whitfield** for Instructor / TA and **Farah Aziz** for Student.
Other identities remain available through the token setup with demo mode disabled or through
the screenshot/test helpers: **Sam Reyes** (TA), and students
**Amara Okafor** (a released final), **Ben Castellano**, **Chloe Nguyen** (two attempts, final not
reviewed), **Dev Patel**, **Elena Petrova** (one attempt, not handed in), **Farah Aziz** (two
attempts, not handed in).

## Screenshots

```sh
node tools/shot.mjs http://localhost:5173/<route> design/screenshots/<task>/<name>.png 1440x900 --as "Sam Reyes"
```

`shot.mjs` reads `.dev/session.json` and injects the named identity's token into
`localStorage["verity.session"]` before the page loads — no token ever appears in a URL or in a
screenshot. Pass `390x844` for the phone viewport. The tool prints any console errors to stdout and
exits non-zero if there were any; screenshots land under `design/screenshots/<task>/`.

## Tests

```sh
npm test         # Vitest (jsdom + @testing-library), unit tests, no backend needed
npm run build    # tsc -b && vite build, zero TypeScript errors
npm run lint     # oxlint
```

End-to-end smoke scripts live under `frontend/e2e/` — plain Node scripts driving Playwright
(no `@playwright/test` runner), one file per flow, each exiting non-zero on failure:

```sh
node e2e/run.mjs   # runs every e2e/*.mjs script and prints a pass/fail table
node e2e/session.mjs   # or run one script directly
```

They require both the backend (`:8026`) and the shared dev server (`:5173`) already running, and
a seeded `.dev/session.json`. They assert on text, ARIA roles, URLs, and network activity — never
on screenshot pixels.

## Structure

```
frontend/
  src/
    api/          typed client (client.ts, types.ts, session.ts) + this package's unit tests
    app/           shell, router, session setup                        (Task 1 — foundation)
    components/    shared building blocks used across pages            (Task 1 — foundation)
    design/        tokens, fonts, base styles                          (Task 1 — foundation)
    pdf/           PDF.js integration                                  (Task 1 — foundation)
    pages/
      grading/     grading workspace                                   (Task 2)
      rubric/      rubric studio + assignment setup                    (Task 3)
      student/     student workspace                                   (Task 4)
      course/      course home, overview, reports                      (Task 5)
      landing/     signed-out landing                                  (Task 5)
    test/          Vitest setup (jsdom, @testing-library/jest-dom)
  tools/
    shot.mjs       screenshot helper for design verification
    reseed.sh      backend health check + reseed + identity printout
  e2e/             Playwright smoke scripts (plain node, no test runner)
  design/
    BRIEF.md       design system, vocabulary, non-negotiables
    DESIGN.md      Task 1's design decisions and route table
    tasks/         one spec per task agent
    screenshots/   verification screenshots, one folder per task
```

## Ownership

Each task owns one slice of `src/` and adds routes only through the router Task 1 exposes. From
[`design/BRIEF.md`](design/BRIEF.md):

| Task | Owns | Routes |
|---|---|---|
| 1 Foundation | `src/design/**`, `src/components/**`, `src/app/**`, `src/pdf/**`, `index.html`, `src/main.tsx`, `src/index.css`, `design/DESIGN.md` | shell, router, session setup |
| 2 Grading workspace | `src/pages/grading/**` | `/a/:assignmentId/grade`, `/a/:assignmentId/grade/:submissionId` |
| 3 Rubric studio and assignment setup | `src/pages/rubric/**` | `/a/:assignmentId/rubric`, `/c/:courseId/new` |
| 4 Student workspace | `src/pages/student/**` | `/a/:assignmentId` (student), `/s/:submissionId/pages`, `/s/:submissionId` |
| 5 Course home, overview, reports, landing | `src/pages/course/**`, `src/pages/landing/**` | `/`, `/c/:courseId`, `/a/:assignmentId/overview`, `/a/:assignmentId/reports`, `/a/:assignmentId` (staff) |
| 6 Fixtures | dev provider fixtures | — |
| 7 QA (this task) | `src/api/*.test.ts`, `e2e/**`, `tools/reseed.sh`, this file | — |

Do not edit a file outside your own slice; report the change you need instead and the orchestrator
reconciles it in `src/components/`.
