import { describe, expect, it } from "vitest";
import type { Job } from "../../../api/types";
import { NOT_CONFIGURED, idleJob, isRunning, jobReducer } from "./job";

function job(status: Job["status"], error_code: Job["error_code"] = null): Job {
  return {
    id: "job_1",
    kind: "assessment",
    target_id: "sub_1",
    status,
    attempts: 1,
    created_at: "2026-09-19T21:53:54Z",
    updated_at: "2026-09-19T21:53:55Z",
    error_code,
  };
}

describe("job reducer", () => {
  it("starts queued with no percentage and no promise", () => {
    const state = jobReducer(idleJob, { type: "start", jobId: "job_1" });
    expect(state).toMatchObject({ phase: "queued", jobId: "job_1", message: "Checking your work…" });
    expect(isRunning(state)).toBe(true);
  });

  it("moves queued to running", () => {
    const state = jobReducer(jobReducer(idleJob, { type: "start", jobId: "job_1" }), {
      type: "poll",
      job: job("running"),
    });
    expect(state.phase).toBe("running");
    expect(isRunning(state)).toBe(true);
  });

  it("asks for a refetch when the job succeeds", () => {
    const state = jobReducer(idleJob, { type: "poll", job: job("succeeded") });
    expect(state).toMatchObject({ phase: "succeeded", needsRefetch: true, message: "" });
    expect(isRunning(state)).toBe(false);
    expect(jobReducer(state, { type: "refetched" }).needsRefetch).toBe(false);
  });

  it("explains a provider failure and offers a retry", () => {
    const state = jobReducer(idleJob, { type: "poll", job: job("failed", "provider_failed") });
    expect(state).toMatchObject({
      phase: "failed",
      errorCode: "provider_failed",
      message: "The check did not finish.",
      canRetry: true,
      needsRefetch: false,
    });
  });

  it("treats an interrupted job the same way", () => {
    expect(jobReducer(idleJob, { type: "poll", job: job("failed", "interrupted") })).toMatchObject({
      message: "The check did not finish.",
      canRetry: true,
    });
  });

  it("uses the capability sentence for not_configured and hides retry", () => {
    const state = jobReducer(idleJob, { type: "poll", job: job("failed", "not_configured") });
    expect(state.message).toBe(NOT_CONFIGURED);
    expect(state.canRetry).toBe(false);
  });

  it("returns to running when a retry restarts the job", () => {
    const failed = jobReducer(idleJob, { type: "poll", job: job("failed", "provider_failed") });
    const retried = jobReducer(failed, { type: "start", jobId: "job_1" });
    expect(retried).toMatchObject({ phase: "queued", errorCode: null, canRetry: false });
  });

  it("falls back to a provider failure when the request itself throws", () => {
    expect(jobReducer(idleJob, { type: "error" })).toMatchObject({
      phase: "failed",
      message: "The check did not finish.",
      canRetry: true,
    });
    expect(jobReducer(idleJob, { type: "error", code: "not_configured" }).canRetry).toBe(false);
  });

  it("clears back to idle", () => {
    const state = jobReducer(idleJob, { type: "start", jobId: "job_1" });
    expect(jobReducer(state, { type: "clear" })).toEqual(idleJob);
  });
});
