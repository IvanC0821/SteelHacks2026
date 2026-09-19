// Data loading for the course pages, on top of the foundation's `useResource`: one hook per
// screen, each returning { data, error, loading, refetch }.

import { useCallback } from "react";
import { useClient, useResource, useSession, type Resource } from "../../app";
import type {
  Analytics,
  Assignment,
  AssignmentDetail,
  Member,
  Report,
  StudentSubmission,
} from "../../api/types";
import { staffStatus, studentStatus, type StaffStatus, type StudentStatus } from "./status";

export interface AssignmentRow {
  assignment: Assignment;
  /** set for a TA or instructor */
  staff: StaffStatus | null;
  /** set for a student */
  student: StudentStatus | null;
}

export interface CourseHome {
  rows: AssignmentRow[];
  members: Member[];
}

/** The assignment table plus, for staff, the roster. Students never request the roster.
 *  Staff rows need that assignment's final queue, so the rows load in one fan-out. */
export function useCourseHome(courseId: string | undefined): Resource<CourseHome> {
  const client = useClient();
  const { user } = useSession();
  const isStaff = user.role !== "student";

  const fetcher = useCallback(
    async (id: string): Promise<CourseHome> => {
      const assignments = await client.assignments(id);
      const rows = await Promise.all(
        assignments.map(async (assignment): Promise<AssignmentRow> => {
          if (isStaff) {
            const [queue, detail] = await Promise.all([
              client.finalQueue(assignment.id),
              assignment.published_rubric_id ? client.assignment(assignment.id) : Promise.resolve(null),
            ]);
            return {
              assignment,
              staff: staffStatus(assignment, queue, latestRubricVersion(detail)),
              student: null,
            };
          }
          const submissions = (await client.submissions(assignment.id)) as StudentSubmission[];
          return { assignment, staff: null, student: studentStatus(assignment, submissions) };
        }),
      );
      const members = isStaff ? await client.members(id) : [];
      return { rows, members };
    },
    [client, isStaff],
  );

  return useResource(courseId ?? null, fetcher, [client, isStaff]);
}

function latestRubricVersion(detail: AssignmentDetail | null): number {
  const rubrics = detail?.rubrics ?? [];
  return rubrics.length > 0 ? rubrics[rubrics.length - 1].version : 1;
}

export interface OverviewData {
  assignment: AssignmentDetail;
  analytics: Analytics;
}

export function useOverview(assignmentId: string | undefined): Resource<OverviewData> {
  const client = useClient();
  const fetcher = useCallback(
    async (id: string): Promise<OverviewData> => {
      const [assignment, analytics] = await Promise.all([client.assignment(id), client.analytics(id)]);
      return { assignment, analytics };
    },
    [client],
  );
  return useResource(assignmentId ?? null, fetcher, [client]);
}

export interface ReportsData {
  assignment: AssignmentDetail;
  reports: Report[];
  members: Member[];
}

export function useReports(assignmentId: string | undefined): Resource<ReportsData> {
  const client = useClient();
  const fetcher = useCallback(
    async (id: string): Promise<ReportsData> => {
      const [assignment, reports] = await Promise.all([client.assignment(id), client.reports(id)]);
      let members: Member[] = [];
      try {
        members = await client.members(assignment.course_id);
      } catch {
        // the roster only supplies display names; a denied roster is not worth failing the page
      }
      return { assignment, reports, members };
    },
    [client],
  );
  return useResource(assignmentId ?? null, fetcher, [client]);
}

/** The sentence a failed load shows, from `ApiError.code` as `useResource` reports it. */
export function errorMessage(code: string): string {
  if (code === "forbidden" || code === "course_access_denied") return "This course is not yours to open.";
  if (code === "not_found") return "That assignment no longer exists.";
  if (code === "network") return "The server did not answer. Check that the backend is running.";
  return "Something went wrong loading this page.";
}
