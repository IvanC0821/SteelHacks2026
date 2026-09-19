import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { PageHeader } from "../../app";
import { assignmentTabs, tabForPath } from "./tabs";
import "./course.css";

export interface AssignmentFrameProps {
  assignmentId: string;
  title: string;
  /** the open report count, shown on the Reports tab when there is one */
  openReports?: number;
  /** the header's one primary, if this view has one */
  right?: ReactNode;
  children: ReactNode;
}

/** The staff assignment page: one 52px PageHeader (the same row Tasks 2 and 3 render) with the
 *  four tabs directly beneath it, so switching between Overview and Reports never moves the title.
 *  Rubric and Grade are workspaces owned by Tasks 3 and 2; the tabs link straight out to them. */
export function AssignmentFrame({ assignmentId, title, openReports = 0, right, children }: AssignmentFrameProps) {
  const active = tabForPath(useLocation().pathname, assignmentId);

  return (
    <>
      <PageHeader title={title} right={right} />
      <nav className="v-tabs v-assignment__tabs" aria-label="Assignment">
        {assignmentTabs(assignmentId).map((tab) => (
          <Link
            key={tab.id}
            to={tab.to}
            className="v-tabs__tab"
            aria-current={tab.id === active ? "page" : undefined}
          >
            {tab.label}
            {tab.id === "reports" && openReports > 0 ? (
              <span className="v-tabs__badge">{openReports}</span>
            ) : null}
          </Link>
        ))}
      </nav>
      <div className="v-page">{children}</div>
    </>
  );
}
