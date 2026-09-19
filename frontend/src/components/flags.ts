import type { FlagCategory } from "../api/types";
import type { MarkTone } from "../pdf/marks";

/** The reader-facing word for a flag category. Sentence case, no terminal period. */
export const FLAG_LABEL: Record<FlagCategory, string> = {
  arithmetic: "Arithmetic",
  logic: "Logic",
  notation: "Notation",
  presentation: "Presentation",
  justification: "Justification",
  unsupported_method: "Unsupported method",
  unreadable: "Unreadable",
  needs_review: "Needs review",
};

/** The shared category-to-ink mapping, so a finding is the same colour on the paper and in the
 *  panel and across the grading and student views. Categories that cost points read as deduction
 *  red; the rest are hints. A flag is never the only signal: the category word is always shown. */
export const FLAG_TONE: Record<FlagCategory, MarkTone> = {
  arithmetic: "deduction",
  logic: "deduction",
  unsupported_method: "deduction",
  notation: "hint",
  presentation: "hint",
  justification: "hint",
  unreadable: "hint",
  needs_review: "hint",
};

export function flagLabel(category: FlagCategory): string {
  return FLAG_LABEL[category] ?? "Finding";
}

export function flagTone(category: FlagCategory): MarkTone {
  return FLAG_TONE[category] ?? "hint";
}
