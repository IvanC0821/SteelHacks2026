import { useParams } from "react-router-dom";
import { Notice, Spinner } from "../../components";
import { AssignmentFrame } from "./AssignmentFrame";
import { errorMessage, useOverview } from "./data";
import { FeedbackByQuestion } from "./FeedbackByQuestion";
import "./course.css";

/** One staff overview for instructors and TAs, using the latest-attempt feedback graph. */
export function Overview() {
  const { assignmentId = "" } = useParams();
  const { data, error, loading } = useOverview(assignmentId);
  return (
    <AssignmentFrame
      assignmentId={assignmentId}
      title={data?.assignment.title ?? "Assignment"}
      openReports={data?.analytics.open_reports ?? 0}
    >
      {loading && !data ? <Spinner size={20} label="Loading the overview" /> : null}
      {error ? <Notice tone="error">{errorMessage(error)}</Notice> : null}
      {data ? <FeedbackByQuestion analytics={data.analytics} questions={data.assignment.questions} /> : null}
    </AssignmentFrame>
  );
}
