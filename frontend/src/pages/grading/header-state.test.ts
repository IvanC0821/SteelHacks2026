import { describe, expect, it } from "vitest";
import { headerState, releaseToast } from "./header-state";
import * as fx from "./fixtures";

const allSaved = Object.fromEntries(fx.questions.map((q) => [q.id, { score: 1, reason: "x" }]));
const job = fx.job();

describe("the header primary", () => {
  it("is Complete review while the review is open", () => {
    for (const status of ["not_started", "in_progress"] as const) {
      const state = headerState({ role: "ta", status, questions: fx.questions, saved: allSaved, job });
      expect(state).toEqual({
        primary: "complete",
        disabledReason: null,
        chip: null,
        canReopen: false,
        readOnly: false,
      });
    }
  });

  it("carries the gate's reason when questions are unsaved", () => {
    const state = headerState({
      role: "ta",
      status: "in_progress",
      questions: fx.questions,
      saved: { q1: { score: 5, reason: "a" } },
      job,
    });
    expect(state.primary).toBe("complete");
    expect(state.disabledReason).toBe("Save Q2, Q3 and Q4 first");
  });

  it("gives the instructor Release scores once the paper is complete", () => {
    const state = headerState({ role: "instructor", status: "completed", questions: fx.questions, saved: allSaved, job });
    expect(state.primary).toBe("release");
    expect(state.chip).toBeNull();
    expect(state.canReopen).toBe(true);
    expect(state.readOnly).toBe(true);
  });

  it("gives the TA a chip instead, and no Reopen", () => {
    const state = headerState({ role: "ta", status: "completed", questions: fx.questions, saved: allSaved, job });
    expect(state.primary).toBe("none");
    expect(state.chip).toBe("Completed, awaiting release");
    expect(state.canReopen).toBe(false);
  });

  it("locks the fields once the scores are released, and only the instructor may reopen", () => {
    const asTa = headerState({ role: "ta", status: "released", questions: fx.questions, saved: allSaved, job });
    expect(asTa).toMatchObject({ primary: "none", chip: "Released", canReopen: false, readOnly: true });
    const asInstructor = headerState({
      role: "instructor",
      status: "released",
      questions: fx.questions,
      saved: allSaved,
      job,
    });
    expect(asInstructor.canReopen).toBe(true);
  });

  it("names the student in the release confirmation", () => {
    expect(releaseToast("Chloe Nguyen")).toBe("Scores released to Chloe Nguyen");
  });
});
