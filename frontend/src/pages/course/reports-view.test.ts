import { describe, expect, it } from "vitest";
import type { Member, Question, Report } from "../../api/types";
import {
  openReportCount,
  orderReports,
  reportKindLabel,
  reportRows,
  reportStatusLabel,
} from "./reports-view";

const report = (overrides: Partial<Report> = {}): Report => ({
  id: "rep_1",
  submission_id: "sub_1",
  question_id: "q3",
  kind: "help",
  message: "I don't see what is missing from my subspace proof.",
  status: "open",
  created_at: "2026-09-19T21:53:54Z",
  ...overrides,
});

const questions: Question[] = [
  { id: "q1", title: "Solve the system", prompt: "", max_points: 8 },
  { id: "q2", title: "Rank and nullity", prompt: "", max_points: 6 },
  { id: "q3", title: "Subspace proof", prompt: "", max_points: 8 },
];

const members: Member[] = [
  { id: "usr_chloe", name: "Chloe Nguyen", role: "student" },
  { id: "usr_dana", name: "Dana Whitfield", role: "instructor" },
];

describe("orderReports", () => {
  it("puts open reports first, then newest", () => {
    const ordered = orderReports([
      report({ id: "old_open", created_at: "2026-09-10T00:00:00Z" }),
      report({ id: "new_resolved", status: "resolved", created_at: "2026-09-18T00:00:00Z" }),
      report({ id: "new_open", created_at: "2026-09-17T00:00:00Z" }),
      report({ id: "old_dismissed", status: "dismissed", created_at: "2026-09-01T00:00:00Z" }),
    ]);
    expect(ordered.map((r) => r.id)).toEqual(["new_open", "old_open", "new_resolved", "old_dismissed"]);
  });

  it("does not mutate the input", () => {
    const input = [report({ id: "a", status: "resolved" }), report({ id: "b" })];
    orderReports(input);
    expect(input.map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("labels", () => {
  it("uses the exact vocabulary", () => {
    expect(reportKindLabel("help")).toBe("Help");
    expect(reportKindLabel("incorrect_feedback")).toBe("Feedback disputed");
    expect(reportStatusLabel("open")).toBe("Open");
    expect(reportStatusLabel("resolved")).toBe("Resolved");
    expect(reportStatusLabel("dismissed")).toBe("Dismissed");
  });

  it("times the row with the shared formatter", () => {
    const rows = reportRows([report()], questions, members);
    expect(rows[0].when).toMatch(/^Sep \d\d?, \d\d?:\d\d (AM|PM)$/);
  });
});

describe("reportRows", () => {
  it("resolves the student name from the roster and the question from the assignment", () => {
    const rows = reportRows([report({ student_id: "usr_chloe" })], questions, members);
    expect(rows[0].studentName).toBe("Chloe Nguyen");
    expect(rows[0].questionLabel).toBe("Q3 · Subspace proof");
    expect(rows[0].kindLabel).toBe("Help");
  });

  it("prefers a student_name the API supplies and survives an unknown id", () => {
    const rows = reportRows(
      [report({ student_name: "Farah Aziz" }), report({ id: "rep_2", student_id: "usr_ghost" })],
      questions,
      members,
    );
    expect(rows[0].studentName).toBe("Farah Aziz");
    expect(rows[1].studentName).toBe("Unknown student");
  });

  it("counts open reports", () => {
    expect(openReportCount([report(), report({ id: "r2", status: "resolved" })])).toBe(1);
  });
});
