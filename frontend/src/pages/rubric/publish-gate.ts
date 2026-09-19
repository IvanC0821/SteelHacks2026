// Why Publish rubric is disabled. Every reason mirrors a check the API makes in
// `validate_rubric` / `publish_rubric`, so the button is never disabled for a reason the server
// would not also give, and never enabled into a 422.

import type { DocumentMeta, Question, Role, Rubric, RubricInput } from "../../api/types";
import { CRITERION_ID_PATTERN, canonical, pointsAssigned } from "./draft";

export interface PublishGateInput {
  questions: Question[];
  /** the draft as it would be sent, including unsaved edits */
  draft: RubricInput | null;
  /** true when the editor holds edits the server has not confirmed */
  dirty: boolean;
  /** published versions, latest last */
  rubrics: Rubric[];
  /** every reference document on the assignment (the API attaches all of them) */
  documents: DocumentMeta[];
  role: Role;
}

/** The reference IDs the API would attach: every non-submission document, in store order. */
export function referenceIds(documents: DocumentMeta[]): string[] {
  return documents.filter((d) => d.kind !== "submission").map((d) => d.id);
}

function sameReferences(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
}

/**
 * What `PUT /rubric-draft` would refuse: the API validates the draft on save as strictly as on
 * publish, so an unbalanced draft cannot be stored at all and autosave must hold off.
 */
export function saveBlockers(questions: Question[], draft: RubricInput | null): string[] {
  const reasons: string[] = [];
  if (!draft || draft.criteria.length === 0) return ["Add at least one criterion"];

  const known = new Set(questions.map((q) => q.id));
  const uncovered = questions.filter((q) => !draft.criteria.some((c) => c.question_id === q.id));
  if (uncovered.length > 0) {
    reasons.push(`Add a criterion to ${uncovered.map((q) => q.title).join(", ")}`);
  }
  const stray = draft.criteria.filter((c) => !known.has(c.question_id));
  if (stray.length > 0) {
    reasons.push(`Remove ${stray.length} criteri${stray.length === 1 ? "on" : "a"} pointing at a question that no longer exists`);
  }

  const ids = draft.criteria.map((c) => c.id);
  if (new Set(ids).size !== ids.length) reasons.push("Two criteria share an ID");
  if (ids.some((id) => !CRITERION_ID_PATTERN.test(id))) reasons.push("A criterion ID uses characters the API rejects");

  if (draft.criteria.some((c) => c.description.trim() === "")) {
    reasons.push("Every criterion needs a description");
  }
  if (draft.criteria.some((c) => !Number.isFinite(c.points) || c.points <= 0)) {
    reasons.push("Criterion points must be more than 0");
  }

  const off = questions.filter((q) => {
    const assigned = pointsAssigned(draft.criteria, q.id);
    return draft.criteria.some((c) => c.question_id === q.id) && Math.abs(assigned - q.max_points) > 1e-8;
  });
  off.forEach((q) => {
    const assigned = pointsAssigned(draft.criteria, q.id);
    reasons.push(`${q.title} has ${formatPoints(assigned)} of ${formatPoints(q.max_points)} points assigned`);
  });

  return reasons;
}

/**
 * One sentence per blocker, in the order an instructor would fix them. Empty means publishable.
 */
export function publishBlockers(input: PublishGateInput): string[] {
  const { questions, draft, dirty, rubrics, documents, role } = input;

  if (role !== "instructor") return ["Only the instructor can publish a rubric"];

  const reasons = saveBlockers(questions, draft);
  if (dirty) reasons.push("Save the draft first");

  const latest = rubrics.length > 0 ? rubrics[rubrics.length - 1] : null;
  if (
    !dirty &&
    reasons.length === 0 &&
    latest &&
    canonical(latest) === canonical(draft) &&
    sameReferences(latest.reference_ids, referenceIds(documents))
  ) {
    reasons.push(`Nothing has changed since Rubric v${latest.version}`);
  }

  return reasons;
}

/** The `title` on the disabled button: every reason, one sentence each. */
export function publishGateTitle(reasons: string[]): string | undefined {
  if (reasons.length === 0) return undefined;
  return reasons.join(". ");
}

/** What the next publish would be called. */
export function nextVersionLabel(rubrics: Rubric[]): string {
  return `Rubric v${rubrics.length + 1}`;
}
