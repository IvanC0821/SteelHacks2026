import { describe, expect, it } from "vitest";
import type { Rubric, RubricInput } from "../../api/types";
import { readSaveResponse, versionLine, versionSummary } from "./save";

const sent: RubricInput = {
  criteria: [{ id: "q1-a", question_id: "q1", description: "Row operations are labeled", points: 8, category: "presentation" }],
  instructor_notes: "",
};

describe("save response", () => {
  it("reads the {draft, revision} shape the API actually returns", () => {
    const saved = readSaveResponse({ draft: sent, revision: 4 }, sent, 3);
    expect(saved.revision).toBe(4);
    expect(saved.draft).toBe(sent);
  });

  it("reads an assignment detail if the endpoint ever returns one", () => {
    const saved = readSaveResponse({ id: "asg_1", rubric_draft: sent, draft_revision: 9 }, sent, 3);
    expect(saved.revision).toBe(9);
    expect(saved.draft).toBe(sent);
  });

  it("falls back to what was sent and the next revision", () => {
    const saved = readSaveResponse(undefined, sent, 3);
    expect(saved.revision).toBe(4);
    expect(saved.draft).toBe(sent);
  });

  it("keeps revision 0 → 1 for a first save", () => {
    expect(readSaveResponse({}, sent, 0).revision).toBe(1);
  });
});

describe("published versions", () => {
  const rubric: Rubric = {
    ...sent,
    criteria: [
      { id: "q1-a", question_id: "q1", description: "a", points: 8, category: "logic" },
      { id: "q2-a", question_id: "q2", description: "b", points: 6, category: "logic" },
      { id: "q2-b", question_id: "q2", description: "c", points: 0.5, category: "logic" },
    ],
    id: "rub_1",
    assignment_id: "asg_1",
    version: 1,
    published_at: new Date(2026, 8, 19, 14, 14).toISOString(),
    reference_ids: [],
  };

  it("writes the quiet version line in lower-case clock time", () => {
    expect(versionLine(rubric)).toBe("Rubric v1 published 2:14 pm");
  });

  it("does not invent a time from a broken timestamp", () => {
    expect(versionLine({ ...rubric, published_at: "nonsense" })).toBe("Rubric v1 published at an unknown time");
  });

  it("summarises a version by criteria and questions", () => {
    expect(versionSummary(rubric)).toBe("3 criteria across 2 questions");
    expect(versionSummary({ ...rubric, criteria: [rubric.criteria[0]] })).toBe("1 criterion across 1 question");
  });
});
