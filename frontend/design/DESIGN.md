# Verity design system

Status: ready for Tasks 2–5

The contract Tasks 2 to 5 build on. `design/BRIEF.md` has the direction; this file is the exact
surface. Task 1 owns everything named here: if you need a change, write it in your report.

## 1. Tokens (`src/design/tokens.css`)

Prefixed `--v-`. Colours are authored in OKLCH inside `@supports (color: oklch(...))`; the preceding
`:root` block carries the sRGB hex computed from the same triple, so the two never drift.

### Teal, hue 212

| Token | Hex | Use |
|---|---|---|
| `--v-teal-50` | `#eff9fb` | info ground, hover on a teal surface |
| `--v-teal-100` | `#ddf1f6` | selection tint (always with a 2px left rule) |
| `--v-teal-300` | `#95c8d2` | decorative only, never text |
| `--v-teal-500` | `#0c7686` | links, active icon |
| `--v-teal-600` | `#09606e` | the primary fill, active nav, focus underline |
| `--v-teal-800` | `#033d46` | pressed primary, toast ground |

### Tinted neutrals (chroma 0.004–0.014 toward hue 212)

| Token | Hex | Use |
|---|---|---|
| `--v-surface` | `#ffffff` | the workspace and the paper |
| `--v-panel` | `#f7fafb` | the rail, side panels, the setup ground |
| `--v-panel-strong` | `#edf4f5` | a panel inside a panel, disabled fills |
| `--v-hover` | `#e7eff1` | the one neutral hover step |
| `--v-canvas` | `#e0e8ea` | the ground the PDF pages sit on |
| `--v-line` | `#d9e2e4` | 1px hairline divider |
| `--v-line-strong` | `#7d898b` | the border of anything you can click or type into |
| `--v-muted` | `#5c6769` | secondary text |
| `--v-ink` | `#182123` | body text |

### Semantic (each an ink plus a soft fill)

`--v-deduction` `#a5292b` / `--v-deduction-soft` `#ffedeb` · `--v-credit` `#176933` /
`--v-credit-soft` `#e6f6e8` · `--v-hint` `#6e5c09` / `--v-hint-soft` `#fcf2cd` ·
`--v-ai` `#614999` / `--v-ai-soft` `#f4f1ff` · `--v-error` `#a91518` / `--v-error-soft` `#ffeeec` ·
`--v-warn` `#8a4603` / `--v-warn-soft` `#ffefe3` · `--v-focus` `#086a9c`.

`--v-deduction` is points taken off a paper, `--v-error` is a request that failed; they are close on
purpose and never appear together. `--v-ai` never appears without the words "AI suggested".

### Measured contrast

Computed from the hex values with the WCAG 2.1 relative-luminance formula. Body and muted text clear
4.5:1 on every ground they are used on; control borders and the focus ring clear 3:1. No failures.

| Foreground | Background: ratio | Floor |
|---|---|---|
| `--v-ink` #182123 | surface **16.40** · panel **15.63** · panel-strong **14.73** · hover **14.07** · teal-100 **14.05** · canvas **13.20** | ≥ 4.5 |
| `--v-muted` #5c6769 | surface **5.83** · panel **5.56** · panel-strong **5.24** · hover **5.01** · teal-100 **5.00** · canvas **4.70** | ≥ 4.5 |
| `--v-teal-500` #0c7686 | surface **5.31** · panel **5.07** · teal-50 **4.96** · teal-100 **4.55** | ≥ 4.5 |
| `--v-teal-600` #09606e | surface **7.22** · panel **6.88** · teal-100 **6.18** | ≥ 4.5 |
| `--v-surface` #ffffff | teal-600 **7.22** · teal-800 **11.93** · deduction **7.11** · credit **6.76** · hint **6.57** · error **7.48** · warn **7.10** | ≥ 4.5 |
| `--v-deduction` #a5292b | surface **7.11** · deduction-soft **6.29** | ≥ 4.5 |
| `--v-credit` #176933 | surface **6.76** · credit-soft **6.03** | ≥ 4.5 |
| `--v-hint` #6e5c09 | surface **6.57** · hint-soft **5.85** | ≥ 4.5 |
| `--v-ai` #614999 | surface **7.19** · ai-soft **6.46** | ≥ 4.5 |
| `--v-error` #a91518 | surface **7.48** · error-soft **6.66** | ≥ 4.5 |
| `--v-warn` #8a4603 | surface **7.10** · warn-soft **6.32** | ≥ 4.5 |
| `--v-line-strong` #7d898b | surface **3.61** · panel **3.44** · panel-strong **3.24** | ≥ 3 |
| `--v-focus` #086a9c | surface **5.91** · panel **5.64** · canvas **4.76** · teal-100 **5.06** · panel-strong **5.31** | ≥ 3 |
| `--v-line` #d9e2e4 | surface **1.32** | n/a |
| `--v-surface` #ffffff | canvas **1.24** | n/a |
| `--v-teal-300` #95c8d2 | surface **1.83** | n/a |

### Everything else

**Type** `--v-font-sans` (IBM Plex Sans 400/500/600) · `--v-font-serif` (IBM Plex Serif 600) ·
sizes `--v-text-{12,14,16,20,28}` · leading `--v-lead-12` 16, `--v-lead-14` 18, `--v-lead-14-prose`
20, `--v-lead-16` 24, `--v-lead-16-prose` 26, `--v-lead-20` 28, `--v-lead-28` 36 ·
`--v-track-tight` −0.006em · `--v-weight-{regular,medium,semibold}`.

**Space** `--v-space-{2,4,8,12,16,24,32,48}`. **Radius** `--v-radius-6` controls, `--v-radius-8`
panels, `--v-radius-round`; never nest a card in a card. **Border** `--v-border-hairline` and
`--v-border-control`. **Shadow** `--v-shadow-float`, floating elements only.
**Motion** `--v-motion-instant` 0 · `--v-motion-state` 100 · `--v-motion-panel` 200 ·
`--v-motion-toast` 350 · `--v-ease` `cubic-bezier(.2,0,0,1)`; only in answer to an action, never on
entrance, and `prefers-reduced-motion` is handled once in `base.css`.
**Icons** `--v-icon-16` / `--v-stroke-16` 1.5, `--v-icon-20` / `--v-stroke-20` 1.75; use `<Icon>`.
**Layout** `--v-rail` 240 · `--v-rail-collapsed` 56 · `--v-panel-width` 360 · `--v-measure` 1040 ·
`--v-header-row` 52 · `--v-control` 40 · `--v-control-lg` 44.
**z-index** `--v-z-sticky` 200 · `--v-z-backdrop` 300 · `--v-z-dialog` 400 · `--v-z-toast` 500.

## 2. Type classes (`src/design/base.css`)

`body` is 14/18 sans, `tabular-nums lining-nums`, `font-synthesis: none`. Use these, not raw sizes.

| Class | Size / leading | Use |
|---|---|---|
| `.v-label-12` | 12/16 medium, muted | table headers, meta, captions |
| `.v-label-14` | 14/18 medium | form labels, rail items, toolbar read-outs |
| `.v-copy-14` | 14/20 regular | body copy in a list or a panel |
| `.v-copy-16` | 16/26 regular | prose in a panel |
| `.v-heading-14` | 14/18 semibold | a heading inside a component |
| `.v-heading-16` | 16/24 semibold | a panel heading |
| `.v-heading-20` | 20/28 serif semibold | the page title in `PageHeader` |
| `.v-heading-28` | 28/36 serif semibold | the one big title on a content page |
| `.v-score` | serif, tabular lining | any number that can change |

Helpers: `.v-muted`, `.v-measure` (max-width 1040), `.v-visually-hidden`. Links are `--v-teal-500`
and underlined in prose. The focus ring is one rule: `:focus-visible` → 2px `--v-focus`, 2px offset.

### CSS naming

Every stylesheet in the app is global, so the prefix is the only thing keeping five concurrent page
folders out of each other's rules.

- A page CSS class is prefixed by its area: `v-course-`, `v-student-`, `v-grade-`, `v-rubric-`,
  `v-landing-`. So `.v-grade-queue`, `.v-student-attempt`, `.v-rubric-row`. The BEM form of the same
  prefix counts: `.v-grade`, `.v-grade__paper` and `.v-grade--dense` are all inside `v-grade`.
- Only `src/components/**` and `src/pdf/**` own bare `v-` names (`.v-button`, `.v-pdf-page`). A page
  never defines, and never redefines, a bare `v-` class.
- **No page stylesheet may write a selector that does not start with its own prefix.** Not a bare
  element (`button {}`), not a shared class (`.v-chip {}`), not a token override on `:root`. To
  change how a shared component looks inside your page, scope it: `.v-grade-panel .v-chip { … }`,
  and if you need that more than once, ask for a prop instead.
- Modifiers and elements hang off the prefixed block in the same BEM-ish shape the components use:
  `.v-grade-queue__row`, `.v-grade-queue--dense`, and `.is-selected` / `.is-busy` for state (an
  `.is-*` class only ever appears after a prefixed one, never on its own).

## 3. Components (`src/components/`)

Import from the barrel: `import { Button, Score } from "../../components";`. Each component is one
`.tsx` and one `.css`, and imports its own CSS, so a page only imports its own stylesheet.

### `<Button>` → `.v-button`

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `"primary" \| "secondary" \| "quiet" \| "danger"` | `"secondary"` | one primary per view |
| `size` | `"md" \| "lg"` | `"md"` | 40px / 44px tall |
| `icon` | `LucideIcon` | — | leading icon, sized from `size` |
| `busy` | `boolean` | `false` | overlays a spinner, keeps the width, sets `aria-busy`, disables |
| `disabled` | `boolean` | — | pass `title` with the one-sentence reason |
| `iconOnly` | `boolean` | `false` | 44px square; `children` becomes the accessible name |
| `children` | `ReactNode` | — | the label |

Plus every `<button>` attribute. Classes: `.v-button--{variant}`, `.v-button--{size}`, `.is-busy`.

```tsx
<Button variant="primary" size="lg" icon={Check} busy={saving}>Save and next</Button>
<Button variant="quiet" icon={X} iconOnly aria-label="Close">Close</Button>
<Button variant="primary" disabled title="Map every question first">Check my work</Button>
```

### `<Chip>` → `.v-chip`

`tone`: `"neutral" | "teal" | "deduction" | "credit" | "hint" | "ai" | "fixture"` (default neutral) ·
`number?: number` draws the knocked-out numbered circle that matches the pin on the paper ·
`selected?: boolean` adds the teal tint and left rule · `children`, `className`, `title`.

`tone="ai"` always prints **AI suggested** and `tone="fixture"` always prints **Test fixture**;
`children` then becomes a quiet detail after the fixed label. Colour is never the only signal.

### `<StatusChip>`

`{ kind: "review", status: ReviewStatus }` → Not started · In review · Completed · Released.
`{ kind: "assessment", status: "not_checked" | "estimated" | "needs_review" }` → Not checked ·
Estimated · Needs review. Both maps are total, so a new backend status is a type error, not a blank.
`assessmentState(submission.assessment)` (from the barrel) derives the state; null → `"not_checked"`.

### `<Score>` → `.v-score-value` / `.v-score-null`

`value: number | null` · `max?: number` · `estimated?: boolean` adds "Estimated" underneath ·
`size?: "sm" | "md" | "lg"` (16 / 20 / 28) · `delta?: boolean` signs it and colours by sign ·
`nullLabel?: string` (default "Needs review").

`value === null` renders the muted `nullLabel`, never 0. A real 0 renders as `0`.
Helpers live in `score-format.ts` and come out of the barrel: `formatPoints(7.46)` → `"7.5"`,
`formatDelta(-1.5)` → `"−1.5"`, `deltaToneClass(n)` → `v-score--credit | v-score--deduction |
v-score--neutral`. `assessmentState` is in `status.ts` and `activeTab` in `tabs-url.ts`; a component
file exports only its component, so import the helpers from `../../components`, not from `./Score`.

```tsx
<Score value={submission.assessment?.score ?? null} max={30} size="lg" estimated />
```

### `<Dialog>` → `.v-dialog`

`open` · `title` · `description?` (one sentence) · `children?` · `primary?: DialogAction` ·
`secondary?: DialogAction` · `onClose`. `DialogAction = { label, onClick, busy?, disabled?, danger? }`.
Focus is trapped, Escape closes, the backdrop dismisses, focus returns to the trigger.
Use it only for an irreversible action; prefer an undo toast otherwise.

### `<Drawer>` → `.v-drawer`

`open` · `title` · `side?: "right" | "left"` (default right) · `width?` (default `--v-panel-width`) ·
`children` · `onClose`. Travels 40px with opacity over 200ms. Escape closes.

### `<ToastProvider>` and `useToast()`

Already mounted in `App`. `const { toast } = useToast(); toast({ message, tone?, action? })` where
`tone` is `"confirm" | "error"` and `action` is `{ label, onClick }` (use it for undo). The layer is
`role="status"`, enters over 350ms and clears after 5s. Consequential confirmations only.

### `<Notice>` → `.v-notice`

`tone?: "info" | "success" | "warn" | "error"` · `title?` · `children` · `action?: ReactNode` ·
`className`. An inline block, never floating. `tone="error"` carries `role="alert"`.

`tone="success"` is the credit green (`--v-credit` on `--v-credit-soft`, `CircleCheck`) and reports
a state that has settled — scores released, a review completed, a rubric published. It is not a save
confirmation: a consequential save is a `useToast()` confirm, which clears itself. Use `success` only
when the state it names is still true the next time the page loads.

### `<Field>` → `.v-field`

`label` (always visible) · `as?: "input" | "textarea" | "select"` · `value` · `onChange(value)` ·
`type?` · `placeholder?` · `hint?` · `error?` (the 422 field error, wired through
`aria-describedby` and `aria-invalid`) · `disabled` · `required` · `rows?` · `children` (options) ·
`trailing?` · `autoFocus` · `name` · `id` · `className`.

### `<Table>` → `.v-table`

`columns: Column<T>[]` where `Column = { key, header, cell(row), align?: "start" | "end", width? }` ·
`rows: T[]` · `rowKey(row)` · `onRowClick?` (makes rows keyboard-activatable) · `isSelected?` ·
`empty?: ReactNode` · `caption?` (visually hidden) · `className`. Borderless rows on hairlines; no
zebra, no card. Right-align anything numeric so the tabular figures line up.

### `<Tabs>` → `.v-tabs`

`tabs: { id, label, badge? }[]` · `param?` (search param, default `"tab"`) · `defaultTab?` ·
`label` (the `aria-label` for the tablist) · `onChange?`. URL-driven, so a link reaches a tab and
Back works. Arrow keys move; Tab leaves the group. `activeTab(location.search, tabs)` (barrel) reads
the active id in the page body without rendering the control.

### `<EmptyState>` → `.v-empty`

`title` (short noun phrase) · `children` (exactly one sentence) · `action?` (at most one) · `icon?` ·
`bare?` (drops the panel chrome) · `className`.

### `<Spinner>`, `<Kbd>`, `<Icon>`

`<Spinner size={16|20} label?>` — `label` makes it a `role="status"`.
`<Kbd>h</Kbd>` — one key cap.
`<Icon glyph={Check} size={16|20} />` — applies the 16/1.5 and 20/1.75 rule and inherits
`currentColor`. Never import a lucide icon straight into JSX.

### `flags.ts`

`flagLabel(category)` → the reader-facing word ("Unsupported method"). `flagTone(category)` → the
shared `MarkTone`: arithmetic, logic and unsupported_method read as deduction; notation,
presentation, justification, unreadable and needs_review read as hint. Override per page if your
screen has a better reason, but keep the paper and the panel in agreement. `FLAG_LABEL` is the total
map behind `flagLabel`, for when a page needs to list every category. All three come out of the
barrel: `import { flagLabel, flagTone, FLAG_LABEL } from "../../components";`.

## 4. PDF (`src/pdf/`)

```tsx
const { blob, url, error, loading } = usePdfBlob(client, submission.document_id);
```
Fetches with authorization, creates the object URL and revokes it on unmount. Pass `null` to hold
off. No token ever reaches a URL.

```tsx
<PdfViewer
  blob={blob} page={page} onPageChange={setPage}
  zoom={zoom} onZoomChange={setZoom}
  marks={marks} onMarkSelect={setSelectedId}
  hideMarks={hideMarks} onHideMarksChange={setHideMarks}
  toolbarRight={<Button variant="primary">Save and next</Button>}
/>
```

| Prop | Type | Notes |
|---|---|---|
| `blob` | `Blob` | from `usePdfBlob` |
| `page` / `onPageChange` | `number` / `(n) => void` | controlled, 1-based; scrolling reports back |
| `zoom` / `onZoomChange` | `"fit-width" \| number` | fit-width recomputes on resize |
| `marks` | `Mark[]` | see below |
| `onMarkSelect` | `(id: string) => void` | omitting it makes the pins non-interactive |
| `hideMarks` / `onHideMarksChange` | `boolean` | bound to the `h` key; omit the setter to drop the toggle |
| `toolbar` | `boolean` | `false` hides the built-in `ViewerToolbar` |
| `toolbarRight` | `ReactNode` | the right slot of the toolbar row |
| `label` | `string` | accessible name for the scroll region |

`Mark = { id, page, bbox: [l,t,r,b] | null, label: string | number, tone: "deduction" | "hint" |
"credit", selected? }`. With `bbox === null` — which is what the current page-level extraction always
returns — the pin goes in the page's 32px left gutter and the page edge is tinted; nothing is drawn
at an invented coordinate. With a usable bbox the box is outlined and the pin sits at its top-left.
`isUsableBbox(bbox)` is the guard (four finite numbers in 0..1 with positive area);
`marksByPage(marks)` groups them.

Pages render as canvases in one vertical scroll on `--v-canvas`, 24px gap, at device pixel ratio,
lazily (within 600px of the viewport).

```tsx
<PageThumbnails blob={blob} selected={[2, 3]} onSelect={setPage}
  overlay={(n) => <Chip tone="teal">{`Q${map[n]}`}</Chip>} overlayPosition="bottom"
  layout="grid" tileWidth={116} />
```
`selected: number[]` · `onSelect?` · `overlay?: (page) => ReactNode` (the chip slot over each tile) ·
`overlayPosition?: "top" | "bottom"` · `tileWidth?` · `layout?: "row" | "grid"` · `label?`.

`overlayPosition` (default `"top"`) says which end of the tile the chip slot sits on. A page's first
lines are the ones a reader recognises it by, so use `"bottom"` whenever the overlay is persistent —
the question chips on the page-mapping grid — and keep `"top"` for a short-lived badge.

### Lazy loading

`PdfViewer` and `PageThumbnails` are thin `React.lazy` wrappers; the real components live beside
them in `PdfViewerImpl.tsx` and `PageThumbnailsImpl.tsx` and pull pdf.js in with them. The names,
the props and the import path are unchanged, so nothing in `src/pages/**` changes — the chunk simply
arrives on first mount, behind a `Suspense` fallback that reserves the pane on the `--v-canvas`
ground with the shared `Spinner` (`Pane.tsx`, classes `.v-pdf-pane` and `.v-thumbs-pane`).

Keep it that way: import the viewer from `../../pdf` or `../../pdf/PdfViewer`, never from
`PdfViewerImpl`, or pdf.js lands back in the main bundle. `vite.config.ts` also splits React, React
DOM and the router into a `vendor-react` chunk. Main chunk 161 kB, vendor 313 kB, pdf.js 430 kB.

`<ViewerToolbar>` is exported separately if a page needs the row without the scroll:
`page`, `pageCount`, `onPageChange`, `zoom`, `onZoomChange`, `hideMarks?`, `onHideMarksChange?`,
`right?`.

## 5. Shell and routing (`src/app/`)

```tsx
import { useClient, useUser, useCapabilities, useSession, useAssignment } from "../../app";
```

| Export | Returns |
|---|---|
| `useSession()` | `{ user, capabilities, client, courses, signOut, refresh }` — throws with no session |
| `useClient()` | the `VerityClient` for the current identity |
| `useUser()` | `User` |
| `useCapabilities()` | `Capabilities` — check `mode === "unconfigured"` before offering Check my work |
| `usePrimaryCourse()` | `courses[0] ?? null` |
| `useAssignment(id)` | `Resource<AssignmentDetail>` |
| `useAssignments(courseId)` | `Resource<Assignment[]>` |
| `useSubmission(id)` | `Resource<Submission>` |
| `useSubmissions(id, finalOnly?)` | `Resource<Submission[]>` |
| `useResource(key, fetcher, deps)` | the generic behind them |

`Resource<T> = { data, error, loading, refetch() }`; `error` is the `ApiError.code`. A 401 is not
swallowed — it rethrows so `SessionProvider` returns to setup. Data stays visible while refetching.

`formatDue(iso)` → `"Due Sep 24, 4:53 PM"` or `"No due date"`; `formatTime(iso)`, `formatDate(iso)`,
`isPastDue(iso)` live in `src/design/format.ts`.

### `<PageHeader>` → `.v-page-header`

Every page starts with exactly one. `title` (serif 20/28) · `left?` (back link or switcher) ·
`right?` (the one primary) · `subtitle?` (quiet, hidden on a phone) · `sticky?` · `className`.
It is 52px tall. Never stack two headers.

### Shell

240px rail: brand → course name → the assignment list (`NavLink` with `aria-current`, an icon, and
for staff a Published/Draft chip) → footer with `Sam Reyes · TA` and a quiet Sign out. A route with
`handle.workspace === true` collapses it to a 56px icon strip with a toggle whose choice persists in
`localStorage["verity.rail.workspace-expanded"]`; content routes always show the full rail. At
≤ 760px the rail becomes a left `Drawer` behind a 52px header's menu button.

`<main class="v-shell__main">` is a full-height flex column with `overflow: hidden`; your page owns
its own scrolling (`flex: 1; min-height: 0; overflow: auto`) so the header row stays put.

### Route fragments

Each page folder owns `src/pages/<area>/routes.tsx`, default-exporting `RouteObject[]`.
`src/app/routes.tsx` imports all five and spreads them into the Shell's children.

- Paths are **absolute** (`"/a/:assignmentId/grade"`).
- `handle: RouteHandle = { workspace?: boolean; roles?: Role[]; title?: string }`.
  `STAFF`, `STUDENT` and `INSTRUCTOR` are exported from `src/app/route-meta.ts`.
- The Shell reads the merged handle through `useMatches()`; a reader in the wrong role sees a
  one-sentence `EmptyState`, not a crash.
- Two fragments may declare the same path when they differ by role. `mergeByPath` collapses them
  into a single route whose element is `<RoleSplit>`; they must agree on `workspace`.
- The import is static, so a module-level error in one fragment takes the whole app down. Keep
  `routes.tsx` importable at all times.

| Path | Owner | File | Workspace | Roles |
|---|---|---|---|---|
| `/` | 5 | `pages/landing/routes.tsx` | no | all |
| `/c/:courseId` | 5 | `pages/course/routes.tsx` | no | all |
| `/c/:courseId/new` | 3 | `pages/rubric/routes.tsx` | no | instructor |
| `/a/:assignmentId` | 4 + 5 | student and course fragments, split by role | no | all |
| `/a/:assignmentId/overview` | 5 | `pages/course/routes.tsx` | no | staff |
| `/a/:assignmentId/reports` | 5 | `pages/course/routes.tsx` | no | staff |
| `/a/:assignmentId/rubric` | 3 | `pages/rubric/routes.tsx` | **yes** | staff |
| `/a/:assignmentId/grade` | 2 | `pages/grading/routes.tsx` | **yes** | staff |
| `/a/:assignmentId/grade/:submissionId` | 2 | `pages/grading/routes.tsx` | **yes** | staff |
| `/s/:submissionId/pages` | 4 | `pages/student/routes.tsx` | **yes** | student |
| `/s/:submissionId` | 4 | `pages/student/routes.tsx` | **yes** | student |
| `/session` | 1 | `app/SessionSetup.tsx` | — | signed out |
| `/dev/components` | 1 | `app/DevComponents.tsx` | no | all |
| `/dev/pdf` | 1 | `app/DevPdf.tsx` | yes | all |

`/dev/components` is the visual regression sheet and `/dev/pdf` is the viewer harness. Keep both.
Anything unmatched redirects to `/`.

### Session

`SessionProvider` loads `localStorage["verity.session"]`, calls `me()`, `capabilities()` and
`courses()`, and renders `SessionSetup` when there is none. A 401 anywhere returns to setup with
"That session expired. Paste a current token to continue." Setup is the wordmark, one sentence, a
token field, the API base under **Advanced**, and Continue; on success it holds "Continuing as Dana
Whitfield, instructor" for 700ms, then goes to `/`.

## 6. Vocabulary and voice

Use exactly: Assignments · Rubric · Rubric v1 · Publish rubric · Save and next · Complete review ·
Release scores · Reopen · Check my work · Upload revision · Hand in · Estimated · Needs review ·
Test fixture · Final score. Sentence case everywhere. No terminal period on a label. No "→" glued to
link text. No middle-dot meta strings when a short sentence works. Never call an estimate a grade;
never render a null score as 0; never show a fixture result without the Test fixture chip.

## 7. Reaching the seeded identities

Local tokens are in `frontend/.dev/session.json` (gitignored). Never paste one into a URL or a file.

```
node tools/shot.mjs http://localhost:5173/<route> design/screenshots/<task>/<name>.png 1440x900 --as "Sam Reyes"
```
`--as` takes: `Dana Whitfield` (instructor) · `Sam Reyes` (TA) · `Amara Okafor` (student, released
final) · `Ben Castellano` · `Chloe Nguyen` (two attempts, final not reviewed) · `Dev Patel` ·
`Elena Petrova` (one attempt, not handed in) · `Farah Aziz` (two attempts, not handed in).
Flags: `390x844` for the phone, `--full`, `--wait <sel>`, `--click <sel>`, `--fill <sel> <val>`,
`--sleep <ms>`, `--2x`. It prints console errors and exits 1 if there were any.

A `--full` capture of a Shell page clips, because the shell is `100dvh` with an inner scroll. Use a
tall viewport (`1440x3500`) instead.

Course `21-241 Linear Algebra (fictional section)` has `Homework 1` (published rubric, four
questions, 30 points) and `Homework 2` (no published rubric). Re-seed from the repo root with
`PYTHONPATH=backend:. .venv/bin/python -m tools.seed_dev`.

## 8. Screenshots of record (`design/screenshots/01/`)

`session-setup.png` / `session-setup-390.png` · `shell-1440.png` / `shell-390.png` /
`shell-390-drawer.png` (rail as a drawer) · `components.png` (1440×3500) / `components-390.png` ·
`pdf-viewer.png` (latest attempt, fit width) · `pdf-viewer-three-pages.png` (attempt 1 at 50%, five
gutter pins across three pages) · `pdf-viewer-hidemarks.png` (the same with marks hidden).

`design/screenshots/polish/` holds the code-split proof: `grading-lazy-1440.png`,
`student-feedback-lazy-1440.png`, `dev-pdf-lazy.png` (the lazy viewer and thumbnails on a real
paper, no console errors), `components-notice.png` (the sheet with `Notice tone="success"`) and
`shell-390-drawer.png` / `shell-390-drawer-closes.png` (the rail drawer opens, and navigating
closes it).
