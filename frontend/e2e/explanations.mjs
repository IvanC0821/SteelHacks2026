// Staff explanation editing against live pages, with writes isolated in browser responses.
// Backend tests cover real persistence, permission checks, privacy and revision locking.
import { chromium } from "playwright";
import { BASE_URL, identity, openPage, apiGet, assert } from "./lib.mjs";

const browser = await chromium.launch();
try {
  for (const name of ["Dana Whitfield", "Sam Reyes"]) {
    const { session, file } = identity(name);
    const queue = await apiGet(session.token, file.api, `/assignments/${file.assignment_id}/submissions?final_only=true`);
    let paper = structuredClone(queue.find((s) => s.assessment && ["not_started", "in_progress"].includes(s.review.status)));
    assert(paper, "Need an assessed paper with an open review");
    const original = structuredClone(paper.assessment);
    const { page, context, consoleErrors } = await openPage(browser, {
      as: name, viewport: name === "Sam Reyes" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    });
    const path = `/api/submissions/${paper.id}`;
    let behavior = "success";
    let saves = 0;
    await page.route("**/api/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname === path && request.method() === "GET") {
        return route.fulfill({ json: paper });
      }
      if (url.pathname.startsWith(`${path}/review/explanations/`) && request.method() === "PUT") {
        saves++;
        const body = request.postDataJSON();
        assert(body.expected_revision === paper.review.revision, "Stale revision sent");
        if (behavior === "failure") return route.fulfill({ status: 503, json: { detail: { code: "unavailable" } } });
        if (behavior === "conflict") {
          paper.review.revision++;
          return route.fulfill({ status: 409, json: { detail: { code: "stale_review_reload" } } });
        }
        const criterion = decodeURIComponent(url.pathname.split("/").at(-1));
        paper.review = { ...paper.review, revision: paper.review.revision + 1, criterion_explanations: {
          ...paper.review.criterion_explanations,
          [criterion]: { text: body.text, edited_by: "browser-test", edited_at: new Date().toISOString() },
        } };
        return route.fulfill({ json: paper.review });
      }
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) return route.abort();
      return route.continue();
    });

    await page.goto(`${BASE_URL}/a/${file.assignment_id}/grade/${paper.id}`, { waitUntil: "networkidle" });
    await page.locator(".v-pdf-page__canvas").first().waitFor({ state: "attached" });
    // The mobile grading panel is a bottom sheet.
    const mobileTrigger = page.getByRole("button", { name: "Show the rubric", exact: true });
    if (await mobileTrigger.isVisible()) await mobileTrigger.click();
    const why = page.locator(".v-grade-criterion__why").first();
    await why.locator(":scope > summary").click();
    await why.getByRole("button", { name: "Edit explanation", exact: true }).click();
    const field = why.getByRole("textbox", { name: "Explanation", exact: true });
    await field.fill("   ");
    await why.getByRole("button", { name: "Save explanation", exact: true }).click();
    await why.getByText("Write an explanation before saving.").waitFor();
    assert(saves === 0, "Blank explanation reached API");
    await field.fill("Unsaved text");
    await why.getByRole("button", { name: "Cancel", exact: true }).click();
    assert(saves === 0, "Cancel wrote to API");

    await why.getByRole("button", { name: "Edit explanation", exact: true }).click();
    const correction = "Staff checked the required row-operation labels.";
    await field.fill(correction);
    await page.screenshot({ path: `.dev/ux-review/why-editor-${name === "Sam Reyes" ? "mobile" : "desktop"}.png` });
    behavior = "failure";
    await why.getByRole("button", { name: "Save explanation", exact: true }).click();
    await why.getByText(/could not be saved/).waitFor();
    assert(await field.inputValue() === correction, "Failed save lost the draft");
    behavior = "conflict";
    await why.getByRole("button", { name: "Save explanation", exact: true }).click();
    await why.getByText(/Another staff member changed this review/).waitFor();
    assert(await field.inputValue() === correction, "Conflict lost the draft");
    behavior = "success";
    await why.getByRole("button", { name: "Save explanation", exact: true }).click();
    await why.getByText("Explanation saved", { exact: true }).waitFor();
    await why.getByText(correction, { exact: true }).waitFor();
    assert(JSON.stringify(paper.assessment) === JSON.stringify(original), "Explanation edit changed assessment");
    await why.getByText("Original example", { exact: true }).click();
    await why.getByText(original.decisions[0].rationale, { exact: true }).waitFor();
    await page.screenshot({ path: `.dev/ux-review/edit-why-${name === "Sam Reyes" ? "mobile" : "desktop"}.png` });

    await page.reload({ waitUntil: "networkidle" });
    if (await mobileTrigger.isVisible()) await mobileTrigger.click();
    await why.locator(":scope > summary").click();
    await why.getByText(correction, { exact: true }).waitFor();
    paper.review.status = "completed";
    await page.reload({ waitUntil: "networkidle" });
    if (await mobileTrigger.isVisible()) await mobileTrigger.click();
    await why.locator(":scope > summary").click();
    assert(await why.getByRole("button", { name: "Edit explanation", exact: true }).count() === 0, "Completed review is editable");
    assert(consoleErrors.filter((text) => !text.includes("503") && !text.includes("409")).length === 0, consoleErrors.join("; "));
    await context.close();
    console.log(`PASS explanations: ${name}, save/reload, cancel, validation, error, conflict, original and completed lock`);
  }
} finally {
  await browser.close();
}
