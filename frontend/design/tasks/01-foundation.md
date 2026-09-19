# Task 1: foundation (design system, app shell, PDF viewer, session setup)

You run alone and first. Tasks 2 to 5 build on what you leave behind, so every primitive here must be documented in `design/DESIGN.md` with its props and the class names it renders. Read `design/BRIEF.md` fully before starting. The Vite + React + TypeScript app is already scaffolded in `frontend/`; `src/api/{types,client,session}.ts` exist and are the API contract. `App.tsx`, `index.css` and `main.tsx` are the untouched Vite template: replace them.

## Deliverables

### 1. Tokens and base layer (`src/design/`)

- `tokens.css`: one `:root` block. Teal scale (50, 100, 300, 500, 600, 800) in OKLCH at hue 212 with hex fallbacks in a preceding block; tinted neutrals (surface, panel, panel-strong, hover, canvas, line, line-strong, muted, ink); semantic (deduction, credit, hint, ai, error, warn, focus, each with a soft fill); type (font families, five sizes, the leading tokens per size and role, tracking); space (2, 4, 8, 12, 16, 24, 32, 48); radius (6, 8, round); shadow; motion (instant 0, state 100, panel 200, toast 350, plus the ease); icon sizes; layout (rail 240, rail-collapsed 56, panel-width 360, measure 1040, header-row 52, control 40, control-lg 44). Prefix `--v-`. Every color choice measured: body text ≥ 4.5:1, muted ≥ 4.5:1, control borders ≥ 3:1. Write the measured ratios into DESIGN.md.
- `fonts.css`: `@font-face` for IBM Plex Sans 400/500/600 and IBM Plex Serif 600, latin subset, from `node_modules/@fontsource/ibm-plex-sans/files/…` and `…-serif/files/…` (import the woff2 via Vite URL imports or copy the four files into `src/design/fonts/`; either is fine, no CDN). Metric-matched fallbacks so layout does not jump. `font-synthesis: none`.
- `base.css`: reset, body type (14/18 default in the workspace, tabular-nums), composed type classes `.v-label-12`, `.v-label-14`, `.v-copy-14`, `.v-copy-16`, `.v-heading-14`, `.v-heading-16`, `.v-heading-20`, `.v-heading-28` (serif), `.v-score` (serif tabular numerals), links (teal-500, underlined in prose), focus ring, reduced-motion block.

### 2. Components (`src/components/`), each a small typed React component with its own CSS file

- `Button` (`primary | secondary | quiet | danger`, sizes md 40px and lg 44px, optional leading icon, `busy` state that keeps width and shows a spinner, disabled with a `title` reason).
- `Chip` (neutral, teal, deduction, credit, hint, ai with the "AI suggested" wording built in, plus a `Test fixture` variant) and `StatusChip` for review status (Not started, In review, Completed, Released) and assessment status (Not checked, Estimated, Needs review).
- `Score` (serif tabular numerals; renders `null` as "Needs review" in muted text, never 0; `estimated` prop adds the word Estimated under it; `delta` variant for signed points in deduction red or credit green).
- `Dialog` (focus trap, Escape, backdrop, `title`, `primary` and `secondary` actions), `Drawer` (right side, 200ms travel of 40px with opacity, not the full width), `Toast` provider with `useToast()` (350ms, `role="status"`, only for consequential confirmations), `Notice` (info, warn, error inline blocks), `Field` (label, input or textarea or select, error text, hint), `Table` (borderless rows, header in `.v-label-12`), `Tabs` (URL-driven), `EmptyState` (one sentence and one action), `Spinner`, `Kbd`.
- `Icon` wrapper around `lucide-react` applying the 16/1.5 and 20/1.75 sizing rule.

### 3. PDF viewer (`src/pdf/`)

`PdfViewer` built on `pdfjs-dist` (set `GlobalWorkerOptions.workerSrc` to the package worker via a Vite `?url` import). Props: `blob: Blob`, `page` (controlled current page), `onPageChange`, `zoom: "fit-width" | number`, `marks?: Array<{ id: string; page: number; bbox: [number, number, number, number] | null; label: string | number; tone: "deduction" | "hint" | "credit"; selected?: boolean }>`, `onMarkSelect`, `hideMarks`. Renders every page as a canvas in a vertical scroll on the `--v-canvas` ground with a 24px gap, fit-to-width by default, keeps pixel ratio crisp, lazy renders offscreen pages. Marks with a bbox draw an outlined box with the numbered circle at its top-left; marks with `bbox === null` draw the numbered circle in the page's left gutter and tint the page edge. Includes a `ViewerToolbar` (page n of m with prev/next, zoom out / fit / zoom in, hide marks toggle bound to the `h` key, an optional right slot). Also export `usePdfBlob(client, documentId)` that fetches with `client.documentBlob`, returns `{ blob, error, loading }` and revokes on unmount, and `PageThumbnails` (renders each page small, selectable, with a slot for chips over each tile; Task 4 uses it for page mapping).

Prove it with the seeded data: load Chloe Nguyen's latest attempt PDF (`.dev/session.json` → `client.submissions(assignmentId)` as Chloe → `documentBlob`) and screenshot three marks on three pages.

### 4. App shell and routing (`src/app/`)

- `main.tsx` mounts `<App />` with `react-router-dom` (`createBrowserRouter`). `App.tsx` provides `SessionProvider` (`useSession()` → `{ session, user, capabilities, client, signOut }`), which loads the stored session, calls `me()` and `capabilities()`, and renders `SessionSetup` when there is no valid session or a 401 arrives from anywhere (`client` errors with `expired` bubble to it through an `onExpired` callback).
- `SessionSetup` route `/session`: the wordmark, one sentence ("Paste the access token your instructor or the local setup printed."), a token field, an API base field prefilled from `defaultApiBase()` and collapsed under "Advanced", Continue as the one primary; on success it shows "Continuing as Dana Whitfield, instructor" for a beat and redirects to `/`.
- `Shell` layout: rail 240px (brand mark and wordmark "Verity", the current course name, the assignment list with a `StatusChip` each from `client.assignments`, footer with the identity line "Sam Reyes · TA" and a quiet Sign out), a `<main>` with an outlet. Routes flagged `workspace: true` in the route table collapse the rail to 56px (icons only, tooltips) with a toggle; the choice persists in localStorage. Phone (≤ 760px): a 52px header with a menu button that opens the rail as a drawer.
- `routes.tsx`: the route table with placeholders for every route in the BRIEF's ownership table so Tasks 2 to 5 replace one file each. Guard by role: student routes for students, staff routes for ta/instructor; the wrong role sees a one-sentence EmptyState, not a crash. Landing `/` for a signed-in user redirects to their course (`courses()[0]`) or shows "You are not enrolled in a course yet."
- `PageHeader`: the one 52px row (title in `.v-heading-20`, optional left slot for back/switcher, right slot for the primary).

### 5. `design/DESIGN.md`

The contract for Tasks 2 to 5: token table with hex and measured contrast, type classes, every component with props and an example, the PDF viewer API, the shell and route table, the vocabulary, the motion rules, and "how to reach each seeded identity". Keep it under 400 lines and exact.

### 6. Tests and checks

Vitest for `Score` (null → "Needs review", estimated label, delta sign and color class), `Chip` variants, the session store (load/save/clear, malformed JSON), and the route guard. `npm run build`, `npm run lint` clean. Screenshots in `design/screenshots/01/`: session setup, shell with the assignment list as Sam Reyes at 1440×900 and 390×844 (phone rail drawer open), the PDF viewer proof, and a component sheet route `/dev/components` (keep it; it is the visual regression page) at 1440×900.

## Notes

- `index.html`: title "Verity", `<link rel="icon" href="/favicon.svg">` with a mark you draw (teal rounded square, white check), `lang="en"`, `color-scheme: light`.
- Keep files small and single-purpose. A component is one `.tsx` and one `.css`.
- Do not build any page beyond the placeholders; that is Tasks 2 to 5.
