import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError, type VerityClient } from "../../api/client";
import type { StaffSubmission, StudentSubmission } from "../../api/types";
import { useAssessmentJob, useFinalQueue, useSubmission } from "./hooks";
import * as fx from "./fixtures";

function fake(overrides: Partial<Record<keyof VerityClient, unknown>>): VerityClient {
  return overrides as unknown as VerityClient;
}

describe("useFinalQueue", () => {
  it("loads the handed-in papers", async () => {
    const queue = [fx.submission({ id: "sub_a", student_name: "Amara Okafor" }), fx.submission()];
    const client = fake({ finalQueue: vi.fn().mockResolvedValue(queue) });
    const { result } = renderHook(() => useFinalQueue(client, "asg_1"));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.map((s) => s.student_name)).toEqual(["Amara Okafor", "Ben Castellano"]);
    expect(result.current.error).toBeNull();
  });

  it("surfaces an empty queue as an empty list, not an error", async () => {
    const client = fake({ finalQueue: vi.fn().mockResolvedValue([]) });
    const { result } = renderHook(() => useFinalQueue(client, "asg_1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([]);
  });

  it("keeps the ApiError so the page can tell 403 from a network drop", async () => {
    const client = fake({ finalQueue: vi.fn().mockRejectedValue(new ApiError(403, "forbidden")) });
    const { result } = renderHook(() => useFinalQueue(client, "asg_1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.code).toBe("forbidden");
    expect(result.current.error?.denied).toBe(true);
  });

  it("reload refetches", async () => {
    const finalQueue = vi.fn().mockResolvedValue([fx.submission()]);
    const client = fake({ finalQueue });
    const { result } = renderHook(() => useFinalQueue(client, "asg_1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.reload());
    expect(finalQueue).toHaveBeenCalledTimes(2);
  });

  it("does nothing without an assignment id", async () => {
    const finalQueue = vi.fn();
    const client = fake({ finalQueue });
    const { result } = renderHook(() => useFinalQueue(client, null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(finalQueue).not.toHaveBeenCalled();
  });
});

describe("useSubmission", () => {
  it("loads a staff submission with its rubric and review", async () => {
    const client = fake({ submission: vi.fn().mockResolvedValue(fx.submission()) });
    const { result } = renderHook(() => useSubmission(client, "sub_ben"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.rubric.version).toBe(1);
    expect(result.current.data?.review.status).toBe("not_started");
  });

  it("refuses a student-shaped response rather than rendering staff fields", async () => {
    const student: StudentSubmission = {
      ...(fx.submission() as unknown as StudentSubmission),
      assessment: null,
      review: { status: "not_started" },
    };
    delete (student as unknown as Partial<StaffSubmission>).student_name;
    const client = fake({ submission: vi.fn().mockResolvedValue(student) });
    const { result } = renderHook(() => useSubmission(client, "sub_ben"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error?.code).toBe("staff_only");
  });

  it("applyReview swaps the review in place after a mutation", async () => {
    const client = fake({ submission: vi.fn().mockResolvedValue(fx.submission()) });
    const { result } = renderHook(() => useSubmission(client, "sub_ben"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.applyReview(fx.review({ revision: 4, status: "completed" })));
    expect(result.current.data?.review.revision).toBe(4);
    expect(result.current.data?.review.status).toBe("completed");
  });

  it("reload returns the fresh submission for the stale-conflict path", async () => {
    const fresh = fx.submission({ review: fx.review({ revision: 9, status: "in_progress" }) });
    const client = fake({ submission: vi.fn().mockResolvedValue(fresh) });
    const { result } = renderHook(() => useSubmission(client, "sub_ben"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let returned: StaffSubmission | null = null;
    await act(async () => {
      returned = await result.current.reload();
    });
    expect(returned!.review.revision).toBe(9);
  });
});

describe("useAssessmentJob", () => {
  it("reads a finished job once and stops", async () => {
    const job = vi.fn().mockResolvedValue(fx.job());
    const client = fake({ job });
    const { result } = renderHook(() => useAssessmentJob(client, "job_1"));
    await waitFor(() => expect(result.current?.status).toBe("succeeded"));
    expect(job).toHaveBeenCalledTimes(1);
  });

  it("keeps polling while the job is running", async () => {
    const job = vi
      .fn()
      .mockResolvedValueOnce(fx.job({ status: "running" }))
      .mockResolvedValue(fx.job({ status: "succeeded" }));
    const client = fake({ job });
    const { result } = renderHook(() => useAssessmentJob(client, "job_1"));
    await waitFor(() => expect(result.current?.status).toBe("succeeded"), { timeout: 3000 });
    expect(job).toHaveBeenCalledTimes(2);
  });

  it("stays null without a job id", () => {
    const job = vi.fn();
    const client = fake({ job });
    const { result } = renderHook(() => useAssessmentJob(client, null));
    expect(result.current).toBeNull();
    expect(job).not.toHaveBeenCalled();
  });
});
