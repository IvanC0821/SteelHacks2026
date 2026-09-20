import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import {
  Button,
  Chip,
  Dialog,
  Field,
  Icon,
  Notice,
  Score,
  Spinner,
  useToast,
} from "../../components";
import { PageHeader, useAssignment, useCapabilities, useClient, useSubmission, useSubmissions } from "../../app";
import { PdfViewer, usePdfBlob } from "../../pdf";
import { ApiError } from "../../api/client";
import type { QuestionAssessment, StudentSubmission } from "../../api/types";
import { HandInButton } from "./HandInButton";
import { RevisionButton } from "./RevisionButton";
import {
  attemptLabel,
  isMapped,
  scoreLine,
  sortedAttempts,
  stamp,
  uploadGate,
} from "./lib/attempts";
import { flagIdFromMark, flagMarks, flagsForQuestion, numberFlags } from "./lib/flags";
import { idleJob, isRunning, jobReducer } from "./lib/job";
import "./student.css";

type ReportKind = "help" | "incorrect_feedback";

/** Step 3: the checked paper beside its findings. Students never see criteria, decisions or staff
 *  reasons; the API strips them and this page never asks a staff route for them. */
export function Feedback() {
  const { submissionId = "" } = useParams();
  const client = useClient();
  const capabilities = useCapabilities();
  const navigate = useNavigate();
  const { toast } = useToast();

  const submission = useSubmission(submissionId);
  const attempt = (submission.data ?? null) as StudentSubmission | null;
  const assignment = useAssignment(attempt?.assignment_id);
  const siblings = useSubmissions(attempt?.assignment_id);
  const pdf = usePdfBlob(client, attempt?.document_id ?? null);

  const [job, dispatch] = useReducer(jobReducer, idleJob);
  const [pollToken, setPollToken] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [hideMarks, setHideMarks] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [report, setReport] = useState<{ questionId: string; kind: ReportKind } | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const cardRefs = useRef<Record<string, HTMLLIElement | null>>({});

  const attempts = sortedAttempts((siblings.data ?? []) as StudentSubmission[]);
  const questions = useMemo(() => assignment.data?.questions ?? [], [assignment.data]);
  const assessment = attempt?.assessment ?? null;
  const flags = useMemo(() => numberFlags(assessment, questions), [assessment, questions]);
  const marks = useMemo(() => flagMarks(flags, selected), [flags, selected]);
  const dueAt = assignment.data?.due_at ?? null;
  const released = attempt?.review.status === "released";
  const canCheck = capabilities.mode !== "unconfigured" && capabilities.automated_assessment;

  // poll the job the backend already started for this attempt, then refetch the submission
  useEffect(() => {
    const jobId = attempt?.job_id;
    if (!jobId || attempt?.assessment) return;
    const controller = new AbortController();
    dispatch({ type: "start", jobId });
    client
      .waitForJob(jobId, controller.signal)
      .then((finished) => {
        if (controller.signal.aborted) return;
        dispatch({ type: "poll", job: finished });
        if (finished.status === "succeeded") {
          submission.refetch();
          dispatch({ type: "refetched" });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) dispatch({ type: "error" });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.job_id, attempt?.assessment, client, pollToken]);

  async function retry() {
    if (!job.jobId) return;
    try {
      const restarted = await client.retryJob(job.jobId);
      dispatch({ type: "start", jobId: restarted.id });
      setPollToken((n) => n + 1);
    } catch {
      dispatch({ type: "error" });
    }
  }

  async function startCheck() {
    if (!attempt) return;
    if (!isMapped(attempt)) {
      navigate(`/s/${attempt.id}/pages`);
      return;
    }
    try {
      const started = await client.startAssessment(attempt.id);
      dispatch({ type: "start", jobId: started.id });
      submission.refetch();
    } catch {
      dispatch({ type: "error" });
    }
  }

  async function sendReport() {
    if (!report) return;
    setSending(true);
    try {
      await client.createReport(submissionId, {
        question_id: report.questionId,
        kind: report.kind,
        message: message.trim(),
      });
      setReport(null);
      setMessage("");
      toast({ message: report.kind === "help" ? "Help request sent" : "Report sent" });
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : "network";
      toast({
        message: code === "unknown_question" ? "That question is not on this paper." : "That did not send. Try again.",
        tone: "error",
      });
    } finally {
      setSending(false);
    }
  }

  function pickFlag(flagId: string, flagPage: number) {
    setSelected(flagId);
    setPage(flagPage);
  }

  function onMarkSelect(markKey: string) {
    const flagId = flagIdFromMark(markKey);
    setSelected(flagId);
    cardRefs.current[flagId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const title = assignment.data
    ? `${assignment.data.title} · Attempt ${attempt?.version ?? ""}`
    : "Feedback";

  const header = (
    <PageHeader
      title={title}
      left={
        attempts.length > 1 && attempt ? (
          <details className="v-student-versions">
            <summary className="v-student-versions__summary v-label-14">
              {attemptLabel(attempt, attempts)}
              <Icon glyph={ChevronDown} size={16} />
            </summary>
            <ul className="v-student-versions__list">
              {attempts.map((other) => (
                <li key={other.id}>
                  <button
                    type="button"
                    className={`v-student-versions__item${other.id === attempt.id ? " is-active" : ""}`}
                    aria-current={other.id === attempt.id}
                    onClick={() => navigate(`/s/${other.id}`)}
                  >
                    <span className="v-label-14">{attemptLabel(other, attempts)}</span>
                    <span className="v-copy-14 v-student-versions__meta">{stamp(other.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ) : null
      }
      right={
        attempt ? (
          <div className="v-student-header-actions v-student-feedback-actions">
            <RevisionButton
              assignmentId={attempt.assignment_id}
              size="md"
              disabledReason={
                uploadGate(dueAt).allowed ? null : "The due date has passed, so uploads are closed"
              }
            />
            <HandInButton
              submission={attempt}
              attempts={attempts.length ? attempts : [attempt]}
              dueAt={dueAt}
              onDone={() => {
                submission.refetch();
                siblings.refetch();
              }}
            />
          </div>
        ) : null
      }
    />
  );

  if (submission.error) {
    return (
      <>
        {header}
        <div className="v-student-page">
          <Notice tone="error">This attempt could not be loaded.</Notice>
        </div>
      </>
    );
  }

  const pane = (
    <>
      <div className="v-student-pane__body">
        {attempt?.final ? (
          <Chip tone="teal">{`Handed in ${stamp(attempt.handed_in_at)}`}</Chip>
        ) : null}

        {released && attempt ? (
          <Notice tone="success" className="v-student-pane__final">
            {`Final score ${scoreLine(attempt.review.score ?? null, assessment?.max_points ?? 0)}, released by your instructor`}
          </Notice>
        ) : null}

        {isRunning(job) ? (
          <div className="v-student-pane__running" role="status">
            <Spinner size={20} />
            <p className="v-copy-16">Checking your work…</p>
            <p className="v-copy-14 v-student-pane__muted">Your paper is here while the check runs.</p>
          </div>
        ) : null}

        {job.phase === "failed" ? (
          <Notice
            tone={job.errorCode === "not_configured" ? "info" : "error"}
            action={
              job.canRetry ? (
                <Button variant="secondary" onClick={() => void retry()}>
                  Retry
                </Button>
              ) : undefined
            }
          >
            {job.message}
          </Notice>
        ) : null}

        {assessment ? (
          <>
            <section className="v-student-total">
              <p className="v-label-12">Your estimate</p>
              <Score
                value={assessment.score}
                max={assessment.max_points}
                estimated={assessment.score !== null}
                size="lg"
                nullLabel="Needs review"
              />
              {assessment.score === null ? (
                <p className="v-copy-14 v-student-pane__muted">
                  Needs review: a staff member will look at part of this paper.
                </p>
              ) : (
                <p className="v-copy-14 v-student-pane__muted">
                  An estimate from your rubric, not a grade. A staff member reviews every paper.
                </p>
              )}
              {assessment.mode === "fixture" ? <Chip tone="fixture" /> : null}
            </section>

            <ul className="v-student-findings">
              {assessment.questions.map((question) => (
                <li key={question.question_id}>
                  {renderQuestion(question)}
                </li>
              ))}
            </ul>
          </>
        ) : !isRunning(job) && job.phase !== "failed" ? (
          <div className="v-student-pane__empty">
            <p className="v-heading-16">Not checked yet</p>
            <p className="v-copy-14 v-student-pane__muted">
              {canCheck
                ? "Check your work to see broad flags on your pages."
                : "Automated assessment is not connected yet. You can still hand in for staff review."}
            </p>
            {canCheck ? (
              <Button variant="primary" size="lg" onClick={() => void startCheck()}>
                Check my work
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );

  function renderQuestion(question: QuestionAssessment) {
    const meta = questions.find((q) => q.id === question.question_id);
    const rows = flagsForQuestion(flags, question.question_id);
    const finalScore = released ? attempt?.review.questions?.[question.question_id]?.score ?? null : null;
    return (
      <section className="v-student-finding">
        <header className="v-student-finding__head">
          <h3 className="v-heading-14">{meta?.title ?? question.question_id}</h3>
          <div className="v-student-finding__scores">
            <span className="v-student-finding__score">
              <span className="v-label-12">Estimated</span>
              <Score value={question.score} max={question.max_points} nullLabel="Needs review" />
            </span>
            {released ? (
              <span className="v-student-finding__score v-student-finding__score--final">
                <span className="v-label-12">Final</span>
                <Score value={finalScore} max={question.max_points} nullLabel="Not scored" />
              </span>
            ) : null}
          </div>
        </header>

        {rows.length === 0 ? (
          <p className="v-copy-14 v-student-pane__muted">No flags on this question.</p>
        ) : (
          <ul className="v-student-flags">
            {rows.map((entry) => (
              <li
                key={entry.flag.id}
                ref={(node) => {
                  cardRefs.current[entry.flag.id] = node;
                }}
              >
                <button
                  type="button"
                  className={`v-student-flag${selected === entry.flag.id ? " is-selected" : ""}`}
                  aria-current={selected === entry.flag.id}
                  onClick={() => pickFlag(entry.flag.id, entry.page)}
                >
                  <Chip tone="hint" number={entry.number}>
                    {entry.categoryLabel}
                  </Chip>
                  <span className="v-label-12 v-student-flag__page">{`Page ${entry.page}`}</span>
                  <span className="v-copy-14 v-student-flag__message">{entry.flag.message}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="v-student-finding__actions">
          <Button
            variant="quiet"
            onClick={() => {
              setMessage("");
              setReport({ questionId: question.question_id, kind: "help" });
            }}
          >
            Ask for help
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              setMessage("");
              setReport({ questionId: question.question_id, kind: "incorrect_feedback" });
            }}
          >
            Report this feedback
          </Button>
        </div>
      </section>
    );
  }

  return (
    <>
      {header}
      <div className="v-student-workspace v-student-workspace--sheet">
        <div className="v-student-workspace__paper">
          {pdf.error ? (
            <div className="v-student-workspace__state">
              <Notice tone="error">{`Your PDF could not be fetched (${pdf.error}).`}</Notice>
            </div>
          ) : pdf.blob ? (
            <PdfViewer
              blob={pdf.blob}
              page={page}
              onPageChange={setPage}
              marks={marks}
              onMarkSelect={onMarkSelect}
              hideMarks={hideMarks}
              onHideMarksChange={setHideMarks}
              label="Your paper"
            />
          ) : (
            <div className="v-student-workspace__state">
              <Spinner size={20} label="Loading your paper" />
            </div>
          )}
        </div>

        <aside className={`v-student-workspace__pane v-student-sheet${sheetOpen ? " is-open" : ""}`} aria-label="Feedback">
          <button
            type="button"
            className="v-student-sheet__handle"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen((open) => !open)}
          >
            <span className="v-label-14">
              {assessment
                ? `${released ? "Final" : "Estimated"} ${scoreLine(
                    released ? attempt?.review.score ?? null : assessment.score,
                    assessment.max_points,
                  )}`
                : isRunning(job)
                  ? "Checking your work…"
                  : "Not checked yet"}
            </span>
            <Icon glyph={ChevronDown} size={16} />
          </button>
          {pane}
          {attempt ? (
            <div className="v-student-sheet__actions">
              <RevisionButton
                assignmentId={attempt.assignment_id}
                size="lg"
                disabledReason={
                  uploadGate(dueAt).allowed ? null : "The due date has passed, so uploads are closed"
                }
              />
              <HandInButton
                submission={attempt}
                attempts={attempts.length ? attempts : [attempt]}
                dueAt={dueAt}
                onDone={() => {
                  submission.refetch();
                  siblings.refetch();
                }}
              />
            </div>
          ) : null}
        </aside>
      </div>

      <Dialog
        open={report !== null}
        title={report?.kind === "help" ? "Ask for help" : "Report this feedback"}
        description={
          report?.kind === "help"
            ? "Your instructor and TAs see this with the question you asked about."
            : "Tell staff what looks wrong. Nothing on your paper changes automatically."
        }
        onClose={() => setReport(null)}
        primary={{
          label: "Send",
          onClick: () => void sendReport(),
          busy: sending,
          disabled: message.trim().length === 0,
        }}
        secondary={{ label: "Cancel", onClick: () => setReport(null) }}
      >
        <Field
          label="Message"
          as="textarea"
          rows={4}
          value={message}
          onChange={setMessage}
          hint="One or two sentences is plenty."
        />
      </Dialog>
    </>
  );
}
