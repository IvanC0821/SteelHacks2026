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
const hints = student.assessment.questions.flatMap((question) => question.flags.map((flag) => flag.message));
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
    } else {
      await page.locator(".v-rubric__card-title").getByText("The sum of the first n odd numbers").waitFor();
      assert.match(await page.locator("body").innerText(), /Published/i);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: fileURLToPath(new URL(`${view.name}.png`, output)), fullPage: true });
    assert.deepEqual(errors, [], `${view.name} browser errors`);
    checks.push({ view: view.name, pdf_visible: view.pdf, console_errors: 0, screenshot: `${view.name}.png` });
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(new URL("browser-check.json", output), JSON.stringify({ checked_at: new Date().toISOString(), checks }, null, 2) + "\n");
console.log("Student feedback and instructor rubric verified; screenshots saved.");
