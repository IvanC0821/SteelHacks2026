// Requesting a generated draft: POST returns 202 with a job, poll until it succeeds or fails,
// then refetch the assignment. No progress percentage and no promised duration: only the state.

import { useCallback, useEffect, useRef, useState } from "react";
import type { VerityClient } from "../../api/client";
import { ApiError } from "../../api/client";
import type { AssignmentDetail, Capabilities, Job } from "../../api/types";

export type GenerateStatus = "idle" | "running" | "failed";

/** What went wrong, in one sentence the instructor can act on. */
export function jobFailureMessage(job: Job): string {
  switch (job.error_code) {
    case "not_configured":
      return "Automated assessment is not connected yet. You can still write the rubric by hand.";
    case "invalid_result":
      return "The generated draft did not fit this assignment, or the draft changed while it ran. Nothing was overwritten.";
    case "provider_failed":
      return "The provider could not produce a draft. Try again.";
    case "interrupted":
      return "The job stopped before it finished. Try again.";
    default:
      return "The draft could not be generated. Try again.";
  }
}

/** The one-sentence reason the button is unavailable, or undefined when it can run. */
export function generateDisabledReason(capabilities: Capabilities, hasSolution: boolean): string | undefined {
  if (capabilities.mode === "unconfigured" || !capabilities.automated_assessment) {
    return "Automated assessment is not connected yet. You can still write the rubric by hand.";
  }
  if (!hasSolution) return "Add the instructor solution first";
  return undefined;
}

export interface GenerateState {
  status: GenerateStatus;
  message: string | null;
  start: () => void;
  dismiss: () => void;
}

/**
 * Starts a rubric job and polls it. `onLoaded` receives the refetched assignment, so the caller
 * decides what to do with the new draft.
 */
export function useGeneratedDraft(
  client: VerityClient,
  assignmentId: string,
  onLoaded: (detail: AssignmentDetail) => void,
): GenerateState {
  const [status, setStatus] = useState<GenerateStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const alive = useRef(true);
  const loaded = useRef(onLoaded);

  useEffect(() => {
    loaded.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const start = useCallback(() => {
    setStatus("running");
    setMessage(null);
    void (async () => {
      try {
        const job = await client.requestRubricDraft(assignmentId);
        const finished = await client.waitForJob(job.id);
        if (!alive.current) return;
        if (finished.status !== "succeeded") {
          setStatus("failed");
          setMessage(jobFailureMessage(finished));
          return;
        }
        const detail = await client.assignment(assignmentId);
        if (!alive.current) return;
        setStatus("idle");
        loaded.current(detail);
      } catch (error) {
        if (!alive.current) return;
        setStatus("failed");
        setMessage(
          error instanceof ApiError && error.code === "not_configured"
            ? "Automated assessment is not connected yet. You can still write the rubric by hand."
            : "The draft could not be requested. Try again.",
        );
      }
    })();
  }, [assignmentId, client]);

  const dismiss = useCallback(() => {
    setStatus("idle");
    setMessage(null);
  }, []);

  return { status, message, start, dismiss };
}
