#!/usr/bin/env node
// e2e/console.mjs — visits every route in the brief's ownership table as the right identity and
// fails on any console error or any network response >= 400. Routes still owned by Task 1's
// Placeholder are visited too (the shell chrome and role guard must stay clean) but are only
// checked for console/network cleanliness, not for real content. `node e2e/console.mjs`.
import { chromium } from "playwright";
import { BASE_URL, identity, openPage, apiGet, isPlaceholder } from "./lib.mjs";

const dana = identity("Dana Whitfield");
const amara = identity("Amara Okafor");
const { file } = dana;
const assignmentId = file.assignment_id;
const courseId = file.course_id;

// Real ids so a route that has already gone live (or lands mid-flight) gets a fetchable resource
// instead of a synthetic 404.
const finalQueue = await apiGet(
  dana.session.token,
  file.api,
  `/assignments/${assignmentId}/submissions?final_only=true`,
);
const gradeSubmissionId = finalQueue[0]?.id ?? "no-final-submission";
const amaraSubs = await apiGet(amara.session.token, file.api, `/assignments/${assignmentId}/submissions`);
const studentSubmissionId = amaraSubs[0]?.id ?? "no-submission";

const ROUTES = [
  { path: "/session", as: null },
  { path: "/", as: "Dana Whitfield" },
  { path: `/c/${courseId}`, as: "Dana Whitfield" },
  { path: `/c/${courseId}/new`, as: "Dana Whitfield" },
  { path: `/a/${assignmentId}`, as: "Dana Whitfield" },
  { path: `/a/${assignmentId}`, as: "Amara Okafor" },
  { path: `/a/${assignmentId}/overview`, as: "Sam Reyes" },
  { path: `/a/${assignmentId}/reports`, as: "Sam Reyes" },
  { path: `/a/${assignmentId}/rubric`, as: "Dana Whitfield" },
  { path: `/a/${assignmentId}/grade`, as: "Sam Reyes" },
  { path: `/a/${assignmentId}/grade/${gradeSubmissionId}`, as: "Sam Reyes" },
  { path: `/s/${studentSubmissionId}/pages`, as: "Amara Okafor" },
  { path: `/s/${studentSubmissionId}`, as: "Amara Okafor" },
];

const browser = await chromium.launch();
let failures = 0;
try {
  for (const route of ROUTES) {
    const { page, consoleErrors, failedRequests } = await openPage(browser, { as: route.as ?? undefined });
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle" });
    const placeholder = await isPlaceholder(page);
    const dirty = consoleErrors.length > 0 || failedRequests.length > 0;
    const label = `${route.path} as ${route.as ?? "signed out"}${placeholder ? " [placeholder]" : ""}`;
    if (dirty) {
      failures++;
      console.error(`FAIL ${label}`);
      for (const e of consoleErrors) console.error(`  console: ${e}`);
      for (const f of failedRequests) console.error(`  network: ${f}`);
    } else {
      console.log(`PASS ${label}`);
    }
    await page.context().close();
  }
} finally {
  await browser.close();
}

if (failures > 0) {
  console.error(`FAIL console.mjs: ${failures}/${ROUTES.length} routes had console errors or failed requests`);
  process.exitCode = 1;
} else {
  console.log(`PASS console.mjs (${ROUTES.length} routes clean)`);
}
