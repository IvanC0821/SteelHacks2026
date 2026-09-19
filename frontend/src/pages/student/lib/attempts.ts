// The attempt history model: what each row in the attempts table says, and when Hand in is allowed.
// Every rule here mirrors a backend rule (service.hand_in, writable_attempt, before_deadline), so a
// disabled control always carries the reason the server would have given.

import type { StudentSubmission } from "../../../api/types";

/** Drops a trailing .0 so 8 points reads "8" and 7.5 stays "7.5". */
export function points(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function scoreLine(score: number | null, max: number): string {
  return score === null ? "Needs review" : `${points(score)} of ${points(max)}`;
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
  if (!assessment) return { kind: "not_checked", label: "Not checked" };
  if (assessment.score === null || assessment.status === "needs_review") {
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

export function isPastDue(dueAt: string | null, now: Date = new Date()): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  return Number.isFinite(due.getTime()) && now.getTime() >= due.getTime();
}

/** Uploading a revision follows the same deadline rule; there is no attempt cap. */
export function uploadGate(dueAt: string | null, now: Date = new Date()): HandInGate {
  return isPastDue(dueAt, now)
    ? { allowed: false, reason: "The due date has passed" }
    : { allowed: true, reason: null };
}

const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const DAY = new Intl.DateTimeFormat("en-US", { weekday: "long" });
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function clock(date: Date): string {
  return TIME.format(date).replace(" AM", " am").replace(" PM", " pm");
}

/** "Due Thursday, 11:59 pm" while open, "Closed" once the due date has passed. */
export function dueSentence(dueAt: string | null, now: Date = new Date()): string {
  if (!dueAt) return "No due date";
  const due = new Date(dueAt);
  if (!Number.isFinite(due.getTime())) return "No due date";
  if (now.getTime() >= due.getTime()) return "Closed";
  const withinAWeek = due.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;
  const day = withinAWeek ? DAY.format(due) : DATE.format(due);
  return `Due ${day}, ${clock(due)}`;
}

/** "Sept 19, 4:12 pm" for an upload or a hand-in stamp. */
export function stamp(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  return `${DATE.format(date)}, ${clock(date)}`;
}
