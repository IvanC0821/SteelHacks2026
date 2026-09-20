// Reading the automated assessment as a suggestion: per-question slices, criterion decisions,
// and the marks handed to the viewer. Nothing here computes a grade.

import type { Category, Criterion, Decision, Flag, QuestionAssessment, StaffAssessment } from "../../api/types";
import { flagLabel, flagTone } from "../../components";
import type { Mark, MarkTone } from "../../pdf";

export function questionAssessment(
  assessment: StaffAssessment | null,
  questionId: string,
): QuestionAssessment | null {
  if (!assessment) return null;
  return assessment.questions.find((q) => q.question_id === questionId) ?? null;
}

export function decisionMap(assessment: StaffAssessment | null): Map<string, Decision> {
  const map = new Map<string, Decision>();
  if (!assessment) return map;
  for (const decision of assessment.decisions) map.set(decision.criterion_id, decision);
  return map;
}

/** Criterion ids the automated pass called met, in rubric order. */
export function suggestedMetIds(criteria: Criterion[], decisions: Map<string, Decision>): string[] {
  return criteria.filter((c) => decisions.get(c.id)?.outcome === "met").map((c) => c.id);
}

export const OUTCOME_LABEL: Record<Decision["outcome"], string> = {
  met: "Met",
  not_met: "Not met",
  uncertain: "Uncertain",
};

/** The shared word and ink for a category, so the pin on the paper and the chip in the panel
 *  always agree with the student view. Task 1 owns the mapping. */
export function categoryLabel(category: Category | Flag["category"]): string {
  return flagLabel(category);
}

/**
 * On the grading screen every flag is a reason the human may take points off, so the pin and the
 * chip are both deduction ink (task 02). `flagTone` stays the shared default for the student view,
 * where a notation nudge is a hint rather than a deduction.
 */
export function categoryTone(_category: Category | Flag["category"]): MarkTone {
  return "deduction";
}

/** What the student view would use for the same category, kept so the two never silently drift. */
export const sharedCategoryTone = flagTone;

/**
 * One mark per anchor, numbered from 1 in the order of `flags[]` so the pin on the paper and the
 * chip in the panel carry the same number and the same ink. Measured regions target cited text;
 * when no region is available, the viewer places the pin in the page gutter.
 */
export function marksForQuestion(
  submissionId: string,
  questionId: string,
  flags: Flag[],
  selectedFlagId: string | null,
): Mark[] {
  const marks: Mark[] = [];
  flags.forEach((flag, index) => {
    for (const anchor of flag.anchors) {
      marks.push({
        id: `${submissionId}:${questionId}:${flag.id}:${anchor.id}`,
        page: anchor.page,
        bbox: anchor.bbox,
        label: index + 1,
        message: flag.message,
        title: categoryLabel(flag.category),
        tone: categoryTone(flag.category),
        selected: flag.id === selectedFlagId,
      });
    }
  });
  return marks;
}

/** The flag id inside a mark id built by marksForQuestion. */
export function flagIdFromMark(markId: string): string | null {
  const parts = markId.split(":");
  return parts.length === 4 ? parts[2] : null;
}

/** First mapped page for a question, 1-based; null when the student mapped nothing. */
export function firstMappedPage(mapping: Record<string, number[]> | null, questionId: string): number | null {
  const pages = mapping?.[questionId];
  return pages && pages.length > 0 ? pages[0] : null;
}

export function pagesSentence(mapping: Record<string, number[]> | null, questionId: string): string | null {
  const pages = mapping?.[questionId];
  if (!pages || pages.length === 0) return null;
  return pages.length === 1 ? `Page ${pages[0]}` : `Pages ${pages.join(", ")}`;
}
