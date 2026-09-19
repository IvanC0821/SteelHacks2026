// The rubric draft being edited. The server owns a `{criteria, instructor_notes}` document plus a
// revision counter; this reducer holds the edited copy, the last saved copy, and whether the two
// differ. Points are per question and must land exactly on the question's max_points.

import type { Category, Criterion, Question, RubricInput } from "../../api/types";

export const CATEGORIES: Category[] = [
  "arithmetic",
  "logic",
  "notation",
  "presentation",
  "justification",
  "unsupported_method",
  "unreadable",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  arithmetic: "Arithmetic",
  logic: "Logic",
  notation: "Notation",
  presentation: "Presentation",
  justification: "Justification",
  unsupported_method: "Unsupported method",
  unreadable: "Unreadable",
};

export const CRITERION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,60}$/;

export interface DraftState {
  criteria: Criterion[];
  instructorNotes: string;
  /** the draft as the server last confirmed it, or null when the assignment has no draft */
  saved: RubricInput | null;
  /** the server's draft_revision for the saved copy */
  revision: number;
  /** true when the current criteria came from a generated draft in this session */
  generated: boolean;
}

export type DraftAction =
  | { type: "load"; draft: RubricInput | null; revision: number; generated?: boolean }
  | { type: "add"; questionId: string; points: number }
  | { type: "update"; id: string; patch: Partial<Pick<Criterion, "description" | "points" | "category">> }
  | { type: "remove"; id: string }
  | { type: "notes"; value: string }
  | { type: "saved"; draft: RubricInput; revision: number }
  /** the draft has been published, so it is no longer an unreviewed generated draft */
  | { type: "reviewed" };

export function emptyDraft(): DraftState {
  return { criteria: [], instructorNotes: "", saved: null, revision: 0, generated: false };
}

export function stateFromAssignment(draft: RubricInput | null | undefined, revision = 0): DraftState {
  return {
    criteria: draft ? draft.criteria.map((c) => ({ ...c })) : [],
    instructorNotes: draft?.instructor_notes ?? "",
    saved: draft ? clone(draft) : null,
    revision,
    generated: false,
  };
}

function clone(draft: RubricInput): RubricInput {
  return { criteria: draft.criteria.map((c) => ({ ...c })), instructor_notes: draft.instructor_notes };
}

/** The payload for `client.saveRubricDraft`. */
export function toRubricInput(state: DraftState): RubricInput {
  return {
    criteria: state.criteria.map((c) => ({ ...c, description: c.description.trim() })),
    instructor_notes: state.instructorNotes,
  };
}

/** A stable string for comparing two drafts; criterion order is part of the document. */
export function canonical(draft: RubricInput | null): string {
  if (!draft) return "";
  return JSON.stringify({
    criteria: draft.criteria.map((c) => [c.id, c.question_id, c.description.trim(), c.points, c.category]),
    notes: draft.instructor_notes.trim(),
  });
}

/** Unsaved edits are pending. An assignment with no draft is clean until something is written. */
export function isDirty(state: DraftState): boolean {
  const current = toRubricInput(state);
  if (!state.saved) return current.criteria.length > 0 || current.instructor_notes.trim() !== "";
  return canonical(current) !== canonical(state.saved);
}

/** A unique criterion ID for a question: q1-c1, q1-c2, … */
export function newCriterionId(criteria: Criterion[], questionId: string): string {
  const taken = new Set(criteria.map((c) => c.id));
  const base = questionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 50) || "c";
  for (let n = 1; n < 1000; n += 1) {
    const id = `${base}-c${n}`;
    if (!taken.has(id)) return id;
  }
  return `${base}-${Date.now()}`;
}

export function criteriaFor(criteria: Criterion[], questionId: string): Criterion[] {
  return criteria.filter((c) => c.question_id === questionId);
}

export function pointsAssigned(criteria: Criterion[], questionId: string): number {
  const total = criteriaFor(criteria, questionId).reduce((sum, c) => sum + (Number.isFinite(c.points) ? c.points : 0), 0);
  return round(total);
}

export function pointsRemaining(criteria: Criterion[], question: Question): number {
  return round(question.max_points - pointsAssigned(criteria, question.id));
}

/** The backend compares with abs_tol 1e-8; two decimals is the finest the editor offers. */
export function pointsBalance(criteria: Criterion[], question: Question): "exact" | "under" | "over" {
  const remaining = pointsRemaining(criteria, question);
  if (Math.abs(remaining) < 1e-8) return "exact";
  return remaining > 0 ? "under" : "over";
}

function round(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "load":
      return { ...stateFromAssignment(action.draft, action.revision), generated: action.generated ?? false };
    case "add": {
      const criterion: Criterion = {
        id: newCriterionId(state.criteria, action.questionId),
        question_id: action.questionId,
        description: "",
        points: action.points,
        category: "logic",
      };
      // Keep a question's criteria together so the editor's per-question list stays in order;
      // a question with none yet appends at the end.
      const last = lastIndexFor(state.criteria, action.questionId);
      const criteria = [...state.criteria];
      criteria.splice(last < 0 ? criteria.length : last + 1, 0, criterion);
      return { ...state, criteria };
    }
    case "update": {
      let changed = false;
      const criteria = state.criteria.map((c) => {
        if (c.id !== action.id) return c;
        changed = true;
        return { ...c, ...action.patch };
      });
      return changed ? { ...state, criteria } : state;
    }
    case "remove": {
      const criteria = state.criteria.filter((c) => c.id !== action.id);
      return criteria.length === state.criteria.length ? state : { ...state, criteria };
    }
    case "notes":
      return state.instructorNotes === action.value ? state : { ...state, instructorNotes: action.value };
    case "saved":
      return { ...state, saved: clone(action.draft), revision: action.revision };
    case "reviewed":
      return state.generated ? { ...state, generated: false } : state;
    default:
      return state;
  }
}

function lastIndexFor(criteria: Criterion[], questionId: string): number {
  let index = -1;
  criteria.forEach((c, i) => {
    if (c.question_id === questionId) index = i;
  });
  return index;
}

/** The points a new criterion starts with: what is left on the question, else 1. */
export function suggestedPoints(criteria: Criterion[], question: Question): number {
  const remaining = pointsRemaining(criteria, question);
  return remaining > 0 ? remaining : 1;
}
