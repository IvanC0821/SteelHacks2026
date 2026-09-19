import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText } from "lucide-react";
import {
  Button,
  Chip,
  Icon,
  Notice,
  Score,
  Spinner,
  Table,
  type Column,
} from "../../components";
import { PageHeader, useAssignment, useCapabilities, useClient, useSubmissions } from "../../app";
import { usePdfBlob } from "../../pdf";
import { ApiError } from "../../api/client";
import type { StudentSubmission } from "../../api/types";
import { HandInButton } from "./HandInButton";
import { RevisionButton } from "./RevisionButton";
import { UploadZone } from "./UploadZone";
import {
  ACTION_LABELS,
  attemptAction,
  attemptStatus,
  dueSentence,
  finalAttempt,
  latestAttempt,
  sortedAttempts,
  stamp,
  uploadGate,
} from "./lib/attempts";
import { uploadFailure } from "./lib/upload";
import "./student.css";

const UNCONFIGURED =
  "Automated assessment is not connected yet. You can still hand in for staff review.";

/** The student's home for one assignment: upload, the attempt history, and the way into each one. */
export function AssignmentPage() {
  const { assignmentId = "" } = useParams();
  const client = useClient();
  const capabilities = useCapabilities();
  const navigate = useNavigate();
  const assignment = useAssignment(assignmentId);
  const submissions = useSubmissions(assignmentId);

  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadProblem, setUploadProblem] = useState<string | null>(null);
  const [actionProblem, setActionProblem] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const canCheck = capabilities.mode !== "unconfigured" && capabilities.automated_assessment;
  const attempts = sortedAttempts((submissions.data ?? []) as StudentSubmission[]);
  const latest = latestAttempt(attempts);
  const handed = finalAttempt(attempts);
  const dueAt = assignment.data?.due_at ?? null;
  const gate = uploadGate(dueAt);
  const blankDoc = assignment.data?.documents.find((d) => d.kind === "questions") ?? null;
  const blank = usePdfBlob(client, blankDoc?.id ?? null);

  async function upload(file: File) {
    setUploadBusy(true);
    setUploadProblem(null);
    try {
      const created = (await client.upload(assignmentId, "submission", file)) as StudentSubmission;
      navigate(`/s/${created.id}/pages`);
    } catch (cause) {
      setUploadProblem(uploadFailure(cause instanceof ApiError ? cause.code : "network"));
    } finally {
      setUploadBusy(false);
    }
  }

  async function runAction(submission: StudentSubmission) {
    const action = attemptAction(submission, { canCheck });
    if (action === "view") {
      navigate(`/s/${submission.id}`);
      return;
    }
    if (action !== "check") {
      navigate(`/s/${submission.id}/pages`);
      return;
    }
    setChecking(true);
    setActionProblem(null);
    try {
      await client.startAssessment(submission.id);
      navigate(`/s/${submission.id}`);
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : "network";
      setActionProblem(
        code === "deadline_passed"
          ? "The due date has passed, so this attempt can no longer be checked."
          : "The check could not be started. Open the attempt to try again.",
      );
    } finally {
      setChecking(false);
    }
  }

  if (assignment.loading && !assignment.data) {
    return (
      <>
        <PageHeader title="Assignment" />
        <div className="v-student-page">
          <Spinner size={20} label="Loading the assignment" />
        </div>
      </>
    );
  }

  if (!assignment.data) {
    return (
      <>
        <PageHeader title="Assignment" />
        <div className="v-student-page">
          <Notice tone="error">This assignment could not be loaded.</Notice>
        </div>
      </>
    );
  }

  const detail = assignment.data;

  const columns: Array<Column<StudentSubmission>> = [
    {
      key: "attempt",
      header: "Attempt",
      cell: (row) => (
        <span className="v-attempts__name">
          <span className="v-label-14">Attempt {row.version}</span>
          {row.final ? <Chip tone="teal">Handed in</Chip> : null}
        </span>
      ),
      width: "22%",
    },
    {
      key: "uploaded",
      header: "Uploaded",
      cell: (row) => <span className="v-copy-14 v-attempts__muted">{stamp(row.created_at)}</span>,
      width: "22%",
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const status = attemptStatus(row);
        return (
          <span className="v-attempts__status">
            <span className="v-copy-14">{status.label}</span>
            {row.assessment?.mode === "fixture" ? <Chip tone="fixture" /> : null}
          </span>
        );
      },
    },
    {
      key: "action",
      header: "Action",
      align: "end",
      cell: (row) => (
        <Button variant="quiet" onClick={() => void runAction(row)} busy={checking && row.id === latest?.id}>
          {ACTION_LABELS[attemptAction(row, { canCheck })]}
        </Button>
      ),
      width: "20%",
    },
  ];

  return (
    <>
      <PageHeader
        title={detail.title}
        right={<span className="v-copy-14 v-student-due">{dueSentence(dueAt)}</span>}
      />
      <div className="v-student-page">
        <div className="v-measure v-student-stack">
          {!canCheck ? <Notice tone="info">{UNCONFIGURED}</Notice> : null}
          {actionProblem ? <Notice tone="error">{actionProblem}</Notice> : null}

          {attempts.length === 0 ? (
            <section className="v-panel-card">
              <h2 className="v-heading-16">Upload your work</h2>
              <p className="v-copy-16 v-student-lede">
                Upload a PDF of your handwritten work. Next you say which pages hold which question,
                then you can check your work as many times as you like before you hand in.
              </p>
              <UploadZone
                onFile={(file) => void upload(file)}
                busy={uploadBusy}
                failure={uploadProblem}
                disabledReason={gate.allowed ? null : "The due date has passed, so uploads are closed"}
              />
              {blankDoc && blank.url ? (
                <a className="v-student-link" href={blank.url} target="_blank" rel="noreferrer">
                  <Icon glyph={FileText} size={16} />
                  Open {detail.title} (PDF)
                </a>
              ) : null}
            </section>
          ) : (
            <>
              <section className="v-student-actions">
                <div className="v-student-actions__buttons">
                  {latest ? (
                    <Button
                      variant="primary"
                      size="lg"
                      busy={checking}
                      onClick={() => void runAction(latest)}
                    >
                      {ACTION_LABELS[attemptAction(latest, { canCheck })]}
                    </Button>
                  ) : null}
                  <RevisionButton
                    assignmentId={assignmentId}
                    disabledReason={
                      gate.allowed ? null : "The due date has passed, so uploads are closed"
                    }
                  />
                  {/* Hand in lives on the feedback page; it only moves here when there is no check
                      to run, so this view keeps one primary and two controls. */}
                  {latest && !canCheck ? (
                    <HandInButton
                      submission={latest}
                      attempts={attempts}
                      dueAt={dueAt}
                      onDone={() => {
                        submissions.refetch();
                      }}
                      variant="secondary"
                      hideWhenBlocked={Boolean(handed)}
                    />
                  ) : null}
                </div>
                {handed ? (
                  <div className="v-student-final">
                    <Chip tone="teal">{`Handed in ${stamp(handed.handed_in_at)}`}</Chip>
                    {handed.review.status === "released" ? (
                      <div className="v-student-final__score">
                        <p className="v-label-12">Final score</p>
                        <Score
                          value={handed.review.score ?? null}
                          max={handed.assessment?.max_points}
                          size="lg"
                        />
                      </div>
                    ) : (
                      <p className="v-copy-14 v-attempts__muted">
                        A staff member reviews it before a final score appears.
                      </p>
                    )}
                  </div>
                ) : null}
              </section>

              <section className="v-student-attempts">
                <h2 className="v-heading-16">Attempts</h2>
                <Table
                  columns={columns}
                  rows={attempts}
                  rowKey={(row) => row.id}
                  caption={`Attempts for ${detail.title}`}
                />
                <p className="v-copy-14 v-attempts__muted">
                  Every attempt stays here. A revision is a new attempt and never replaces an older one.
                </p>
                {blankDoc && blank.url ? (
                  <a className="v-student-link" href={blank.url} target="_blank" rel="noreferrer">
                    <Icon glyph={FileText} size={16} />
                    Open {detail.title} (PDF)
                  </a>
                ) : null}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
