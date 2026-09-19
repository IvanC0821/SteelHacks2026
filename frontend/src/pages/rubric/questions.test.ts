import { describe, expect, it } from "vitest";
import {
  initialQuestionsState,
  mapFieldErrors,
  nextQuestionId,
  questionsReducer,
  toQuestions,
  totalPoints,
  validateQuestions,
  type QuestionsState,
} from "./questions";

function build(ids: string[]): QuestionsState {
  let state = initialQuestionsState();
  ids.slice(1).forEach(() => {
    state = questionsReducer(state, { type: "add" });
  });
  ids.forEach((id, index) => {
    state = questionsReducer(state, { type: "field", key: state.rows[index].key, field: "id", value: id });
  });
  return state;
}

describe("question editor reducer", () => {
  it("starts with one row numbered q1", () => {
    const state = initialQuestionsState();
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].id).toBe("q1");
    expect(state.rows[0].points).toBe("");
  });

  it("adds rows with the next unused auto ID", () => {
    let state = initialQuestionsState();
    state = questionsReducer(state, { type: "add" });
    state = questionsReducer(state, { type: "add" });
    expect(state.rows.map((r) => r.id)).toEqual(["q1", "q2", "q3"]);
    expect(new Set(state.rows.map((r) => r.key)).size).toBe(3);
  });

  it("skips an ID the instructor already typed", () => {
    let state = initialQuestionsState();
    state = questionsReducer(state, { type: "field", key: state.rows[0].key, field: "id", value: "q2" });
    state = questionsReducer(state, { type: "add" });
    expect(state.rows.map((r) => r.id)).toEqual(["q2", "q1"]);
    expect(nextQuestionId(state.rows)).toBe("q3");
  });

  it("removes a row but never the last one", () => {
    let state = build(["q1", "q2"]);
    state = questionsReducer(state, { type: "remove", key: state.rows[0].key });
    expect(state.rows.map((r) => r.id)).toEqual(["q2"]);
    const only = state.rows[0].key;
    state = questionsReducer(state, { type: "remove", key: only });
    expect(state.rows).toHaveLength(1);
  });

  it("reorders with up and down and clamps at the ends", () => {
    const state = build(["q1", "q2", "q3"]);
    const down = questionsReducer(state, { type: "move", key: state.rows[0].key, delta: 1 });
    expect(down.rows.map((r) => r.id)).toEqual(["q2", "q1", "q3"]);
    const up = questionsReducer(down, { type: "move", key: down.rows[2].key, delta: -1 });
    expect(up.rows.map((r) => r.id)).toEqual(["q2", "q3", "q1"]);
    expect(questionsReducer(state, { type: "move", key: state.rows[0].key, delta: -1 })).toBe(state);
    expect(questionsReducer(state, { type: "move", key: state.rows[2].key, delta: 1 })).toBe(state);
  });

  it("keeps row keys stable across a reorder so focus does not jump", () => {
    const state = build(["q1", "q2"]);
    const keys = state.rows.map((r) => r.key);
    const moved = questionsReducer(state, { type: "move", key: keys[0], delta: 1 });
    expect(moved.rows.map((r) => r.key)).toEqual([keys[1], keys[0]]);
  });

  it("returns the same state when a field is set to its current value", () => {
    const state = build(["q1"]);
    expect(questionsReducer(state, { type: "field", key: state.rows[0].key, field: "id", value: "q1" })).toBe(state);
  });
});

describe("question validation", () => {
  function filled(ids: string[], points = "5"): QuestionsState {
    let state = build(ids);
    state.rows.forEach((row) => {
      state = questionsReducer(state, { type: "field", key: row.key, field: "title", value: "Title" });
      state = questionsReducer(state, { type: "field", key: row.key, field: "prompt", value: "Prompt" });
      state = questionsReducer(state, { type: "field", key: row.key, field: "points", value: points });
    });
    return state;
  }

  it("accepts a complete list", () => {
    const state = filled(["q1", "q2"]);
    const result = validateQuestions(state.rows);
    expect(result.valid).toBe(true);
    expect(totalPoints(state.rows)).toBe(10);
    expect(toQuestions(state.rows)).toEqual([
      { id: "q1", title: "Title", prompt: "Prompt", max_points: 5 },
      { id: "q2", title: "Title", prompt: "Prompt", max_points: 5 },
    ]);
  });

  it("flags duplicate IDs on both rows", () => {
    const state = filled(["q1", "q1"]);
    const result = validateQuestions(state.rows);
    expect(result.valid).toBe(false);
    expect(result.rows[state.rows[0].key].id).toMatch(/already uses/);
    expect(result.rows[state.rows[1].key].id).toMatch(/already uses/);
  });

  it("flags an ID outside the API pattern", () => {
    const state = filled(["part one"]);
    expect(validateQuestions(state.rows).rows[state.rows[0].key].id).toMatch(/Letters, numbers/);
  });

  it("flags missing text and non-positive points", () => {
    let state = filled(["q1"], "0");
    state = questionsReducer(state, { type: "field", key: state.rows[0].key, field: "title", value: "  " });
    const errors = validateQuestions(state.rows).rows[state.rows[0].key];
    expect(errors.title).toBeTruthy();
    expect(errors.points).toBe("Points must be more than 0");
  });

  it("totals only the rows that parse", () => {
    let state = filled(["q1", "q2"], "8");
    state = questionsReducer(state, { type: "field", key: state.rows[1].key, field: "points", value: "" });
    expect(totalPoints(state.rows)).toBe(8);
  });
});

describe("422 field errors", () => {
  it("lands an array path on the matching row", () => {
    const state = build(["q1", "q2"]);
    const mapped = mapFieldErrors(
      [
        { path: ["body", "questions", 1, "id"], type: "string_pattern_mismatch" },
        { path: ["body", "questions", 0, "max_points"], type: "greater_than" },
        { path: ["body", "title"], type: "string_too_short" },
      ],
      state.rows,
    );
    expect(mapped.rows[state.rows[1].key].id).toMatch(/Letters, numbers/);
    expect(mapped.rows[state.rows[0].key].points).toBe("Must be more than 0");
    expect(mapped.form).toEqual(["Title: this cannot be empty"]);
  });

  it("also reads a dotted string path", () => {
    const state = build(["q1"]);
    const mapped = mapFieldErrors([{ path: "body.questions.0.prompt", type: "string_too_short" }], state.rows);
    expect(mapped.rows[state.rows[0].key].prompt).toBe("This cannot be empty");
  });

  it("keeps an unknown path as a form-level message instead of dropping it", () => {
    const mapped = mapFieldErrors([{ path: ["body", "mystery"], type: "missing" }], []);
    expect(mapped.rows).toEqual({});
    expect(mapped.form).toHaveLength(1);
  });
});
