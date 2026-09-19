import { describe, expect, it } from "vitest";
import { dueDateError, formatOffset, fromDueAtIso, localOffsetMinutes, toDueAtIso } from "./due-date";

describe("due date", () => {
  it("builds an ISO string with an explicit offset", () => {
    expect(toDueAtIso("2026-09-24", "23:59", -240)).toBe("2026-09-24T23:59:00-04:00");
    expect(toDueAtIso("2026-01-05", "09:00", 330)).toBe("2026-01-05T09:00:00+05:30");
    expect(toDueAtIso("2026-01-05", "09:00", 0)).toBe("2026-01-05T09:00:00+00:00");
  });

  it("defaults the time to end of day", () => {
    expect(toDueAtIso("2026-09-24", "", -240)).toBe("2026-09-24T23:59:00-04:00");
  });

  it("returns null without a date", () => {
    expect(toDueAtIso("", "23:59", 0)).toBeNull();
    expect(toDueAtIso("24/09/2026", "23:59", 0)).toBeNull();
  });

  it("uses the browser zone when no offset is given, and the server accepts it", () => {
    const iso = toDueAtIso("2026-09-24", "23:59");
    expect(iso).not.toBeNull();
    expect(iso).toMatch(/^2026-09-24T23:59:00[+-]\d{2}:\d{2}$/);
    // Parsing it back gives the same wall-clock time in this zone.
    const back = fromDueAtIso(iso);
    expect(back).toEqual({ date: "2026-09-24", time: "23:59" });
  });

  it("formats offsets on both sides of UTC", () => {
    expect(formatOffset(0)).toBe("+00:00");
    expect(formatOffset(-330)).toBe("-05:30");
    expect(formatOffset(600)).toBe("+10:00");
    expect(typeof localOffsetMinutes()).toBe("number");
  });

  it("reports the problems the form should show", () => {
    expect(dueDateError("", "")).toBeNull();
    expect(dueDateError("2026-09-24", "")).toBeNull();
    expect(dueDateError("", "23:59")).toBe("Add a date for the time you entered");
    expect(dueDateError("2026-13-01", "12:00")).toBe("That date does not exist");
    expect(dueDateError("2026-02-30", "12:00")).toBe("That date does not exist");
    expect(dueDateError("2026-09-24", "9:00")).toBe("Use a 24-hour time in the form 23:59");
    expect(dueDateError("Sept 24", "12:00")).toBe("Use a date in the form 2026-09-24");
  });

  it("round-trips an empty due date", () => {
    expect(fromDueAtIso(null)).toEqual({ date: "", time: "" });
    expect(fromDueAtIso("not a date")).toEqual({ date: "", time: "" });
  });
});
