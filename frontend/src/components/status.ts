// Assessment state derivation. Kept out of StatusChip.tsx so that file only exports a component.

/** The assessment side of the status pair. `null` means the student has not checked their work. */
export type AssessmentState = "not_checked" | "estimated" | "needs_review";

/** Derived once so every screen agrees: a missing assessment is "Not checked", never a zero. */
export function assessmentState(assessment: { status: "estimated" | "needs_review" } | null): AssessmentState {
  if (!assessment) return "not_checked";
  return assessment.status;
}
