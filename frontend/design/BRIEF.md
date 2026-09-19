# Verity frontend brief (SteelHacks 2026)

Date: 2026-09-19. Author: Fable (design lead, orchestrator). Repo `~/code/SteelHacks2026`, branch `main`.
Every task agent reads this file first, then `design/DESIGN.md` (written by Task 1), then its own file in `design/tasks/`.

## What Verity is

Practice feedback for handwritten math homework under an instructor's rubric, followed by human review of every final paper.

- **Staff** (instructor, TA) create an assignment with questions and points, upload the blank assignment, a private solution and optional graded examples, write or request a rubric draft, review it, publish it. Then they grade each **handed-in** paper beside the original PDF with the rubric, the automated decisions as suggestions, and an editable score and private reason per question. TAs complete papers; the instructor releases scores.
- **Students** open a published assignment, upload a PDF, say which pages hold which question, click **Check my work**, wait for the job, and get an **Estimated** score with broad flags (arithmetic, logic, notation, presentation, justification, unsupported method, unreadable) pinned to pages. They can upload a revision (a new attempt; every attempt stays), and finally **Hand in** the latest attempt. A final score appears only after release.

The fresh backend in this repo owns all of that. The interface never computes a grade, never sees a solution as a student, and never invents a page region the backend did not give it.

## Constraints that shape every screen

Read `docs/FRONTEND.md` and `docs/SPEC.md` in the repo root; they are the contract. In short:

- API at `http://127.0.0.1:8026`, bearer token on every call, CORS allows `http://localhost:5173` only (open the app at `localhost`, not `127.0.0.1`). `src/api/client.ts` and `src/api/types.ts` are the typed client, written by the orchestrator from the live responses. Use them; extend them if a field is missing (and say so in your report).
- Identity: one token per browser session, stored under `localStorage["verity.session"]` (`src/api/session.ts`). The first screen is **session setup**: paste a token, we call `GET /api/me`, show the name and role, continue. There is no role switcher and no list of other people's tokens in the bundle. Local tokens for the seeded fictional course are in `frontend/.dev/session.json` (gitignored); `tools/shot.mjs --as "Sam Reyes"` injects one for screenshots.
- Fictional data only. The seeded course is "21-241 Linear Algebra (fictional section)", instructor Dana Whitfield, TA Sam Reyes, six students. Re-seed with `PYTHONPATH=backend:. .venv/bin/python -m tools.seed_dev` from the repo root (backend must be running, see `README.md`; the dev provider is enabled with `VERITY_PROVIDER_FACTORY=tools.dev_provider:create_provider`).
- Assessment states you must render honestly: `assessment === null` (not checked yet), `status: "needs_review"` with `score: null` (show "Needs review", never 0), `status: "estimated"` with a number (always labeled **Estimated**), `mode === "fixture"` (a visible "Test fixture" chip; it is not model output), capabilities `mode === "unconfigured"` (say "Automated assessment is not connected yet. You can still hand in for staff review." and keep Hand in available).
- Jobs: `POST` returns 202 with a job; poll `GET /api/jobs/{id}` until `succeeded` or `failed`; then refetch the submission. Failed jobs show the error and a **Retry** button. No fake progress percentages, no promised durations.
- Anchors: the current extraction is page-level, so `anchor.bbox` is `null`. Highlight the page and place the numbered pin in the page's margin gutter, never at an invented coordinate. If a bbox ever arrives (normalized `[left, top, right, bottom]`, origin top-left), draw the pin at its top-left and outline the box.
- Reviews: every save returns a new `revision`; send it back as `expected_revision`. On 409 `stale_review_reload`, reload the submission and tell the user what changed instead of retrying the overwrite.
- Errors: `ApiError.code` from `detail.code`; 401 is an expired session (return to session setup with a message), 403 denied, 409 state conflict (refresh and explain), 422 invalid input (show field errors).
- PDFs: `client.documentBlob(id)` fetches with authorization; create an object URL for PDF.js and revoke it on unmount. Never put a token in a query string.

## Direction (decided; refine within it, do not re-litigate)

Voice: exacting, calm, marginalia. The graded paper is the hero; the interface is the desk and the pen. White workspace, quiet tinted panels, one dark teal for actions, thin borders, restrained corners.

- **Type:** IBM Plex Sans for all UI (400, 500, 600) and IBM Plex Serif 600 for page titles, the wordmark and score numerals, loaded from the installed `@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-serif` packages (latin subsets only, no CDN). Five sizes: 12 / 14 / 16 / 20 / 28 px. Integer leading on the 4px grid: 12/16, 14/18 in components and 14/20 in paragraphs, 16/24 in panels and 16/26 in prose, 20/28, 28/36. Tabular lining numerals wherever a number can change. No all-caps labels, no letter-spaced eyebrows, no bold paragraphs.
- **Color, in OKLCH with hex fallbacks:** one teal scale at hue 212 (50, 100, 300, 500 for links, 600 for the primary fill and active nav, 800 pressed). Tinted neutrals toward the teal hue (chroma 0.004–0.014), never pure gray. Semantic: deduction red, credit green, hint yellow, a quiet lavender for anything AI-suggested (always with a visible "AI suggested" label, never color alone), error, warning, focus ring. Hover is a neutral step; selection is the teal-100 tint with a left rule. 60/30/10: one primary per view.
- **Layout:** left rail 240px with real navigation (brand, course, the assignment list with a status chip each, footer with the current identity and Sign out). On grading, rubric and feedback routes the rail collapses to a 56px icon strip so the paper gets the width. Workspaces are full-height panes (`100dvh`), page headers are one 52px row. Content pages (assignments, overview, reports) use a 1040px measure, left-aligned.
- **Spacing** 2 / 4 / 8 / 12 / 16 / 24 / 32 / 48. **Radius** 6px controls, 8px panels, never nested cards. **Borders** 1px tinted hairline for dividers, a 3.3:1 stronger line for anything you can click or type into. **Shadow** at most `0 1px 2px` on floating elements.
- **The one bold thing:** scores and point deltas. Serif tabular numerals slightly larger than body; deductions in red ink with a numbered circle on the paper that matches the numbered chip in the panel; credit in green ink. Everything else stays quiet.
- **Motion:** only in answer to an action. 0ms hover-in, 100ms state change, 200ms panel or drawer, 350ms toast; ease-out; `prefers-reduced-motion` respected; no entrance animations.
- **Icons:** `lucide-react`, 16px at stroke 1.5 beside 14px text, 20px at stroke 1.75 beside 16px text, icons take the color of the text beside them, 44px hit targets on icon-only buttons.
- **Vocabulary (use exactly):** Assignments; an assignment keeps its own title ("Homework 1"); Rubric (never standards); Rubric v1; Publish rubric; Save and next; Complete review; Release scores; Reopen; Check my work; Upload revision; Hand in; Estimated; Needs review; Test fixture; Final score. Sentence case everywhere. No terminal period on labels. No "→" glued to link text. No middle-dot meta strings when a short sentence works.
- **Chart discipline:** draw a chart only when data exists; otherwise a guided empty state in one sentence. Horizontal bars per question, latest attempt as the bar, first attempt as a tick, the finding as the title, no axes or legend.

## Non-negotiables

- Fictional data only. No real student PDFs, names or grades anywhere, including screenshots.
- No token in a URL, no staff token in a student view, no frontend role switch.
- Never show a null score as 0. Never call an estimate a grade. Never show the private solution, criteria, decisions or staff reasons to a student (the API strips them; do not re-add them from staff routes).
- Accessibility floor: visible focus ring on every control, body text ≥ 4.5:1, 44px touch targets on primary controls, keyboard-reachable actions (the grading rubric outcomes have number keys), `aria-current` on active nav, `aria-label` on icon-only buttons, `role="status"` for job progress and save confirmations, dialogs trap focus and close on Escape.
- Responsive: 1440×900 and 390×844 both work with no horizontal page scroll. Phone gets a 52px header with a menu button that opens the rail as a drawer.
- Tests: `npm test` (Vitest) must pass; add unit tests for pure logic you write (mapping completeness, score formatting, revision reconciliation, chip states). `npm run build` must pass with zero TypeScript errors. `npm run lint` clean.
- Do not commit. The orchestrator commits after each task.
- Do not edit files another task owns (see Ownership). If you need a change there, write it in your report.

## Verification protocol (every task)

1. Backend up (`curl http://127.0.0.1:8026/health`), frontend up (`npm run dev` in `frontend/`, background it; it must be `http://localhost:5173`).
2. Screenshots: `node tools/shot.mjs http://localhost:5173/<route> design/screenshots/<task>/<name>.png 1440x900 --as "Sam Reyes"` and again with `390x844`. Identities: "Dana Whitfield" (instructor), "Sam Reyes" (TA), "Amara Okafor" (student with a released final), "Chloe Nguyen" (two attempts, final not reviewed), "Elena Petrova" (one attempt, not handed in), "Farah Aziz" (two attempts, not handed in). The tool prints console errors and exits 1 if there were any.
3. Open every screenshot you take with the Read tool and critique it against this brief before you call anything done. Iterate; three rounds is normal.
4. `npm test`, `npm run build`, `npm run lint`.
5. Final report: files changed, screenshot paths, test counts, anything deferred and why, any field you had to add to `types.ts`, any place you had to touch a file outside your ownership.

Reference reading before touching a dimension: `~/.claude/plugins/cache/impeccable/impeccable/2.1.1/source/skills/impeccable/reference/{typography,color-and-contrast,spatial-design,interaction-design,ux-writing,responsive-design}.md`.

## Ownership and sequence

Task 1 (foundation) runs alone and first and owns `src/design/**`, `src/components/**`, `src/app/**` (shell, router, session setup), `src/pdf/**`, `index.html`, `src/main.tsx`, `src/index.css`, and `design/DESIGN.md`. Tasks 2 to 5 then run concurrently, each owning its own folder under `src/pages/` and its own CSS file, adding routes only through the route table Task 1 exposes:

| Task | Owns | Routes |
|---|---|---|
| 2 Grading workspace | `src/pages/grading/**` | `/a/:assignmentId/grade`, `/a/:assignmentId/grade/:submissionId` |
| 3 Rubric studio and assignment setup | `src/pages/rubric/**` | `/a/:assignmentId/rubric`, `/c/:courseId/new` |
| 4 Student workspace | `src/pages/student/**` | `/a/:assignmentId` (student), `/s/:submissionId/pages`, `/s/:submissionId` |
| 5 Course home, overview, reports, landing | `src/pages/course/**`, `src/pages/landing/**` | `/`, `/c/:courseId`, `/a/:assignmentId/overview`, `/a/:assignmentId/reports`, `/a/:assignmentId` (staff) |

Shared needs discovered mid-task go in your report; the orchestrator reconciles in `src/components/`.
