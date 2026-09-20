#!/usr/bin/env node
// e2e/run.mjs — runs every e2e/*.mjs smoke script (except lib.mjs and this file) as its own node
// process and prints a pass/fail table. `node e2e/run.mjs`.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const skip = new Set(["lib.mjs", "run.mjs"]);
const scripts = readdirSync(here)
  .filter((f) => f.endsWith(".mjs") && !skip.has(f))
  .sort();

function runOne(file) {
  return new Promise((resolve) => {
    const start = Date.now();
    const child = spawn(process.execPath, [path.join(here, file)], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => {
      resolve({ file, code, ms: Date.now() - start, out: out.trim() });
    });
  });
}

const results = [];
for (const file of scripts) {
  process.stdout.write(`running ${file}...\n`);
  const result = await runOne(file);
  results.push(result);
}

const skipped = results.filter((r) => r.code === 0 && /^SKIP/m.test(r.out));
const passed = results.filter((r) => r.code === 0 && !/^SKIP/m.test(r.out));
const failed = results.filter((r) => r.code !== 0);

console.log("\nfile              status  time");
console.log("----              ------  ----");
for (const r of results) {
  const status = r.code !== 0 ? "FAIL" : /^SKIP/m.test(r.out) ? "SKIP" : "PASS";
  console.log(`${r.file.padEnd(18)}${status.padEnd(8)}${r.ms}ms`);
}

if (failed.length > 0) {
  console.log("\nfailures:");
  for (const r of failed) {
    console.log(`\n--- ${r.file} (exit ${r.code}) ---`);
    console.log(r.out);
  }
}

console.log(`\n${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped, ${results.length} total`);
process.exitCode = failed.length > 0 ? 1 : 0;
