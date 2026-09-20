#!/usr/bin/env node
// e2e/rubric.mjs — the publish gate shows the right one-sentence reason for two blockers
// (Task 3): no criteria yet, and a TA trying to publish. Skips (exit 0) if still a placeholder.
// `node e2e/rubric.mjs`.
import { chromium } from "playwright";
import { BASE_URL, identity, openPage, apiGet, assert, isPlaceholder } from "./lib.mjs";

const dana = identity("Dana Whitfield");
const { file } = dana;
const courseId = file.course_id;

// Homework 2 in the seed has no draft, no documents and no published rubric -- a clean fixture
// for "add at least one criterion" without editing anything.
const assignments = await apiGet(dana.session.token, file.api, `/courses/${courseId}/assignments`);
const unpublished = assignments.find((a) => a.published_rubric_id === null);
if (!unpublished) throw new Error("no unpublished assignment to test the gate against -- reseed and retry");

const browser = await chromium.launch();
try {
  // Instructor, no criteria yet.
  {
    const { page, consoleErrors } = await openPage(browser, { as: "Dana Whitfield" });
    await page.goto(`${BASE_URL}/a/${unpublished.id}/rubric`, { waitUntil: "networkidle" });
    if (await isPlaceholder(page)) {
      console.log("SKIP rubric.mjs: /a/:assignmentId/rubric is still a placeholder");
      await page.context().close();
      process.exit(0);
    }
    // Two "Publish rubric" buttons exist on this page: the primary in the header and a mirror
    // inside the guided setup steps. Scope to the header's action group, which is the one this
    // task cares about.
    const button = page.locator(".v-rubric__actions").getByRole("button", { name: "Publish rubric" });
    await button.waitFor({ state: "visible", timeout: 10000 });
    assert(await button.isDisabled(), "expected Publish rubric to be disabled with no criteria");
    await page.getByText("Add at least one criterion").first().waitFor({ state: "visible" });
    const title = await button.getAttribute("title");
    assert(title?.includes("Add at least one criterion"), `expected the button title to explain why, got "${title}"`);
    assert(consoleErrors.length === 0, `console errors (instructor): ${consoleErrors.join("; ")}`);
    await page.context().close();
  }

  // TA: blocked on role before any content check.
  {
    const { page, consoleErrors } = await openPage(browser, { as: "Sam Reyes" });
    await page.goto(`${BASE_URL}/a/${unpublished.id}/rubric`, { waitUntil: "networkidle" });
    const button = page.locator(".v-rubric__actions").getByRole("button", { name: "Publish rubric" });
    await button.waitFor({ state: "visible", timeout: 10000 });
    assert(await button.isDisabled(), "expected Publish rubric to be disabled for a TA");
    await page.getByText("Only the instructor can publish a rubric").first().waitFor({ state: "visible" });
    assert(consoleErrors.length === 0, `console errors (TA): ${consoleErrors.join("; ")}`);
    await page.context().close();
  }

  console.log("PASS rubric.mjs");
} catch (err) {
  console.error(`FAIL rubric.mjs: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
