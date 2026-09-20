import type { VerityClient } from "../api/client";
import type { Course } from "../api/types";

const key = (userId: string) => `verity.course.${userId}`;

export function rememberedCourse(userId: string): string | null {
  try { return localStorage.getItem(key(userId)); } catch { return null; }
}

export function rememberCourse(userId: string, courseId: string) {
  try { localStorage.setItem(key(userId), courseId); } catch { /* URL still preserves selection. */ }
}

/** A saved preference never grants membership; the authenticated course list is authoritative. */
export function preferredCourse(courses: Course[], courseId: string | null): Course | null {
  return courses.find((course) => course.id === courseId) ?? courses[0] ?? null;
}

/** Resolve deep links as well as course pages; never guess from assignment names. */
export async function routeCourseId(client: VerityClient, pathname: string): Promise<string | null> {
  const courseId = pathname.match(/^\/c\/([^/]+)(?:\/|$)/)?.[1];
  if (courseId) return courseId;
  let assignmentId = pathname.match(/^\/a\/([^/]+)(?:\/|$)/)?.[1];
  const submissionId = pathname.match(/^\/s\/([^/]+)(?:\/|$)/)?.[1];
  if (submissionId) assignmentId = (await client.submission(submissionId)).assignment_id;
  return assignmentId ? (await client.assignment(assignmentId)).course_id : null;
}
