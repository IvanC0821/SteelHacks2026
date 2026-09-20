import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VerityClient } from "../api/client";
import type { Course } from "../api/types";
import { preferredCourse, rememberCourse, rememberedCourse, routeCourseId } from "./course-selection";

const courses: Course[] = [
  { id: "algebra", name: "Linear Algebra", role: "student", created_at: "today" },
  { id: "concepts", name: "21-127", role: "student", created_at: "today" },
];

beforeEach(() => localStorage.clear());

describe("course selection", () => {
  it("remembers a separate course for each account", () => {
    rememberCourse("student", "concepts");
    rememberCourse("ta", "algebra");
    expect(rememberedCourse("student")).toBe("concepts");
    expect(rememberedCourse("ta")).toBe("algebra");
    expect(rememberedCourse("other")).toBeNull();
  });
  it("never uses a stored preference as authorization", () => {
    expect(preferredCourse(courses, "concepts")).toEqual(courses[1]);
    expect(preferredCourse(courses, "inaccessible")).toEqual(courses[0]);
    expect(preferredCourse([], "concepts")).toBeNull();
  });
  it("resolves course, assignment and submission deep links", async () => {
    const assignment = vi.fn().mockResolvedValue({ course_id: "concepts" });
    const submission = vi.fn().mockResolvedValue({ assignment_id: "hw2" });
    const client = { assignment, submission } as unknown as VerityClient;
    expect(await routeCourseId(client, "/c/algebra")).toBe("algebra");
    expect(assignment).not.toHaveBeenCalled();
    expect(await routeCourseId(client, "/a/hw1/overview")).toBe("concepts");
    expect(assignment).toHaveBeenLastCalledWith("hw1");
    expect(await routeCourseId(client, "/s/paper")).toBe("concepts");
    expect(submission).toHaveBeenCalledWith("paper");
    expect(assignment).toHaveBeenLastCalledWith("hw2");
    expect(await routeCourseId(client, "/a/hw2/grade/paper")).toBe("concepts");
    expect(await routeCourseId(client, "/")).toBeNull();
  });
  it("does not guess a course when a deep link is forbidden", async () => {
    const client = { assignment: vi.fn().mockRejectedValue(new Error("forbidden")) } as unknown as VerityClient;
    await expect(routeCourseId(client, "/a/private")).rejects.toThrow("forbidden");
  });
});
