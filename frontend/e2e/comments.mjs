// Real staff-to-student comment persistence and live refresh in an isolated copy of the demo.
// The active demo database and PDFs are never modified by this check.
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { BASE_URL, identity, apiGet, assert, pollFor } from "./lib.mjs";

const repo = fileURLToPath(new URL("../../", import.meta.url));
const root = mkdtempSync(path.join(repo, ".data/comment-check-"));
const python = path.join(repo, ".venv/bin/python");
let server;
let browser;
try {
  const copied = spawnSync(python, ["-c", `
import os, sqlite3, sys
with sqlite3.connect(sys.argv[1]) as source, sqlite3.connect(sys.argv[2]) as target:
    source.backup(target)
os.chmod(sys.argv[2], 0o600)
`, path.join(repo, ".data/verity.sqlite3"), path.join(root, "verity.sqlite3")], { encoding: "utf8" });
  assert(copied.status === 0, "Could not prepare isolated comment test database");
  symlinkSync(path.join(repo, ".data/files"), path.join(root, "files"), "dir");
  server = spawn(python, ["-m", "uvicorn", "verity.api:create_app", "--factory", "--host", "127.0.0.1", "--port", "0"], {
    cwd: repo,
    env: { ...process.env, PYTHONPATH: "backend:.", VERITY_DATA_DIR: root, VERITY_PROVIDER_FACTORY: "tools.dev_provider:create_provider" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverLog = "";
  server.stdout.on("data", (data) => { serverLog += data; });
  server.stderr.on("data", (data) => { serverLog += data; });
  const api = await pollFor(() => serverLog.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0], Boolean);
  const staff = identity("Dana Whitfield");
  const queue = await apiGet(staff.session.token, api, `/assignments/${staff.file.assignment_id}/submissions?final_only=true`);
  const paper = queue.find((item) => item.review.status === "released");
  assert(paper, "Need an existing released paper to check comments independent of grades");
  const studentName = Object.keys(staff.file.users).find((name) => staff.file.users[name].id === paper.student_id);
  assert(studentName === paper.student_name, "Paper owner must match the student's canonical identity");
  const assignment = await apiGet(staff.session.token, api, `/assignments/${paper.assignment_id}`);
  const question = assignment.questions[0];
  browser = await chromium.launch();
  const errors = [];
  async function openAs(name, viewport = { width: 1440, height: 900 }) {
    const account = identity(name);
    const context = await browser.newContext({ viewport });
    await context.addInitScript((session) => localStorage.setItem("verity.session", JSON.stringify(session)), { token: account.session.token, api });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(String(error)));
    return { page, context };
  }
  const student = await openAs(studentName);
  await student.page.goto(`${BASE_URL}/s/${paper.id}`, { waitUntil: "networkidle" });

  for (const name of ["Sam Reyes", "Dana Whitfield"]) {
    const grader = await openAs(name);
    await grader.page.goto(`${BASE_URL}/a/${paper.assignment_id}/grade/${paper.id}`, { waitUntil: "networkidle" });
    const editor = grader.page.getByRole("textbox", { name: "Comment to student", exact: true });
    const text = `${name}: Compare the signs in each new row with the previous row.\nExplain which operation you applied.`;
    await editor.fill(text);
    const commentPath = `**/api/submissions/${paper.id}/review/comments/${question.id}`;
    await grader.page.route(commentPath, (route) => route.fulfill({ status: 503, json: { detail: { code: "unavailable" } } }), { times: 1 });
    await grader.page.getByRole("button", { name: "Save comment", exact: true }).click();
    await grader.page.getByText(/The comment could not be saved/).waitFor();
    assert(await editor.inputValue() === text, "Failed comment save must preserve typing");
    await grader.page.getByRole("button", { name: "Save comment", exact: true }).click();
    await grader.page.getByText(`Comment shared with ${studentName}`, { exact: true }).waitFor();
    // Do not reload the student page: the refresh must deliver the saved comment itself.
    await pollFor(() => student.page.getByRole("region", { name: "Staff feedback" }).innerText().catch(() => ""), (value) => value.includes(text), { timeout: 12000 });
    const studentPaper = await apiGet(identity(studentName).session.token, api, `/submissions/${paper.id}`);
    assert(studentPaper.review.comments[question.id].author_name === name, "Comment author must match the actual staff account");
    assert(studentPaper.review.score === paper.review.score && studentPaper.review.status === "released", "Comment save must preserve the released grade");
    assert(!JSON.stringify(studentPaper).includes("criterion_explanations"), "Staff explanation edits stay private");
    await grader.page.reload({ waitUntil: "networkidle" });
    assert(await editor.inputValue() === text, "Comment must persist on reload");
    if (name === "Dana Whitfield") {
      await grader.page.screenshot({ path: ".dev/ux-review/student-comment-editor.png", animations: "disabled" });
      await student.page.screenshot({ path: ".dev/ux-review/student-comment-received.png", animations: "disabled" });
      for (const width of [390, 320]) {
        await student.page.setViewportSize({ width, height: 844 });
        const handle = student.page.getByRole("button", { name: "Feedback · Staff comments", exact: true });
        if (await handle.getAttribute("aria-expanded") !== "true") await handle.click();
        assert(await student.page.getByRole("region", { name: "Staff feedback" }).isVisible(), "Staff comments must be reachable on phones");
        assert(await student.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Comments must fit phone width");
        await student.page.screenshot({ path: `.dev/ux-review/student-comment-${width}.png`, animations: "disabled" });
      }
      await editor.fill("");
      await grader.page.getByRole("button", { name: "Remove comment", exact: true }).click();
      await grader.page.getByText("Comment removed", { exact: true }).waitFor();
      await pollFor(() => student.page.getByText(text, { exact: true }).count(), (count) => count === 0, { timeout: 12000 });
    }
    await grader.context.close();
  }
  assert(errors.length === 0, errors.join("; "));
  await student.context.close();
  console.log("PASS comments.mjs: real TA/professor save, student auto-refresh, names, reload, removal, failed-save draft, released-grade preservation and phone views; active demo unchanged");
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    const stopped = new Promise((resolve) => server.once("exit", resolve));
    server.kill("SIGTERM");
    await stopped;
  }
  rmSync(root, { recursive: true, force: true });
}
