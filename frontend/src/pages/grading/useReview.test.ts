import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type VerityClient } from "../../api/client";
import type { StaffReview, StaffSubmission } from "../../api/types";
import { useReview } from "./useReview";
import * as fx from "./fixtures";

function fake(overrides: Record<string, unknown>): VerityClient {
  return overrides as unknown as VerityClient;
}

function setup(options: {
  submission?: StaffSubmission;
  saveReview?: unknown;
  saveExplanation?: unknown;
  saveStudentComment?: unknown;
  completeReview?: unknown;
  releaseReview?: unknown;
  reopenReview?: unknown;
  reload?: () => Promise<StaffSubmission | null>;
}) {
  const submission = options.submission ?? fx.submission();
  const client = fake({
    saveReview: options.saveReview ?? vi.fn(),
    saveExplanation: options.saveExplanation ?? vi.fn(),
    saveStudentComment: options.saveStudentComment ?? vi.fn(),
    completeReview: options.completeReview ?? vi.fn(),
    releaseReview: options.releaseReview ?? vi.fn(),
    reopenReview: options.reopenReview ?? vi.fn(),
  });
  const reload = options.reload ?? vi.fn().mockResolvedValue(null);
  const onReview = vi.fn();
  const hook = renderHook(() => useReview(client, submission, fx.questions, reload, onReview));
  return { hook, client, reload, onReview, submission };
}

describe("saving a question", () => {
  it("shares a comment independently of score drafts and keeps the revision current", async () => {
    const review = fx.review({ revision: 1, student_comments: {
      q1: { text: "Check signs", edited_by: "ta", edited_at: "2026-09-19T12:00:00Z" },
    } });
    const saveStudentComment = vi.fn().mockResolvedValue(review);
    const { hook, onReview } = setup({ saveStudentComment });
    act(() => hook.result.current.setScore("q1", "6"));
    await act(async () => { await hook.result.current.saveStudentComment("q1", "Check signs"); });
    expect(saveStudentComment).toHaveBeenCalledWith("sub_ben", "q1", 0, "Check signs");
    expect(onReview).toHaveBeenCalledWith(review);
    expect(hook.result.current.state.revision).toBe(1);
    expect(hook.result.current.state.drafts.q1.score).toBe("6");
    expect(hook.result.current.state.saved).toEqual({});
  });
  it("saves a criterion explanation with the shared revision and keeps the score draft", async () => {
    const review = fx.review({ revision: 1, criterion_explanations: {
      "q1-ops": { text: "Checked labels", edited_by: "ta", edited_at: "2026-09-19T12:00:00Z" },
    } });
    const saveExplanation = vi.fn().mockResolvedValue(review);
    const { hook, onReview } = setup({ saveExplanation });
    act(() => hook.result.current.setScore("q1", "6"));
    await act(async () => { await hook.result.current.saveExplanation("q1-ops", "Checked labels"); });
    expect(saveExplanation).toHaveBeenCalledWith("sub_ben", "q1-ops", 0, "Checked labels");
    expect(onReview).toHaveBeenCalledWith(review);
    expect(hook.result.current.state.revision).toBe(1);
    expect(hook.result.current.state.drafts.q1.score).toBe("6");
  });

  it("sends the revision it last saw, with the saved questions merged in", async () => {
    const saveReview = vi.fn().mockResolvedValue(
      fx.review({ revision: 2, status: "in_progress", questions: { q1: { score: 5, reason: "a" }, q3: { score: 7, reason: "b" } } }),
    );
    const submission = fx.submission({
      review: fx.review({ revision: 1, status: "in_progress", questions: { q1: { score: 5, reason: "a" } } }),
    });
    const { hook, onReview } = setup({ submission, saveReview });

    act(() => {
      hook.result.current.setScore("q3", "7");
      hook.result.current.setReason("q3", "b");
    });
    let outcome;
    await act(async () => {
      outcome = await hook.result.current.saveQuestion("q3");
    });

    expect(saveReview).toHaveBeenCalledWith("sub_ben", 1, {
      q1: { score: 5, reason: "a" },
      q3: { score: 7, reason: "b" },
    });
    expect(outcome).toEqual({ ok: true, stale: false, code: null });
    expect(hook.result.current.state.revision).toBe(2);
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it("refuses to call the API with an empty reason", async () => {
    const saveReview = vi.fn();
    const { hook } = setup({ saveReview });
    act(() => hook.result.current.setScore("q1", "8"));
    let outcome;
    await act(async () => {
      outcome = await hook.result.current.saveQuestion("q1");
    });
    expect(saveReview).not.toHaveBeenCalled();
    expect(outcome).toEqual({ ok: false, stale: false, code: "invalid_input" });
  });

  it("refuses a score above the question maximum", async () => {
    const saveReview = vi.fn();
    const { hook } = setup({ saveReview });
    act(() => {
      hook.result.current.setScore("q2", "99");
      hook.result.current.setReason("q2", "fine");
    });
    await act(async () => {
      await hook.result.current.saveQuestion("q2");
    });
    expect(saveReview).not.toHaveBeenCalled();
  });

  it("keeps a non-conflict error code for the page to show", async () => {
    const saveReview = vi.fn().mockRejectedValue(new ApiError(422, "invalid_input"));
    const { hook } = setup({ saveReview });
    act(() => {
      hook.result.current.setScore("q1", "8");
      hook.result.current.setReason("q1", "Correct.");
    });
    await act(async () => {
      await hook.result.current.saveQuestion("q1");
    });
    expect(hook.result.current.error).toBe("invalid_input");
  });
});

describe("a stale revision", () => {
  const stale = new ApiError(409, "stale_review_reload");

  it("reloads instead of retrying the overwrite, and keeps my typing", async () => {
    const saveReview = vi.fn().mockRejectedValue(stale);
    const fresh = fx.submission({
      review: fx.review({ revision: 5, status: "in_progress", questions: { q1: { score: 8, reason: "theirs" } } }),
    });
    const reload = vi.fn().mockResolvedValue(fresh);
    const { hook } = setup({ saveReview, reload });

    act(() => {
      hook.result.current.setScore("q3", "6");
      hook.result.current.setReason("q3", "mine");
    });
    let outcome;
    await act(async () => {
      outcome = await hook.result.current.saveQuestion("q3");
    });

    expect(outcome).toEqual({ ok: false, stale: true, code: "stale_review_reload" });
    expect(saveReview).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(hook.result.current.state.revision).toBe(5);
    expect(hook.result.current.state.drafts.q3).toMatchObject({ score: "6", reason: "mine" });
    expect(hook.result.current.state.conflict?.changed).toEqual(["q1"]);
  });

  it("the next save uses the reloaded revision", async () => {
    const saveReview = vi
      .fn()
      .mockRejectedValueOnce(stale)
      .mockResolvedValue(fx.review({ revision: 6, status: "in_progress" }));
    const fresh = fx.submission({ review: fx.review({ revision: 5, status: "in_progress" }) });
    const { hook } = setup({ saveReview, reload: vi.fn().mockResolvedValue(fresh) });

    act(() => {
      hook.result.current.setScore("q1", "8");
      hook.result.current.setReason("q1", "Correct.");
    });
    await act(async () => {
      await hook.result.current.saveQuestion("q1");
    });
    await waitFor(() => expect(hook.result.current.state.revision).toBe(5));
    await act(async () => {
      await hook.result.current.saveQuestion("q1");
    });
    expect(saveReview).toHaveBeenNthCalledWith(2, "sub_ben", 5, { q1: { score: 8, reason: "Correct." } });
  });

  it("clears the conflict once the reviewer dismisses it", async () => {
    const saveReview = vi.fn().mockRejectedValue(stale);
    const fresh = fx.submission({ review: fx.review({ revision: 5, questions: { q1: { score: 8, reason: "t" } } }) });
    const { hook } = setup({ saveReview, reload: vi.fn().mockResolvedValue(fresh) });
    act(() => {
      hook.result.current.setScore("q2", "6");
      hook.result.current.setReason("q2", "mine");
    });
    await act(async () => {
      await hook.result.current.saveQuestion("q2");
    });
    expect(hook.result.current.state.conflict).not.toBeNull();
    act(() => hook.result.current.dismissConflict());
    expect(hook.result.current.state.conflict).toBeNull();
  });
});

describe("complete, release and reopen", () => {
  it("each sends the current revision and adopts the returned review", async () => {
    const completed: StaffReview = fx.review({ revision: 4, status: "completed" });
    const completeReview = vi.fn().mockResolvedValue(completed);
    const releaseReview = vi.fn().mockResolvedValue(fx.review({ revision: 5, status: "released" }));
    const reopenReview = vi.fn().mockResolvedValue(fx.review({ revision: 6, status: "in_progress" }));
    const submission = fx.submission({ review: fx.review({ revision: 3, status: "in_progress" }) });
    const { hook } = setup({ submission, completeReview, releaseReview, reopenReview });

    await act(async () => {
      await hook.result.current.complete();
    });
    expect(completeReview).toHaveBeenCalledWith("sub_ben", 3);
    expect(hook.result.current.state.status).toBe("completed");

    await act(async () => {
      await hook.result.current.release();
    });
    expect(releaseReview).toHaveBeenCalledWith("sub_ben", 4);
    expect(hook.result.current.state.status).toBe("released");

    await act(async () => {
      await hook.result.current.reopen("Regrade request from the student.");
    });
    expect(reopenReview).toHaveBeenCalledWith("sub_ben", 5, "Regrade request from the student.");
    expect(hook.result.current.state.status).toBe("in_progress");
  });
});

describe("the criterion tally through the controller", () => {
  it("toggles a criterion of the current question and fills the field", async () => {
    const { hook } = setup({});
    act(() => hook.result.current.toggleCriterion("q1", "q1-ops"));
    expect(hook.result.current.state.drafts.q1.score).toBe("3");
    act(() => hook.result.current.fillFromSuggestion("q1", ["q1-ops", "q1-arith"]));
    expect(hook.result.current.state.drafts.q1.score).toBe("6");
  });
});
