// Page mapping for a student attempt: which pages hold which question.
// Internally pages are 0-based indices matching the thumbnail array; the API payload is 1-based.
// A page may belong to several questions and a question may span pages.

import type { PageMapping, Question } from "../../../api/types";

/** questionId -> sorted 0-based page indices */
export type PageSelection = Record<string, number[]>;

export function emptySelection(questions: Question[]): PageSelection {
  const out: PageSelection = {};
  for (const q of questions) out[q.id] = [];
  return out;
}

/** Server mapping (1-based) -> selection (0-based). Unknown questions and out-of-range pages drop. */
export function selectionFromMapping(
  mapping: PageMapping | null | undefined,
  questions: Question[],
  pageCount: number,
): PageSelection {
  const out = emptySelection(questions);
  if (!mapping) return out;
  for (const q of questions) {
    const pages = mapping[q.id];
    if (!Array.isArray(pages)) continue;
    const seen = new Set<number>();
    for (const page of pages) {
      if (!Number.isInteger(page) || page < 1 || page > pageCount) continue;
      seen.add(page - 1);
    }
    out[q.id] = [...seen].sort((a, b) => a - b);
  }
  return out;
}

/** Add the page to the question, or remove it when it is already there. Returns a new selection. */
export function togglePage(selection: PageSelection, questionId: string, page: number): PageSelection {
  const current = selection[questionId] ?? [];
  const next = current.includes(page)
    ? current.filter((p) => p !== page)
    : [...current, page].sort((a, b) => a - b);
  return { ...selection, [questionId]: next };
}

export function pagesFor(selection: PageSelection, questionId: string): number[] {
  return selection[questionId] ?? [];
}

/** Every question that claims this page, in the assignment's question order. */
export function questionsOnPage(selection: PageSelection, questions: Question[], page: number): Question[] {
  return questions.filter((q) => (selection[q.id] ?? []).includes(page));
}

export interface Completeness {
  mapped: number;
  total: number;
  complete: boolean;
  /** question ids with no page yet, in question order */
  missing: string[];
  /** "3 of 4 questions have pages" */
  sentence: string;
}

export function completeness(selection: PageSelection, questions: Question[]): Completeness {
  const missing = questions.filter((q) => (selection[q.id] ?? []).length === 0).map((q) => q.id);
  const total = questions.length;
  const mapped = total - missing.length;
  return {
    mapped,
    total,
    complete: total > 0 && missing.length === 0,
    missing,
    sentence: `${mapped} of ${total} ${total === 1 ? "question has" : "questions have"} pages`,
  };
}

/** The PUT /mapping payload: every question, 1-based ascending page numbers. */
export function mappingPayload(selection: PageSelection, questions: Question[]): PageMapping {
  const out: PageMapping = {};
  for (const q of questions) {
    out[q.id] = [...(selection[q.id] ?? [])].sort((a, b) => a - b).map((p) => p + 1);
  }
  return out;
}

/** The backend rejects a partial mapping (422 map_every_question), so saving needs every question. */
export function saveBlockedReason(selection: PageSelection, questions: Question[]): string | null {
  const state = completeness(selection, questions);
  if (state.complete) return null;
  return "Give every question at least one page first";
}
