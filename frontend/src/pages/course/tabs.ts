// Which of the four staff tabs a path belongs to. Pure, so the frame and its test agree.

export type TabId = "overview" | "rubric" | "grade" | "reports";

/** `/a/{id}` with no trailing segment is Overview, the default tab. */
export function tabForPath(pathname: string, assignmentId: string): TabId {
  const rest = pathname.replace(`/a/${assignmentId}`, "").replace(/^\//, "");
  if (rest.startsWith("rubric")) return "rubric";
  if (rest.startsWith("grade")) return "grade";
  if (rest.startsWith("reports")) return "reports";
  return "overview";
}

export interface TabSpec {
  id: TabId;
  to: string;
  label: string;
}

/** The four tabs in their fixed order: Overview, Rubric, Grade, Reports. */
export function assignmentTabs(assignmentId: string): TabSpec[] {
  return [
    { id: "overview", to: `/a/${assignmentId}/overview`, label: "Overview" },
    { id: "rubric", to: `/a/${assignmentId}/rubric`, label: "Rubric" },
    { id: "grade", to: `/a/${assignmentId}/grade`, label: "Grade" },
    { id: "reports", to: `/a/${assignmentId}/reports`, label: "Reports" },
  ];
}
