import { describe, expect, it } from "vitest";
import type { AssignmentDetail, DocumentMeta } from "../../api/types";
import { needsGuidedStart, setupSteps } from "./steps";

const base: AssignmentDetail = {
  id: "asg_2",
  course_id: "crs_1",
  title: "Homework 2",
  questions: [{ id: "q1", title: "Determinants", prompt: "…", max_points: 10 }],
  due_at: null,
  created_at: "2026-09-19T21:53:54+00:00",
  published_rubric_id: null,
  documents: [],
  rubric_draft: null,
  draft_revision: 0,
  rubrics: [],
};

const solution: DocumentMeta = {
  id: "doc_s",
  assignment_id: "asg_2",
  kind: "solution",
  filename: "solution.pdf",
  page_count: 3,
  sha256: "s",
  extraction: "pdf_text",
  has_unreadable_pages: false,
};

describe("guided setup", () => {
  it("leads with the guided card on an assignment with nothing on it", () => {
    expect(needsGuidedStart(base)).toBe(true);
    const steps = setupSteps(base);
    expect(steps.map((s) => s.done)).toEqual([false, false, false]);
    expect(steps.find((s) => s.current)?.id).toBe("solution");
  });

  it("moves to the draft step once the solution is attached", () => {
    const withSolution = { ...base, documents: [solution] };
    expect(needsGuidedStart(withSolution)).toBe(false);
    const steps = setupSteps(withSolution);
    expect(steps[0].done).toBe(true);
    expect(steps.find((s) => s.current)?.id).toBe("draft");
  });

  it("moves to publish once criteria exist", () => {
    const ready = {
      ...base,
      documents: [solution],
      rubric_draft: {
        criteria: [{ id: "q1-a", question_id: "q1", description: "d", points: 10, category: "logic" as const }],
        instructor_notes: "",
      },
      draft_revision: 1,
    };
    expect(setupSteps(ready).find((s) => s.current)?.id).toBe("publish");
    expect(needsGuidedStart(ready)).toBe(false);
  });

  it("treats an empty draft as no draft", () => {
    const empty = { ...base, rubric_draft: { criteria: [], instructor_notes: "" } };
    expect(needsGuidedStart(empty)).toBe(true);
    expect(setupSteps(empty)[1].done).toBe(false);
  });
});
