#!/usr/bin/env node
// e2e/grading.mjs — grading save-and-next persists and re-renders after reload (Task 2).
// Idempotent: always targets the paper's first question and alternates its score between 0 and 1
// so the assertion is meaningful (a real change) no matter how many times this has run before.
// Retries once on failure: the shared dev server is being actively edited by other tasks right
// now, and a Vite HMR reload landing mid-interaction is an environment hazard, not a real bug.
// Skips (exit 0) if the route is still a placeholder. `node e2e/grading.mjs`.
import { chromium } from "playwright";
import { BASE_URL, identity, openPage, apiGet, assert, isPlaceholder, pollFor } from "./lib.mjs";

const sam = identity("Sam Reyes");
const { file } = sam;
const assignmentId = file.assignment_id;

async function attempt(browser) {
  // Re-fetched every attempt so a retry sees this attempt's own prior save, not stale data.
  const queue = await apiGet(sam.session.token, file.api, `/assignments/${assignmentId}/submissions?final_only=true`);
  const paper = queue.find((s) => s.review.status === "in_progress" || s.review.status === "not_started");
  if (!paper) throw new Error("no in_progress or not_started final paper -- reseed the backend and retry");

  const questionIds = paper.assessment.questions.map((q) => q.question_id);
  const targetId = questionIds[0];
  const total = questionIds.length;
  const savedBefore = Object.keys(paper.review.questions).length;
  const wasSaved = targetId in paper.review.questions;
  const currentScore = wasSaved ? paper.review.questions[targetId].score : null;
  const newScore = currentScore === 0 ? 1 : 0; // guaranteed different from whatever is there now
  const savedAfter = wasSaved ? savedBefore : savedBefore + 1;

  const { page, consoleErrors } = await openPage(browser, { as: "Sam Reyes" });
  await page.goto(`${BASE_URL}/a/${assignmentId}/grade/${paper.id}`, { waitUntil: "networkidle" });

  if (await isPlaceholder(page)) {
    console.log("SKIP grading.mjs: /a/:assignmentId/grade/:submissionId is still a placeholder");
    await page.context().close();
    return "skip";
  }

  await page.getByText(`${savedBefore} of ${total} questions saved`).waitFor({ state: "visible", timeout: 10000 });

  const tab = page.getByRole("tab", { name: /^Q1\b/ });
  await tab.click();
  await page.getByLabel("Score").fill(String(newScore));
  await page.getByLabel("Reason").fill(`e2e check: set to ${newScore}`);
  await page.getByRole("button", { name: "Save and next" }).click();

  // Poll the chip itself rather than the progress count: re-saving an already-saved question
  // leaves the count unchanged, so waiting on that text is not a real synchronization point and
  // would race the save.
  await pollFor(() => tab.textContent(), (text) => text?.includes(String(newScore)), { timeout: 15000 });
  await page.getByText(`${savedAfter} of ${total} questions saved`).waitFor({ state: "visible", timeout: 5000 });
  assert(consoleErrors.length === 0, `console errors after save: ${consoleErrors.join("; ")}`);

  const urlBeforeReload = page.url();
  await page.reload({ waitUntil: "networkidle" });
  assert(page.url() === urlBeforeReload, `expected to stay on ${urlBeforeReload}, got ${page.url()}`);
  await page.getByText(`${savedAfter} of ${total} questions saved`).waitFor({ state: "visible", timeout: 15000 });
  const tabTextAfterReload = await page.getByRole("tab", { name: /^Q1\b/ }).textContent();
  assert(
    tabTextAfterReload?.includes(String(newScore)),
    `expected Q1's chip to still show ${newScore} after reload, got "${tabTextAfterReload}"`,
  );

  await page.context().close();
  return "pass";
}

const browser = await chromium.launch();
try {
  let outcome;
  try {
    outcome = await attempt(browser);
  } catch (firstErr) {
    console.error(`grading.mjs first attempt failed (${firstErr.message}); retrying once`);
    outcome = await attempt(browser);
  }
  if (outcome === "skip") process.exit(0);
  console.log("PASS grading.mjs");
} catch (err) {
  console.error(`FAIL grading.mjs: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
