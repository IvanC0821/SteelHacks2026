// Report list shaping: open reports first, then newest, plus the labels the table prints.
// Resolving a report never changes a score, so nothing here touches a review.

import type { Member, Question, Report } from "../../api/types";
import { formatTime } from "../../design/format";

export interface ReportRow {
  report: Report;
  studentName: string;
  questionLabel: string;
  kindLabel: string;
  statusLabel: string;
  when: string;
}

export function reportKindLabel(kind: Report["kind"]): string {
  return kind === "help" ? "Help" : "Feedback disputed";
}

export function reportStatusLabel(status: Report["status"]): string {
  if (status === "open") return "Open";
  if (status === "resolved") return "Resolved";
  return "Dismissed";
}

/** Open first, then newest by creation time. Stable for reports created in the same millisecond. */
export function orderReports(reports: Report[]): Report[] {
  return [...reports].sort((a, b) => {
    const openness = Number(b.status === "open") - Number(a.status === "open");
    if (openness !== 0) return openness;
    return b.created_at.localeCompare(a.created_at);
  });
}

export function reportRows(reports: Report[], questions: Question[], members: Member[]): ReportRow[] {
  const names = new Map(members.map((member) => [member.id, member.name]));
  const questionLabels = new Map(
    questions.map((question, index) => [question.id, `Q${index + 1} · ${question.title}`]),
  );
  return orderReports(reports).map((report) => ({
    report,
    studentName: report.student_name ?? names.get(report.student_id ?? "") ?? "Unknown student",
    questionLabel: questionLabels.get(report.question_id) ?? report.question_id,
    kindLabel: reportKindLabel(report.kind),
    statusLabel: reportStatusLabel(report.status),
    when: formatTime(report.created_at),
  }));
}

export function openReportCount(reports: Report[]): number {
  return reports.filter((report) => report.status === "open").length;
}

/** The staff note is required: a resolution with no explanation tells the student nothing. */
export function validateResolution(note: string): string | null {
  const trimmed = note.trim();
  if (trimmed.length === 0) return "Write a note for the record before resolving.";
  if (trimmed.length < 4) return "Write a sentence, not a word.";
  return null;
}
