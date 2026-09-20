import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  categoryTone,
  decisionMap,
  firstMappedPage,
  flagIdFromMark,
  marksForQuestion,
  pagesSentence,
  questionAssessment,
  sharedCategoryTone,
  suggestedMetIds,
} from "./assessment";
import { criteriaFor } from "./review-state";
import * as fx from "./fixtures";

describe("reading the automated assessment", () => {
  it("slices a question, and returns null when there is no assessment", () => {
    expect(questionAssessment(fx.assessment, "q2")?.flags).toHaveLength(2);
    expect(questionAssessment(fx.assessment, "nope")).toBeNull();
    expect(questionAssessment(null, "q1")).toBeNull();
  });

  it("keeps a null question score as null, never zero", () => {
    const q4 = questionAssessment(fx.assessment, "q4");
    expect(q4?.score).toBeNull();
    expect(q4?.status).toBe("needs_review");
  });

  it("indexes decisions by criterion and names only the met ones", () => {
    const decisions = decisionMap(fx.assessment);
    expect(decisions.get("q1-ops")?.outcome).toBe("met");
    expect(suggestedMetIds(criteriaFor(fx.criteria, "q1"), decisions)).toEqual(["q1-ops", "q1-arith"]);
    expect(suggestedMetIds(criteriaFor(fx.criteria, "q2"), decisions)).toEqual([]);
    expect(decisionMap(null).size).toBe(0);
  });

  it("takes its category words and ink from the shared map, so the paper and the panel agree", () => {
    expect(categoryLabel("unsupported_method")).toBe("Unsupported method");
    expect(categoryLabel("arithmetic")).toBe("Arithmetic");
    expect(categoryLabel("needs_review")).toBe("Needs review");
    // every flag on the grading screen is a reason to take points off, so the ink is deduction
    expect(categoryTone("arithmetic")).toBe("deduction");
    expect(categoryTone("presentation")).toBe("deduction");
    // the student view's shared default still distinguishes them
    expect(sharedCategoryTone("presentation")).toBe("hint");
  });
});

describe("marks for the paper", () => {
  const flags = questionAssessment(fx.assessment, "q2")!.flags;

  it("numbers marks from 1 in flag order, carries the page and takes the category's ink", () => {
    const marks = marksForQuestion("sub_ben", "q2", flags, null);
    expect(marks.map((m) => m.label)).toEqual([1, 2]);
    expect(marks.map((m) => m.page)).toEqual([1, 2]);
    expect(marks.map((m) => m.tone)).toEqual(["deduction", "deduction"]);
    const presentation = marksForQuestion("sub_x", "q1", [
      { id: "f", category: "presentation", message: "m", anchors: [{ id: "a", page: 1, bbox: null }] },
    ], null);
    expect(presentation[0].tone).toBe("deduction");
  });

  it("leaves a null bbox null so the viewer uses the page gutter", () => {
    expect(marksForQuestion("sub_ben", "q2", flags, null).every((m) => m.bbox === null)).toBe(true);
  });

  it("keys each mark by submission, question, flag and anchor", () => {
    const marks = marksForQuestion("sub_ben", "q2", flags, null);
    expect(marks[0].id).toBe("sub_ben:q2:q2-flag-1:anchor-1");
    expect(new Set(marks.map((m) => m.id)).size).toBe(marks.length);
    expect(flagIdFromMark(marks[1].id)).toBe("q2-flag-2");
    expect(flagIdFromMark("nonsense")).toBeNull();
  });

  it("marks the selected flag so the pin and the card stay in step", () => {
    const marks = marksForQuestion("sub_ben", "q2", flags, "q2-flag-2");
    expect(marks.map((m) => m.selected)).toEqual([false, true]);
  });

  it("has no marks for a question the assessment did not flag", () => {
    expect(marksForQuestion("sub_ben", "q1", questionAssessment(fx.assessment, "q1")!.flags, null)).toEqual([]);
  });
});

describe("page mapping", () => {
  const mapping = fx.submission().mapping;

  it("reads the first mapped page and writes the pages sentence", () => {
    expect(firstMappedPage(mapping, "q2")).toBe(1);
    expect(pagesSentence(mapping, "q1")).toBe("Page 1");
    expect(pagesSentence(mapping, "q2")).toBe("Pages 1, 2");
  });

  it("says nothing when a question was never mapped", () => {
    expect(firstMappedPage(null, "q1")).toBeNull();
    expect(pagesSentence({ q1: [] }, "q1")).toBeNull();
    expect(pagesSentence(mapping, "q9")).toBeNull();
  });
});
