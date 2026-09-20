import { describe, expect, it } from "vitest";
import {
  buildSavePayload,
  changedQuestions,
  completeGate,
  conflictSentence,
  criteriaFor,
  initialReviewState,
  listLabels,
  progressSentence,
  reviewReducer,
  savedTotal,
  scoreText,
  tallyScore,
  validateDraft,
} from "./review-state";
import * as fx from "./fixtures";

const q1Criteria = criteriaFor(fx.criteria, "q1");

describe("criterion tally fills the score field", () => {
  it("sums only the ticked criteria", () => {
    expect(tallyScore(q1Criteria, [], 8)).toBe(0);
    expect(tallyScore(q1Criteria, ["q1-ops"], 8)).toBe(3);
    expect(tallyScore(q1Criteria, ["q1-ops", "q1-vector"], 8)).toBe(5);
    expect(tallyScore(q1Criteria, ["q1-ops", "q1-arith", "q1-vector"], 8)).toBe(8);
  });

  it("clamps a rubric that over-sums to the question maximum", () => {
    expect(tallyScore(q1Criteria, ["q1-ops", "q1-arith", "q1-vector"], 5)).toBe(5);
  });

  it("ignores criteria from another question", () => {
    expect(tallyScore(q1Criteria, ["q2-rank"], 8)).toBe(0);
  });

  it("toggling a criterion writes the sum into the field and toggling back removes it", () => {
    let state = initialReviewState(fx.submission(), fx.questions);
    state = reviewReducer(state, {
      type: "toggleCriterion",
      questionId: "q1",
      criterionId: "q1-ops",
      criteria: q1Criteria,
      maxPoints: 8,
    });
    expect(state.drafts.q1.score).toBe("3");
    expect(state.drafts.q1.tally).toEqual(["q1-ops"]);

    state = reviewReducer(state, {
      type: "toggleCriterion",
      questionId: "q1",
      criterionId: "q1-arith",
      criteria: q1Criteria,
      maxPoints: 8,
    });
    expect(state.drafts.q1.score).toBe("6");

    state = reviewReducer(state, {
      type: "toggleCriterion",
      questionId: "q1",
      criterionId: "q1-ops",
      criteria: q1Criteria,
      maxPoints: 8,
    });
    expect(state.drafts.q1.score).toBe("3");
    expect(state.drafts.q1.tally).toEqual(["q1-arith"]);
  });

  it("keeps the field editable: a typed score overrides the tally", () => {
    let state = initialReviewState(fx.submission(), fx.questions);
    state = reviewReducer(state, {
      type: "toggleCriterion",
      questionId: "q1",
      criterionId: "q1-ops",
      criteria: q1Criteria,
      maxPoints: 8,
    });
    state = reviewReducer(state, { type: "setScore", questionId: "q1", value: "7.5" });
    expect(state.drafts.q1.score).toBe("7.5");
    expect(state.drafts.q1.tally).toEqual(["q1-ops"]);
  });

  it("fills from the automated suggestion as one explicit action", () => {
    let state = initialReviewState(fx.submission(), fx.questions);
    state = reviewReducer(state, {
      type: "fillFromSuggestion",
      questionId: "q1",
      criteria: q1Criteria,
      metIds: ["q1-ops", "q1-arith"],
      maxPoints: 8,
    });
    expect(state.drafts.q1.score).toBe("6");
    expect(state.drafts.q1.tally).toEqual(["q1-ops", "q1-arith"]);
  });

  it("formats halves without trailing noise", () => {
    expect(scoreText(8)).toBe("8");
    expect(scoreText(7.5)).toBe("7.5");
  });
});

describe("saveReview payload merges the questions the server already holds", () => {
  it("sends previously saved questions beside the new one", () => {
    const saved = { q1: { score: 5, reason: "Unlabeled operations." }, q2: { score: 6, reason: "Complete." } };
    const payload = buildSavePayload(saved, "q3", { score: "7", reason: "  Zero vector missing.  ", tally: [] });
    expect(payload).toEqual({
      q1: { score: 5, reason: "Unlabeled operations." },
      q2: { score: 6, reason: "Complete." },
      q3: { score: 7, reason: "Zero vector missing." },
    });
  });

  it("overwrites a question that is being re-saved", () => {
    const saved = { q1: { score: 5, reason: "First pass." } };
    const payload = buildSavePayload(saved, "q1", { score: "6", reason: "Second pass.", tally: [] });
    expect(payload).toEqual({ q1: { score: 6, reason: "Second pass." } });
  });

  it("does not mutate the saved map", () => {
    const saved = { q1: { score: 5, reason: "First pass." } };
    buildSavePayload(saved, "q2", { score: "4", reason: "Fine.", tally: [] });
    expect(Object.keys(saved)).toEqual(["q1"]);
  });

  it("a save response becomes the new revision and saved map", () => {
    let state = initialReviewState(fx.submission(), fx.questions);
    expect(state.revision).toBe(0);
    state = reviewReducer(state, {
      type: "saved",
      review: fx.review({ revision: 1, status: "in_progress", questions: { q1: { score: 5, reason: "ok" } } }),
    });
    expect(state.revision).toBe(1);
    expect(state.status).toBe("in_progress");
    expect(state.saved.q1.score).toBe(5);
  });
});

describe("complete gate", () => {
  const job = fx.job();

  it("names the unsaved questions", () => {
    const gate = completeGate({
      status: "in_progress",
      questions: fx.questions,
      saved: { q1: { score: 5, reason: "a" }, q2: { score: 6, reason: "b" } },
      job,
    });
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toBe("Save Q3 and Q4 first");
  });

  it("uses the singular for one missing question", () => {
    const saved = {
      q1: { score: 5, reason: "a" },
      q2: { score: 6, reason: "b" },
      q3: { score: 6, reason: "c" },
    };
    expect(completeGate({ status: "in_progress", questions: fx.questions, saved, job }).reason).toBe("Save Q4 first");
  });

  it("blocks while an assessment job is queued or running", () => {
    const saved = Object.fromEntries(fx.questions.map((q) => [q.id, { score: 1, reason: "x" }]));
    for (const status of ["queued", "running"] as const) {
      const gate = completeGate({ status: "in_progress", questions: fx.questions, saved, job: fx.job({ status }) });
      expect(gate.enabled).toBe(false);
      expect(gate.reason).toBe("Wait for the automated assessment to finish");
    }
  });

  it("enables once every question is saved and the job is done", () => {
    const saved = Object.fromEntries(fx.questions.map((q) => [q.id, { score: 1, reason: "x" }]));
    expect(completeGate({ status: "not_started", questions: fx.questions, saved, job })).toEqual({
      enabled: true,
      reason: null,
    });
    expect(completeGate({ status: "in_progress", questions: fx.questions, saved, job: null }).enabled).toBe(true);
  });

  it("stays disabled once the review is completed or released", () => {
    const saved = Object.fromEntries(fx.questions.map((q) => [q.id, { score: 1, reason: "x" }]));
    expect(completeGate({ status: "completed", questions: fx.questions, saved, job }).reason).toBe(
      "This review is already complete",
    );
    expect(completeGate({ status: "released", questions: fx.questions, saved, job }).reason).toBe(
      "Scores are already released",
    );
  });

  it("counts progress in a sentence", () => {
    expect(progressSentence(fx.questions, { q1: { score: 5, reason: "a" }, q2: { score: 6, reason: "b" } })).toBe(
      "2 of 4 questions saved",
    );
    expect(progressSentence(fx.questions, {})).toBe("0 of 4 questions saved");
  });

  it("lists labels the way a sentence reads", () => {
    expect(listLabels([])).toBe("");
    expect(listLabels(["Q1"])).toBe("Q1");
    expect(listLabels(["Q1", "Q2"])).toBe("Q1 and Q2");
    expect(listLabels(["Q1", "Q3", "Q4"])).toBe("Q1, Q3 and Q4");
  });

  it("totals only the saved questions and stays null when nothing is saved", () => {
    expect(savedTotal({})).toBeNull();
    expect(savedTotal({ q1: { score: 5, reason: "a" }, q2: { score: 6.5, reason: "b" } })).toBe(11.5);
  });
});

describe("stale conflict reload", () => {
  const mine = fx.submission({ review: fx.review({ revision: 1, status: "in_progress", questions: { q1: { score: 5, reason: "mine" } } }) });

  it("keeps my unsaved typing and takes the server revision", () => {
    let state = initialReviewState(mine, fx.questions);
    state = reviewReducer(state, { type: "setScore", questionId: "q3", value: "7" });
    state = reviewReducer(state, { type: "setReason", questionId: "q3", value: "Zero vector missing." });

    const theirs = fx.submission({
      review: fx.review({
        revision: 2,
        status: "in_progress",
        questions: { q1: { score: 8, reason: "theirs" }, q2: { score: 6, reason: "theirs too" } },
      }),
    });
    state = reviewReducer(state, { type: "reload", submission: theirs, questions: fx.questions });

    expect(state.revision).toBe(2);
    expect(state.drafts.q3.score).toBe("7");
    expect(state.drafts.q3.reason).toBe("Zero vector missing.");
    expect(state.saved.q1.score).toBe(8);
    expect(state.conflict?.changed).toEqual(["q1", "q2"]);
  });

  it("does not overwrite my edited field with the other reviewer's value", () => {
    let state = initialReviewState(mine, fx.questions);
    expect(state.drafts.q1.score).toBe("5");
    state = reviewReducer(state, { type: "setScore", questionId: "q1", value: "4" });
    const theirs = fx.submission({
      review: fx.review({ revision: 2, status: "in_progress", questions: { q1: { score: 8, reason: "theirs" } } }),
    });
    state = reviewReducer(state, { type: "reload", submission: theirs, questions: fx.questions });
    expect(state.drafts.q1.score).toBe("4");
    expect(state.saved.q1.score).toBe(8);
  });

  it("adopts the server value for a question I never touched", () => {
    let state = initialReviewState(fx.submission(), fx.questions);
    const theirs = fx.submission({
      review: fx.review({ revision: 1, status: "in_progress", questions: { q2: { score: 6, reason: "theirs" } } }),
    });
    state = reviewReducer(state, { type: "reload", submission: theirs, questions: fx.questions });
    expect(state.drafts.q2).toEqual({ score: "6", reason: "theirs", tally: [] });
  });

  it("still reports the conflict when the other reviewer wrote the same values", () => {
    let state = initialReviewState(mine, fx.questions);
    const theirs = fx.submission({
      review: fx.review({ revision: 2, status: "in_progress", questions: { q1: { score: 5, reason: "mine" } } }),
    });
    // no visible difference, but the save was rejected and did not land
    state = reviewReducer(state, { type: "reload", submission: theirs, questions: fx.questions, afterConflict: true });
    expect(state.conflict).toEqual({ changed: [], revision: 2 });
    expect(conflictSentence(fx.questions, state.conflict!)).toBe(
      "Someone else saved this review. Your unsaved changes are kept in the fields; compare and save again.",
    );
  });

  it("a plain reload with no difference raises no conflict", () => {
    let state = initialReviewState(mine, fx.questions);
    const same = fx.submission({
      review: fx.review({ revision: 1, status: "in_progress", questions: { q1: { score: 5, reason: "mine" } } }),
    });
    state = reviewReducer(state, { type: "reload", submission: same, questions: fx.questions });
    expect(state.conflict).toBeNull();
  });

  it("clears the conflict on the next successful save and on dismiss", () => {
    let state = initialReviewState(mine, fx.questions);
    const theirs = fx.submission({
      review: fx.review({ revision: 2, questions: { q1: { score: 8, reason: "theirs" } } }),
    });
    state = reviewReducer(state, { type: "reload", submission: theirs, questions: fx.questions });
    expect(state.conflict).not.toBeNull();
    expect(reviewReducer(state, { type: "dismissConflict" }).conflict).toBeNull();
    const cleared = reviewReducer(state, { type: "saved", review: fx.review({ revision: 3 }) });
    expect(cleared.conflict).toBeNull();
  });

  it("names what changed in one sentence", () => {
    const sentence = conflictSentence(fx.questions, { changed: ["q1", "q2"], revision: 2 });
    expect(sentence).toBe(
      "Someone else saved this review. Q1 and Q2 changed. Your unsaved changes are kept in the fields; compare and save again.",
    );
  });

  it("diffs scores and reasons, not object identity", () => {
    const before = { q1: { score: 5, reason: "a" }, q2: { score: 6, reason: "b" } };
    expect(changedQuestions(before, { q1: { score: 5, reason: "a" }, q2: { score: 6, reason: "b" } })).toEqual([]);
    expect(changedQuestions(before, { q1: { score: 5, reason: "a!" }, q2: { score: 6, reason: "b" } })).toEqual(["q1"]);
    expect(changedQuestions(before, { q1: { score: 5, reason: "a" } })).toEqual(["q2"]);
  });
});

describe("draft validation", () => {
  it("requires a score inside the question maximum", () => {
    expect(validateDraft({ score: "", reason: "ok", tally: [] }, 8).score).toBe("Enter a score");
    expect(validateDraft({ score: "-1", reason: "ok", tally: [] }, 8).score).toBe("Score cannot be negative");
    expect(validateDraft({ score: "9", reason: "ok", tally: [] }, 8).score).toBe("Score cannot be above 8");
    expect(validateDraft({ score: "abc", reason: "ok", tally: [] }, 8).score).toBe("Enter a number");
  });

  it("requires a reason of at least one character, as the API does", () => {
    expect(validateDraft({ score: "8", reason: "   ", tally: [] }, 8).reason).toBe(
      "Write a reason. It stays private to staff",
    );
    expect(validateDraft({ score: "8", reason: "Correct.", tally: [] }, 8)).toEqual({
      ok: true,
      score: null,
      reason: null,
    });
  });
});

describe("initial state", () => {
  it("seeds every question and prefills the ones already saved", () => {
    const state = initialReviewState(
      fx.submission({ review: fx.review({ revision: 1, questions: { q2: { score: 6, reason: "Complete." } } }) }),
      fx.questions,
    );
    expect(Object.keys(state.drafts)).toEqual(["q1", "q2", "q3", "q4"]);
    expect(state.drafts.q1).toEqual({ score: "", reason: "", tally: [] });
    expect(state.drafts.q2).toEqual({ score: "6", reason: "Complete.", tally: [] });
  });
});
