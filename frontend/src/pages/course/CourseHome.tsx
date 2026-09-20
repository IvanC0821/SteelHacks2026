import { useParams } from "react-router-dom";
import { ClipboardList, Plus } from "lucide-react";
import { PageHeader, useSession } from "../../app";
import { EmptyState, Icon, Notice, Score, Spinner, Table, type Column } from "../../components";
import { formatDate } from "../../design/format";
import { errorMessage, useCourseHome, type AssignmentRow } from "./data";
import { LinkButton } from "./LinkButton";
import { Roster } from "./Roster";
import { CourseDeductionsPanel } from "./CourseDeductionsPanel";
import "./course.css";

/** The course home: every assignment with the one status that matters to this reader and the one
 *  action that matches it, then, for staff, the roster. */
export function CourseHome() {
  const { courseId = "" } = useParams();
  const { user, courses } = useSession();
  const course = courses.find((c) => c.id === courseId) ?? null;
  const home = useCourseHome(courseId);
  const isInstructor = user.role === "instructor";
  const isStaff = user.role !== "student";

  const rows = home.data?.rows ?? [];

  return (
    <>
      <PageHeader
        title={course?.name ?? "Course"}
        right={
          isInstructor ? (
            <LinkButton to={`/c/${courseId}/new`} variant="primary">
              <Icon glyph={Plus} size={16} />
              <span className="v-course-wide-only">New assignment</span>
              <span className="v-course-phone-only">New</span>
            </LinkButton>
          ) : undefined
        }
      />

      <div className="v-course-page">
        {home.loading && !home.data ? <Spinner size={20} label="Loading the course" /> : null}
        {home.error ? <Notice tone="error">{errorMessage(home.error)}</Notice> : null}

        {home.data ? (
          <Table<AssignmentRow>
            className="v-course-rows v-course-assignments"
            caption="Assignments in this course"
            columns={columns(isStaff)}
            rows={rows}
            rowKey={(row) => row.assignment.id}
            empty={
              <EmptyState
                title="No assignments yet"
                icon={ClipboardList}
                action={
                  isInstructor ? (
                    <LinkButton to={`/c/${courseId}/new`} variant="primary">
                      New assignment
                    </LinkButton>
                  ) : undefined
                }
              >
                {isInstructor
                  ? "Create the first assignment to write its rubric."
                  : "Nothing has been published to this course yet."}
              </EmptyState>
            }
          />
        ) : null}

        {isStaff && home.data ? <CourseDeductionsPanel key={courseId} courseId={courseId} /> : null}
        {isStaff && home.data ? (
          <Roster
            courseId={courseId}
            members={home.data.members}
            canEnroll={isInstructor}
            onEnrolled={home.refetch}
          />
        ) : null}
      </div>
    </>
  );
}

function columns(isStaff: boolean): Array<Column<AssignmentRow>> {
  return [
    {
      key: "title",
      header: "Assignment",
      cell: (row) => (
        <div className="v-course-assignments__title">
          <span className="v-heading-14">{row.assignment.title}</span>
          <span className="v-label-12">
            {row.assignment.due_at
              ? `${row.assignment.questions.length} questions, due ${formatDate(row.assignment.due_at)}`
              : `${row.assignment.questions.length} questions`}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (isStaff ? <StaffCell row={row} /> : <StudentCell row={row} />),
    },
    {
      key: "action",
      header: "",
      align: "end",
      width: "1%",
      cell: (row) => {
        const action = (row.staff ?? row.student)?.action;
        if (!action) return null;
        return <LinkButton to={action.to}>{action.label}</LinkButton>;
      },
    },
  ];
}

function StaffCell({ row }: { row: AssignmentRow }) {
  const status = row.staff;
  if (!status) return null;
  const progress = status.progress;
  return (
    <div className="v-course-assignments__status">
      <span className="v-label-14">{status.label}</span>
      {progress && progress.total > 0 ? (
        <span
          className="v-course-progress"
          role="img"
          aria-label={`${progress.reviewed} of ${progress.total} papers reviewed`}
        >
          <span
            className="v-course-progress__fill"
            style={{ inlineSize: `${(progress.reviewed / progress.total) * 100}%` }}
          />
        </span>
      ) : null}
    </div>
  );
}

function StudentCell({ row }: { row: AssignmentRow }) {
  const status = row.student;
  if (!status) return null;
  return (
    <div className="v-course-assignments__status">
      <span className="v-label-14">{status.label}</span>
      {status.state === "final_score" ? (
        <Score value={status.score} max={status.maxPoints ?? undefined} size="sm" />
      ) : null}
      {status.state !== "final_score" && status.estimate !== null ? (
        <Score value={status.estimate} max={status.maxPoints ?? undefined} size="sm" estimated />
      ) : null}
    </div>
  );
}
