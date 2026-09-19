// What the drop zone accepts, checked before we spend a round trip on an upload the backend
// would reject. The limits come from GET /api/capabilities, never from a guess.

import type { Capabilities } from "../../../api/types";

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function isPdf(file: { name: string; type: string }): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

/** null when the file is fine, otherwise one sentence for the drop zone. */
export function uploadError(
  file: { name: string; type: string; size: number },
  capabilities?: Pick<Capabilities, "max_upload_bytes"> | null,
): string | null {
  if (!isPdf(file)) return "Upload a PDF. Other file types are not accepted.";
  if (file.size === 0) return "That file is empty.";
  const limit = capabilities?.max_upload_bytes ?? 0;
  if (limit > 0 && file.size > limit) return `That PDF is larger than the ${formatBytes(limit)} limit.`;
  return null;
}

/** The sentence under the drop zone, so the limits are visible before a failure. */
export function uploadHint(capabilities?: Capabilities | null): string {
  if (!capabilities) return "PDF only.";
  const parts = ["PDF only"];
  if (capabilities.max_upload_bytes > 0) parts.push(`up to ${formatBytes(capabilities.max_upload_bytes)}`);
  if (capabilities.max_pages > 0) parts.push(`${capabilities.max_pages} pages at most`);
  return `${parts.join(", ")}.`;
}

/**
 * Messages for the upload call itself. The backend's PDF inspector fails with a written sentence
 * as detail.code ("PDF must contain 1–40 pages"), so pass those through instead of flattening them.
 */
export function uploadFailure(code: string): string {
  switch (code) {
    case "deadline_passed":
      return "The due date has passed, so this assignment no longer takes uploads.";
    case "pdf_too_large":
      return "That PDF is too large.";
    case "upload_role_denied":
      return "You cannot upload to this assignment.";
    case "network":
      return "The upload could not reach the server. Check your connection and try again.";
    default:
      if (/\s/.test(code)) return code.endsWith(".") ? code : `${code}.`;
      return "The upload did not go through. Try again.";
  }
}
