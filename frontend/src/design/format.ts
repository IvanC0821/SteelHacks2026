// Shared formatting so every screen writes a date the same way. Sentence case, no middle dots.

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const DATE_YEAR = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Due Sep 24, 4:53 PM", or "No due date" when the assignment has none.
 *  The year appears only when it is not the current one. */
export function formatDue(iso: string | null | undefined, now = new Date()): string {
  const date = parse(iso);
  if (!date) return "No due date";
  const sameYear = date.getFullYear() === now.getFullYear();
  return `Due ${(sameYear ? DATE : DATE_YEAR).format(date)}, ${TIME.format(date)}`;
}

/** "Sep 19, 5:53 PM" for a timestamp; empty string when there is nothing to show. */
export function formatTime(iso: string | null | undefined, now = new Date()): string {
  const date = parse(iso);
  if (!date) return "";
  const sameYear = date.getFullYear() === now.getFullYear();
  return `${(sameYear ? DATE : DATE_YEAR).format(date)}, ${TIME.format(date)}`;
}

/** "Sep 19" for a date without a clock. */
export function formatDate(iso: string | null | undefined, now = new Date()): string {
  const date = parse(iso);
  if (!date) return "";
  const sameYear = date.getFullYear() === now.getFullYear();
  return (sameYear ? DATE : DATE_YEAR).format(date);
}

/** True when the due date has passed, so uploads and hand-in are closed. */
export function isPastDue(iso: string | null | undefined, now = new Date()): boolean {
  const date = parse(iso);
  return date !== null && date.getTime() < now.getTime();
}
