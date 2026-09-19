import { describe, expect, it } from "vitest";
import type { Question } from "../../../api/types";
import {
  completeness,
  emptySelection,
  mappingPayload,
  pagesFor,
  questionsOnPage,
  saveBlockedReason,
  selectionFromMapping,
  togglePage,
} from "./mapping";

const questions: Question[] = [
  { id: "q1", title: "Solve the system", prompt: "", max_points: 8 },
  { id: "q2", title: "Rank and nullity", prompt: "", max_points: 6 },
  { id: "q3", title: "Subspace proof", prompt: "", max_points: 8 },
  { id: "q4", title: "Inverse", prompt: "", max_points: 8 },
];

describe("page selection", () => {
  it("starts empty for every question", () => {
    expect(emptySelection(questions)).toEqual({ q1: [], q2: [], q3: [], q4: [] });
  });

  it("toggles a page on and off for one question", () => {
    let selection = emptySelection(questions);
    selection = togglePage(selection, "q1", 0);
    expect(pagesFor(selection, "q1")).toEqual([0]);
    selection = togglePage(selection, "q1", 0);
    expect(pagesFor(selection, "q1")).toEqual([]);
  });

  it("keeps pages sorted when they arrive out of order", () => {
    let selection = emptySelection(questions);
    selection = togglePage(selection, "q3", 2);
    selection = togglePage(selection, "q3", 0);
    selection = togglePage(selection, "q3", 1);
    expect(pagesFor(selection, "q3")).toEqual([0, 1, 2]);
  });

  it("lets several questions share one page", () => {
    let selection = emptySelection(questions);
    selection = togglePage(selection, "q1", 0);
    selection = togglePage(selection, "q2", 0);
    expect(questionsOnPage(selection, questions, 0).map((q) => q.id)).toEqual(["q1", "q2"]);
    selection = togglePage(selection, "q1", 0);
    expect(questionsOnPage(selection, questions, 0).map((q) => q.id)).toEqual(["q2"]);
  });

  it("does not mutate the previous selection", () => {
    const before = emptySelection(questions);
    const after = togglePage(before, "q1", 1);
    expect(before.q1).toEqual([]);
    expect(after.q1).toEqual([1]);
  });
});

describe("completeness", () => {
  it("counts questions that have at least one page", () => {
    let selection = emptySelection(questions);
    selection = togglePage(selection, "q1", 0);
    selection = togglePage(selection, "q2", 0);
    selection = togglePage(selection, "q3", 1);
    const state = completeness(selection, questions);
    expect(state).toMatchObject({ mapped: 3, total: 4, complete: false, missing: ["q4"] });
    expect(state.sentence).toBe("3 of 4 questions have pages");
  });

  it("is complete only when every question has a page", () => {
    let selection = emptySelection(questions);
    for (const q of questions) selection = togglePage(selection, q.id, 0);
    const state = completeness(selection, questions);
    expect(state.complete).toBe(true);
    expect(state.sentence).toBe("4 of 4 questions have pages");
    expect(saveBlockedReason(selection, questions)).toBeNull();
  });

  it("explains why saving is blocked while a question has no page", () => {
    expect(saveBlockedReason(emptySelection(questions), questions)).toBe(
      "Give every question at least one page first",
    );
  });

  it("uses the singular for a one-question assignment", () => {
    const one = [questions[0]];
    expect(completeness(emptySelection(one), one).sentence).toBe("0 of 1 question has pages");
  });
});

describe("payload", () => {
  it("sends 1-based ascending page numbers for every question", () => {
    let selection = emptySelection(questions);
    selection = togglePage(selection, "q1", 0);
    selection = togglePage(selection, "q2", 0);
    selection = togglePage(selection, "q3", 1);
    selection = togglePage(selection, "q4", 2);
    selection = togglePage(selection, "q4", 1);
    expect(mappingPayload(selection, questions)).toEqual({
      q1: [1],
      q2: [1],
      q3: [2],
      q4: [2, 3],
    });
  });

  it("round-trips a server mapping without shifting pages", () => {
    const selection = selectionFromMapping({ q1: [1], q2: [1], q3: [2], q4: [3] }, questions, 3);
    expect(selection).toEqual({ q1: [0], q2: [0], q3: [1], q4: [2] });
    expect(mappingPayload(selection, questions)).toEqual({ q1: [1], q2: [1], q3: [2], q4: [3] });
  });

  it("reads a fresh upload's empty mapping as nothing selected", () => {
    expect(selectionFromMapping({}, questions, 3)).toEqual({ q1: [], q2: [], q3: [], q4: [] });
    expect(selectionFromMapping(null, questions, 3)).toEqual({ q1: [], q2: [], q3: [], q4: [] });
  });

  it("drops pages the document does not have and duplicates", () => {
    const selection = selectionFromMapping({ q1: [1, 1, 9, 0, 2] }, questions, 3);
    expect(selection.q1).toEqual([0, 1]);
  });
});
