import { describe, expect, it } from "vitest";
import type { Criterion, Question, RubricInput } from "../../api/types";
import {
  canonical,
  criteriaFor,
  draftReducer,
  emptyDraft,
  isDirty,
  newCriterionId,
  pointsAssigned,
  pointsBalance,
  pointsRemaining,
  stateFromAssignment,
  suggestedPoints,
  toRubricInput,
  type DraftState,
} from "./draft";

const q1: Question = { id: "q1", title: "Solve the system", prompt: "…", max_points: 8 };
const q2: Question = { id: "q2", title: "Rank and nullity", prompt: "…", max_points: 6 };

function criterion(id: string, question_id: string, points: number): Criterion {
  return { id, question_id, description: `Criterion ${id}`, points, category: "logic" };
}

const saved: RubricInput = {
  criteria: [criterion("q1-a", "q1", 5), criterion("q1-b", "q1", 3), criterion("q2-a", "q2", 6)],
  instructor_notes: "Alternative methods earn full credit",
};

function loaded(): DraftState {
  return stateFromAssignment(saved, 3);
}

describe("rubric draft reducer", () => {
  it("loads a draft and starts clean", () => {
    const state = loaded();
    expect(state.criteria).toHaveLength(3);
    expect(state.revision).toBe(3);
    expect(isDirty(state)).toBe(false);
    expect(state.generated).toBe(false);
  });

  it("an assignment with no draft starts empty and clean", () => {
    const state = stateFromAssignment(null, 0);
    expect(state.criteria).toEqual([]);
    expect(state.saved).toBeNull();
    expect(isDirty(state)).toBe(false);
  });

  it("does not mutate the loaded draft when a criterion is edited", () => {
    const state = draftReducer(loaded(), { type: "update", id: "q1-a", patch: { points: 4 } });
    expect(saved.criteria[0].points).toBe(5);
    expect(state.criteria[0].points).toBe(4);
    expect(isDirty(state)).toBe(true);
  });

  it("adds a criterion after the last one for that question", () => {
    const state = draftReducer(loaded(), { type: "add", questionId: "q1", points: 2 });
    expect(state.criteria.map((c) => c.id)).toEqual(["q1-a", "q1-b", "q1-c1", "q2-a"]);
    expect(state.criteria[2].question_id).toBe("q1");
    expect(state.criteria[2].points).toBe(2);
    expect(state.criteria[2].description).toBe("");
  });

  it("gives every new criterion a unique ID", () => {
    let state = emptyDraft();
    state = draftReducer(state, { type: "add", questionId: "q1", points: 1 });
    state = draftReducer(state, { type: "add", questionId: "q1", points: 1 });
    state = draftReducer(state, { type: "add", questionId: "q2", points: 1 });
    expect(state.criteria.map((c) => c.id)).toEqual(["q1-c1", "q1-c2", "q2-c1"]);
    expect(newCriterionId(state.criteria, "q1")).toBe("q1-c3");
  });

  it("removes a criterion and leaves the rest", () => {
    const state = draftReducer(loaded(), { type: "remove", id: "q1-a" });
    expect(state.criteria.map((c) => c.id)).toEqual(["q1-b", "q2-a"]);
    expect(isDirty(state)).toBe(true);
  });

  it("tracks notes as part of the document", () => {
    const state = draftReducer(loaded(), { type: "notes", value: "Stricter on notation" });
    expect(isDirty(state)).toBe(true);
    expect(toRubricInput(state).instructor_notes).toBe("Stricter on notation");
  });

  it("clears dirty once the server confirms the save", () => {
    const edited = draftReducer(loaded(), { type: "update", id: "q1-a", patch: { points: 4 } });
    const confirmed = draftReducer(edited, { type: "saved", draft: toRubricInput(edited), revision: 4 });
    expect(isDirty(confirmed)).toBe(false);
    expect(confirmed.revision).toBe(4);
  });

  it("an edit back to the saved value is no longer dirty", () => {
    let state = draftReducer(loaded(), { type: "update", id: "q1-a", patch: { points: 4 } });
    expect(isDirty(state)).toBe(true);
    state = draftReducer(state, { type: "update", id: "q1-a", patch: { points: 5 } });
    expect(isDirty(state)).toBe(false);
  });

  it("marks a generated draft", () => {
    const state = draftReducer(loaded(), { type: "load", draft: saved, revision: 4, generated: true });
    expect(state.generated).toBe(true);
    expect(isDirty(state)).toBe(false);
  });

  it("trims descriptions on the way to the API but not in the editor", () => {
    const state = draftReducer(loaded(), { type: "update", id: "q1-a", patch: { description: "  padded  " } });
    expect(state.criteria[0].description).toBe("  padded  ");
    expect(toRubricInput(state).criteria[0].description).toBe("padded");
  });

  it("canonical ignores whitespace but not order", () => {
    const reordered: RubricInput = { ...saved, criteria: [saved.criteria[1], saved.criteria[0], saved.criteria[2]] };
    expect(canonical(reordered)).not.toBe(canonical(saved));
    expect(canonical({ ...saved, instructor_notes: `${saved.instructor_notes}  ` })).toBe(canonical(saved));
    expect(canonical(null)).toBe("");
  });
});

describe("points per question", () => {
  it("sums only that question's criteria", () => {
    const state = loaded();
    expect(pointsAssigned(state.criteria, "q1")).toBe(8);
    expect(pointsAssigned(state.criteria, "q2")).toBe(6);
    expect(criteriaFor(state.criteria, "q1")).toHaveLength(2);
  });

  it("reports remaining points and the balance", () => {
    const state = loaded();
    expect(pointsRemaining(state.criteria, q1)).toBe(0);
    expect(pointsBalance(state.criteria, q1)).toBe("exact");
    const under = draftReducer(state, { type: "update", id: "q1-a", patch: { points: 3 } });
    expect(pointsRemaining(under.criteria, q1)).toBe(2);
    expect(pointsBalance(under.criteria, q1)).toBe("under");
    const over = draftReducer(state, { type: "update", id: "q1-a", patch: { points: 7 } });
    expect(pointsRemaining(over.criteria, q1)).toBe(-2);
    expect(pointsBalance(over.criteria, q1)).toBe("over");
  });

  it("survives fractional points without float noise", () => {
    let state = emptyDraft();
    state = draftReducer(state, { type: "add", questionId: "q2", points: 0.1 });
    state = draftReducer(state, { type: "add", questionId: "q2", points: 0.2 });
    expect(pointsAssigned(state.criteria, "q2")).toBe(0.3);
  });

  it("suggests what is left, or 1 when the question is already full", () => {
    const state = loaded();
    expect(suggestedPoints(state.criteria, q1)).toBe(1);
    expect(suggestedPoints(state.criteria, q2)).toBe(1);
    const under = draftReducer(state, { type: "remove", id: "q1-b" });
    expect(suggestedPoints(under.criteria, q1)).toBe(3);
  });

  it("treats a question with no criteria as fully unassigned", () => {
    expect(pointsAssigned([], "q1")).toBe(0);
    expect(pointsRemaining([], q1)).toBe(8);
  });
});
