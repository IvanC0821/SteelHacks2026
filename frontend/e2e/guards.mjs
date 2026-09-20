#!/usr/bin/env node
// e2e/guards.mjs — a reader in the wrong role gets the one-sentence denied state, never a crash.
// `node e2e/guards.mjs`.
import { chromium } from "playwright";
import { BASE_URL, identity, openPage, assert } from "./lib.mjs";

const browser = await chromium.launch();
try {
  const { file } = identity("Dana Whitfield");
  const assignmentId = file.assignment_id;

  // A student visiting the staff-only grading queue.
  {
    const { page, consoleErrors, failedRequests } = await openPage(browser, { as: "Elena Petrova" });
    await page.goto(`${BASE_URL}/a/${assignmentId}/grade`, { waitUntil: "networkidle" });
    await page.getByText("Not your page").waitFor({ state: "visible", timeout: 10000 });
    await page
      .getByText("This page is for the instructor and TAs")
      .waitFor({ state: "visible" });
    assert(consoleErrors.length === 0, `console errors (student on /grade): ${consoleErrors.join("; ")}`);
    assert(failedRequests.length === 0, `failed requests (student on /grade): ${failedRequests.join("; ")}`);
    await page.context().close();
  }

  // A TA visiting a student-only route. The role check happens on the route's handle before any
  // data fetch, so a submission id that does not exist is fine here -- nothing tries to load it.
  {
    const { page, consoleErrors, failedRequests } = await openPage(browser, { as: "Sam Reyes" });
    await page.goto(`${BASE_URL}/s/does-not-exist`, { waitUntil: "networkidle" });
    await page.getByText("Not your page").waitFor({ state: "visible", timeout: 10000 });
    await page.getByText("This page is for students").waitFor({ state: "visible" });
    assert(consoleErrors.length === 0, `console errors (TA on /s/:id): ${consoleErrors.join("; ")}`);
    assert(failedRequests.length === 0, `failed requests (TA on /s/:id): ${failedRequests.join("; ")}`);
    await page.context().close();
  }

  console.log("PASS guards.mjs");
} catch (err) {
  console.error(`FAIL guards.mjs: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
