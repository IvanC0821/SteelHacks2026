// The grading review reducer. Pure: no React, no client calls.
// The score field is the truth; the criterion tally only fills it. Every save sends back the
// questions the server already holds beside the one being saved, so the payload is the whole
// review either way (the backend merges today; sending the full map survives a switch to replace).

import type {
  Criterion,
  Job,
  Question,
  ReviewQuestion,
  ReviewStatus,
  StaffReview,
  StaffSubmission,
} from "../../api/types";

export interface QuestionDraft {
  /** raw field text so a half-typed number never becomes NaN */
  score: string;
  reason: string;
  /** criterion ids the reviewer ticked in the local tally */
  tally: string[];
}

export interface ConflictInfo {
  /** question ids whose saved score or reason changed under us */
  changed: string[];
  revision: number;
}

export interface ReviewState {
  submissionId: string;
  revision: number;
  status: ReviewStatus;
  /** the server's questions map, last known */
  saved: Record<string, ReviewQuestion>;
  /** one draft per question in the assignment, always present */
  drafts: Record<string, QuestionDraft>;
  conflict: ConflictInfo | null;
}

export type ReviewAction =
  | { type: "load"; submission: StaffSubmission; questions: Question[] }
  | { type: "reload"; submission: StaffSubmission; questions: Question[]; afterConflict?: boolean }
  | { type: "toggleCriterion"; questionId: string; criterionId: string; criteria: Criterion[]; maxPoints: number }
  | { type: "fillFromSuggestion"; questionId: string; criteria: Criterion[]; metIds: string[]; maxPoints: number }
  | { type: "setScore"; questionId: string; value: string }
  | { type: "setReason"; questionId: string; value: string }
  | { type: "saved"; review: StaffReview }
  | { type: "dismissConflict" };

/** Points of the ticked criteria, clamped into [0, maxPoints] and rounded to 2 decimals. */
export function tallyScore(criteria: Criterion[], selected: readonly string[], maxPoints: number): number {
  const ticked = new Set(selected);
  let sum = 0;
  for (const c of criteria) if (ticked.has(c.id)) sum += c.points;
  const clamped = Math.min(Math.max(sum, 0), maxPoints);
  return Math.round(clamped * 100) / 100;
}

/** Score text for a field: integers stay integers, halves keep one decimal. */
export function scoreText(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

export function criteriaFor(criteria: Criterion[], questionId: string): Criterion[] {
  return criteria.filter((c) => c.question_id === questionId);
}

function emptyDraft(): QuestionDraft {
  return { score: "", reason: "", tally: [] };
}

function draftsFrom(questions: Question[], saved: Record<string, ReviewQuestion>): Record<string, QuestionDraft> {
  const drafts: Record<string, QuestionDraft> = {};
  for (const q of questions) {
    const existing = saved[q.id];
    drafts[q.id] = existing
      ? { score: scoreText(existing.score), reason: existing.reason, tally: [] }
      : emptyDraft();
  }
  return drafts;
}

/** Question ids whose saved score or reason differs between two server maps. */
export function changedQuestions(
  before: Record<string, ReviewQuestion>,
  after: Record<string, ReviewQuestion>,
): string[] {
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const id of ids) {
    const a = before[id];
    const b = after[id];
    if (!a || !b) {
      changed.push(id);
      continue;
    }
    if (a.score !== b.score || a.reason !== b.reason) changed.push(id);
  }
  return changed.sort();
}

export function initialReviewState(submission: StaffSubmission, questions: Question[]): ReviewState {
  return {
    submissionId: submission.id,
    revision: submission.review.revision,
    status: submission.review.status,
    saved: { ...submission.review.questions },
    drafts: draftsFrom(questions, submission.review.questions),
    conflict: null,
  };
}

export function reviewReducer(state: ReviewState, action: ReviewAction): ReviewState {
  switch (action.type) {
    case "load":
      return initialReviewState(action.submission, action.questions);

    case "reload": {
      // A stale-revision reload: keep what the reviewer typed, take the server's revision and
      // saved map, and name the questions that moved so the UI can explain the conflict.
      const next = action.submission.review;
      const changed = changedQuestions(state.saved, next.questions);
      const drafts: Record<string, QuestionDraft> = {};
      for (const q of action.questions) {
        const mine = state.drafts[q.id] ?? emptyDraft();
        const untouched = mine.score === "" && mine.reason === "" && mine.tally.length === 0;
        const theirs = next.questions[q.id];
        drafts[q.id] = untouched && theirs ? { score: scoreText(theirs.score), reason: theirs.reason, tally: [] } : mine;
      }
      // After a 409 the save did not land, so the reviewer is always told, even when the other
      // reviewer happened to write the same values and nothing visibly changed.
      const conflict =
        action.afterConflict || changed.length > 0 ? { changed, revision: next.revision } : state.conflict;
      return {
        submissionId: action.submission.id,
        revision: next.revision,
        status: next.status,
        saved: { ...next.questions },
        drafts,
        conflict,
      };
    }

    case "toggleCriterion": {
      const draft = state.drafts[action.questionId] ?? emptyDraft();
      const tally = draft.tally.includes(action.criterionId)
        ? draft.tally.filter((id) => id !== action.criterionId)
        : [...draft.tally, action.criterionId];
      const filled = tallyScore(action.criteria, tally, action.maxPoints);
      return {
        ...state,
        drafts: { ...state.drafts, [action.questionId]: { ...draft, tally, score: scoreText(filled) } },
      };
    }

    case "fillFromSuggestion": {
      const draft = state.drafts[action.questionId] ?? emptyDraft();
      const tally = action.criteria.filter((c) => action.metIds.includes(c.id)).map((c) => c.id);
      const filled = tallyScore(action.criteria, tally, action.maxPoints);
      return {
        ...state,
        drafts: { ...state.drafts, [action.questionId]: { ...draft, tally, score: scoreText(filled) } },
      };
    }

    case "setScore": {
      const draft = state.drafts[action.questionId] ?? emptyDraft();
      // A manually entered score is no longer represented by the local criterion tally.
      return { ...state, drafts: { ...state.drafts, [action.questionId]: { ...draft, score: action.value, tally: [] } } };
    }

    case "setReason": {
      const draft = state.drafts[action.questionId] ?? emptyDraft();
      return { ...state, drafts: { ...state.drafts, [action.questionId]: { ...draft, reason: action.value } } };
    }

    case "saved":
      return {
        ...state,
        revision: action.review.revision,
        status: action.review.status,
        saved: { ...action.review.questions },
        conflict: null,
      };

    case "dismissConflict":
      return { ...state, conflict: null };

    default:
      return state;
  }
}

/**
 * The payload for PUT /review: every question the server already holds, plus the one being
 * saved. `expected_revision` already guards against clobbering another reviewer's work.
 */
export function buildSavePayload(
  saved: Record<string, ReviewQuestion>,
  questionId: string,
  draft: QuestionDraft,
): Record<string, ReviewQuestion> {
  const payload: Record<string, ReviewQuestion> = {};
  for (const [id, q] of Object.entries(saved)) payload[id] = { score: q.score, reason: q.reason };
  payload[questionId] = { score: Number(draft.score), reason: draft.reason.trim() };
  return payload;
}

export interface DraftValidity {
  ok: boolean;
  score: string | null;
  reason: string | null;
}

export function validateDraft(draft: QuestionDraft, maxPoints: number): DraftValidity {
  let score: string | null = null;
  const trimmed = draft.score.trim();
  if (trimmed === "") score = "Enter a score";
  else {
    const value = Number(trimmed);
    if (!Number.isFinite(value)) score = "Enter a number";
    else if (value < 0) score = "Score cannot be negative";
    else if (value > maxPoints) score = `Score cannot be above ${maxPoints}`;
  }
  const reason = draft.reason.trim().length === 0 ? "Write a reason. It stays private to staff" : null;
  return { ok: score === null && reason === null, score, reason };
}

/** "Q1", "Q1 and Q2", "Q1, Q3 and Q4" */
export function listLabels(labels: string[]): string {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export function questionLabel(questions: Question[], questionId: string): string {
  const index = questions.findIndex((q) => q.id === questionId);
  return index < 0 ? questionId : `Q${index + 1}`;
}

export interface CompleteGate {
  enabled: boolean;
  /** why the button is disabled, for the title attribute; null when it is enabled */
  reason: string | null;
}

/** Completion needs every question saved and no assessment job queued or running. */
export function completeGate(input: {
  status: ReviewStatus;
  questions: Question[];
  saved: Record<string, ReviewQuestion>;
  job: Job | null;
}): CompleteGate {
  if (input.status === "released") return { enabled: false, reason: "Scores are already released" };
  if (input.status === "completed") return { enabled: false, reason: "This review is already complete" };
  if (input.job && (input.job.status === "queued" || input.job.status === "running"))
    return { enabled: false, reason: "Wait for the automated assessment to finish" };
  const missing = input.questions.filter((q) => !(q.id in input.saved));
  if (missing.length > 0) {
    const labels = missing.map((q) => questionLabel(input.questions, q.id));
    return { enabled: false, reason: `Save ${listLabels(labels)} first` };
  }
  if (input.questions.length === 0) return { enabled: false, reason: "This assignment has no questions" };
  return { enabled: true, reason: null };
}

export function progressSentence(questions: Question[], saved: Record<string, ReviewQuestion>): string {
  const count = questions.filter((q) => q.id in saved).length;
  return `${count} of ${questions.length} questions saved`;
}

/** The human total across saved questions, or null when nothing is saved yet. */
export function savedTotal(saved: Record<string, ReviewQuestion>): number | null {
  const values = Object.values(saved);
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, q) => sum + q.score, 0) * 100) / 100;
}

export const STALE_CONFLICT_CODE = "stale_review_reload";

export function conflictSentence(questions: Question[], conflict: ConflictInfo): string {
  const labels = conflict.changed.map((id) => questionLabel(questions, id));
  const what = labels.length > 0 ? ` ${listLabels(labels)} changed.` : "";
  return `Someone else saved this review.${what} Your unsaved changes are kept in the fields; compare and save again.`;
}
