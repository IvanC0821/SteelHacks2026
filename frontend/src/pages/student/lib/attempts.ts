// The attempt history model: what each row in the attempts table says, and when Hand in is allowed.
// Every rule here mirrors a backend rule (service.hand_in, writable_attempt, before_deadline), so a
// disabled control always carries the reason the server would have given.

import type { StudentSubmission } from "../../../api/types";
import { assessmentState, formatPoints } from "../../../components";
import { formatDate, isPastDue } from "../../../design/format";

// The number, date and status vocabularies are the design system's; this module only adds the
// attempt-history rules on top of them.
export { isPastDue };

export function scoreLine(score: number | null, max: number): string {
  return score === null ? "Needs review" : `${formatPoints(score)} of ${formatPoints(max)}`;
}

export type AttemptStatus =
  | { kind: "not_checked"; label: string }
  | { kind: "estimated"; label: string; score: number; max: number }
  | { kind: "needs_review"; label: string }
  | { kind: "final"; label: string; score: number | null; max: number };

export type AttemptAction = "assign_pages" | "edit_pages" | "check" | "view";

export function attemptStatus(submission: StudentSubmission): AttemptStatus {
  if (submission.review.status === "released") {
    const score = submission.review.score ?? null;
    const max = submission.assessment?.max_points ?? 0;
    return { kind: "final", label: `Final score ${scoreLine(score, max)}`, score, max };
  }
  const assessment = submission.assessment;
  const state = assessmentState(assessment);
  if (state === "not_checked" || !assessment) return { kind: "not_checked", label: "Not checked" };
  if (state === "needs_review" || assessment.score === null) {
    return { kind: "needs_review", label: "Needs review" };
  }
  return {
    kind: "estimated",
    label: `Estimated ${scoreLine(assessment.score, assessment.max_points)}`,
    score: assessment.score,
    max: assessment.max_points,
  };
}

export function isMapped(submission: StudentSubmission): boolean {
  const mapping = submission.mapping;
  if (!mapping) return false;
  const questionIds = Object.keys(mapping);
  return questionIds.length > 0 && questionIds.every((id) => (mapping[id] ?? []).length > 0);
}

export function attemptAction(
  submission: StudentSubmission,
  options: { canCheck?: boolean } = {},
): AttemptAction {
  const canCheck = options.canCheck ?? true;
  if (submission.sealed || submission.final) return "view";
  if (!isMapped(submission)) return "assign_pages";
  return canCheck ? "check" : "edit_pages";
}

export const ACTION_LABELS: Record<AttemptAction, string> = {
  assign_pages: "Assign pages",
  edit_pages: "Edit pages",
  check: "Check my work",
  view: "View feedback",
};

export function sortedAttempts(attempts: StudentSubmission[]): StudentSubmission[] {
  return [...attempts].sort((a, b) => b.version - a.version);
}

export function latestAttempt(attempts: StudentSubmission[]): StudentSubmission | null {
  return sortedAttempts(attempts)[0] ?? null;
}

export function finalAttempt(attempts: StudentSubmission[]): StudentSubmission | null {
  return attempts.find((a) => a.final) ?? null;
}

/** "Attempt 2" plus the qualifier that keeps the first and the latest view distinct. */
export function attemptLabel(submission: StudentSubmission, attempts: StudentSubmission[]): string {
  const name = `Attempt ${submission.version}`;
  if (attempts.length < 2) return name;
  const versions = attempts.map((a) => a.version);
  if (submission.version === Math.max(...versions)) return `${name} (latest)`;
  if (submission.version === Math.min(...versions)) return `${name} (first)`;
  return name;
}

export interface HandInGate {
  allowed: boolean;
  /** one sentence, used as the disabled control's title */
  reason: string | null;
}

/** Hand in is allowed on the latest attempt only, once, before the deadline, with pages assigned. */
export function handInGate(input: {
  submission: StudentSubmission;
  attempts: StudentSubmission[];
  dueAt: string | null;
  now?: Date;
}): HandInGate {
  const { submission, attempts, dueAt } = input;
  const now = input.now ?? new Date();
  const all = attempts.length ? attempts : [submission];

  if (submission.final) {
    return { allowed: false, reason: "This attempt is already handed in" };
  }
  const handed = finalAttempt(all);
  if (handed) {
    return { allowed: false, reason: `You already handed in attempt ${handed.version}` };
  }
  const latest = latestAttempt(all);
  if (latest && latest.id !== submission.id) {
    return { allowed: false, reason: "Only the latest attempt can be handed in" };
  }
  if (isPastDue(dueAt, now)) {
    return { allowed: false, reason: "The due date has passed" };
  }
  if (!isMapped(submission)) {
    return { allowed: false, reason: "Assign pages to every question first" };
  }
  return { allowed: true, reason: null };
}

/** Uploading a revision follows the same deadline rule; there is no attempt cap. */
export function uploadGate(dueAt: string | null, now: Date = new Date()): HandInGate {
  return isPastDue(dueAt, now)
    ? { allowed: false, reason: "The due date has passed" }
    : { allowed: true, reason: null };
}

const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-US", { weekday: "long" });

/** The student area writes the clock in the same sentence as a day, so it stays lowercase. */
function clock(date: Date): string {
  return TIME.format(date).replace(" AM", " am").replace(" PM", " pm");
}

/** "Due Thursday, 11:59 pm" while open, "Closed" once the due date has passed. */
export function dueSentence(dueAt: string | null, now: Date = new Date()): string {
  if (!dueAt) return "No due date";
  const due = new Date(dueAt);
  if (!Number.isFinite(due.getTime())) return "No due date";
  if (isPastDue(dueAt, now)) return "Closed";
  const withinAWeek = due.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;
  const day = withinAWeek ? DAY.format(due) : formatDate(dueAt, now);
  return `Due ${day}, ${clock(due)}`;
}

/** "Sep 19, 4:12 pm" for an upload or a hand-in stamp. */
export function stamp(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const day = formatDate(iso, now);
  // formatDate returns "" for anything it could not parse, so the clock below is always safe.
  return day ? `${day}, ${clock(new Date(iso))}` : "";
}
