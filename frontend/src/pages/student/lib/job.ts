// The assessment job as the student sees it. A POST returns 202 with a queued job; we poll until
// it succeeds or fails and then refetch the submission. No percentages, no promised durations.

import type { Job } from "../../../api/types";

export type JobPhase = "idle" | "queued" | "running" | "succeeded" | "failed";

export interface JobState {
  phase: JobPhase;
  jobId: string | null;
  errorCode: Job["error_code"];
  /** what the pane says right now, in plain words */
  message: string;
  /** a failed job can be retried unless the provider is simply not configured */
  canRetry: boolean;
  /** true once a run finishes so the page knows to refetch the submission */
  needsRefetch: boolean;
}

export type JobAction =
  | { type: "start"; jobId: string }
  | { type: "poll"; job: Job }
  | { type: "error"; code?: Job["error_code"] }
  | { type: "refetched" }
  | { type: "clear" };

export const NOT_CONFIGURED =
  "Automated assessment is not connected yet. You can still hand in for staff review.";
const DID_NOT_FINISH = "The check did not finish.";
const RUNNING = "Checking your work…";

export const idleJob: JobState = {
  phase: "idle",
  jobId: null,
  errorCode: null,
  message: "",
  canRetry: false,
  needsRefetch: false,
};

export function failureMessage(code: Job["error_code"]): string {
  return code === "not_configured" ? NOT_CONFIGURED : DID_NOT_FINISH;
}

export function jobReducer(state: JobState, action: JobAction): JobState {
  switch (action.type) {
    case "start":
      return {
        phase: "queued",
        jobId: action.jobId,
        errorCode: null,
        message: RUNNING,
        canRetry: false,
        needsRefetch: false,
      };
    case "poll": {
      const job = action.job;
      if (job.status === "succeeded") {
        return {
          phase: "succeeded",
          jobId: job.id,
          errorCode: null,
          message: "",
          canRetry: false,
          needsRefetch: true,
        };
      }
      if (job.status === "failed") {
        return {
          phase: "failed",
          jobId: job.id,
          errorCode: job.error_code,
          message: failureMessage(job.error_code),
          canRetry: job.error_code !== "not_configured",
          needsRefetch: false,
        };
      }
      return {
        phase: job.status,
        jobId: job.id,
        errorCode: null,
        message: RUNNING,
        canRetry: false,
        needsRefetch: false,
      };
    }
    case "error": {
      const code = action.code ?? "provider_failed";
      return {
        phase: "failed",
        jobId: state.jobId,
        errorCode: code,
        message: failureMessage(code),
        canRetry: code !== "not_configured",
        needsRefetch: false,
      };
    }
    case "refetched":
      return { ...state, needsRefetch: false };
    case "clear":
      return idleJob;
    default:
      return state;
  }
}

export function isRunning(state: JobState): boolean {
  return state.phase === "queued" || state.phase === "running";
}
