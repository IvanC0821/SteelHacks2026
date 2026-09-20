import { describe, expect, it } from "vitest";
import { isUsableBbox, marksByPage, type Mark } from "./marks";

const mark = (id: string, page: number, bbox: Mark["bbox"] = null): Mark => ({
  id,
  page,
  bbox,
  label: id,
  tone: "deduction",
});

describe("marksByPage", () => {
  it("groups marks by their 1-based page", () => {
    const grouped = marksByPage([mark("a", 1), mark("b", 3), mark("c", 1)]);
    expect(grouped.get(1)?.map((m) => m.id)).toEqual(["a", "c"]);
    expect(grouped.get(3)?.map((m) => m.id)).toEqual(["b"]);
    expect(grouped.get(2)).toBeUndefined();
  });

  it("is empty for no marks", () => {
    expect(marksByPage([]).size).toBe(0);
  });
});

describe("isUsableBbox", () => {
  it("rejects null for documents without measured regions", () => {
    expect(isUsableBbox(null)).toBe(false);
  });

  it("accepts a normalized box with area", () => {
    expect(isUsableBbox([0.1, 0.2, 0.6, 0.35])).toBe(true);
  });

  it("rejects a box with no area, so nothing invents a coordinate", () => {
    expect(isUsableBbox([0.3, 0.3, 0.3, 0.5])).toBe(false);
    expect(isUsableBbox([0.3, 0.3, 0.5, 0.3])).toBe(false);
  });

  it("rejects a reversed or out-of-range box", () => {
    expect(isUsableBbox([0.6, 0.2, 0.1, 0.35])).toBe(false);
    expect(isUsableBbox([-0.1, 0.2, 0.6, 0.35])).toBe(false);
    expect(isUsableBbox([0.1, 0.2, 1.4, 0.35])).toBe(false);
    expect(isUsableBbox([Number.NaN, 0.2, 0.6, 0.35])).toBe(false);
  });
});
