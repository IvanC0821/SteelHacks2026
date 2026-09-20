import { describe, expect, it } from "vitest";
import type { Assignment, ReviewStatus, StaffSubmission, StudentSubmission } from "../../api/types";
import { staffStatus, studentStatus, totalPoints } from "./status";

const assignment = (overrides: Partial<Assignment> = {}): Assignment => ({
  id: "asg_1",
  course_id: "crs_1",
  title: "Homework 1",
  questions: [
    { id: "q1", title: "Solve the system", prompt: "", max_points: 8 },
    { id: "q2", title: "Rank and nullity", prompt: "", max_points: 6 },
  ],
  due_at: null,
  created_at: "2026-09-19T00:00:00Z",
  published_rubric_id: "rub_1",
  ...overrides,
});

const staffSub = (status: ReviewStatus): StaffSubmission =>
  ({ id: `sub_${status}`, final: true, review: { status } }) as unknown as StaffSubmission;

const studentSub = (
  version: number,
  options: { final?: boolean; review?: ReviewStatus; score?: number | null; estimate?: number | null } = {},
): StudentSubmission =>
  ({
    id: `sub_${version}`,
    version,
    created_at: `2026-09-1${version}T00:00:00Z`,
    final: options.final ?? false,
    review:
      options.review === "released"
        ? { status: "released", score: options.score ?? null }
        : { status: options.review ?? "not_started" },
    assessment:
      options.estimate === undefined
        ? { score: 19, max_points: 30, status: "estimated", questions: [], provider_id: "dev", mode: "fixture", assessed_at: "" }
        : options.estimate === null
          ? null
          : { score: options.estimate, max_points: 30, status: "estimated", questions: [], provider_id: "dev", mode: "fixture", assessed_at: "" },
  }) as unknown as StudentSubmission;

describe("totalPoints", () => {
  it("adds the question maxima", () => {
    expect(totalPoints(assignment())).toBe(14);
  });
});

describe("staffStatus", () => {
  it("asks for a rubric before anything else, even with papers in the queue", () => {
    const status = staffStatus(assignment({ published_rubric_id: null }), [staffSub("not_started")]);
    expect(status.state).toBe("rubric_missing");
    expect(status.label).toBe("Rubric not published");
    expect(status.action).toEqual({ label: "Set up rubric", to: "/a/asg_1/rubric" });
    expect(status.progress).toBeNull();
  });

  it("names the published rubric version when no papers are in yet", () => {
    const status = staffStatus(assignment(), [], 2);
    expect(status.state).toBe("no_papers");
    expect(status.label).toBe("Rubric v2, no papers yet");
    expect(status.action.to).toBe("/a/asg_1/overview");
  });

  it("counts completed and released papers as reviewed while grading", () => {
    const status = staffStatus(assignment(), [
      staffSub("released"),
      staffSub("completed"),
      staffSub("in_progress"),
      staffSub("not_started"),
    ]);
    expect(status.state).toBe("grading");
    expect(status.label).toBe("Grading 2 of 4");
    expect(status.progress).toEqual({ reviewed: 2, total: 4 });
    expect(status.action).toEqual({ label: "Grade", to: "/a/asg_1/grade" });
  });

  it("reaches all reviewed before anything is released", () => {
    const status = staffStatus(assignment(), [staffSub("completed"), staffSub("released")]);
    expect(status.state).toBe("all_reviewed");
    expect(status.label).toBe("All reviewed");
    expect(status.action).toEqual({ label: "Review", to: "/a/asg_1/grade" });
  });

  it("is released only when every paper is released", () => {
    const status = staffStatus(assignment(), [staffSub("released"), staffSub("released")]);
    expect(status.state).toBe("released");
    expect(status.action).toEqual({ label: "Open", to: "/a/asg_1/overview" });
  });
});

describe("studentStatus", () => {
  it("is not started with no attempts", () => {
    const status = studentStatus(assignment(), []);
    expect(status.state).toBe("not_started");
    expect(status.label).toBe("Not started");
    expect(status.action).toEqual({ label: "Start", to: "/a/asg_1" });
  });

  it("reads the latest attempt for the estimate", () => {
    const status = studentStatus(assignment(), [studentSub(1, { estimate: 12 }), studentSub(2, { estimate: 17 })]);
    expect(status.state).toBe("estimated");
    expect(status.estimate).toBe(17);
    expect(status.score).toBeNull();
  });

  it("says not checked when an attempt exists with no assessment", () => {
    const status = studentStatus(assignment(), [studentSub(1, { estimate: null })]);
    expect(status.state).toBe("not_checked");
    expect(status.estimate).toBeNull();
  });

  it("is handed in while the review is pending, and never shows a final score", () => {
    const status = studentStatus(assignment(), [studentSub(1), studentSub(2, { final: true, estimate: 19 })]);
    expect(status.state).toBe("handed_in");
    expect(status.label).toBe("Handed in");
    expect(status.score).toBeNull();
    expect(status.estimate).toBe(19);
  });

  it("shows the final score only once the review is released", () => {
    const status = studentStatus(assignment(), [
      studentSub(1),
      studentSub(2, { final: true, review: "released", score: 27 }),
    ]);
    expect(status.state).toBe("final_score");
    expect(status.score).toBe(27);
    expect(status.estimate).toBeNull();
    expect(status.maxPoints).toBe(14);
  });

  it("renders a released review with no number as null, not zero", () => {
    const status = studentStatus(assignment(), [
      studentSub(1, { final: true, review: "released", score: null }),
    ]);
    expect(status.state).toBe("final_score");
    expect(status.score).toBeNull();
  });

  it("labels a null estimate Needs review, never Estimated", () => {
    const attempt = {
      id: "s1", assignment_id: "a1", student_id: "u1", document_id: "d1", version: 1, rubric_id: "r1",
      created_at: "2026-09-19T00:00:00Z", mapping: { q1: [1] }, sealed: true, final: false, handed_in_at: null,
      job_id: null, document: { id: "d1", assignment_id: "a1", kind: "submission", filename: "x.pdf", page_count: 1, sha256: "", extraction: "pdf_text", has_unreadable_pages: false },
      assessment: { score: null, max_points: 30, status: "needs_review", questions: [], provider_id: "dev", mode: "fixture", assessed_at: "" },
      review: { status: "not_started" },
    };
    const status = studentStatus(assignment(), [attempt as never]);
    expect(status.state).toBe("needs_review");
    expect(status.label).toBe("Needs review");
    expect(status.estimate).toBeNull();
  });
});
