#!/usr/bin/env node
// e2e/overview.mjs — the staff Overview tab renders tiles and per-question bars from the real,
// seeded /analytics response (Task 5). Skips (exit 0) if the route is still a placeholder.
// `node e2e/overview.mjs`.
import { chromium } from "playwright";
import { BASE_URL, identity, openPage, apiGet, assert, isPlaceholder } from "./lib.mjs";

const dana = identity("Dana Whitfield");
const { file } = dana;
const assignmentId = file.assignment_id;

const assignment = await apiGet(dana.session.token, file.api, `/assignments/${assignmentId}`);
const analytics = await apiGet(dana.session.token, file.api, `/assignments/${assignmentId}/analytics`);

const browser = await chromium.launch();
try {
  const { page, consoleErrors } = await openPage(browser, { as: "Dana Whitfield" });
  await page.goto(`${BASE_URL}/a/${assignmentId}/overview`, { waitUntil: "networkidle" });

  if (await isPlaceholder(page)) {
    console.log("SKIP overview.mjs: /a/:assignmentId/overview is still a placeholder");
    await page.context().close();
    process.exit(0);
  }

  await page.getByRole("heading", { name: assignment.title }).waitFor({ state: "visible", timeout: 10000 });
  await page.getByText("Handed in", { exact: true }).waitFor({ state: "visible" });

  const hasEstimates = analytics.questions.some((q) => q.latest.scored_students > 0);
  if (hasEstimates) {
    const bars = page.locator(".v-bar");
    await bars.first().waitFor({ state: "visible", timeout: 10000 });
    const count = await bars.count();
    assert(count === assignment.questions.length, `expected ${assignment.questions.length} bars, got ${count}`);
  } else {
    await page.getByText("No estimates yet").waitFor({ state: "visible" });
  }

  if (analytics.open_reports > 0) {
    await page.getByText("Open reports").waitFor({ state: "visible" });
  }

  assert(consoleErrors.length === 0, `console errors: ${consoleErrors.join("; ")}`);
  await page.context().close();
  console.log("PASS overview.mjs");
} catch (err) {
  console.error(`FAIL overview.mjs: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
