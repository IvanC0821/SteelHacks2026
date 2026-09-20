import { describe, expect, it } from "vitest";
import {
  assessmentStateOf,
  entryFor,
  estimateOf,
  firstUnreviewed,
  humanTotalOf,
  neighbour,
  queueIndex,
  switcherLabel,
} from "./queue";
import * as fx from "./fixtures";

const queue = [
  fx.submission({ id: "sub_a", student_name: "Amara Okafor", review: fx.review({ revision: 3, status: "released", questions: { q1: { score: 7, reason: "a" } } }) }),
  fx.submission({ id: "sub_b", student_name: "Ben Castellano", review: fx.review({ revision: 1, status: "in_progress" }) }),
  fx.submission({ id: "sub_c", student_name: "Chloe Nguyen" }),
  fx.submission({ id: "sub_d", student_name: "Dev Patel", assessment: null }),
];

describe("the queue switcher", () => {
  it("finds a paper's position", () => {
    expect(queueIndex(queue, "sub_c")).toBe(2);
    expect(queueIndex(queue, "nope")).toBe(-1);
    expect(queueIndex(queue, null)).toBe(-1);
    expect(entryFor(queue, "sub_c")).toMatchObject({ position: 3, total: 4 });
    expect(entryFor(queue, "nope")).toBeNull();
  });

  it("writes the header and phone labels", () => {
    expect(switcherLabel(entryFor(queue, "sub_c"))).toBe("Chloe Nguyen · 3 of 4");
    expect(switcherLabel(entryFor(queue, "sub_c"), true)).toBe("3 / 4");
    expect(switcherLabel(null)).toBe("No paper selected");
  });

  it("steps between papers without wrapping", () => {
    expect(neighbour(queue, "sub_b", 1)?.id).toBe("sub_c");
    expect(neighbour(queue, "sub_b", -1)?.id).toBe("sub_a");
    expect(neighbour(queue, "sub_a", -1)).toBeNull();
    expect(neighbour(queue, "sub_d", 1)).toBeNull();
    expect(neighbour([], null, 1)).toBeNull();
  });
});

describe("what the roster shows per paper", () => {
  it("reads the assessment state, including a paper never checked", () => {
    expect(assessmentStateOf(queue[0])).toBe("estimated");
    expect(assessmentStateOf(queue[3])).toBe("not_checked");
    expect(
      assessmentStateOf(fx.submission({ assessment: { ...fx.assessment, status: "needs_review", score: null } })),
    ).toBe("needs_review");
  });

  it("keeps a null estimate null instead of zero", () => {
    expect(estimateOf(queue[0])).toEqual({ score: 19, max: 30 });
    expect(estimateOf(queue[3])).toBeNull();
    expect(estimateOf(fx.submission({ assessment: { ...fx.assessment, score: null, status: "needs_review" } }))).toEqual(
      { score: null, max: 30 },
    );
  });

  it("totals the human scores only once something is saved", () => {
    expect(humanTotalOf(queue[0])).toBe(7);
    expect(humanTotalOf(queue[2])).toBeNull();
  });
});

describe("where the workspace opens", () => {
  it("picks the first paper still needing review", () => {
    expect(firstUnreviewed(queue)?.id).toBe("sub_b");
  });

  it("falls back to the first paper when every review is done", () => {
    const done = queue.map((s) => ({ ...s, review: fx.review({ status: "released" as const }) }));
    expect(firstUnreviewed(done)?.id).toBe("sub_a");
  });

  it("has nothing to open on an empty queue", () => {
    expect(firstUnreviewed([])).toBeNull();
  });
});
