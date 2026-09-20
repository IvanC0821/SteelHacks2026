import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useResource } from "./data";

afterEach(cleanup);

it("clears the old course's assignments immediately while a new course loads", async () => {
  let finish: (value: string[]) => void = () => {};
  const fetcher = vi.fn((key: string) => key === "algebra" ? Promise.resolve(["Algebra HW"])
    : new Promise<string[]>((resolve) => { finish = resolve; }));
  const { result, rerender } = renderHook(({ course }) => useResource(course, fetcher),
    { initialProps: { course: "algebra" as string | null } });
  await waitFor(() => expect(result.current.data).toEqual(["Algebra HW"]));
  rerender({ course: "concepts" });
  expect(result.current.data).toBeNull();
  expect(result.current.loading).toBe(true);
  await act(async () => finish(["Concepts HW"]));
  expect(result.current.data).toEqual(["Concepts HW"]);
  rerender({ course: null });
  expect(result.current.data).toBeNull();
  expect(result.current.loading).toBe(false);
});

it("ignores a response arriving after a course switch", async () => {
  let finishOld: (value: string) => void = () => {};
  const fetcher = vi.fn((key: string) => key === "old" ? new Promise<string>((resolve) => { finishOld = resolve; })
    : Promise.resolve("new homework"));
  const { result, rerender } = renderHook(({ course }) => useResource(course, fetcher), { initialProps: { course: "old" } });
  rerender({ course: "new" });
  await waitFor(() => expect(result.current.data).toBe("new homework"));
  await act(async () => finishOld("old homework"));
  expect(result.current.data).toBe("new homework");
});

it("retains same-course data during an explicit refresh", async () => {
  let finish: (value: string) => void = () => {};
  const fetcher = vi.fn().mockResolvedValueOnce("existing").mockImplementationOnce(
    () => new Promise<string>((resolve) => { finish = resolve; }));
  const { result } = renderHook(() => useResource("course", fetcher));
  await waitFor(() => expect(result.current.data).toBe("existing"));
  act(() => result.current.refetch());
  expect(result.current.data).toBe("existing");
  expect(result.current.loading).toBe(true);
  await act(async () => finish("updated"));
  expect(result.current.data).toBe("updated");
});
