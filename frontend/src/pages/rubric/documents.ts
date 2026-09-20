// The reference picker and upload drawer. Documents come back in store order, so the
// latest of a kind is the last one. The upload control refuses what the API would refuse.

import type { Capabilities, DocumentMeta, DocumentKind } from "../../api/types";

export type ReferenceKind = Exclude<DocumentKind, "submission">;

export const REFERENCE_KINDS: ReferenceKind[] = ["questions", "solution", "graded_example"];

export const KIND_LABELS: Record<ReferenceKind, string> = {
  questions: "Blank assignment",
  solution: "Instructor solution",
  graded_example: "Graded examples",
};

export function ofKind(documents: DocumentMeta[], kind: ReferenceKind): DocumentMeta[] {
  return documents.filter((d) => d.kind === kind);
}

/** The most recently uploaded document of a kind, or null. */
export function latestOfKind(documents: DocumentMeta[], kind: ReferenceKind): DocumentMeta | null {
  const list = ofKind(documents, kind);
  return list.length > 0 ? list[list.length - 1] : null;
}

/** Current solution first, then assignment and every available example. No empty categories. */
export function referenceDocuments(documents: DocumentMeta[]): DocumentMeta[] {
  return [
    latestOfKind(documents, "solution"),
    latestOfKind(documents, "questions"),
    ...ofKind(documents, "graded_example"),
  ].filter((document): document is DocumentMeta => document !== null);
}

export function referenceLabel(document: DocumentMeta): string {
  const label = document.kind === "solution" ? "Instructor solution"
    : document.kind === "questions" ? "Blank assignment" : "Graded example";
  return `${label} — ${document.filename}`;
}

export function pageCount(pages: number): string {
  return `${pages} page${pages === 1 ? "" : "s"}`;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

/** The one sentence to show instead of starting an upload, or null when the file is fine. */
export function uploadError(file: { name: string; size: number; type: string }, capabilities: Capabilities): string | null {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "Upload a PDF";
  if (file.size === 0) return "That file is empty";
  if (capabilities.max_upload_bytes > 0 && file.size > capabilities.max_upload_bytes) {
    return `That file is ${formatBytes(file.size)}; the limit is ${formatBytes(capabilities.max_upload_bytes)}`;
  }
  return null;
}

/** The API error codes an upload can return, in a sentence. */
export function uploadFailureMessage(code: string): string {
  switch (code) {
    case "unsupported_media_type":
      return "The server would not take that file. Upload a PDF";
    case "file_too_large":
      return "That file is over the upload limit";
    case "too_many_pages":
      return "That PDF has more pages than the server accepts";
    case "questions_locked":
      return "Questions and points are locked once the first rubric is published";
    case "course_access_denied":
      return "Only the instructor can attach references";
    case "network":
      return "The upload could not reach the server. Try again";
    default:
      return "The upload failed. Try again";
  }
}
