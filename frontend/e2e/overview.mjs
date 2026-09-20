#!/usr/bin/env node
// e2e/overview.mjs — the shared staff Overview tab renders per-question feedback bars from real,
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
  for (const role of ["Dana Whitfield", "Sam Reyes"]) {
  const { page, consoleErrors } = await openPage(browser, { as: role });
  await page.goto(`${BASE_URL}/a/${assignmentId}/overview`, { waitUntil: "networkidle" });

  if (await isPlaceholder(page)) {
    console.log("SKIP overview.mjs: /a/:assignmentId/overview is still a placeholder");
    await page.context().close();
    process.exit(0);
  }

  await page.getByRole("heading", { name: assignment.title }).waitFor({ state: "visible", timeout: 10000 });
  await page.getByRole("heading", { name: "Students with feedback flags" }).waitFor();
  assert(await page.locator(".v-course-tiles, .v-course-flagged").count() === 0, "No dense staff statistics");

  const hasEstimates = analytics.questions.some((q) => q.latest.assessed_students > 0);
  if (hasEstimates) {
    const bars = page.locator(".v-course-feedback-chart__row");
    await bars.first().waitFor({ state: "visible", timeout: 10000 });
    const count = await bars.count();
    assert(count === assignment.questions.length, `expected ${assignment.questions.length} bars, got ${count}`);
  } else {
    await page.getByText("No checked attempts yet").waitFor({ state: "visible" });
  }

  if (analytics.open_reports > 0) {
    await page.getByRole("navigation", { name: "Assignment" }).getByRole("link", { name: /Reports/ }).waitFor();
  }

  assert(consoleErrors.length === 0, `console errors: ${consoleErrors.join("; ")}`);
  await page.context().close();
  }
  console.log("PASS overview.mjs");
} catch (err) {
  console.error(`FAIL overview.mjs: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
