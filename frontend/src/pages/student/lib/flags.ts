// Flag numbering. Every flag on the paper gets one number, counted across all questions in
// reading order (page first, then the order the backend returned it), so the numbered chip in
// the panel and the numbered pin on the page always say the same thing.

import type { Anchor, Flag, Question, StudentAssessment } from "../../../api/types";
import { flagLabel } from "../../../components";

export interface NumberedFlag {
  /** 1-based, unique across the whole paper */
  number: number;
  questionId: string;
  questionTitle: string;
  flag: Flag;
  /** the first page this flag touches, 1-based */
  page: number;
  anchors: Anchor[];
  /** the shared reader-facing word for the category, so the paper and the panel agree */
  categoryLabel: string;
}

function firstPage(flag: Flag): number {
  const pages = flag.anchors.map((a) => a.page).filter((p) => Number.isFinite(p));
  return pages.length ? Math.min(...pages) : Number.MAX_SAFE_INTEGER;
}

/**
 * Number every flag in the assessment. Questions are walked in the assignment's order when it is
 * given, then each question's flags in backend order; that sequence breaks ties between flags that
 * start on the same page.
 */
export function numberFlags(
  assessment: StudentAssessment | null | undefined,
  questions: Question[] = [],
): NumberedFlag[] {
  if (!assessment) return [];
  const order = new Map(questions.map((q, i) => [q.id, i]));
  const titles = new Map(questions.map((q) => [q.id, q.title]));
  const rows = [...assessment.questions]
    .sort((a, b) => (order.get(a.question_id) ?? 0) - (order.get(b.question_id) ?? 0))
    .flatMap((question) =>
      question.flags.map((flag) => ({
        questionId: question.question_id,
        questionTitle: titles.get(question.question_id) ?? question.question_id,
        flag,
        page: firstPage(flag),
      })),
    )
    .map((row, sequence) => ({ ...row, sequence }));

  return rows
    .sort((a, b) => a.page - b.page || a.sequence - b.sequence)
    .map((row, index) => ({
      number: index + 1,
      questionId: row.questionId,
      questionTitle: row.questionTitle,
      flag: row.flag,
      page: row.page,
      anchors: row.flag.anchors,
      categoryLabel: flagLabel(row.flag.category),
    }));
}

export interface FlagMark {
  id: string;
  page: number;
  bbox: [number, number, number, number] | null;
  label: number;
  tone: "hint";
  selected?: boolean;
  message: string;
  title: string;
}

/** One viewer mark per anchor. Extraction is page-level today, so bbox is usually null: the
 *  viewer then draws the numbered circle in that page's gutter instead of inventing a region.
 *  Every student mark is hint-toned: a practice finding is not a deduction and must not read
 *  as points already lost. */
export function flagMarks(flags: NumberedFlag[], selectedFlagId?: string | null): FlagMark[] {
  return flags.flatMap((entry) =>
    entry.anchors.map((anchor) => ({
      id: markId(entry, anchor),
      page: anchor.page,
      bbox: anchor.bbox,
      label: entry.number,
      message: entry.flag.message,
      title: entry.categoryLabel,
      tone: "hint" as const,
      selected: selectedFlagId === entry.flag.id,
    })),
  );
}

export function markId(entry: Pick<NumberedFlag, "questionId" | "flag">, anchor: Anchor): string {
  return `${entry.questionId}:${entry.flag.id}:${anchor.id}`;
}

export function flagIdFromMark(markKey: string): string {
  const parts = markKey.split(":");
  return parts.length >= 2 ? parts[1] : markKey;
}

/** Flags belonging to one question, keeping the paper-wide numbers. */
export function flagsForQuestion(flags: NumberedFlag[], questionId: string): NumberedFlag[] {
  return flags.filter((f) => f.questionId === questionId);
}
