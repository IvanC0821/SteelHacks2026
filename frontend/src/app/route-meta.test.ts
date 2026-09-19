import { describe, expect, it } from "vitest";
import { allowsRole, resolveHandle, wrongRoleSentence, INSTRUCTOR, STAFF, STUDENT } from "./route-meta";
import { mergeByPath, pageRoutes } from "./routes";
import type { RouteHandle } from "./route-meta";

describe("allowsRole", () => {
  it("lets everyone through a route with no roles", () => {
    expect(allowsRole(undefined, "student")).toBe(true);
    expect(allowsRole({}, "ta")).toBe(true);
    expect(allowsRole({ roles: [] }, "instructor")).toBe(true);
  });

  it("keeps a student out of a staff route", () => {
    expect(allowsRole({ roles: STAFF }, "student")).toBe(false);
    expect(allowsRole({ roles: STAFF }, "ta")).toBe(true);
    expect(allowsRole({ roles: STAFF }, "instructor")).toBe(true);
  });

  it("keeps staff out of a student route", () => {
    expect(allowsRole({ roles: STUDENT }, "ta")).toBe(false);
    expect(allowsRole({ roles: STUDENT }, "instructor")).toBe(false);
    expect(allowsRole({ roles: STUDENT }, "student")).toBe(true);
  });

  it("keeps a TA out of an instructor-only route", () => {
    expect(allowsRole({ roles: INSTRUCTOR }, "ta")).toBe(false);
    expect(allowsRole({ roles: INSTRUCTOR }, "instructor")).toBe(true);
  });
});

describe("resolveHandle", () => {
  it("merges parent and child handles, child last", () => {
    expect(
      resolveHandle([{ handle: { workspace: false, roles: STAFF } }, { handle: { workspace: true } }]),
    ).toEqual({ workspace: true, roles: STAFF });
  });

  it("ignores matches with no handle", () => {
    expect(resolveHandle([{}, { handle: { title: "Rubric" } }])).toEqual({ title: "Rubric" });
  });
});

describe("wrongRoleSentence", () => {
  it("is one sentence, in the reader's direction", () => {
    expect(wrongRoleSentence("student")).toMatch(/instructor and TAs/);
    expect(wrongRoleSentence("ta")).toMatch(/for students/);
  });
});

describe("the route table", () => {
  it("covers every route in the brief's ownership table", () => {
    const paths = mergeByPath(pageRoutes).map((route) => route.path);
    for (const path of [
      "/",
      "/c/:courseId",
      "/c/:courseId/new",
      "/a/:assignmentId",
      "/a/:assignmentId/overview",
      "/a/:assignmentId/reports",
      "/a/:assignmentId/rubric",
      "/a/:assignmentId/grade",
      "/a/:assignmentId/grade/:submissionId",
      "/s/:submissionId",
      "/s/:submissionId/pages",
    ]) {
      expect(paths).toContain(path);
    }
  });

  it("declares each path exactly once after the role split is merged", () => {
    const paths = mergeByPath(pageRoutes).map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("flags the paper routes as workspaces and the content routes as not", () => {
    const byPath = new Map(
      mergeByPath(pageRoutes).map((route) => [route.path, (route.handle ?? {}) as RouteHandle]),
    );
    for (const path of [
      "/a/:assignmentId/grade",
      "/a/:assignmentId/grade/:submissionId",
      "/a/:assignmentId/rubric",
      "/s/:submissionId",
      "/s/:submissionId/pages",
    ]) {
      expect(byPath.get(path)?.workspace, path).toBe(true);
    }
    for (const path of ["/", "/c/:courseId", "/a/:assignmentId", "/a/:assignmentId/overview"]) {
      expect(byPath.get(path)?.workspace, path).toBeFalsy();
    }
  });

  it("merges the one path two tasks share into a single role-split route", () => {
    const shared = pageRoutes.filter((route) => route.path === "/a/:assignmentId");
    expect(shared.length).toBe(2);
    const merged = mergeByPath(pageRoutes).filter((route) => route.path === "/a/:assignmentId");
    expect(merged.length).toBe(1);
    // the Shell must let both roles reach it; RoleSplit then picks the page
    expect((merged[0].handle as RouteHandle).roles).toBeUndefined();
  });
});
