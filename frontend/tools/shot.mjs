#!/usr/bin/env node
// Screenshot helper for design verification.
//   node tools/shot.mjs <url> <out.png> [1440x900|390x844] [--as "Sam Reyes"] [--full]
//        [--wait <selector>] [--click <selector>]... [--fill <selector> <value>]... [--2x]
// Reads frontend/.dev/session.json (written by tools/seed_dev.py) and injects that identity's
// token into localStorage before the page loads, so no token ever appears in a URL.

import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("usage: shot.mjs <url> <out.png> [WxH] [--as name] [--full] [--wait sel] [--click sel] [--fill sel val] [--2x]");
  process.exit(2);
}
const [url, out] = args;
let width = 1440;
let height = 900;
let as = null;
let full = false;
let scale = 1;
const steps = [];
for (let i = 2; i < args.length; i++) {
  const a = args[i];
  if (/^\d+x\d+$/.test(a)) [width, height] = a.split("x").map(Number);
  else if (a === "--as") as = args[++i];
  else if (a === "--full") full = true;
  else if (a === "--2x") scale = 2;
  else if (a === "--wait") steps.push({ wait: args[++i] });
  else if (a === "--click") steps.push({ click: args[++i] });
  else if (a === "--fill") steps.push({ fill: args[++i], value: args[++i] });
  else if (a === "--sleep") steps.push({ sleep: Number(args[++i]) });
}

let session = null;
if (as) {
  const file = JSON.parse(readFileSync(path.join(here, "..", ".dev", "session.json"), "utf8"));
  const user = file.users[as];
  if (!user) {
    console.error(`no identity named "${as}" in .dev/session.json; have: ${Object.keys(file.users).join(", ")}`);
    process.exit(2);
  }
  session = { token: user.token, api: file.api };
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale });
if (session) {
  await context.addInitScript((s) => {
    window.localStorage.setItem("verity.session", JSON.stringify(s));
  }, session);
}
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(url, { waitUntil: "networkidle" });
for (const s of steps) {
  if (s.wait) await page.waitForSelector(s.wait, { timeout: 15000 });
  if (s.click) await page.click(s.click);
  if (s.fill) await page.fill(s.fill, s.value);
  if (s.sleep) await page.waitForTimeout(s.sleep);
  await page.waitForLoadState("networkidle");
}
await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: full });
await browser.close();
console.log(`${out} ${width}x${height}${full ? " full" : ""}${errors.length ? `\nconsole errors:\n${errors.join("\n")}` : ""}`);
if (errors.length) process.exitCode = 1;
