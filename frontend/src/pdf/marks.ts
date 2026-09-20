export type MarkTone = "deduction" | "hint" | "credit";

export interface Mark {
  /** stable across renders; key with submission/question/flag/anchor ids */
  id: string;
  /** 1-based, matching the backend's anchor pages */
  page: number;
  /** normalized [left, top, right, bottom], origin top-left; null when only the page is known */
  bbox: [number, number, number, number] | null;
  /** the number shown in the pin, matched to the numbered chip in the panel */
  label: string | number;
  tone: MarkTone;
  selected?: boolean;
  /** Student-safe feedback displayed in the linked annotation card. */
  message?: string;
  title?: string;
}

/** Groups marks by page once, so each page renders only its own pins. */
export function marksByPage(marks: Mark[]): Map<number, Mark[]> {
  const grouped = new Map<number, Mark[]>();
  for (const mark of marks) {
    const list = grouped.get(mark.page);
    if (list) list.push(mark);
    else grouped.set(mark.page, [mark]);
  }
  return grouped;
}

/** True when a bbox is usable: four finite numbers in 0..1 with a positive area.
 *  Anything else falls back to the gutter pin rather than inventing a coordinate. */
export function isUsableBbox(bbox: Mark["bbox"]): bbox is [number, number, number, number] {
  if (!bbox || bbox.length !== 4) return false;
  const [left, top, right, bottom] = bbox;
  if (![left, top, right, bottom].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) return false;
  return right > left && bottom > top;
}
