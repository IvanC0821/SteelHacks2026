import { describe, expect, it } from "vitest";
import type { FlagCategory, QuestionAssessment, StudentAssessment } from "../../../api/types";
import { compareFeedback, needsAttention } from "./feedback";

function question(categories: FlagCategory[], overrides: Partial<QuestionAssessment> = {}): QuestionAssessment {
  return {
    question_id: "q1", score: 5, max_points: 8, status: "estimated",
    flags: categories.map((category, i) => ({ id: `flag-${i}`, category, message: "Check this step", anchors: [] })),
    ...overrides,
  };
}

function attempt(version: number, questions: QuestionAssessment[]) {
  const assessment: StudentAssessment = {
    score: 5, max_points: 8, status: "estimated", questions,
    provider_id: "dev-fixture", mode: "fixture", assessed_at: "2026-09-19T00:00:00Z",
  };
  return { version, assignment_id: "a1", student_id: "s1", rubric_id: "r1", assessment };
}

describe("feedback attention", () => {
  it("includes uncertain work even when there are no flags", () => {
    expect(needsAttention(question([], { score: null }))).toBe(true);
    expect(needsAttention(question([], { status: "needs_review" }))).toBe(true);
  });
  it("includes flagged questions but does not infer flags from a score", () => {
    expect(needsAttention(question(["arithmetic"]))).toBe(true);
    expect(needsAttention(question([]))).toBe(false);
  });
});

describe("revision comparison", () => {
  it("compares unique categories by question without relying on generated flag IDs", () => {
    const before = attempt(1, [question(["arithmetic", "arithmetic", "notation"])]);
    const after = attempt(2, [question(["arithmetic", "logic", "logic"])]);
    expect(compareFeedback(after, before)).toEqual([{
      questionId: "q1", still: ["arithmetic"], added: ["logic"], absent: ["notation"], uncertain: false,
    }]);
  });
  it("does not label disappearing flags as improvement when either check is uncertain", () => {
    const before = attempt(1, [question(["arithmetic"])]);
    const after = attempt(2, [question([], { score: null, status: "needs_review" })]);
    expect(compareFeedback(after, before)?.[0]).toMatchObject({ absent: [], uncertain: true });
    expect(compareFeedback(attempt(3, [question([])]), after)?.[0].uncertain).toBe(true);
  });
  it("refuses different or missing rubric versions", () => {
    const before = attempt(1, [question(["logic"])]);
    const after = attempt(2, [question([])]);
    expect(compareFeedback({ ...after, rubric_id: "r2" }, before)).toBeNull();
    expect(compareFeedback({ ...after, rubric_id: "" }, { ...before, rubric_id: "" })).toBeNull();
  });
  it("refuses incomplete checks and changed question definitions", () => {
    const before = attempt(1, [question(["logic"])]);
    const after = attempt(2, [question([])]);
    expect(compareFeedback({ ...after, assessment: null }, before)).toBeNull();
    expect(compareFeedback(after, { ...before, assessment: null })).toBeNull();
    expect(compareFeedback(attempt(2, []), before)).toBeNull();
    expect(compareFeedback(attempt(2, [question([], { max_points: 10 })]), before)).toBeNull();
    expect(compareFeedback(attempt(2, [question([], { question_id: "q2" })]), before)).toBeNull();
  });
  it("refuses changed assessment providers or fixture/live modes", () => {
    const before = attempt(1, [question(["logic"])]);
    const after = attempt(2, [question([])]);
    expect(compareFeedback({ ...after, assessment: { ...after.assessment, provider_id: "new-provider" } }, before)).toBeNull();
    expect(compareFeedback({ ...after, assessment: { ...after.assessment, mode: "live" } }, before)).toBeNull();
  });
  it("refuses other students, assignments and reversed or equal versions", () => {
    const before = attempt(1, [question(["logic"])]);
    const after = attempt(2, [question([])]);
    expect(compareFeedback({ ...after, student_id: "s2" }, before)).toBeNull();
    expect(compareFeedback({ ...after, assignment_id: "a2" }, before)).toBeNull();
    expect(compareFeedback(before, after)).toBeNull();
    expect(compareFeedback(before, before)).toBeNull();
  });
  it("matches questions by identity when their order differs", () => {
    const before = attempt(1, [question(["arithmetic"]), question(["logic"], { question_id: "q2" })]);
    const after = attempt(2, [question(["logic"], { question_id: "q2" }), question([])]);
    expect(compareFeedback(after, before)?.map((change) => [change.questionId, change.still, change.absent])).toEqual([
      ["q2", ["logic"], []], ["q1", [], ["arithmetic"]],
    ]);
  });
});
