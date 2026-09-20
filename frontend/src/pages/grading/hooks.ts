// Typed data hooks over the client for the grading workspace.
// Every fetch is cancellable; nothing writes state after unmount.

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type VerityClient } from "../../api/client";
import type { AssignmentDetail, Job, StaffSubmission, StaffReview } from "../../api/types";
import { isStaffSubmission } from "../../api/types";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

const IDLE = { data: null, loading: true, error: null } as const;

function toApiError(cause: unknown): ApiError {
  return cause instanceof ApiError ? cause : new ApiError(0, "unknown");
}

/** A 401 is not this page's business: rethrowing it lets SessionProvider return to session setup
 *  (it listens for the unhandled rejection), rather than showing an inline error with no way out. */
function rethrowExpired(error: ApiError): void {
  if (error.expired) throw error;
}

/** The handed-in papers for an assignment, in queue order. */
export interface FinalQueue extends AsyncState<StaffSubmission[]> {
  reload: () => Promise<void>;
}

export function useFinalQueue(client: VerityClient, assignmentId: string | null): FinalQueue {
  const [state, setState] = useState<AsyncState<StaffSubmission[]>>(IDLE);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!assignmentId) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const queue = await client.finalQueue(assignmentId);
      if (live.current) setState({ data: queue, loading: false, error: null });
    } catch (cause) {
      const error = toApiError(cause);
      rethrowExpired(error);
      if (live.current) setState({ data: null, loading: false, error });
    }
  }, [client, assignmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load };
}

/** One handed-in paper with its rubric, assessment and review. */
export interface SubmissionState extends AsyncState<StaffSubmission> {
  reload: () => Promise<StaffSubmission | null>;
  /** replaces the review in place after a mutation, without a refetch */
  applyReview: (review: StaffReview) => void;
}

export function useSubmission(client: VerityClient, submissionId: string | null): SubmissionState {
  const [state, setState] = useState<AsyncState<StaffSubmission>>(IDLE);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!submissionId) {
      setState({ data: null, loading: false, error: null });
      return null;
    }
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const submission = await client.submission(submissionId);
      if (!isStaffSubmission(submission)) {
        const denied = new ApiError(403, "staff_only");
        if (live.current) setState({ data: null, loading: false, error: denied });
        return null;
      }
      if (live.current) setState({ data: submission, loading: false, error: null });
      return submission;
    } catch (cause) {
      const error = toApiError(cause);
      rethrowExpired(error);
      if (live.current) setState({ data: null, loading: false, error });
      return null;
    }
  }, [client, submissionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyReview = useCallback((review: StaffReview) => {
    setState((prev) => (prev.data ? { ...prev, data: { ...prev.data, review } } : prev));
  }, []);

  return { ...state, reload: load, applyReview };
}

/** The assignment, for question prompts, titles and point totals. */
export function useAssignment(client: VerityClient, assignmentId: string | null): AsyncState<AssignmentDetail> {
  const [state, setState] = useState<AsyncState<AssignmentDetail>>(IDLE);

  useEffect(() => {
    if (!assignmentId) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    let live = true;
    setState({ data: null, loading: true, error: null });
    client
      .assignment(assignmentId)
      .then((detail) => {
        if (live) setState({ data: detail, loading: false, error: null });
      })
      .catch((cause: unknown) => {
        const error = toApiError(cause);
        rethrowExpired(error);
        if (live) setState({ data: null, loading: false, error });
      });
    return () => {
      live = false;
    };
  }, [client, assignmentId]);

  return state;
}

/**
 * The assessment job behind a paper. Polls only while it is queued or running, so a finished
 * paper costs one request. No progress percentage: the backend gives none.
 */
export function useAssessmentJob(client: VerityClient, jobId: string | null): Job | null {
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = 600;

    const tick = async () => {
      try {
        const next = await client.job(jobId);
        if (!live) return;
        setJob(next);
        if (next.status === "queued" || next.status === "running") {
          delay = Math.min(delay * 1.5, 2000);
          timer = setTimeout(() => void tick(), delay);
        }
      } catch {
        /* a job we cannot read never blocks the reviewer */
      }
    };
    void tick();

    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [client, jobId]);

  return job;
}
