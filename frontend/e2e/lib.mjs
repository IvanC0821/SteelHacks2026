// Shared helpers for the plain-node Playwright e2e smoke scripts (no @playwright/test runner).
// Identity injection mirrors tools/shot.mjs: read .dev/session.json, set
// localStorage["verity.session"] via addInitScript before the app's first paint, so no token
// ever appears in a URL.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

export const BASE_URL = process.env.VERITY_BASE_URL ?? "http://localhost:5173";

export function readSessionFile() {
  const file = path.join(here, "..", ".dev", "session.json");
  return JSON.parse(readFileSync(file, "utf8"));
}

/** { session: {token, api}, user: {id, role, token}, file } for a name from .dev/session.json. */
export function identity(name) {
  const file = readSessionFile();
  const user = file.users[name];
  if (!user) {
    throw new Error(`no identity named "${name}" in .dev/session.json; have: ${Object.keys(file.users).join(", ")}`);
  }
  return { session: { token: user.token, api: file.api }, user, file };
}

/** GETs an authenticated API path directly (setup for a script, not something the page does). */
export async function apiGet(token, apiBase, apiPath) {
  const res = await fetch(`${apiBase}/api${apiPath}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`GET ${apiPath} -> ${res.status}`);
  return res.json();
}

/** Opens a browser context, optionally signed in as `as`, with console/network capture wired up.
 *  Desktop viewport by default so the rail is never collapsed into the phone drawer. */
export async function openPage(browser, { as, viewport = { width: 1280, height: 900 } } = {}) {
  const context = await browser.newContext({ viewport });
  if (as) {
    const { session } = identity(as);
    await context.addInitScript((s) => {
      window.localStorage.setItem("verity.session", JSON.stringify(s));
    }, session);
  }
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  page.on("requestfailed", (req) => {
    const failure = req.failure();
    if (failure) failedRequests.push(`${req.method()} ${req.url()} (${failure.errorText})`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });
  return { context, page, consoleErrors, failedRequests };
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

/** Polls `read()` until `matches` is true, or throws with the last value on timeout. Use this
 *  instead of waiting on UI text that might already be true before an action lands (e.g. a
 *  progress count that does not change when re-saving an already-saved answer) -- that kind of
 *  wait is not a real synchronization point and races the action it is meant to follow. */
export async function pollFor(read, matches, { timeout = 10000, interval = 200 } = {}) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await read();
    if (matches(last)) return last;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error(`pollFor timed out after ${timeout}ms; last value: ${JSON.stringify(last)}`);
}

/** True when the page is still Task 1's Placeholder standing in for a route not built yet. */
export async function isPlaceholder(page) {
  return (await page.getByText("owns this route and replaces this placeholder").count()) > 0;
}
