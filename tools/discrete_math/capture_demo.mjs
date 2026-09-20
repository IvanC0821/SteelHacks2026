// Capture the current local demo. All browser operations are read-only.
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../frontend/package.json", import.meta.url));
const { chromium } = require("playwright");
const root = new URL("../../", import.meta.url);
const seed = JSON.parse(await readFile(new URL("frontend/.dev/session.json", root), "utf8"));
assert.equal(seed.demo, "discrete-math-induction", "Run the discrete math demo first");
const output = new URL("docs/demos/discrete-math/", root);
const student = JSON.parse(await readFile(new URL("student-feedback.json", output), "utf8"));
const locations = JSON.parse(await readFile(new URL("error-locations.json", output), "utf8"));
const evidence = locations.findings.flatMap((finding) => finding.evidence);
assert.ok(evidence.length > 0 && evidence.every((line) => line.bbox), "Every demo error needs measured coordinates");
const hints = student.assessment.questions.flatMap((question) => question.flags.map((flag) => flag.message));
const expectedBoxes = student.assessment.questions.flatMap((question) => question.flags.flatMap((flag) => flag.anchors.map((anchor) => anchor.bbox)));
const pdfBytes = [...await readFile(new URL("output/pdf/discrete-math-student-response.pdf", root))];

async function checkOverlay(page) {
  const actual = await page.locator(".v-pdf-page__paper").first().evaluate((paper) => {
    const bounds = paper.getBoundingClientRect();
    return [...paper.querySelectorAll(".v-feedback-annotations__region")].map((region) => {
      const box = region.getBoundingClientRect();
      return [(box.left - bounds.left) / bounds.width, (box.top - bounds.top) / bounds.height,
        (box.right - bounds.left) / bounds.width, (box.bottom - bounds.top) / bounds.height];
    });
  });
  assert.equal(actual.length, expectedBoxes.length, "Every finding must highlight its evidence");
  for (const expected of expectedBoxes) {
    assert.ok(actual.some((box) => box.every((value, i) => Math.abs(value - expected[i]) < 0.002)),
      "A rendered highlight moved away from the measured error line");
  }
  assert.equal(await page.locator(".v-feedback-annotations__pointer").count(), expectedBoxes.length);
}
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const checks = [];
try {
  for (const view of [
    { name: "student-feedback", identity: "Farah Aziz", path: `/s/${seed.submission_id}`, pdf: true },
    { name: "instructor-rubric", identity: "Dana Whitfield", path: `/a/${seed.assignment_id}/rubric`, pdf: false },
  ]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const session = { api: seed.api, token: seed.users[view.identity].token };
    await context.addInitScript((value) => localStorage.setItem("verity.session", JSON.stringify(value)), session);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.goto(`http://localhost:5173${view.path}`, { waitUntil: "networkidle" });
    if (view.pdf) {
      await page.locator("canvas").first().waitFor({ state: "visible" });
      for (const hint of hints) await page.getByText(hint, { exact: true }).first().waitFor();
      assert.match(await page.locator("body").innerText(), /4\s*\/\s*10/);
      await checkOverlay(page);
      // Independently compare backend geometry with the renderer's own PDF text positions.
      const rendererLines = await page.evaluate(async ({ bytes, lines }) => {
        const { openDocument } = await import("/src/pdf/pdfjs.ts");
        const document = await openDocument(new Blob([new Uint8Array(bytes)]));
        try {
          return await Promise.all(lines.map(async (line) => {
            const pdfPage = await document.getPage(line.page);
            const viewport = pdfPage.getViewport({ scale: 1 });
            const text = await pdfPage.getTextContent();
            const normalize = (value) => value.normalize("NFKC").replace(/\s+/g, "");
            const groups = new Map();
            for (const item of text.items) {
              if (!("str" in item) || !item.str.trim()) continue;
              const baseline = item.transform[5].toFixed(2);
              if (!groups.has(baseline)) groups.set(baseline, []);
              groups.get(baseline).push(item);
            }
            const items = [...groups.values()].map((group) => group.sort((a, b) => a.transform[4] - b.transform[4]))
              .find((group) => normalize(group.map((item) => item.str).join(" ")) === normalize(line.text));
            if (!items) return null;
            const boxes = items.map((item) => {
              const [, , , , x, y] = item.transform;
              const rect = [...viewport.convertToViewportPoint(x, y), ...viewport.convertToViewportPoint(x + item.width, y + item.height)];
              return [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])];
            });
            return [Math.min(...boxes.map((box) => box[0])) / viewport.width, Math.min(...boxes.map((box) => box[1])) / viewport.height,
              Math.max(...boxes.map((box) => box[2])) / viewport.width, Math.max(...boxes.map((box) => box[3])) / viewport.height];
          }));
        } finally { await document.loadingTask.destroy(); }
      }, { bytes: pdfBytes, lines: evidence });
      for (const [i, measured] of rendererLines.entries()) {
        assert.ok(measured, `Cited text is absent from PDF.js: ${evidence[i].text}`);
        const box = evidence[i].bbox;
        const overlap = Math.min(measured[3], box[3]) - Math.max(measured[1], box[1]);
        assert.ok(overlap > (box[3] - box[1]) * 0.5, "Highlight misses the actual rendered error text");
        assert.ok(Math.abs(measured[0] - box[0]) < 0.005 && Math.abs(measured[2] - box[2]) < 0.005);
      }
      await page.getByRole("button", { name: "Zoom out", exact: true }).click();
      await checkOverlay(page);
      await page.getByRole("button", { name: "Fit to width", exact: true }).click();
      await checkOverlay(page);
      const pin = page.getByRole("button", { name: "Finding 1 on page 1", exact: true }).first();
      await pin.click();
      await page.getByRole("region", { name: "Feedback 1", exact: true }).waitFor();
      await page.screenshot({ path: fileURLToPath(new URL("error-detail.png", output)), fullPage: true });
      await page.getByRole("button", { name: "Close feedback", exact: true }).click();
      assert.equal(await page.getByText("Page location only.", { exact: false }).count(), 0);
    } else {
      await page.locator(".v-rubric__card-title").getByText("The sum of the first n odd numbers").waitFor();
      assert.match(await page.locator("body").innerText(), /Published/i);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: fileURLToPath(new URL(`${view.name}.png`, output)), fullPage: true });
    assert.deepEqual(errors, [], `${view.name} browser errors`);
    checks.push({ view: view.name, pdf_visible: view.pdf, console_errors: 0, screenshot: `${view.name}.png`,
      ...(view.pdf ? { error_regions: expectedBoxes.length, text_positions_verified: true, zoom_verified: true, pointer_interaction_verified: true } : {}) });
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(new URL("browser-check.json", output), JSON.stringify({ checked_at: new Date().toISOString(), checks }, null, 2) + "\n");
console.log("Student feedback and instructor rubric verified; screenshots saved.");
