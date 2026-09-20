import type { FlagCategory, QuestionAssessment, StudentSubmission } from "../../../api/types";

export function needsAttention(question: QuestionAssessment): boolean {
  return question.flags.length > 0 || question.score === null || question.status === "needs_review";
}

export interface QuestionChange {
  questionId: string;
  still: FlagCategory[];
  added: FlagCategory[];
  absent: FlagCategory[];
  uncertain: boolean;
}

/** Compare categories, not generated flag IDs. A missing flag is not proof of a corrected answer.
 * Different rubric versions or incomplete checks do not support a like-for-like comparison. */
type CheckedAttempt = Pick<StudentSubmission, "rubric_id" | "assignment_id" | "student_id" | "version" | "assessment">;

export function compareFeedback(current: CheckedAttempt, previous: CheckedAttempt): QuestionChange[] | null {
  if (!current.rubric_id || current.rubric_id !== previous.rubric_id ||
      current.assignment_id !== previous.assignment_id || current.student_id !== previous.student_id ||
      current.version <= previous.version || !current.assessment || !previous.assessment) return null;
  if (current.assessment.provider_id !== previous.assessment.provider_id ||
      current.assessment.mode !== previous.assessment.mode) return null;
  const before = previous.assessment.questions;
  const after = current.assessment.questions;
  if (before.length !== after.length || after.some((q) =>
    !before.some((old) => old.question_id === q.question_id && old.max_points === q.max_points))) return null;
  return after.map((question) => {
    const old = before.find((q) => q.question_id === question.question_id)!;
    const prior = new Set(old.flags.map((flag) => flag.category));
    const latest = new Set(question.flags.map((flag) => flag.category));
    const uncertain = question.score === null || old.score === null ||
      question.status === "needs_review" || old.status === "needs_review";
    return {
      questionId: question.question_id,
      still: [...latest].filter((category) => prior.has(category)),
      added: [...latest].filter((category) => !prior.has(category)),
      // An unreadable answer can lose all its flags without having improved.
      absent: uncertain ? [] : [...prior].filter((category) => !latest.has(category)),
      uncertain,
    };
  });
}
