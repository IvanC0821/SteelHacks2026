// Typed data hooks over the client for the grading workspace.
// Every fetch is cancellable; nothing writes state after unmount.
//
// Each hook keys its one piece of state on the id it was asked for and derives `loading` during
// render from that key, so no effect ever sets state synchronously: an id that has not resolved
// yet simply reads as loading, and the only writes happen in an async continuation. The fetches
// themselves live at module scope and hand their result to a `commit` callback, which is what
// lets the same code serve both the mount effect and the manual reload.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, type VerityClient } from "../../api/client";
import type { AssignmentDetail, Job, StaffSubmission, StaffReview } from "../../api/types";
import { isStaffSubmission } from "../../api/types";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
}

/** A result tagged with the id it was fetched for, so a stale one is ignored during render. */
interface Keyed<T> {
  key: string;
  data: T | null;
  error: ApiError | null;
}

type Commit<T> = (result: Keyed<T>) => void;

function toApiError(cause: unknown): ApiError {
  return cause instanceof ApiError ? cause : new ApiError(0, "unknown");
}

/** A 401 is not this page's business: rethrowing it lets SessionProvider return to session setup
 *  (it listens for the unhandled rejection), rather than showing an inline error with no way out. */
function rethrowExpired(error: ApiError): void {
  if (error.expired) throw error;
}

async function loadQueue(
  client: VerityClient,
  assignmentId: string,
  commit: Commit<StaffSubmission[]>,
): Promise<void> {
  try {
    const queue = await client.finalQueue(assignmentId);
    commit({ key: assignmentId, data: queue, error: null });
  } catch (cause) {
    const error = toApiError(cause);
    rethrowExpired(error);
    commit({ key: assignmentId, data: null, error });
  }
}

async function loadSubmission(
  client: VerityClient,
  submissionId: string,
  commit: Commit<StaffSubmission>,
): Promise<StaffSubmission | null> {
  try {
    const submission = await client.submission(submissionId);
    if (!isStaffSubmission(submission)) {
      commit({ key: submissionId, data: null, error: new ApiError(403, "staff_only") });
      return null;
    }
    commit({ key: submissionId, data: submission, error: null });
    return submission;
  } catch (cause) {
    const error = toApiError(cause);
    rethrowExpired(error);
    commit({ key: submissionId, data: null, error });
    return null;
  }
}

/** The handed-in papers for an assignment, in queue order. */
export interface FinalQueue extends AsyncState<StaffSubmission[]> {
  reload: () => Promise<void>;
}

export function useFinalQueue(client: VerityClient, assignmentId: string | null): FinalQueue {
  const [result, setResult] = useState<Keyed<StaffSubmission[]> | null>(null);
  const [reloading, setReloading] = useState(false);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    if (!assignmentId) return;
    let alive = true;
    void loadQueue(client, assignmentId, (next) => {
      if (alive) setResult(next);
    });
    return () => {
      alive = false;
    };
  }, [client, assignmentId]);

  /** A manual refresh keeps the current list on screen and raises the spinner itself: the effect
   *  above only runs when the assignment changes. */
  const reload = useCallback(async () => {
    if (!assignmentId) return;
    setReloading(true);
    try {
      await loadQueue(client, assignmentId, (next) => {
        if (live.current) setResult(next);
      });
    } finally {
      if (live.current) setReloading(false);
    }
  }, [client, assignmentId]);

  const fresh = result !== null && result.key === assignmentId;
  return useMemo(
    () => ({
      data: fresh ? result.data : null,
      loading: assignmentId !== null && (!fresh || reloading),
      error: fresh ? result.error : null,
      reload,
    }),
    [assignmentId, fresh, result, reloading, reload],
  );
}

/** One handed-in paper with its rubric, assessment and review. */
export interface SubmissionState extends AsyncState<StaffSubmission> {
  reload: () => Promise<StaffSubmission | null>;
  /** replaces the review in place after a mutation, without a refetch */
  applyReview: (review: StaffReview) => void;
}

export function useSubmission(client: VerityClient, submissionId: string | null): SubmissionState {
  const [result, setResult] = useState<Keyed<StaffSubmission> | null>(null);
  const [reloading, setReloading] = useState(false);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  useEffect(() => {
    if (!submissionId) return;
    let alive = true;
    void loadSubmission(client, submissionId, (next) => {
      if (alive) setResult(next);
    });
    return () => {
      alive = false;
    };
  }, [client, submissionId]);

  const reload = useCallback(async () => {
    if (!submissionId) return null;
    setReloading(true);
    try {
      return await loadSubmission(client, submissionId, (next) => {
        if (live.current) setResult(next);
      });
    } finally {
      if (live.current) setReloading(false);
    }
  }, [client, submissionId]);

  const applyReview = useCallback((review: StaffReview) => {
    setResult((prev) => (prev?.data ? { ...prev, data: { ...prev.data, review } } : prev));
  }, []);

  const fresh = result !== null && result.key === submissionId;
  return useMemo(
    () => ({
      data: fresh ? result.data : null,
      loading: submissionId !== null && (!fresh || reloading),
      error: fresh ? result.error : null,
      reload,
      applyReview,
    }),
    [submissionId, fresh, result, reloading, reload, applyReview],
  );
}

/** The assignment, for question prompts, titles and point totals. */
export function useAssignment(client: VerityClient, assignmentId: string | null): AsyncState<AssignmentDetail> {
  const [result, setResult] = useState<Keyed<AssignmentDetail> | null>(null);

  useEffect(() => {
    if (!assignmentId) return;
    let alive = true;
    client
      .assignment(assignmentId)
      .then((detail) => {
        if (alive) setResult({ key: assignmentId, data: detail, error: null });
      })
      .catch((cause: unknown) => {
        const error = toApiError(cause);
        rethrowExpired(error);
        if (alive) setResult({ key: assignmentId, data: null, error });
      });
    return () => {
      alive = false;
    };
  }, [client, assignmentId]);

  const fresh = result !== null && result.key === assignmentId;
  return useMemo(
    () => ({
      data: fresh ? result.data : null,
      loading: assignmentId !== null && !fresh,
      error: fresh ? result.error : null,
    }),
    [assignmentId, fresh, result],
  );
}

/**
 * The assessment job behind a paper. Polls only while it is queued or running, so a finished
 * paper costs one request. No progress percentage: the backend gives none.
 */
export function useAssessmentJob(client: VerityClient, jobId: string | null): Job | null {
  const [tracked, setTracked] = useState<{ key: string; job: Job } | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = 600;

    const tick = async () => {
      try {
        const next = await client.job(jobId);
        if (!alive) return;
        setTracked({ key: jobId, job: next });
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
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [client, jobId]);

  // A job from the previous paper is not this paper's job: it reads as "no job" until its own
  // first poll lands, which is what the header gate wants.
  return tracked !== null && tracked.key === jobId ? tracked.job : null;
}
