#!/usr/bin/env node
// Read-only checks of real reference PDFs. Edits are deliberately invalid so no autosave runs;
// API writes are blocked. The example-only response uses an existing reference in browser memory.
import { chromium } from "playwright";
import { BASE_URL, identity, openPage, apiGet, assert } from "./lib.mjs";

const ta = identity("Sam Reyes");
const assignmentId = ta.file.assignment_id;
const detail = await apiGet(ta.session.token, ta.file.api, `/assignments/${assignmentId}`);
const solution = detail.documents.filter((document) => document.kind === "solution").at(-1);
const paper = detail.documents.filter((document) => document.kind === "questions").at(-1);
assert(solution && paper, "Existing seed needs a solution and assignment reference");
const browser = await chromium.launch();

async function blockWrites(page) {
  await page.route("**/api/**", async (route) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) {
      throw new Error(`Unexpected API write: ${route.request().method()}`);
    }
    await route.fallback();
  });
}

try {
  for (const width of [1440, 390, 320]) {
    const { page, consoleErrors } = await openPage(browser, { as: "Sam Reyes", viewport: { width, height: 900 } });
    await blockWrites(page);
    await page.goto(`${BASE_URL}/a/${assignmentId}/rubric`, { waitUntil: "networkidle" });
    const picker = page.getByRole("combobox", { name: "Reference", exact: true });
    assert(await picker.inputValue() === solution.id, "solution is the default reference");
    assert(await page.locator(".v-rubric__chip").count() === 0, "old setup buttons are removed");
    assert(await page.getByRole("button", { name: "Manage references" }).count() === 0, "TAs do not see document management");
    const expectedOptions = 2 + detail.documents.filter((document) => document.kind === "graded_example").length;
    assert(await picker.locator("option").count() === expectedOptions, "only actual references appear, with no empty categories");
    const criterion = page.getByRole("textbox", { name: `Criterion for ${detail.questions[0].title}` }).first();
    await criterion.fill("");
    await picker.selectOption(paper.id);
    await page.getByLabel(paper.filename, { exact: true }).getByRole("img", { name: "Page 1", exact: true }).waitFor();
    assert(await criterion.inputValue() === "", "switching reference preserves draft edits");
    if (width < 760) assert(await page.getByRole("button", { name: "Hide reference" }).isVisible(), "selection opens the phone reference view");
    await picker.selectOption(solution.id);
    await page.getByLabel(solution.filename, { exact: true }).getByRole("img", { name: "Page 1", exact: true }).waitFor();
    assert(await criterion.inputValue() === "", "switching back still preserves edits");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal overflow");
    assert(consoleErrors.length === 0, consoleErrors.join("; "));
    await page.context().close();
  }

  // If only a graded example exists it is selectable and opens through the same authenticated viewer.
  {
    const { page, consoleErrors } = await openPage(browser, { as: "Sam Reyes" });
    await page.route(`**/api/assignments/${assignmentId}`, (route) => route.fulfill({
      json: { ...detail, documents: [{ ...paper, kind: "graded_example" }] },
    }));
    await blockWrites(page);
    await page.goto(`${BASE_URL}/a/${assignmentId}/rubric`, { waitUntil: "networkidle" });
    const picker = page.getByRole("combobox", { name: "Reference", exact: true });
    assert(await picker.inputValue() === paper.id, "example is the fallback when no solution/assignment exists");
    assert(await picker.locator("option").textContent() === `Graded example — ${paper.filename}`, "example identified by filename");
    await page.getByLabel(paper.filename, { exact: true }).getByRole("img", { name: "Page 1", exact: true }).waitFor();
    assert(consoleErrors.length === 0, consoleErrors.join("; "));
    await page.context().close();
  }

  {
    const { page, consoleErrors } = await openPage(browser, { as: "Dana Whitfield" });
    await blockWrites(page);
    await page.goto(`${BASE_URL}/a/${assignmentId}/rubric`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Manage references" }).click();
    await page.getByRole("dialog", { name: "Assignment setup" }).waitFor();
    assert(await page.locator('input[type="file"]').count() > 0, "instructor keeps upload controls");
    assert(consoleErrors.length === 0, consoleErrors.join("; "));
    await page.context().close();
  }

  console.log("PASS rubric-references.mjs (TA switching, preserved drafts, mobile, example fallback, instructor management)");
} catch (error) {
  console.error(`FAIL rubric-references.mjs: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
