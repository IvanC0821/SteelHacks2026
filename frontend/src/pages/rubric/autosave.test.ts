import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTOSAVE_DELAY, createDebounce, savedAtLabel } from "./autosave";
import { generateDisabledReason, jobFailureMessage } from "./generate";
import type { Capabilities, Job } from "../../api/types";

describe("autosave debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves 1.5s after the last edit, once", () => {
    const save = vi.fn();
    const debounced = createDebounce(save, AUTOSAVE_DELAY);
    debounced.schedule();
    vi.advanceTimersByTime(1000);
    debounced.schedule();
    expect(debounced.pending()).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(debounced.pending()).toBe(false);
  });

  it("flush saves now and cancels the timer", () => {
    const save = vi.fn();
    const debounced = createDebounce(save);
    debounced.schedule();
    debounced.flush();
    expect(save).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("cancel drops a pending save", () => {
    const save = vi.fn();
    const debounced = createDebounce(save);
    debounced.schedule();
    debounced.cancel();
    vi.advanceTimersByTime(5000);
    expect(save).not.toHaveBeenCalled();
  });

  it("labels the save with a clock time and no seconds", () => {
    const label = savedAtLabel(new Date(2026, 8, 19, 12, 3));
    expect(label).toMatch(/^Draft saved 12:03/);
    expect(label).not.toMatch(/:\d\d:\d\d/);
  });
});

function job(error_code: Job["error_code"]): Job {
  return {
    id: "job_1",
    kind: "rubric",
    target_id: "asg_1",
    status: "failed",
    attempts: 1,
    created_at: "2026-09-19T14:00:00+00:00",
    updated_at: "2026-09-19T14:00:02+00:00",
    error_code,
  };
}

const capabilities: Capabilities = {
  provider_id: "dev-fixture",
  mode: "fixture",
  automated_assessment: true,
  ocr: false,
  extraction: "pdf_text_or_staff_transcript",
  max_upload_bytes: 15728640,
  max_pages: 40,
  human_review_required: true,
};

describe("generated draft messages", () => {
  it("explains an unconfigured provider without promising anything", () => {
    expect(jobFailureMessage(job("not_configured"))).toBe(
      "Automated assessment is not connected yet. You can still write the rubric by hand.",
    );
  });

  it("says nothing was overwritten when the draft moved under the job", () => {
    expect(jobFailureMessage(job("invalid_result"))).toMatch(/Nothing was overwritten/);
  });

  it("has a sentence for every error code the API can send", () => {
    (["provider_failed", "interrupted", null] as Job["error_code"][]).forEach((code) => {
      expect(jobFailureMessage(job(code)).length).toBeGreaterThan(10);
    });
  });

  it("disables the request when the provider is unconfigured or there is no solution", () => {
    expect(generateDisabledReason({ ...capabilities, mode: "unconfigured" }, true)).toMatch(/not connected yet/);
    expect(generateDisabledReason({ ...capabilities, automated_assessment: false }, true)).toMatch(/not connected yet/);
    expect(generateDisabledReason(capabilities, false)).toBe("Add the instructor solution first");
    expect(generateDisabledReason(capabilities, true)).toBeUndefined();
  });
});
