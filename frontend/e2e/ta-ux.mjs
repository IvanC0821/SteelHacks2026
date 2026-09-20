#!/usr/bin/env node
// Reads the real local course and analytics. Browser save responses are intercepted to avoid
// altering shared drafts; backend tests separately verify TA persistence and authorization.
import { chromium } from "playwright";
import { BASE_URL, identity, openPage, apiGet, assert } from "./lib.mjs";

const ta = identity("Sam Reyes");
const assignmentId = ta.file.assignment_id;
const analytics = await apiGet(ta.session.token, ta.file.api, `/assignments/${assignmentId}/analytics`);
const assignment = await apiGet(ta.session.token, ta.file.api, `/assignments/${assignmentId}`);
const browser = await chromium.launch();
try {
  for (const width of [1440, 390]) {
    const { page, consoleErrors } = await openPage(browser, { as: "Sam Reyes", viewport: { width, height: 900 } });
    await page.goto(`${BASE_URL}/a/${assignmentId}/overview`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Students with feedback flags" }).waitFor();
    assert(await page.locator(".v-course-tiles").count() === 0, "TA sees no statistics tiles");
    assert(await page.locator(".v-course-flagged").count() === 0, "TA sees no category statistics");
    assert(await page.locator(".v-course-bar__tick").count() === 0, "TA sees no first-attempt overlay");
    const rows = page.locator(".v-course-feedback-chart__row");
    assert(await rows.count() === assignment.questions.length, "one graph row per question");
    for (let i = 0; i < assignment.questions.length; i++) {
      const stats = analytics.questions.find((q) => q.question_id === assignment.questions[i].id).latest;
      const count = stats.assessed_students ? `${stats.flagged_students} of ${stats.assessed_students}` : "No checks yet";
      assert(await rows.nth(i).getByText(count, { exact: true }).isVisible(), "graph matches distinct student counts");
    }
    assert(await page.getByRole("navigation", { name: "Assignment" }).getByRole("link", { name: "Grade" }).isVisible(), "grading remains reachable");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal overflow");
    assert(consoleErrors.length === 0, consoleErrors.join("; "));
    await page.context().close();
  }

  const { page, consoleErrors } = await openPage(browser, { as: "Sam Reyes" });
  let savedDraft;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method() === "PUT" && request.url().endsWith(`/assignments/${assignmentId}/rubric-draft`)) {
      savedDraft = request.postDataJSON();
      await route.fulfill({ json: { draft: savedDraft, revision: assignment.draft_revision + 1 } });
    } else if (!["GET", "OPTIONS", "HEAD"].includes(request.method())) {
      throw new Error(`Unexpected API write: ${request.method()} ${request.url()}`);
    } else await route.continue();
  });
  await page.goto(`${BASE_URL}/a/${assignmentId}/rubric`, { waitUntil: "networkidle" });
  const criterion = page.getByRole("textbox", { name: `Criterion for ${assignment.questions[0].title}` }).first();
  assert(await criterion.isEnabled(), "TA can edit criterion text");
  assert(await page.getByLabel("Notes to the model and TAs").isEnabled(), "TA can edit staff notes");
  assert(await page.getByRole("button", { name: "Request generated draft" }).isEnabled(), "TA can request a draft");
  assert(await page.getByRole("button", { name: "Publish rubric", exact: true }).isDisabled(), "publication remains instructor-only");
  const description = `${assignment.rubric_draft.criteria[0].description} (browser save test)`;
  await criterion.fill(description);
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await page.locator(".v-rubric__save [role='status']").filter({ hasText: /^Draft saved .+/ }).waitFor();
  assert(savedDraft?.criteria[0].description === description, "edited draft reaches the save endpoint");
  assert(consoleErrors.length === 0, consoleErrors.join("; "));
  await page.context().close();
  console.log("PASS ta-ux.mjs (desktop/mobile overview, TA draft editing and save request)");
} catch (error) {
  console.error(`FAIL ta-ux.mjs: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
