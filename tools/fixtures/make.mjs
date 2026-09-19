/**
 * Build the fictional handwriting-style homework PDFs for the Verity demo.
 *
 *   node tools/fixtures/make.mjs            # PDFs into tools/fixtures/out/
 *   node tools/fixtures/make.mjs --preview  # also first-page PNGs into tools/fixtures/preview/
 *
 * Playwright lives in frontend/node_modules, so it is resolved with createRequire instead of a
 * dependency of this folder. Fonts are the OFL faces vendored in tools/fixtures/fonts/ and are
 * inlined as data URIs, which keeps the renderer offline and byte-stable.
 *
 * Output feeds tools/seed_dev.py, which prefers these files over its typed fallback.
 */

import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  HANDS,
  QUESTION_SHEET,
  SOLUTION_SHEET,
  STUDENTS,
  SYSTEM_MATRIX,
  slugFor,
  studentPages,
} from "./content.mjs";
import { questionsHtml, solutionHtml, studentHtml } from "./html.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const OUT = path.join(HERE, "out");
const PREVIEW = path.join(HERE, "preview");
const FONTS = path.join(HERE, "fonts");

const require = createRequire(path.join(ROOT, "frontend", "package.json"));
const { chromium } = require("playwright");

const b64 = (file) => fs.readFileSync(path.join(FONTS, file)).toString("base64");
const fonts = {
  caveat400: b64("caveat-latin-400-normal.woff2"),
  caveat600: b64("caveat-latin-600-normal.woff2"),
  patrick400: b64("patrick-hand-latin-400-normal.woff2"),
  sans400: b64("ibm-plex-sans-latin-400-normal.woff2"),
  sans600: b64("ibm-plex-sans-latin-600-normal.woff2"),
  serif400: b64("ibm-plex-serif-latin-400-normal.woff2"),
};

const wantPreview = process.argv.includes("--preview");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (wantPreview) fs.mkdirSync(PREVIEW, { recursive: true });

  const jobs = [
    { file: "questions.pdf", html: questionsHtml(QUESTION_SHEET, SYSTEM_MATRIX, fonts) },
    { file: "solution.pdf", html: solutionHtml(SOLUTION_SHEET, fonts) },
  ];
  for (const { name, versions } of STUDENTS) {
    const hand = HANDS[name];
    if (!hand) throw new Error(`no hand configured for ${name}`);
    for (let v = 1; v <= versions; v += 1) {
      jobs.push({
        file: `${slugFor(name)}-v${v}.pdf`,
        html: studentHtml(name, hand, studentPages(name, v), fonts),
      });
    }
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 816, height: 1056 } });
  for (const job of jobs) {
    await page.setContent(job.html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const target = path.join(OUT, job.file);
    await page.pdf({
      path: target,
      format: "Letter",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
    });
    const kb = (fs.statSync(target).size / 1024).toFixed(1);
    console.log(`${job.file.padEnd(20)} ${kb.padStart(7)} KB`);
  }
  await browser.close();

  if (wantPreview) renderPreviews(jobs.map((j) => j.file));
}

/** First page of each PDF to PNG, for eyeballing the scan look. */
function renderPreviews(files) {
  for (const file of files) {
    const stem = path.join(PREVIEW, file.replace(/\.pdf$/, ""));
    execFileSync("pdftoppm", [
      "-png",
      "-r",
      "96",
      "-f",
      "1",
      "-l",
      "1",
      "-singlefile",
      path.join(OUT, file),
      stem,
    ]);
    console.log(`preview ${path.relative(ROOT, `${stem}.png`)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
