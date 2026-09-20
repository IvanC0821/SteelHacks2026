#!/usr/bin/env node
// e2e/student.mjs — student upload -> assign pages -> check -> feedback (Task 4). Uses a real
// handwriting-style fixture PDF from tools/fixtures/out (written by tools/seed_dev.py's writer).
// Runs as Dev Patel, who is not one of the four identities other tasks' screenshots depend on for
// a specific attempt count, so this upload cannot desync anyone else's fixtures.
// Skips (exit 0) if any of the three routes involved are still placeholders.
// `node e2e/student.mjs`.
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BASE_URL, identity, openPage, apiGet, assert, isPlaceholder } from "./lib.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePdf = path.join(here, "..", "..", "tools", "fixtures", "out", "dev-v1.pdf");

const dev = identity("Dev Patel");
const { file } = dev;
const assignmentId = file.assignment_id;

const assignment = await apiGet(dev.session.token, file.api, `/assignments/${assignmentId}`);
const questionIds = assignment.questions.map((q) => q.id);

const browser = await chromium.launch();
try {
  const { page, consoleErrors } = await openPage(browser, { as: "Dev Patel" });

  // 1. Upload -- Dev already has one attempt, so this goes through "Upload revision".
  await page.goto(`${BASE_URL}/a/${assignmentId}`, { waitUntil: "networkidle" });
  if (await isPlaceholder(page)) {
    console.log("SKIP student.mjs: /a/:assignmentId (student) is still a placeholder");
    await page.context().close();
    process.exit(0);
  }
  await page.locator('input[type="file"]').first().setInputFiles(fixturePdf);
  await page.waitForURL(/\/s\/.+\/pages/, { timeout: 15000 });

  // 2. Assign pages -- map every question to a page (q1/q2 share page 1, matching the seed).
  if (await isPlaceholder(page)) {
    console.log("SKIP student.mjs: /s/:submissionId/pages is still a placeholder");
    await page.context().close();
    process.exit(0);
  }
  const tiles = page.locator("button.v-thumbs__tile");
  await tiles.first().waitFor({ state: "visible", timeout: 15000 });
  const tileCount = await tiles.count();
  for (let i = 0; i < questionIds.length; i++) {
    await page.getByRole("button", { name: new RegExp(`^${i + 1}\\.`) }).click();
    const tileIndex = Math.min(i, tileCount - 1);
    await tiles.nth(tileIndex).click();
  }
  await page
    .getByText(`${questionIds.length} of ${questionIds.length} questions have pages`)
    .waitFor({ state: "visible", timeout: 5000 });

  // 3. Check my work.
  const checkButton = page.getByRole("button", { name: "Check my work" });
  assert(await checkButton.isEnabled(), "expected Check my work to be enabled once every question is mapped");
  await checkButton.click();
  await page.waitForURL(/\/s\/[^/]+$/, { timeout: 15000 });

  // 4. Feedback -- wait for the job to finish against the dev-fixture provider, then read it.
  if (await isPlaceholder(page)) {
    console.log("SKIP student.mjs: /s/:submissionId is still a placeholder");
    await page.context().close();
    process.exit(0);
  }
  await page.getByText("Your estimate").waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Test fixture").first().waitFor({ state: "visible", timeout: 5000 });
  const findings = page.locator(".v-finding");
  await findings.first().waitFor({ state: "visible", timeout: 10000 });
  const findingCount = await findings.count();
  assert(findingCount === questionIds.length, `expected ${questionIds.length} findings, got ${findingCount}`);

  assert(consoleErrors.length === 0, `console errors: ${consoleErrors.join("; ")}`);
  await page.context().close();
  console.log("PASS student.mjs");
} catch (err) {
  console.error(`FAIL student.mjs: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
