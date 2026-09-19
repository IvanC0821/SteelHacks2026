import { describe, expect, it } from "vitest";
import { enrollErrorMessage, ENROLL_ROLES, validateUserId } from "./enroll";
import { validateResolution } from "./reports-view";

describe("validateUserId", () => {
  it("accepts a printed user ID", () => {
    expect(validateUserId("usr_05957a9e61004205ac45b358b6d8efaf")).toBeNull();
    expect(validateUserId("  usr_05957a9e6100  ")).toBeNull();
  });

  it("rejects an empty or malformed one", () => {
    expect(validateUserId("")).toBe("Paste the user ID to enroll.");
    expect(validateUserId("amara@example.edu")).toMatch(/hexadecimal/);
    expect(validateUserId("usr_zz")).toMatch(/hexadecimal/);
  });
});

describe("enroll roles", () => {
  it("offers the three roles in the brief's vocabulary", () => {
    expect(ENROLL_ROLES.map((r) => r.label)).toEqual(["Student", "TA", "Instructor"]);
  });

  it("explains a failure in one sentence", () => {
    expect(enrollErrorMessage("not_found")).toBe("No user has that ID.");
    expect(enrollErrorMessage("whatever")).toBe("That enrollment did not go through.");
  });
});

describe("validateResolution", () => {
  it("requires a staff note", () => {
    expect(validateResolution("   ")).toBe("Write a note for the record before resolving.");
    expect(validateResolution("ok")).toBe("Write a sentence, not a word.");
    expect(validateResolution("Checked the proof, the step is fine.")).toBeNull();
  });
});
