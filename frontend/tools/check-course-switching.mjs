// Read-only live UI regression. Requires the local demo and tools.seed_concepts127.
// No uploads, model calls, or production changes. Tokens are never logged.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../", import.meta.url));
const seed = JSON.parse(readFileSync(`${root}.data/concepts127-seed.json`, "utf8"));
const session = JSON.parse(readFileSync(`${root}frontend/.dev/session.json`, "utf8"));
const user = session.users["Farah Aziz"];
const output = `${root}frontend/design/screenshots/course-switching`;
mkdirSync(output, { recursive: true });
const origin = "http://localhost:5173";
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.addInitScript((value) => {
  if (!localStorage.getItem("verity.session")) localStorage.setItem("verity.session", JSON.stringify(value));
}, { token: user.token, api: session.api });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let modelCalls = 0;
await page.route(/\/(assessment-jobs|rubric-jobs)$/, (route) => { modelCalls++; return route.abort(); });
const trigger = () => page.locator("nav.v-rail .v-course-switch__trigger");
async function expectConcepts() {
  await page.getByRole("heading", { name: seed.course_name, exact: true }).waitFor();
  await page.locator(".v-course-assignments tbody tr").nth(1).waitFor();
  assert.equal(await page.locator(".v-course-assignments tbody tr").count(), 2);
  assert.match(await trigger().innerText(), /21-127/);
}
try {
  await page.goto(`${origin}/c/${seed.source_course_id}`);
  await trigger().click();
  await page.getByRole("button", { name: seed.course_name, exact: true }).click();
  await expectConcepts();
  await page.reload();
  await expectConcepts();
  await page.screenshot({ path: `${output}/course-desktop.png` });
  await trigger().click();
  await page.screenshot({ path: `${output}/course-dropdown.png` });
  await page.keyboard.press("Escape");

  await page.goto(`${origin}/a/${seed.assignments[1].id}`);
  await page.waitForFunction(() => document.querySelector(".v-course-switch__trigger")?.textContent.includes("21-127"));
  await page.reload();
  await page.waitForFunction(() => document.querySelector(".v-course-switch__trigger")?.textContent.includes("21-127"));
  await page.getByRole("link", { name: "Verity home", exact: true }).click();
  await expectConcepts();

  await page.getByLabel("View as", { exact: true }).selectOption("staff");
  await expectConcepts();
  await page.getByRole("link", { name: /Homework 1 - Foundations of proof/ }).first().click();
  await page.getByRole("heading", { name: seed.assignments[0].title, exact: true }).waitFor();
  await page.screenshot({ path: `${output}/staff-homework.png` });
  await page.getByLabel("View as", { exact: true }).selectOption("student");
  await expectConcepts();
  await page.getByLabel("Student", { exact: true }).selectOption(session.users["Ben Castellano"].id);
  await expectConcepts();

  await page.goto(`${origin}/a/${session.assignment_id}`);
  await page.waitForFunction(() => document.querySelector(".v-course-switch__trigger")?.textContent.includes("21-241"));
  await page.getByRole("link", { name: "Verity home", exact: true }).click();
  await page.waitForURL(`**/c/${seed.source_course_id}`);

  await page.goto(`${origin}/dev/pdf`);
  await page.getByRole("button", { name: /^Switch course:/ }).click();
  await page.getByRole("button", { name: seed.course_name, exact: true }).click();
  await expectConcepts();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  const drawer = page.getByRole("dialog");
  await drawer.locator(".v-course-switch__trigger").click();
  await page.screenshot({ path: `${output}/course-mobile.png` });
  await drawer.getByRole("button", { name: /21-241/ }).click();
  await page.waitForURL(`**/c/${seed.source_course_id}`);
  await drawer.waitFor({ state: "hidden" });
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await drawer.locator(".v-course-switch__trigger").click();
  await drawer.getByRole("button", { name: seed.course_name, exact: true }).click();
  await page.getByRole("heading", { name: seed.course_name, exact: true }).waitFor();
  assert.equal(modelCalls, 0);
  assert.deepEqual(errors, []);
  console.log("PASS: desktop/mobile course switching, refresh, deep links, staff/student/account changes, compact rail; no model calls.");
} finally {
  await browser.close();
}
