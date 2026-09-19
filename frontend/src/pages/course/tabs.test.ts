import { describe, expect, it } from "vitest";
import { assignmentTabs, tabForPath } from "./tabs";

describe("tabForPath", () => {
  it("treats the bare assignment path as Overview", () => {
    expect(tabForPath("/a/asg_1", "asg_1")).toBe("overview");
    expect(tabForPath("/a/asg_1/overview", "asg_1")).toBe("overview");
  });

  it("recognises the tabs owned by other tasks", () => {
    expect(tabForPath("/a/asg_1/rubric", "asg_1")).toBe("rubric");
    expect(tabForPath("/a/asg_1/grade", "asg_1")).toBe("grade");
    expect(tabForPath("/a/asg_1/grade/sub_9", "asg_1")).toBe("grade");
    expect(tabForPath("/a/asg_1/reports", "asg_1")).toBe("reports");
  });
});

describe("assignmentTabs", () => {
  it("keeps the order and points at each owner's route", () => {
    const tabs = assignmentTabs("asg_1");
    expect(tabs.map((t) => t.label)).toEqual(["Overview", "Rubric", "Grade", "Reports"]);
    expect(tabs.map((t) => t.to)).toEqual([
      "/a/asg_1/overview",
      "/a/asg_1/rubric",
      "/a/asg_1/grade",
      "/a/asg_1/reports",
    ]);
  });
});
