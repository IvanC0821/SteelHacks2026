// The instructor's Enroll control. The user ID is the opaque `usr_…` the local setup command
// prints; nothing in the interface can look one up, so the field validates the shape only.

import type { Role } from "../../api/types";

export const ENROLL_HINT = "Printed by the local setup command.";

export const ENROLL_ROLES: Array<{ value: Role; label: string }> = [
  { value: "student", label: "Student" },
  { value: "ta", label: "TA" },
  { value: "instructor", label: "Instructor" },
];

/** Returns the field error, or null when the id is worth sending. */
export function validateUserId(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Paste the user ID to enroll.";
  if (!/^usr_[0-9a-f]{8,}$/i.test(trimmed)) return "A user ID looks like usr_ followed by hexadecimal.";
  return null;
}

/** Maps an enroll failure to a sentence. Unknown codes fall through to a plain one. */
export function enrollErrorMessage(code: string): string {
  if (code === "not_found") return "No user has that ID.";
  if (code === "already_enrolled") return "That person is already in this course.";
  if (code === "forbidden" || code === "course_access_denied") return "Only the instructor can enroll people.";
  return "That enrollment did not go through.";
}
