// Real UI + backend persistence, with isolated temporary data and an explicit fixture provider.
// No writes to the user's courses and no paid calls. The fixture server is stopped in finally.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = `${root}frontend/design/screenshots/course-creation`;
mkdirSync(output, { recursive: true });
const server = spawn(`${root}.venv/bin/python`, ["-m", "tools.course_creation_test_server"], {
  cwd: root, env: { ...process.env, PYTHONPATH: "backend:." }, stdio: ["ignore", "ignore", "inherit", "pipe"],
});
let browser;
try {
  const credentials = await new Promise((resolve, reject) => {
    let text = "";
    server.stdio[3].on("data", (part) => { text += part; });
    server.stdio[3].on("end", () => { try { resolve(JSON.parse(text)); } catch { reject(new Error("Test server did not initialize")); } });
    server.on("error", reject);
  });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${credentials.session.api}/health`)).ok) break; } catch { /* Wait for bind. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  await context.addInitScript((session) => localStorage.setItem("verity.session", JSON.stringify(session)), credentials.session);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5173/c/nonexistent");
  await page.getByRole("link", { name: "Create course", exact: true }).click();
  await page.getByLabel("Course name", { exact: true }).fill("Browser Test Concepts");
  await page.getByLabel("Upload PDF (optional)").setInputFiles({ name: "grading-sheet.pdf", mimeType: "application/pdf", buffer: Buffer.from(credentials.pdf_hex, "hex") });
  await page.getByRole("button", { name: "Autofill deductions", exact: true }).click();
  await page.getByLabel("Rule 1", { exact: true }).waitFor();
  assert.match(await page.getByLabel("Penalty 1", { exact: true }).inputValue(), /1 point per step/);
  await page.screenshot({ path: `${output}/autofilled-desktop.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/autofilled-mobile.png` });
  await page.getByLabel("Penalty 1", { exact: true }).fill("2 points per step, capped at 3 points per question");
  await page.getByRole("button", { name: "Create course", exact: true }).click();
  await page.waitForURL(/\/c\/crs_/);
  await page.getByRole("heading", { name: "Browser Test Concepts", exact: true }).waitFor();
  await page.getByText("2 points per step, capped at 3 points per question", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("2 points per step, capped at 3 points per question", { exact: true }).waitFor();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download grading PDF", exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "grading-sheet.pdf");
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.screenshot({ path: `${output}/saved-course-desktop.png` });
  console.log("PASS: zero-course instructor entry, upload, extraction, edit, create, refresh persistence, private PDF download, desktop/mobile; fixture model only.");
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
  await once(server, "exit");
}
