// Which primary the header shows, by review status and role. One table so the TA and the
// instructor never see two primaries, and a TA never sees Release scores.

import type { Job, Question, ReviewQuestion, ReviewStatus, Role } from "../../api/types";
import { completeGate } from "./review-state";

export type HeaderPrimary = "complete" | "release" | "none";

export interface HeaderState {
  primary: HeaderPrimary;
  /** disabled reason for the primary, null when it is enabled or absent */
  disabledReason: string | null;
  /** a status chip instead of a primary, e.g. the TA's "Completed, awaiting release" */
  chip: string | null;
  /** Reopen is instructor-only and only after completion */
  canReopen: boolean;
  /** the score fields are read-only once the scores are released */
  readOnly: boolean;
}

export function headerState(input: {
  role: Role;
  status: ReviewStatus;
  questions: Question[];
  saved: Record<string, ReviewQuestion>;
  job: Job | null;
}): HeaderState {
  const instructor = input.role === "instructor";

  if (input.status === "released") {
    return {
      primary: "none",
      disabledReason: null,
      chip: "Released",
      canReopen: instructor,
      readOnly: true,
    };
  }

  if (input.status === "completed") {
    return {
      primary: instructor ? "release" : "none",
      disabledReason: null,
      chip: instructor ? null : "Completed, awaiting release",
      canReopen: instructor,
      readOnly: true,
    };
  }

  const gate = completeGate(input);
  return {
    primary: "complete",
    disabledReason: gate.reason,
    chip: null,
    canReopen: false,
    readOnly: false,
  };
}

export function releaseToast(studentName: string): string {
  return `Scores released to ${studentName}`;
}
