import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api/client";
import type { Assignment, AssignmentDetail, Submission } from "../api/types";
import { useClient, useSession } from "./session-context";

export interface Resource<T> {
  data: T | null;
  /** the ApiError code, e.g. "not_found", "forbidden", "network"; null while fine */
  error: string | null;
  loading: boolean;
  /** refetch after a mutation; the previous data stays visible while it runs */
  refetch: () => void;
}

/** Keep student comments and released grades current across separate staff/student tabs. */
export function useLiveRefresh(refetch: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => { if (document.visibilityState !== "hidden") refetch(); };
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refetch, enabled]);
}

/** The one fetch-with-refetch hook the page tasks share. Pass `null` to hold off.
 *  `deps` should list anything the fetcher closes over besides the key. */
export function useResource<T>(
  key: string | null,
  fetcher: (key: string) => Promise<T>,
  deps: unknown[] = [],
): Resource<T> {
  const [result, setResult] = useState<{
    key: string | null; data: T | null; error: string | null; loading: boolean;
  }>({ key, data: null, error: null, loading: key !== null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!key) {
      setResult({ key, data: null, error: null, loading: false });
      return;
    }
    let live = true;
    setResult((previous) => ({ key, data: previous.key === key ? previous.data : null,
      error: null, loading: true }));
    fetcher(key)
      .then((value) => {
        if (!live) return;
        setResult({ key, data: value, error: null, loading: false });
      })
      .catch((cause: unknown) => {
        if (!live) return;
        if (cause instanceof ApiError && cause.expired) throw cause;
        setResult((previous) => ({ key, data: previous.key === key ? previous.data : null,
          error: cause instanceof ApiError ? cause.code : "unknown", loading: false }));
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick, ...deps]);

  const refetch = useCallback(() => setTick((n) => n + 1), []);
  // Do not show the previous course's assignments during the next course's fetch.
  const current = result.key === key ? result : { data: null, error: null, loading: key !== null };
  return { data: current.data, error: current.error, loading: current.loading, refetch };
}

/** GET /api/assignments/{id}. Staff get the draft and rubric versions; students get the public view. */
export function useAssignment(assignmentId: string | null | undefined): Resource<AssignmentDetail> {
  const client = useClient();
  return useResource(assignmentId ?? null, (id) => client.assignment(id), [client]);
}

/** GET /api/courses/{id}/assignments, the rail's list and the course home list. */
export function useAssignments(courseId: string | null | undefined): Resource<Assignment[]> {
  const client = useClient();
  return useResource(courseId ?? null, (id) => client.assignments(id), [client]);
}

/** GET /api/assignments/{id}/submissions. `finalOnly` is the staff grading queue. */
export function useSubmissions(
  assignmentId: string | null | undefined,
  finalOnly = false,
): Resource<Submission[]> {
  const client = useClient();
  return useResource(
    assignmentId ? `${assignmentId}:${finalOnly}` : null,
    () => client.submissions(assignmentId as string, finalOnly),
    [client, finalOnly],
  );
}

/** GET /api/submissions/{id}. */
export function useSubmission(submissionId: string | null | undefined): Resource<Submission> {
  const client = useClient();
  return useResource(submissionId ?? null, (id) => client.submission(id), [client]);
}

/** The selected course, resolved from the current route or the last authorized selection. */
export function usePrimaryCourse() {
  return useSession().activeCourse;
}
