// @vitest-environment node
import { describe, expect, it } from "vitest";
import { localRequest, studentAccounts } from "./demo-session";

describe("demo student identities", () => {
  it("uses canonical roster names and excludes accounts outside the class", () => {
    const accounts = studentAccounts({ api: "http://127.0.0.1:8026", course_id: "current-class", users: {
      "Old name": { id: "enrolled", role: "student", token: "test-only" },
      "Other class": { id: "outsider", role: "student", token: "test-only" },
      "Staff": { id: "staff", role: "instructor", token: "test-only" },
    } }, [
      { id: "enrolled", name: "Current roster name", role: "student" },
      { id: "unprovisioned", name: "No demo account", role: "student" },
      { id: "staff", name: "Staff", role: "instructor" },
    ]);
    expect(accounts).toEqual([{ userId: "enrolled", name: "Current roster name", courseId: "current-class" }]);
    expect(JSON.stringify(accounts)).not.toContain("test-only");
  });
});

describe("local demo access boundary", () => {
  it("accepts loopback requests from the same origin", () => {
    expect(localRequest("localhost:5173", "http://localhost:5173", "::1")).toBe(true);
    expect(localRequest("127.0.0.1:5173", undefined, "::ffff:127.0.0.1")).toBe(true);
  });
  it.each([
    ["evil.example:5173", undefined, "127.0.0.1"],
    ["localhost:5173", "https://evil.example", "127.0.0.1"],
    ["localhost:5173", "http://localhost:3000", "127.0.0.1"],
    ["localhost:5173", undefined, "192.168.1.2"],
    [undefined, undefined, "::1"],
    ["localhost:5173", "null", "127.0.0.1"],
  ])("rejects untrusted host/origin/address: %s %s %s", (host, origin, address) => {
    expect(localRequest(host, origin, address)).toBe(false);
  });
});
