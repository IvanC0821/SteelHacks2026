// Due dates travel as ISO strings with an explicit timezone offset; the backend rejects a naive
// datetime ("due_at needs a timezone"). The offset comes from the browser unless a caller passes
// one, which keeps the tests independent of the machine's zone.

/** Minutes east of UTC for `at` in the browser's zone (New York in summer is -240). */
export function localOffsetMinutes(at: Date = new Date()): number {
  return -at.getTimezoneOffset();
}

/** "+05:30", "-04:00", "+00:00". */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const total = Math.abs(Math.trunc(minutes));
  return `${sign}${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^(\d{2}):(\d{2})$/;

/**
 * Builds the `due_at` value from the two form fields. Returns null when there is no date (the
 * field is optional) and throws nothing: an unparseable pair is treated as "no due date" by the
 * caller, which validates first with `dueDateError`.
 */
export function toDueAtIso(date: string, time: string, offsetMinutes?: number): string | null {
  const day = DATE.exec(date.trim());
  if (!day) return null;
  const clock = TIME.exec((time || "23:59").trim());
  if (!clock) return null;
  const [, year, month, dayOfMonth] = day;
  const [, hour, minute] = clock;
  const offset =
    offsetMinutes ??
    localOffsetMinutes(new Date(Number(year), Number(month) - 1, Number(dayOfMonth), Number(hour), Number(minute)));
  return `${year}-${month}-${dayOfMonth}T${hour}:${minute}:00${formatOffset(offset)}`;
}

/** A one-sentence problem with the two fields, or null when they are fine (both may be empty). */
export function dueDateError(date: string, time: string): string | null {
  const hasDate = date.trim() !== "";
  const hasTime = time.trim() !== "";
  if (!hasDate && !hasTime) return null;
  if (!hasDate) return "Add a date for the time you entered";
  if (!DATE.test(date.trim())) return "Use a date in the form 2026-09-24";
  if (hasTime && !TIME.test(time.trim())) return "Use a 24-hour time in the form 23:59";
  const [year, month, day] = date.trim().split("-").map(Number);
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return "That date does not exist";
  }
  return null;
}

/** Reads an ISO due date back into the two local form fields. */
export function fromDueAtIso(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return { date: "", time: "" };
  return {
    date: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    time: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  };
}
