import { describe, expect, it } from "vitest";
import type { Criterion, DocumentMeta, Question, Rubric, RubricInput } from "../../api/types";
import { nextVersionLabel, publishBlockers, publishGateTitle, referenceIds, saveBlockers } from "./publish-gate";

const questions: Question[] = [
  { id: "q1", title: "Solve the system", prompt: "…", max_points: 8 },
  { id: "q2", title: "Rank and nullity", prompt: "…", max_points: 6 },
];

function criterion(id: string, question_id: string, points: number): Criterion {
  return { id, question_id, description: `Criterion ${id}`, points, category: "logic" };
}

const complete: RubricInput = {
  criteria: [criterion("q1-a", "q1", 5), criterion("q1-b", "q1", 3), criterion("q2-a", "q2", 6)],
  instructor_notes: "Notes",
};

const documents: DocumentMeta[] = [
  {
    id: "doc_q",
    assignment_id: "asg_1",
    kind: "questions",
    filename: "homework-1.pdf",
    page_count: 1,
    sha256: "a",
    extraction: "pdf_text",
    has_unreadable_pages: false,
  },
  {
    id: "doc_s",
    assignment_id: "asg_1",
    kind: "solution",
    filename: "homework-1-solution.pdf",
    page_count: 4,
    sha256: "b",
    extraction: "pdf_text",
    has_unreadable_pages: false,
  },
];

function published(draft: RubricInput, version = 1, references = ["doc_q", "doc_s"]): Rubric {
  return {
    ...draft,
    id: `rub_${version}`,
    assignment_id: "asg_1",
    version,
    published_at: "2026-09-19T14:14:00+00:00",
    reference_ids: references,
  };
}

function gate(overrides: Partial<Parameters<typeof publishBlockers>[0]> = {}) {
  return publishBlockers({
    questions,
    draft: complete,
    dirty: false,
    rubrics: [],
    documents,
    role: "instructor",
    ...overrides,
  });
}

describe("publish gate", () => {
  it("allows a complete, saved, changed draft", () => {
    expect(gate()).toEqual([]);
    expect(publishGateTitle([])).toBeUndefined();
  });

  it("blocks a TA", () => {
    expect(gate({ role: "ta" })).toEqual(["Only the instructor can publish a rubric"]);
  });

  it("blocks when there is no draft or no criteria", () => {
    expect(gate({ draft: null })).toEqual(["Add at least one criterion"]);
    expect(gate({ draft: { criteria: [], instructor_notes: "" } })).toEqual(["Add at least one criterion"]);
  });

  it("names every question with no criteria", () => {
    const draft: RubricInput = { criteria: [criterion("q1-a", "q1", 8)], instructor_notes: "" };
    expect(gate({ draft })).toEqual(["Add a criterion to Rank and nullity"]);
  });

  it("reports a question whose points do not sum to its max", () => {
    const draft: RubricInput = {
      criteria: [criterion("q1-a", "q1", 5), criterion("q2-a", "q2", 6)],
      instructor_notes: "",
    };
    expect(gate({ draft })).toEqual(["Solve the system has 5 of 8 points assigned"]);
  });

  // The gate borrows the app-wide formatter from components/score-format, so a fractional total
  // reads the same here as it does on a score anywhere else: at most one decimal.
  it("reports an over-assigned question too, with tidy decimals", () => {
    const draft: RubricInput = {
      criteria: [criterion("q1-a", "q1", 8.25), criterion("q2-a", "q2", 6)],
      instructor_notes: "",
    };
    expect(gate({ draft })).toEqual(["Solve the system has 8.3 of 8 points assigned"]);
  });

  it("blocks an empty description and a zero-point criterion", () => {
    const draft: RubricInput = {
      criteria: [
        { ...criterion("q1-a", "q1", 8), description: "   " },
        { ...criterion("q2-a", "q2", 6), points: 0 },
      ],
      instructor_notes: "",
    };
    const reasons = gate({ draft });
    expect(reasons).toContain("Every criterion needs a description");
    expect(reasons).toContain("Criterion points must be more than 0");
    expect(reasons).toContain("Rank and nullity has 0 of 6 points assigned");
  });

  it("blocks duplicate criterion IDs and an ID the API would reject", () => {
    const duplicate: RubricInput = {
      criteria: [criterion("q1-a", "q1", 8), { ...criterion("q1-a", "q2", 6) }],
      instructor_notes: "",
    };
    expect(gate({ draft: duplicate })).toContain("Two criteria share an ID");
    const bad: RubricInput = {
      criteria: [criterion("q1 a", "q1", 8), criterion("q2-a", "q2", 6)],
      instructor_notes: "",
    };
    expect(gate({ draft: bad })).toContain("A criterion ID uses characters the API rejects");
  });

  it("blocks a criterion pointing at a question that is not on the assignment", () => {
    const draft: RubricInput = { criteria: [...complete.criteria, criterion("q9-a", "q9", 1)], instructor_notes: "N" };
    expect(gate({ draft })).toContain("Remove 1 criterion pointing at a question that no longer exists");
  });

  it("asks for a save before publishing", () => {
    expect(gate({ dirty: true })).toEqual(["Save the draft first"]);
  });

  it("blocks when nothing changed since the last version", () => {
    expect(gate({ rubrics: [published(complete)] })).toEqual(["Nothing has changed since Rubric v1"]);
  });

  it("allows a publish when the criteria changed", () => {
    const older: RubricInput = { ...complete, instructor_notes: "Older notes" };
    expect(gate({ rubrics: [published(older)] })).toEqual([]);
  });

  it("allows a publish when only a new reference document was attached", () => {
    expect(gate({ rubrics: [published(complete, 1, ["doc_q"])] })).toEqual([]);
  });

  it("ignores submission documents when comparing references", () => {
    const submission: DocumentMeta = { ...documents[0], id: "doc_sub", kind: "submission" };
    expect(referenceIds([...documents, submission])).toEqual(["doc_q", "doc_s"]);
    expect(gate({ documents: [...documents, submission], rubrics: [published(complete)] })).toEqual([
      "Nothing has changed since Rubric v1",
    ]);
  });

  it("joins the reasons into the disabled button title", () => {
    const reasons = gate({ draft: { criteria: [criterion("q1-a", "q1", 5)], instructor_notes: "" } });
    expect(publishGateTitle(reasons)).toBe(
      "Add a criterion to Rank and nullity. Solve the system has 5 of 8 points assigned",
    );
  });

  it("saveBlockers holds autosave back from a draft the API would refuse", () => {
    // PUT /rubric-draft validates as strictly as publish, so an unbalanced draft cannot be stored.
    const halfWritten: RubricInput = { criteria: [criterion("q1-a", "q1", 5)], instructor_notes: "" };
    expect(saveBlockers(questions, halfWritten)).toEqual([
      "Add a criterion to Rank and nullity",
      "Solve the system has 5 of 8 points assigned",
    ]);
    expect(saveBlockers(questions, complete)).toEqual([]);
    expect(saveBlockers(questions, null)).toEqual(["Add at least one criterion"]);
  });

  it("saveBlockers ignores who is asking and whether it changed", () => {
    expect(saveBlockers(questions, complete)).toEqual([]);
    expect(publishBlockers({ questions, draft: complete, dirty: true, rubrics: [], documents, role: "instructor" })).toEqual([
      "Save the draft first",
    ]);
  });

  it("names the version the next publish would create", () => {
    expect(nextVersionLabel([])).toBe("Rubric v1");
    expect(nextVersionLabel([published(complete)])).toBe("Rubric v2");
  });
});
