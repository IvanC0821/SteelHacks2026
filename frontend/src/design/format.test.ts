import { describe, expect, it } from "vitest";
import { formatDate, formatDue, formatTime, isPastDue } from "./format";

const NOW = new Date("2026-09-19T12:00:00Z");

describe("formatDue", () => {
  it("says so plainly when there is no due date", () => {
    expect(formatDue(null, NOW)).toBe("No due date");
    expect(formatDue(undefined, NOW)).toBe("No due date");
    expect(formatDue("not a date", NOW)).toBe("No due date");
  });

  it("starts with Due and carries a clock time", () => {
    expect(formatDue("2026-09-24T21:53:54Z", NOW)).toMatch(/^Due Sep 24, \d{1,2}:\d{2} (AM|PM)$/);
  });

  it("adds the year only when it is not the current one", () => {
    expect(formatDue("2027-01-04T15:00:00Z", NOW)).toContain("2027");
    expect(formatDue("2026-09-24T21:53:54Z", NOW)).not.toContain("2026");
  });
});

describe("formatTime and formatDate", () => {
  it("return an empty string when there is nothing to show", () => {
    expect(formatTime(null, NOW)).toBe("");
    expect(formatDate(null, NOW)).toBe("");
  });

  it("drops the clock for a date", () => {
    expect(formatDate("2026-09-19T21:53:54Z", NOW)).toBe("Sep 19");
  });
});

describe("isPastDue", () => {
  it("is false with no due date", () => {
    expect(isPastDue(null, NOW)).toBe(false);
  });

  it("compares against now", () => {
    expect(isPastDue("2026-09-18T12:00:00Z", NOW)).toBe(true);
    expect(isPastDue("2026-09-20T12:00:00Z", NOW)).toBe(false);
  });
});
