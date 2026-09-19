// PUT /api/assignments/{id}/rubric-draft answers with {draft, revision}; `client.saveRubricDraft`
// is typed as the assignment detail. Normalize both shapes here rather than guessing at the call
// site, and keep the assignment's own revision counter honest.

import type { VerityClient } from "../../api/client";
import type { AssignmentDetail, Rubric, RubricInput } from "../../api/types";

export interface SavedDraft {
  draft: RubricInput;
  revision: number;
}

/** Reads {draft, revision} out of whatever the endpoint returned. */
export function readSaveResponse(response: unknown, sent: RubricInput, previousRevision: number): SavedDraft {
  const body = (response ?? {}) as Partial<AssignmentDetail> & Partial<{ draft: RubricInput; revision: number }>;
  const draft = body.draft ?? body.rubric_draft ?? sent;
  const revision = body.revision ?? body.draft_revision ?? previousRevision + 1;
  return { draft, revision };
}

export async function saveDraft(
  client: VerityClient,
  assignmentId: string,
  input: RubricInput,
  previousRevision: number,
): Promise<SavedDraft> {
  const response = await client.saveRubricDraft(assignmentId, input);
  return readSaveResponse(response, input, previousRevision);
}

/** "Rubric v1 published 2:14 pm" */
export function versionLine(rubric: Rubric): string {
  return `Rubric v${rubric.version} published ${publishedTime(rubric.published_at)}`;
}

export function publishedTime(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "at an unknown time";
  return at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

export function publishedDate(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** "13 criteria across 4 questions" for the version popover. */
export function versionSummary(rubric: Rubric): string {
  const questions = new Set(rubric.criteria.map((c) => c.question_id)).size;
  const criteria = rubric.criteria.length;
  return `${criteria} criteri${criteria === 1 ? "on" : "a"} across ${questions} question${questions === 1 ? "" : "s"}`;
}
