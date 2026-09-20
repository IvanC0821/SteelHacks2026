#!/usr/bin/env node
// e2e/session.mjs — session setup, sign-in and sign-out. `node e2e/session.mjs`.
// 1. No session -> /session renders the setup screen.
// 2. Paste Sam Reyes's token -> lands on her course.
// 3. Sign out clears storage and returns to setup.
import { chromium } from "playwright";
import { BASE_URL, identity, openPage, assert } from "./lib.mjs";

const browser = await chromium.launch();
try {
  {
    const { page, consoleErrors } = await openPage(browser, {});
    // The token flow remains the fallback outside local demo mode.
    await page.route("**/__verity_demo/views", (route) => route.fulfill({ json: { available: false } }));
    await page.goto(`${BASE_URL}/session`, { waitUntil: "networkidle" });
    await page.getByLabel("Access token").waitFor({ state: "visible", timeout: 10000 });
    await page.getByRole("button", { name: "Continue" }).waitFor({ state: "visible" });
    assert(consoleErrors.length === 0, `console errors on /session: ${consoleErrors.join("; ")}`);
    await page.context().close();
  }

  const { session, file } = identity("Sam Reyes");
  {
    const { page, consoleErrors } = await openPage(browser, {});
    await page.route("**/__verity_demo/views", (route) => route.fulfill({ json: { available: false } }));
    await page.goto(`${BASE_URL}/session`, { waitUntil: "networkidle" });
    await page.getByLabel("Access token").fill(session.token);
    await page.getByRole("button", { name: "Continue" }).click();

    await page.waitForURL(/\/c\//, { timeout: 10000 });
    assert(page.url().includes(file.course_id), `expected the course id in the URL, got ${page.url()}`);
    const stored = await page.evaluate(() => localStorage.getItem("verity.session"));
    assert(stored !== null, "expected verity.session to be written to localStorage");
    assert(JSON.parse(stored).token === session.token, "expected the stored token to match Sam Reyes's token");
    assert(consoleErrors.length === 0, `console errors after sign-in: ${consoleErrors.join("; ")}`);

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.getByLabel("Access token").waitFor({ state: "visible", timeout: 10000 });
    const cleared = await page.evaluate(() => localStorage.getItem("verity.session"));
    assert(cleared === null, `expected verity.session to be cleared, got ${cleared}`);
    assert(consoleErrors.length === 0, `console errors after sign-out: ${consoleErrors.join("; ")}`);

    await page.context().close();
  }

  console.log("PASS session.mjs");
} catch (err) {
  console.error(`FAIL session.mjs: ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
