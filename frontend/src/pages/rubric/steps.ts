// The guided card an assignment shows before it has a rubric: three steps, each either done or
// the next thing to do. Derived from the assignment, never from a stored wizard position.

import type { AssignmentDetail } from "../../api/types";
import { latestOfKind } from "./documents";

export type StepId = "solution" | "draft" | "publish";

export interface SetupStep {
  id: StepId;
  title: string;
  sentence: string;
  action: string;
  done: boolean;
  /** the first step that is not done */
  current: boolean;
}

export function setupSteps(assignment: AssignmentDetail): SetupStep[] {
  const documents = assignment.documents ?? [];
  const hasSolution = latestOfKind(documents, "solution") !== null;
  const hasDraft = (assignment.rubric_draft?.criteria.length ?? 0) > 0;
  const published = (assignment.rubrics?.length ?? 0) > 0;
  const done: Record<StepId, boolean> = { solution: hasSolution, draft: hasDraft, publish: published };

  const steps: Array<Omit<SetupStep, "done" | "current">> = [
    {
      id: "solution",
      title: "Add the instructor solution",
      sentence: "The solution stays private to staff and gives the rubric something to read.",
      action: "Open setup",
    },
    {
      id: "draft",
      title: "Write or generate the rubric",
      sentence: "Every question needs criteria whose points add up to its total.",
      action: "Start the draft",
    },
    {
      id: "publish",
      title: "Publish",
      sentence: "Students see the assignment once the first rubric is published.",
      action: "Publish rubric",
    },
  ];

  const firstOpen = steps.find((step) => !done[step.id])?.id;
  return steps.map((step) => ({ ...step, done: done[step.id], current: step.id === firstOpen }));
}

/** True when the studio should lead with the guided card instead of the editor. */
export function needsGuidedStart(assignment: AssignmentDetail): boolean {
  const documents = assignment.documents ?? [];
  const hasDraft = (assignment.rubric_draft?.criteria.length ?? 0) > 0;
  return documents.length === 0 && !hasDraft;
}
