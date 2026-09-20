import { describe, expect, it } from "vitest";
import type { Flag, Question, StudentAssessment } from "../../../api/types";
import { flagLabel } from "../../../components";
import { flagIdFromMark, flagMarks, flagsForQuestion, numberFlags } from "./flags";

const questions: Question[] = [
  { id: "q1", title: "Solve the system", prompt: "", max_points: 8 },
  { id: "q2", title: "Rank and nullity", prompt: "", max_points: 6 },
  { id: "q3", title: "Subspace proof", prompt: "", max_points: 8 },
];

function flag(id: string, category: Flag["category"], pages: number[]): Flag {
  return {
    id,
    category,
    message: `message for ${id}`,
    anchors: pages.map((page, i) => ({ id: `anchor-${i + 1}`, page, bbox: null })),
  };
}

function assessment(rows: Array<[string, Flag[]]>): StudentAssessment {
  return {
    score: 19,
    max_points: 30,
    status: "estimated",
    provider_id: "dev-fixture",
    mode: "fixture",
    assessed_at: "2026-09-19T21:53:54Z",
    questions: rows.map(([question_id, flags]) => ({
      question_id,
      score: 5,
      max_points: 8,
      status: "estimated" as const,
      flags,
    })),
  };
}

describe("flag numbering", () => {
  it("numbers across questions in reading order: page first, then the returned order", () => {
    const numbered = numberFlags(
      assessment([
        ["q1", [flag("q1-flag-1", "arithmetic", [1]), flag("q1-flag-2", "notation", [3])]],
        ["q2", [flag("q2-flag-1", "logic", [1])]],
        ["q3", [flag("q3-flag-1", "justification", [2])]],
      ]),
      questions,
    );
    expect(numbered.map((f) => [f.number, f.flag.id, f.page])).toEqual([
      [1, "q1-flag-1", 1],
      [2, "q2-flag-1", 1],
      [3, "q3-flag-1", 2],
      [4, "q1-flag-2", 3],
    ]);
  });

  it("walks questions in the assignment's order even when the backend reorders them", () => {
    const numbered = numberFlags(
      assessment([
        ["q3", [flag("q3-flag-1", "logic", [1])]],
        ["q1", [flag("q1-flag-1", "arithmetic", [1])]],
      ]),
      questions,
    );
    expect(numbered.map((f) => f.flag.id)).toEqual(["q1-flag-1", "q3-flag-1"]);
  });

  it("numbers a multi-page flag from its first page", () => {
    const numbered = numberFlags(
      assessment([
        ["q1", [flag("q1-flag-1", "presentation", [3, 2])]],
        ["q2", [flag("q2-flag-1", "logic", [3])]],
      ]),
      questions,
    );
    expect(numbered.map((f) => [f.number, f.flag.id, f.page])).toEqual([
      [1, "q1-flag-1", 2],
      [2, "q2-flag-1", 3],
    ]);
  });

  it("carries the question title and a plain category label", () => {
    const [first] = numberFlags(
      assessment([["q1", [flag("q1-flag-1", "unsupported_method", [1])]]]),
      questions,
    );
    expect(first.questionTitle).toBe("Solve the system");
    expect(first.categoryLabel).toBe("Unsupported method");
    expect(flagLabel("needs_review")).toBe("Needs review");
  });

  it("is empty when nothing has been checked yet", () => {
    expect(numberFlags(null, questions)).toEqual([]);
    expect(numberFlags(assessment([["q1", []]]), questions)).toEqual([]);
  });

  it("groups by question while keeping paper-wide numbers", () => {
    const numbered = numberFlags(
      assessment([
        ["q1", [flag("q1-flag-1", "arithmetic", [1])]],
        ["q2", [flag("q2-flag-1", "logic", [1]), flag("q2-flag-2", "notation", [2])]],
      ]),
      questions,
    );
    expect(flagsForQuestion(numbered, "q2").map((f) => f.number)).toEqual([2, 3]);
  });
});

describe("viewer marks", () => {
  it("makes one hint mark per anchor, keyed by question, flag and anchor", () => {
    const numbered = numberFlags(
      assessment([["q1", [flag("q1-flag-1", "arithmetic", [1, 2])]]]),
      questions,
    );
    const marks = flagMarks(numbered, "q1-flag-1");
    expect(marks).toEqual([
      { id: "q1:q1-flag-1:anchor-1", page: 1, bbox: null, label: 1, tone: "hint", selected: true },
      { id: "q1:q1-flag-1:anchor-2", page: 2, bbox: null, label: 1, tone: "hint", selected: true },
    ]);
    expect(flagIdFromMark(marks[0].id)).toBe("q1-flag-1");
  });

  it("keeps a bbox when the backend ever sends one", () => {
    const withBox = assessment([
      [
        "q1",
        [
          {
            id: "q1-flag-1",
            category: "arithmetic",
            message: "m",
            anchors: [{ id: "a1", page: 2, bbox: [0.1, 0.2, 0.3, 0.4] }],
          },
        ],
      ],
    ]);
    expect(flagMarks(numberFlags(withBox, questions))[0].bbox).toEqual([0.1, 0.2, 0.3, 0.4]);
  });
});
