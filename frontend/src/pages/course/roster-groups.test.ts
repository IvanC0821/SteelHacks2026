import { describe, expect, it } from "vitest";
import type { Member } from "../../api/types";
import { groupRoster, roleLabel } from "./roster-groups";

const members: Member[] = [
  { id: "u1", name: "Chloe Nguyen", role: "student" },
  { id: "u2", name: "Sam Reyes", role: "ta" },
  { id: "u3", name: "Dana Whitfield", role: "instructor" },
  { id: "u4", name: "Amara Okafor", role: "student" },
];

describe("groupRoster", () => {
  it("orders instructor, TA, student and sorts names inside each group", () => {
    const groups = groupRoster(members);
    expect(groups.map((g) => g.role)).toEqual(["instructor", "ta", "student"]);
    expect(groups.map((g) => g.label)).toEqual(["Instructor", "TA", "Students"]);
    expect(groups[2].members.map((m) => m.name)).toEqual(["Amara Okafor", "Chloe Nguyen"]);
  });

  it("drops empty roles and handles an empty roster", () => {
    expect(groupRoster([{ id: "u1", name: "Sam Reyes", role: "ta" }]).map((g) => g.role)).toEqual(["ta"]);
    expect(groupRoster([])).toEqual([]);
  });
});

describe("roleLabel", () => {
  it("names a single role", () => {
    expect(roleLabel("ta")).toBe("TA");
    expect(roleLabel("instructor")).toBe("Instructor");
    expect(roleLabel("student")).toBe("Student");
  });
});
