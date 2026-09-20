#!/usr/bin/env node
// Read-only student feedback regression, using existing Farah Aziz attempts.
// No uploads, assessments, reports or hand-ins: API writes are blocked and fail the check.
// Run with the seeded backend and Vite up: node e2e/feedback-ux.mjs
import { chromium } from "playwright";
import { BASE_URL, apiGet, assert, identity, openPage, pollFor } from "./lib.mjs";

const farah = identity("Farah Aziz");
const [assignment, submissions] = await Promise.all([
  apiGet(farah.session.token, farah.file.api, `/assignments/${farah.file.assignment_id}`),
  apiGet(farah.session.token, farah.file.api, `/assignments/${farah.file.assignment_id}/submissions`),
]);
const attempts = [...submissions].sort((a, b) => b.version - a.version);
const latest = attempts.find((attempt) => attempt.assessment);
assert(latest, "Farah needs an existing assessed attempt for this read-only check");
const attention = latest.assessment.questions.filter((q) => q.flags.length || q.score === null || q.status === "needs_review");
assert(attention.length, "Farah's latest assessed attempt needs feedback to exercise question jumps");
const uncertainty = attempts.find((attempt) => !attempt.final && attempt.assessment?.score === null);
assert(uncertainty, "Farah needs an existing unhanded-in, uncertain assessment to check the review explanation");
const uploadsOpen = !assignment.due_at || new Date(assignment.due_at).getTime() > Date.now();
const revisionPrimary = uploadsOpen && !attempts.some((attempt) => attempt.final);
const feedbackLabel = `Feedback · ${attention.length} question${attention.length === 1 ? "" : "s"} to revisit`;

async function insideViewport(page, locator, label) {
  assert(await locator.isVisible(), `${label} must be visible`);
  const bounds = await locator.boundingBox();
  const viewport = page.viewportSize();
  assert(bounds && bounds.width > 0 && bounds.height > 0 && bounds.x >= -1 && bounds.y >= -1 &&
    bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1,
  `${label} must fit inside ${viewport.width}×${viewport.height}, got ${JSON.stringify(bounds)}`);
}

async function checkActions(page, scope) {
  // The accessible file input shares this name; check the visible trigger, without opening it.
  const revision = scope.locator("button").filter({ hasText: /^Upload revision$/ });
  const handIn = scope.getByRole("button", { name: "Hand in", exact: true });
  await insideViewport(page, revision, "Upload revision");
  await insideViewport(page, handIn, "Hand in");
  if (revisionPrimary) {
    assert((await revision.getAttribute("class")).includes("v-button--primary"), "flagged practice work should prioritize Upload revision");
    assert((await handIn.getAttribute("class")).includes("v-button--secondary"), "Hand in should remain a secondary action");
    assert(await revision.isEnabled(), "revision upload must remain available before the deadline");
    if (latest.id === attempts[0].id && latest.mapping && Object.keys(latest.mapping).length) {
      assert(await handIn.isEnabled(), "flags must not prevent handing in the latest mapped attempt");
    }
  } else if (!uploadsOpen) {
    assert(await revision.isDisabled(), "revision uploads should close after the deadline");
  }
}

async function checkComparison(page) {
  const previous = attempts.find((attempt) => attempt.version < latest.version);
  if (!previous) return;
  const comparison = page.locator(".v-student-comparison");
  await comparison.getByText(`Compare with attempt ${previous.version}`, { exact: true }).click();
  assert(await comparison.getByRole("button", { name: `View attempt ${previous.version}`, exact: true }).isVisible(),
    "comparison must preserve access to the prior attempt");
  if (previous.assessment && latest.rubric_id && latest.rubric_id === previous.rubric_id) {
    const text = await comparison.innerText();
    assert(text.includes("Same rubric") && text.includes("not proof that an answer is correct"),
      "comparison must explain the limits of changes in flags");
    for (const question of latest.assessment.questions) {
      const title = assignment.questions.find((q) => q.id === question.question_id)?.title ?? question.question_id;
      assert(await comparison.getByText(title, { exact: true }).isVisible(), `comparison should include ${title}`);
    }
  } else {
    assert((await comparison.innerText()).includes("Comparison needs two completed checks using the same rubric and questions"),
      "incompatible attempts should explain why comparison is unavailable");
  }
  await comparison.locator("summary").click();
}

async function desktop(page) {
  await page.goto(`${BASE_URL}/s/${latest.id}`, { waitUntil: "networkidle" });
  await page.getByRole("region", { name: "What to revisit" }).waitFor();
  await checkActions(page, page.locator(".v-student-feedback-actions"));
  await checkComparison(page);

  // Jump to the last flagged question so this exercises scrolling, not just a nearby card.
  const target = [...attention].reverse().find((q) => q.flags.some((flag) => flag.anchors.length)) ?? attention.at(-1);
  const title = assignment.questions.find((q) => q.id === target.question_id)?.title ?? target.question_id;
  await page.locator(".v-student-next__questions").getByRole("button", { name: title, exact: true }).click();
  const finding = page.locator(".v-student-finding").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  await pollFor(() => finding.evaluate((node) => document.activeElement === node), Boolean);
  await insideViewport(page, finding.getByRole("heading", { name: title, exact: true }), "jumped-to question heading");
  if (target.flags.some((flag) => flag.anchors.length)) {
    const selectedPin = page.locator(".v-pdf-pin.is-selected").first();
    await selectedPin.waitFor();
    await insideViewport(page, selectedPin, "paper pin for the jumped-to question");
    assert(await finding.locator('.v-student-flag[aria-current="true"]').count() === 1,
      "question jump should select the corresponding flag");
  }
}

async function mobile(page) {
  await page.goto(`${BASE_URL}/s/${latest.id}`, { waitUntil: "networkidle" });
  const handle = page.getByRole("button", { name: feedbackLabel, exact: true });
  await handle.waitFor();
  assert(await handle.getAttribute("aria-expanded") === "false", "feedback sheet should start collapsed");
  assert(!await page.locator("#student-feedback-body").isVisible(), "collapsed feedback must be hidden");
  await insideViewport(page, handle, "Feedback handle with question count");
  await checkActions(page, page.locator(".v-student-sheet__actions"));

  const toolbar = page.locator(".v-viewer-toolbar");
  for (const name of ["Previous page", "Next page", "Zoom out", "Fit to width", "Zoom in"]) {
    await insideViewport(page, toolbar.getByRole("button", { name, exact: true }), name);
  }
  await insideViewport(page, toolbar.getByRole("button", { name: /^Hide marks/ }), "Hide marks");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "phone page must not scroll horizontally");

  const pin = page.getByRole("button", { name: /^Finding \d+ on page \d+$/ }).first();
  await pin.waitFor();
  const [, number, paperPage] = (await pin.getAttribute("aria-label")).match(/^Finding (\d+) on page (\d+)$/);
  await pin.click();
  await pollFor(() => handle.getAttribute("aria-expanded"), (value) => value === "true");
  const selected = page.locator('.v-student-flag[aria-current="true"]');
  await selected.waitFor();
  assert(await selected.locator(".v-chip__number").innerText() === number, "paper pin must reveal the matching numbered flag");
  assert(await selected.getByText(`Page ${paperPage}`, { exact: true }).isVisible(), "selected flag should name the pin's page");
  await pollFor(() => selected.evaluate((node) => document.activeElement === node), Boolean);
  await insideViewport(page, selected, "focused flag after opening the sheet");
  await checkActions(page, page.locator(".v-student-sheet__actions"));

  await handle.click();
  assert(await handle.getAttribute("aria-expanded") === "false", "Feedback handle should close the sheet");
  assert(!await page.locator("#student-feedback-body").isVisible(), "closing the sheet must hide the body again");
  await checkActions(page, page.locator(".v-student-sheet__actions"));
}

async function uncertainPractice(page) {
  await page.goto(`${BASE_URL}/s/${uncertainty.id}`, { waitUntil: "networkidle" });
  const estimate = page.locator(".v-student-total");
  await estimate.waitFor();
  assert(await estimate.getByText("Needs review", { exact: true }).isVisible(), "uncertain work must not be shown as a numeric score");
  const explanation = await estimate.innerText();
  assert(explanation.includes("Check that your writing and steps are clear") && explanation.includes("ask for help"),
    "uncertain practice work should offer a useful next step");
  assert(explanation.includes("Hand in when you're ready for staff review"), "staff review should be tied to handing in");
  assert(!/staff (member )?will (review|look)|queued|waiting for staff/i.test(explanation),
    "an unhanded-in practice attempt must not imply it is already queued for staff review");
}

const browser = await chromium.launch();
const failures = [];
try {
  for (const [name, viewport, check] of [
    ["desktop jump, actions and comparison", { width: 1440, height: 900 }, desktop],
    ["mobile 390", { width: 390, height: 844 }, mobile],
    ["mobile 320", { width: 320, height: 844 }, mobile],
    ["uncertain practice explanation", { width: 1440, height: 900 }, uncertainPractice],
  ]) {
    const { page, context, consoleErrors } = await openPage(browser, { as: "Farah Aziz", viewport });
    const writes = [];
    await context.route("**/api/**", async (route) => {
      const method = route.request().method();
      if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
        writes.push(`${method} ${new URL(route.request().url()).pathname}`);
        await route.abort();
      } else await route.continue();
    });
    try {
      await check(page);
      assert(!writes.length, `read-only check attempted an API mutation: ${writes.join("; ")}`);
      assert(!consoleErrors.length, `console errors: ${consoleErrors.join("; ")}`);
      console.log(`PASS feedback-ux.mjs: ${name}`);
    } catch (error) {
      failures.push(`${name}: ${error.message}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  console.error(`FAIL feedback-ux.mjs\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`PASS feedback-ux.mjs: existing attempt ${latest.version}; no API writes`);
}
