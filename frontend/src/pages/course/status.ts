// The assignment status model. Staff status comes from the assignment plus that assignment's
// final queue; student status comes from the student's own submissions. One state per row, one
// action per state, so the course home never shows two competing calls to action.

import type { Assignment, StaffSubmission, StudentSubmission } from "../../api/types";
import { assessmentState } from "../../components";

export type StaffState = "rubric_missing" | "no_papers" | "grading" | "all_reviewed" | "released";
export type StudentState =
  | "not_started"
  | "not_checked"
  | "needs_review"
  | "estimated"
  | "handed_in"
  | "final_score";

export interface RowAction {
  label: string;
  to: string;
}

export interface StaffStatus {
  state: StaffState;
  label: string;
  /** reviewed of handed in, for the thin bar; null when there is nothing to grade yet */
  progress: { reviewed: number; total: number } | null;
  action: RowAction;
}

export interface StudentStatus {
  state: StudentState;
  label: string;
  /** the released final score, when there is one */
  score: number | null;
  /** the latest estimate, shown only before a final score exists */
  estimate: number | null;
  maxPoints: number | null;
  action: RowAction;
}

/** Total points a paper is out of, from the question list. */
export function totalPoints(assignment: Pick<Assignment, "questions">): number {
  return assignment.questions.reduce((sum, question) => sum + question.max_points, 0);
}

function reviewedCount(queue: StaffSubmission[]): number {
  return queue.filter((s) => s.review.status === "completed" || s.review.status === "released").length;
}

function releasedCount(queue: StaffSubmission[]): number {
  return queue.filter((s) => s.review.status === "released").length;
}

/**
 * Staff row status. `rubricVersion` is the published rubric's version number when it is known
 * (from `AssignmentDetail.rubrics`); it only changes the wording of the "no papers yet" label.
 */
export function staffStatus(
  assignment: Pick<Assignment, "id" | "published_rubric_id">,
  finalQueue: StaffSubmission[],
  rubricVersion = 1,
): StaffStatus {
  const id = assignment.id;
  if (!assignment.published_rubric_id) {
    return {
      state: "rubric_missing",
      label: "Rubric not published",
      progress: null,
      action: { label: "Set up rubric", to: `/a/${id}/rubric` },
    };
  }

  const total = finalQueue.length;
  if (total === 0) {
    return {
      state: "no_papers",
      label: `Rubric v${rubricVersion}, no papers yet`,
      progress: null,
      action: { label: "Open", to: `/a/${id}/overview` },
    };
  }

  const reviewed = reviewedCount(finalQueue);
  const released = releasedCount(finalQueue);

  if (released === total) {
    return {
      state: "released",
      label: "Released",
      progress: { reviewed, total },
      action: { label: "Open", to: `/a/${id}/overview` },
    };
  }
  if (reviewed === total) {
    return {
      state: "all_reviewed",
      label: "All reviewed",
      progress: { reviewed, total },
      action: { label: "Review", to: `/a/${id}/grade` },
    };
  }
  return {
    state: "grading",
    label: `Grading ${reviewed} of ${total}`,
    progress: { reviewed, total },
    action: { label: "Grade", to: `/a/${id}/grade` },
  };
}

/** Newest attempt first, by version then creation time. */
function latestFirst(submissions: StudentSubmission[]): StudentSubmission[] {
  return [...submissions].sort((a, b) => b.version - a.version || b.created_at.localeCompare(a.created_at));
}

/** Student row status, from that student's own attempts. Never renders a null score as 0. */
export function studentStatus(
  assignment: Pick<Assignment, "id" | "questions">,
  submissions: StudentSubmission[],
): StudentStatus {
  const id = assignment.id;
  const max = totalPoints(assignment);
  const open: RowAction = { label: "Open", to: `/a/${id}` };

  if (submissions.length === 0) {
    return {
      state: "not_started",
      label: "Not started",
      score: null,
      estimate: null,
      maxPoints: max,
      action: { label: "Start", to: `/a/${id}` },
    };
  }

  const ordered = latestFirst(submissions);
  const final = ordered.find((s) => s.final) ?? null;
  const latest = ordered[0];

  if (final && final.review.status === "released") {
    return {
      state: "final_score",
      label: "Final score",
      score: final.review.score ?? null,
      estimate: null,
      maxPoints: max,
      action: open,
    };
  }
  if (final) {
    return {
      state: "handed_in",
      label: "Handed in",
      score: null,
      estimate: final.assessment?.score ?? null,
      maxPoints: max,
      action: open,
    };
  }
  // the same derivation every other screen uses: a missing assessment is "Not checked", never a zero
  const checked = assessmentState(latest.assessment);
  if (checked !== "not_checked") {
    // a null total is "Needs review", never a zero and never "Estimated"
    const needsReview = checked === "needs_review";
    return {
      state: needsReview ? "needs_review" : "estimated",
      label: needsReview ? "Needs review" : "Estimated",
      score: null,
      estimate: latest.assessment?.score ?? null,
      maxPoints: max,
      action: open,
    };
  }
  return {
    state: "not_checked",
    label: "Not checked",
    score: null,
    estimate: null,
    maxPoints: max,
    action: { label: "Open", to: `/a/${id}` },
  };
}
