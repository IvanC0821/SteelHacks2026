// The review controller: the reducer plus review mutations, each sending the revision it
// last saw. A 409 stale_review_reload reloads the paper and keeps the reviewer's typing.

import { useCallback, useEffect, useReducer, useState } from "react";
import { ApiError, type VerityClient } from "../../api/client";
import type { Question, StaffSubmission } from "../../api/types";
import {
  buildSavePayload,
  initialReviewState,
  reviewReducer,
  STALE_CONFLICT_CODE,
  validateDraft,
  type ReviewState,
} from "./review-state";

export type MutationKind = "save" | "explanation" | "comment" | "complete" | "release" | "reopen";

export interface SaveOutcome {
  ok: boolean;
  /** true when the save lost a race and the paper was reloaded instead of overwritten */
  stale: boolean;
  /** an error code to show when ok is false and stale is false */
  code: string | null;
}

export interface ReviewController {
  state: ReviewState;
  /** which mutation is in flight, so exactly one button shows a spinner */
  busy: MutationKind | null;
  /** the last non-conflict error code from a mutation */
  error: string | null;
  setScore: (questionId: string, value: string) => void;
  setReason: (questionId: string, value: string) => void;
  toggleCriterion: (questionId: string, criterionId: string) => void;
  fillFromSuggestion: (questionId: string, metIds: string[]) => void;
  dismissConflict: () => void;
  saveQuestion: (questionId: string) => Promise<SaveOutcome>;
  saveExplanation: (criterionId: string, text: string) => Promise<SaveOutcome>;
  saveStudentComment: (questionId: string, text: string) => Promise<SaveOutcome>;
  complete: () => Promise<SaveOutcome>;
  release: () => Promise<SaveOutcome>;
  reopen: (reason: string) => Promise<SaveOutcome>;
}

const OK: SaveOutcome = { ok: true, stale: false, code: null };

export function useReview(
  client: VerityClient,
  submission: StaffSubmission | null,
  questions: Question[],
  reload: () => Promise<StaffSubmission | null>,
  onReview: (review: StaffSubmission["review"]) => void,
): ReviewController {
  const [state, dispatch] = useReducer(
    reviewReducer,
    submission ? initialReviewState(submission, questions) : blankState(),
  );
  const [busy, setBusy] = useState<MutationKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A different paper resets the drafts; the same paper keeps them. The assignment and the
  // submission arrive in either order, so this also fires when the questions land second —
  // otherwise a paper with saved questions would show empty fields.
  const seeded = questions.length > 0 && questions.every((q) => q.id in state.drafts);
  useEffect(() => {
    if (!submission) return;
    if (submission.id !== state.submissionId || (questions.length > 0 && !seeded)) {
      dispatch({ type: "load", submission, questions });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission?.id, questions, seeded]);

  const run = useCallback(
    async (kind: MutationKind, call: (revision: number) => Promise<StaffSubmission["review"]>): Promise<SaveOutcome> => {
      setBusy(kind);
      setError(null);
      try {
        const review = await call(state.revision);
        dispatch({ type: "saved", review });
        onReview(review);
        return OK;
      } catch (cause) {
        const apiError = cause instanceof ApiError ? cause : new ApiError(0, "unknown");
        // SessionProvider owns an expired session; it listens for the unhandled rejection.
        if (apiError.expired) throw apiError;
        if (apiError.conflict && apiError.code === STALE_CONFLICT_CODE) {
          const fresh = await reload();
          if (fresh) dispatch({ type: "reload", submission: fresh, questions, afterConflict: true });
          return { ok: false, stale: true, code: apiError.code };
        }
        setError(apiError.code);
        return { ok: false, stale: false, code: apiError.code };
      } finally {
        setBusy(null);
      }
    },
    [state.revision, questions, reload, onReview],
  );

  const saveQuestion = useCallback(
    async (questionId: string): Promise<SaveOutcome> => {
      if (!submission) return { ok: false, stale: false, code: "no_submission" };
      const draft = state.drafts[questionId];
      const question = questions.find((q) => q.id === questionId);
      if (!draft || !question) return { ok: false, stale: false, code: "unknown_question" };
      const validity = validateDraft(draft, question.max_points);
      if (!validity.ok) return { ok: false, stale: false, code: "invalid_input" };
      const payload = buildSavePayload(state.saved, questionId, draft);
      return run("save", (revision) => client.saveReview(submission.id, revision, payload));
    },
    [client, submission, state.drafts, state.saved, questions, run],
  );

  const complete = useCallback(async () => {
    if (!submission) return { ok: false, stale: false, code: "no_submission" };
    return run("complete", (revision) => client.completeReview(submission.id, revision));
  }, [client, submission, run]);

  const saveExplanation = useCallback(async (criterionId: string, text: string) => {
    if (!submission) return { ok: false, stale: false, code: "no_submission" };
    return run("explanation", (revision) => client.saveExplanation(submission.id, criterionId, revision, text));
  }, [client, submission, run]);

  const release = useCallback(async () => {
    if (!submission) return { ok: false, stale: false, code: "no_submission" };
    return run("release", (revision) => client.releaseReview(submission.id, revision));
  }, [client, submission, run]);

  const reopen = useCallback(
    async (reason: string) => {
      if (!submission) return { ok: false, stale: false, code: "no_submission" };
      return run("reopen", (revision) => client.reopenReview(submission.id, revision, reason));
    },
    [client, submission, run],
  );

  return {
    state,
    busy,
    error,
    saveStudentComment: useCallback(async (questionId: string, text: string) => {
      if (!submission) return { ok: false, stale: false, code: "no_submission" };
      return run("comment", (revision) => client.saveStudentComment(submission.id, questionId, revision, text));
    }, [client, submission, run]),
    setScore: useCallback((questionId, value) => dispatch({ type: "setScore", questionId, value }), []),
    setReason: useCallback((questionId, value) => dispatch({ type: "setReason", questionId, value }), []),
    toggleCriterion: useCallback(
      (questionId: string, criterionId: string) => {
        if (!submission) return;
        const question = questions.find((q) => q.id === questionId);
        if (!question) return;
        dispatch({
          type: "toggleCriterion",
          questionId,
          criterionId,
          criteria: submission.rubric.criteria.filter((c) => c.question_id === questionId),
          maxPoints: question.max_points,
        });
      },
      [submission, questions],
    ),
    fillFromSuggestion: useCallback(
      (questionId: string, metIds: string[]) => {
        if (!submission) return;
        const question = questions.find((q) => q.id === questionId);
        if (!question) return;
        dispatch({
          type: "fillFromSuggestion",
          questionId,
          criteria: submission.rubric.criteria.filter((c) => c.question_id === questionId),
          metIds,
          maxPoints: question.max_points,
        });
      },
      [submission, questions],
    ),
    dismissConflict: useCallback(() => dispatch({ type: "dismissConflict" }), []),
    saveQuestion,
    saveExplanation,
    complete,
    release,
    reopen,
  };
}

function blankState(): ReviewState {
  return { submissionId: "", revision: 0, status: "not_started", saved: {}, drafts: {}, conflict: null };
}
