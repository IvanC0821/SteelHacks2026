// The final queue as the header switcher sees it: position, neighbours and the one-line summary
// each paper gets in the roster popover.

import type { StaffSubmission } from "../../api/types";
import type { AssessmentState } from "../../components";

export interface QueueEntry {
  submission: StaffSubmission;
  /** 1-based position in the queue */
  position: number;
  total: number;
}

export function queueIndex(queue: StaffSubmission[], submissionId: string | null): number {
  if (!submissionId) return -1;
  return queue.findIndex((s) => s.id === submissionId);
}

export function entryFor(queue: StaffSubmission[], submissionId: string | null): QueueEntry | null {
  const index = queueIndex(queue, submissionId);
  if (index < 0) return null;
  return { submission: queue[index], position: index + 1, total: queue.length };
}

/** The next or previous paper, or null at either end. The queue does not wrap: a reviewer
 *  who reaches the last paper should see that, not silently start again. */
export function neighbour(queue: StaffSubmission[], submissionId: string | null, step: 1 | -1): StaffSubmission | null {
  const index = queueIndex(queue, submissionId);
  if (index < 0) return null;
  const next = index + step;
  return next >= 0 && next < queue.length ? queue[next] : null;
}

/** "Chloe Nguyen · 2 of 4" in the header, "2 / 4" on a phone. */
export function switcherLabel(entry: QueueEntry | null, compact = false): string {
  if (!entry) return compact ? "" : "No paper selected";
  return compact
    ? `${entry.position} / ${entry.total}`
    : `${entry.submission.student_name} · ${entry.position} of ${entry.total}`;
}

export function assessmentStateOf(submission: StaffSubmission): AssessmentState {
  if (!submission.assessment) return "not_checked";
  return submission.assessment.status === "needs_review" ? "needs_review" : "estimated";
}

/** The estimate shown beside a paper in the roster: null stays null, never 0. */
export function estimateOf(submission: StaffSubmission): { score: number | null; max: number } | null {
  const assessment = submission.assessment;
  if (!assessment) return null;
  return { score: assessment.score, max: assessment.max_points };
}

/** The human total for a paper, once the reviewer has saved anything. */
export function humanTotalOf(submission: StaffSubmission): number | null {
  const values = Object.values(submission.review.questions);
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, q) => sum + q.score, 0) * 100) / 100;
}

/** The paper the workspace opens on: the first one still needing review, else the first paper. */
export function firstUnreviewed(queue: StaffSubmission[]): StaffSubmission | null {
  if (queue.length === 0) return null;
  return queue.find((s) => s.review.status === "not_started" || s.review.status === "in_progress") ?? queue[0];
}
