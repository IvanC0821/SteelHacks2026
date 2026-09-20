// The grading keyboard map. One table drives both the handler and the ? popover,
// so the documented shortcut and the live one cannot drift apart.

export type KeyCommand =
  | { kind: "criterion"; index: number }
  | { kind: "prevQuestion" }
  | { kind: "nextQuestion" }
  | { kind: "prevPaper" }
  | { kind: "nextPaper" }
  | { kind: "save" }
  | { kind: "hideMarks" }
  | { kind: "help" }
  | { kind: "closeHelp" };

export interface KeyRow {
  keys: string[];
  label: string;
}

export const KEY_ROWS: KeyRow[] = [
  { keys: ["1", "…", "9"], label: "Toggle the nth criterion of this question" },
  { keys: ["["], label: "Previous question" },
  { keys: ["]"], label: "Next question" },
  { keys: ["k"], label: "Previous paper" },
  { keys: ["j"], label: "Next paper" },
  { keys: ["⌘", "Enter"], label: "Save and next" },
  { keys: ["h"], label: "Hide marks" },
  { keys: ["?"], label: "This list" },
];

export interface KeyEventLike {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export interface KeyContext {
  /** the event started in an input, textarea or contenteditable */
  inField: boolean;
  /** the help popover is open */
  helpOpen: boolean;
}

/**
 * Typing wins: inside a field only ⌘/Ctrl+Enter and Escape do anything, so Enter in the
 * reason textarea inserts a newline instead of submitting.
 */
export function matchKey(event: KeyEventLike, context: KeyContext): KeyCommand | null {
  const mod = event.metaKey || event.ctrlKey;
  if (event.key === "Enter" && mod) return { kind: "save" };
  if (event.key === "Escape") return context.helpOpen ? { kind: "closeHelp" } : null;
  if (context.inField) return null;
  if (mod || event.altKey) return null;
  if (event.key >= "1" && event.key <= "9") return { kind: "criterion", index: Number(event.key) - 1 };
  switch (event.key) {
    case "[":
      return { kind: "prevQuestion" };
    case "]":
      return { kind: "nextQuestion" };
    case "k":
      return { kind: "prevPaper" };
    case "j":
      return { kind: "nextPaper" };
    case "h":
      return { kind: "hideMarks" };
    case "?":
      return { kind: "help" };
    default:
      return null;
  }
}

export function isFieldTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}
