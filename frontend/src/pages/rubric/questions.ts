// The question-list editor on /c/:courseId/new. Rows keep their own stable key so reordering and
// removing never move an input's focus, and points stay a string while the field is being typed.

import type { Question } from "../../api/types";

export const QUESTION_ID_PATTERN = /^[a-zA-Z0-9_-]{1,40}$/;
export const MAX_QUESTIONS = 50;

export interface QuestionRow {
  /** stable across reorders; never sent to the API */
  key: string;
  id: string;
  title: string;
  prompt: string;
  /** kept as typed so "1." and "" survive a keystroke */
  points: string;
}

export interface QuestionsState {
  rows: QuestionRow[];
  /** monotonic source of row keys */
  seq: number;
}

export type QuestionsAction =
  | { type: "add" }
  | { type: "remove"; key: string }
  | { type: "move"; key: string; delta: number }
  | { type: "field"; key: string; field: "id" | "title" | "prompt" | "points"; value: string };

/** The next unused auto ID: q1, q2, … skipping any the instructor typed by hand. */
export function nextQuestionId(rows: QuestionRow[]): string {
  const taken = new Set(rows.map((row) => row.id.trim()));
  for (let n = 1; n <= MAX_QUESTIONS + rows.length + 1; n += 1) {
    if (!taken.has(`q${n}`)) return `q${n}`;
  }
  return `q${rows.length + 1}`;
}

export function emptyRow(state: QuestionsState): QuestionRow {
  return { key: `row-${state.seq}`, id: nextQuestionId(state.rows), title: "", prompt: "", points: "" };
}

export function initialQuestionsState(): QuestionsState {
  const seed: QuestionsState = { rows: [], seq: 0 };
  return questionsReducer(seed, { type: "add" });
}

export function questionsReducer(state: QuestionsState, action: QuestionsAction): QuestionsState {
  switch (action.type) {
    case "add": {
      if (state.rows.length >= MAX_QUESTIONS) return state;
      return { rows: [...state.rows, emptyRow(state)], seq: state.seq + 1 };
    }
    case "remove": {
      // An assignment needs at least one question, so the last row stays.
      if (state.rows.length <= 1) return state;
      const rows = state.rows.filter((row) => row.key !== action.key);
      return rows.length === state.rows.length ? state : { ...state, rows };
    }
    case "move": {
      const from = state.rows.findIndex((row) => row.key === action.key);
      if (from < 0) return state;
      const to = from + action.delta;
      if (to < 0 || to >= state.rows.length) return state;
      const rows = [...state.rows];
      const [row] = rows.splice(from, 1);
      rows.splice(to, 0, row);
      return { ...state, rows };
    }
    case "field": {
      let changed = false;
      const rows = state.rows.map((row) => {
        if (row.key !== action.key || row[action.field] === action.value) return row;
        changed = true;
        return { ...row, [action.field]: action.value };
      });
      return changed ? { ...state, rows } : state;
    }
    default:
      return state;
  }
}

export type RowField = "id" | "title" | "prompt" | "points";
export type RowErrors = Partial<Record<RowField, string>>;

export interface QuestionsValidation {
  /** row key → field → one sentence */
  rows: Record<string, RowErrors>;
  /** true when every row is complete and the IDs are unique */
  valid: boolean;
}

export function parsePoints(value: string): number | null {
  const text = value.trim();
  if (text === "") return null;
  const points = Number(text);
  return Number.isFinite(points) ? points : null;
}

export function totalPoints(rows: QuestionRow[]): number {
  return rows.reduce((sum, row) => sum + (parsePoints(row.points) ?? 0), 0);
}

export function validateQuestions(rows: QuestionRow[]): QuestionsValidation {
  const errors: Record<string, RowErrors> = {};
  const seen = new Map<string, number>();
  rows.forEach((row) => {
    const id = row.id.trim();
    seen.set(id, (seen.get(id) ?? 0) + 1);
  });
  rows.forEach((row) => {
    const row_errors: RowErrors = {};
    const id = row.id.trim();
    if (id === "") row_errors.id = "Give the question an ID";
    else if (!QUESTION_ID_PATTERN.test(id)) row_errors.id = "Letters, numbers, hyphen or underscore";
    else if ((seen.get(id) ?? 0) > 1) row_errors.id = "Another question already uses this ID";
    if (row.title.trim() === "") row_errors.title = "Give the question a title";
    if (row.prompt.trim() === "") row_errors.prompt = "Write what the question asks";
    const points = parsePoints(row.points);
    if (points === null) row_errors.points = "Enter the points";
    else if (points <= 0) row_errors.points = "Points must be more than 0";
    else if (points > 1000) row_errors.points = "Points cannot exceed 1000";
    if (Object.keys(row_errors).length > 0) errors[row.key] = row_errors;
  });
  return { rows: errors, valid: Object.keys(errors).length === 0 && rows.length > 0 };
}

/** The `questions` payload for `client.createAssignment`. Call only when validation passed. */
export function toQuestions(rows: QuestionRow[]): Question[] {
  return rows.map((row) => ({
    id: row.id.trim(),
    title: row.title.trim(),
    prompt: row.prompt.trim(),
    max_points: parsePoints(row.points) ?? 0,
  }));
}

const FIELD_MESSAGES: Record<string, string> = {
  string_too_short: "This cannot be empty",
  string_too_long: "This is too long",
  string_pattern_mismatch: "Letters, numbers, hyphen or underscore",
  greater_than: "Must be more than 0",
  less_than_equal: "This is too large",
  missing: "This is required",
  float_parsing: "Enter a number",
};

/** A 422 field path is an array like ["body","questions",2,"id"]; older shapes send a string. */
function pathParts(path: unknown): string[] {
  if (Array.isArray(path)) return path.map(String);
  if (typeof path === "string") return path.split(/[.[\]]+/).filter(Boolean);
  return [];
}

export interface ApiFieldErrors {
  /** row key → field → message */
  rows: Record<string, RowErrors>;
  /** anything that did not land on a row, e.g. the title */
  form: string[];
}

/** Lands `ApiError.fields` from a failed create on the right rows. */
export function mapFieldErrors(
  fields: ReadonlyArray<{ path: unknown; type: string }>,
  rows: QuestionRow[],
): ApiFieldErrors {
  const mapped: Record<string, RowErrors> = {};
  const form: string[] = [];
  fields.forEach((field) => {
    const parts = pathParts(field.path).filter((part) => part !== "body");
    const message = FIELD_MESSAGES[field.type] ?? "Check this value";
    if (parts[0] === "questions" && parts.length >= 2) {
      const row = rows[Number(parts[1])];
      const name = parts[2];
      if (row && (name === "id" || name === "title" || name === "prompt" || name === "max_points")) {
        const key: RowField = name === "max_points" ? "points" : name;
        mapped[row.key] = { ...mapped[row.key], [key]: message };
        return;
      }
    }
    if (parts[0] === "title") {
      form.push(`Title: ${message.toLowerCase()}`);
      return;
    }
    if (parts[0] === "due_at") {
      form.push("Due date: the server could not read that date and time");
      return;
    }
    form.push(`${parts.join(" ") || "Request"}: ${message.toLowerCase()}`);
  });
  return { rows: mapped, form };
}
