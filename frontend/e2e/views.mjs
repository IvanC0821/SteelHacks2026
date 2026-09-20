// Real local account switching, no assessment/rubric/grade writes.
import { chromium } from "playwright";
import { BASE_URL, identity, openPage, assert, apiGet } from "./lib.mjs";

const { file } = identity("Dana Whitfield");
const browser = await chromium.launch();
async function activeRole(page) {
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("verity.session")));
  return (await apiGet(stored.token, stored.api, "/me")).role;
}
try {
  const metadata = await fetch(`${BASE_URL}/__verity_demo/views`);
  const data = await metadata.json();
  assert(data.available && data.views.length === 2, "Two local demo views");
  assert(!JSON.stringify(data).includes("token"), "View list contains no credentials");
  assert(metadata.headers.get("cache-control") === "no-store", "No demo caching");
  const foreign = await fetch(`${BASE_URL}/__verity_demo/session?view=staff`, { headers: { Origin: "https://unrelated.example" } });
  assert(foreign.status === 403, "Reject foreign-origin session requests");
  const invalid = await fetch(`${BASE_URL}/__verity_demo/session?view=admin`);
  assert(invalid.status === 400, "Only known views are allowed");
  const unknownStudent = await fetch(`${BASE_URL}/__verity_demo/session?view=student&studentId=not-in-class`);
  assert(unknownStudent.status === 400, "Unknown students cannot be selected");
  const staff = identity("Dana Whitfield");
  const roster = await apiGet(staff.session.token, file.api, `/courses/${file.course_id}/members`);
  const students = data.views.find((view) => view.id === "student").accounts;
  assert(students.length > 1, "Named student selection is available");
  assert(students.every((student) => roster.some((member) => member.id === student.userId && member.name === student.name && member.role === "student")), "Demo names match the current class roster by ID");

  const { page, context, consoleErrors, failedRequests } = await openPage(browser);
  await page.goto(`${BASE_URL}/session`, { waitUntil: "networkidle" });
  assert(await page.getByLabel("Access token").count() === 0, "Demo has no token prompt");
  await page.getByRole("combobox", { name: "View as" }).selectOption("staff");
  await page.getByRole("button", { name: "Open workspace" }).click();
  await page.waitForURL(/\/c\//);
  assert(await activeRole(page) === "instructor", "Staff view uses a real instructor session");
  let picker = page.getByRole("combobox", { name: "View as" });
  await picker.waitFor();
  const position = await picker.boundingBox();
  assert(position.x < 240 && position.y > 650, "View dropdown is bottom-left");
  await page.goto(`${BASE_URL}/a/${file.assignment_id}/overview`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Students with feedback flags" }).waitFor();
  assert(await page.locator(".v-course-tiles").count() === 0, "Staff view uses simple graph");
  await page.screenshot({ path: ".dev/ux-review/shared-staff-view.png" });

  // A failed switch keeps the current identity and screen.
  await page.route("**/__verity_demo/session?view=student", (route) => route.fulfill({ status: 503, json: {} }));
  await picker.selectOption("student");
  await page.getByRole("alert").filter({ hasText: "Could not switch views" }).waitFor();
  assert(await activeRole(page) === "instructor", "Failed switch keeps staff identity");
  await page.unroute("**/__verity_demo/session?view=student");
  await picker.selectOption("student");
  await page.waitForURL(/\/c\//);
  await page.getByRole("combobox", { name: "View as" }).waitFor();
  assert(await activeRole(page) === "student", "Student view uses a real student session");
  assert(await page.locator(".v-course-feedback-chart").count() === 0, "Old staff page is unmounted");
  await page.reload({ waitUntil: "networkidle" });
  assert(await activeRole(page) === "student", "View selection persists across reload");

  await picker.selectOption("staff");
  await page.getByText("Dana Whitfield", { exact: true }).waitFor();
  const queue = await apiGet(staff.session.token, file.api, `/assignments/${file.assignment_id}/submissions?final_only=true`);
  const paper = queue.find((item) => item.student_id !== data.views.find((view) => view.id === "student").userId);
  await page.goto(`${BASE_URL}/a/${file.assignment_id}/grade/${paper.id}`, { waitUntil: "networkidle" });
  await picker.selectOption("student");
  await page.waitForURL(`${BASE_URL}/s/${paper.id}`);
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem("verity.session")));
  let current = await apiGet(stored.token, stored.api, "/me");
  assert(current.id === paper.student_id && current.name === paper.student_name, "Switching from grading opens that paper's student");
  await picker.selectOption("staff");
  await page.waitForURL(`${BASE_URL}/a/${file.assignment_id}/grade/${paper.id}`);
  await picker.selectOption("student");
  await page.waitForURL(`${BASE_URL}/s/${paper.id}`);
  const otherStudent = students.find((student) => student.userId !== paper.student_id);
  await page.getByRole("combobox", { name: "Student", exact: true }).selectOption(otherStudent.userId);
  await page.waitForURL(/\/c\//);
  stored = await page.evaluate(() => JSON.parse(localStorage.getItem("verity.session")));
  current = await apiGet(stored.token, stored.api, "/me");
  assert(current.id === otherStudent.userId && current.name === otherStudent.name, "Named student selection opens the matching account");
  await picker.selectOption("staff");
  await page.getByText("Dana Whitfield", { exact: true }).waitFor();
  await page.goto(`${BASE_URL}/a/${file.assignment_id}/rubric`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Manage references" }).waitFor();
  assert(await page.getByRole("combobox", { name: "View as" }).isVisible(), "Dropdown works on collapsed workspace rail");
  await page.getByRole("combobox", { name: "View as" }).selectOption("student");
  await page.waitForURL(/\/c\//);
  assert(await activeRole(page) === "student", "Collapsed rail switches role");

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    picker = page.getByRole("dialog").getByRole("combobox", { name: "View as" });
    await picker.selectOption("staff");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert(await activeRole(page) === "instructor", "Phone drawer switches role and closes");
    await page.getByRole("button", { name: "Open navigation", exact: true }).click();
    await picker.waitFor({ state: "visible" });
    await page.screenshot({ path: `.dev/ux-review/view-switcher-${width}.png`, animations: "disabled" });
    await picker.selectOption("student");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No phone overflow");
  }
  assert(consoleErrors.filter((error) => !error.includes("503")).length === 0, [...consoleErrors, ...failedRequests].join("; "));
  await context.close();
  console.log("PASS views.mjs: tokenless entry, shared chart, switch/failure/reload, collapsed rail, mobile and origin guard");
} finally { await browser.close(); }
