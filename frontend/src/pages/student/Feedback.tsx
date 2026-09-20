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
  flagLabel,
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
import { compareFeedback, needsAttention } from "./lib/feedback";
import { useLiveRefresh } from "../../app/data";
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
  useLiveRefresh(submission.refetch, Boolean(attempt?.final));

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
  const questionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [feedbackTarget, setFeedbackTarget] = useState<{ kind: "flag" | "question"; id: string } | null>(null);

  const attempts = sortedAttempts((siblings.data ?? []) as StudentSubmission[]);
  const questions = useMemo(() => assignment.data?.questions ?? [], [assignment.data]);
  const assessment = attempt?.assessment ?? null;
  const flags = useMemo(() => numberFlags(assessment, questions), [assessment, questions]);
  const marks = useMemo(() => flagMarks(flags, selected), [flags, selected]);
  const dueAt = assignment.data?.due_at ?? null;
  const released = attempt?.review.status === "released";
  const canCheck = capabilities.mode !== "unconfigured" && capabilities.automated_assessment;
  const attention = assessment?.questions.filter(needsAttention) ?? [];
  const hasFinal = Boolean(attempt?.final || attempts.some((other) => other.final));
  const uploadsOpen = uploadGate(dueAt).allowed;
  const revisionPrimary = attention.length > 0 && !hasFinal && uploadsOpen;
  const previous = attempt ? attempts.find((other) => other.version < attempt.version) : undefined;
  const changes = attempt && previous ? compareFeedback(attempt, previous) : null;
  const attentionLabel = attention.length === 1 ? "1 question to revisit" : `${attention.length} questions to revisit`;

  useEffect(() => {
    if (!feedbackTarget) return;
    const node = feedbackTarget.kind === "flag"
      ? cardRefs.current[feedbackTarget.id]?.querySelector<HTMLButtonElement>("button")
      : questionRefs.current[feedbackTarget.id];
    // Run after the sheet has opened so a paper pin also reveals its feedback on a phone.
    node?.scrollIntoView({ block: "nearest" });
    node?.focus({ preventScroll: true });
  }, [feedbackTarget]);

  useEffect(() => {
    setSelected(null);
    setPage(1);
    setFeedbackTarget(null);
    setSheetOpen(false);
  }, [submissionId]);

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
    if (flagPage !== Number.MAX_SAFE_INTEGER) setPage(flagPage);
  }

  function onMarkSelect(markKey: string) {
    const flagId = flagIdFromMark(markKey);
    setSelected(flagId);
    setSheetOpen(true);
    setFeedbackTarget({ kind: "flag", id: flagId });
  }

  function revisit(questionId: string) {
    const first = flags.find((entry) => entry.questionId === questionId);
    if (first) pickFlag(first.flag.id, first.page);
    else {
      setSelected(null);
      const firstPage = attempt?.mapping?.[questionId]?.[0];
      if (firstPage) setPage(firstPage);
    }
    setFeedbackTarget({ kind: "question", id: questionId });
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
              variant={revisionPrimary ? "primary" : "secondary"}
              size="md"
              disabledReason={
                uploadGate(dueAt).allowed ? null : "The due date has passed, so uploads are closed"
              }
            />
            <HandInButton
              submission={attempt}
              variant={revisionPrimary ? "secondary" : "primary"}
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
      <div className="v-student-pane__body" id="student-feedback-body">
        {attempt?.final ? (
          <Chip tone="teal">{`Handed in ${stamp(attempt.handed_in_at)}`}</Chip>
        ) : null}

        {released && attempt ? (
          <Notice tone="success" className="v-student-pane__final">
            {`Final score ${scoreLine(attempt.review.score ?? null, assessment?.max_points ?? 0)}, released by your instructor`}
          </Notice>
        ) : null}

        {Object.keys(attempt?.review.comments ?? {}).length > 0 ? (
          <section className="v-student-comments" aria-label="Staff feedback" aria-live="polite">
            <h2 className="v-heading-20">Staff feedback</h2>
            {questions.map((question) => {
              const comment = attempt?.review.comments?.[question.id];
              return comment ? (
                <article className="v-student-finding" key={question.id}>
                  <h3 className="v-heading-16">{question.title}</h3>
                  <p className="v-copy-14 v-student-comment__text">{comment.text}</p>
                  <p className="v-label-12 v-student-pane__muted">{comment.author_name} · {stamp(comment.updated_at)}</p>
                </article>
              ) : null;
            })}
          </section>
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
            {assessment.mode === "fixture" ? (
              <Notice tone="info" title="Example feedback">
                Scores and flags are simulated. These prompts demonstrate the feedback style. No model has checked this paper.
              </Notice>
            ) : null}
            <section className="v-student-next" aria-label="What to revisit">
              <h2 className="v-heading-20">{attention.length ? attentionLabel : "No flags in this check"}</h2>
              <p className="v-copy-14 v-student-pane__muted">
                {attention.length
                  ? hasFinal
                    ? "Use these prompts to revisit your reasoning. Your handed-in attempt stays the same."
                    : uploadsOpen
                      ? "Revisit your reasoning, then upload a revision when you're ready. You can still hand in with flags."
                      : "Uploads are closed. Revisit these questions to prepare for your next assignment, or ask for help below."
                  : hasFinal
                    ? "A check can miss mistakes. Review your reasoning alongside any feedback from staff."
                    : uploadsOpen
                      ? "Read through your work and the assignment requirements before handing in. A check can miss mistakes."
                      : "Uploads are closed. A check can miss mistakes, so review your reasoning alongside the assignment requirements."}
              </p>
              {attention.length ? (
                <div className="v-student-next__questions" aria-label="Jump to question feedback">
                  {attention.map((question) => (
                    <Button key={question.question_id} variant="secondary" onClick={() => revisit(question.question_id)}>
                      {questions.find((q) => q.id === question.question_id)?.title ?? question.question_id}
                    </Button>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="v-student-total">
              <div className="v-student-total__line">
                <p className="v-label-14">Your estimate</p>
                <Score value={assessment.score} max={assessment.max_points} size="sm" nullLabel="Needs review" />
              </div>
              {assessment.score === null ? (
                <p className="v-copy-14 v-student-pane__muted">
                  {attempt?.final
                    ? released
                      ? "The automated check could not score part of this work reliably. Your instructor's final score is shown above."
                      : "Part of this work could not be scored reliably. Staff will review your handed-in paper."
                    : `Part of this work could not be scored reliably. Check that your writing and steps are clear, or ask for help below.${!hasFinal && uploadsOpen ? " Hand in when you're ready for staff review." : ""}`}
                </p>
              ) : (
                <p className="v-copy-14 v-student-pane__muted">
                  {released ? "Automated estimate. Your instructor's final score is shown above." : "Based on the assignment rubric. Staff decide the final score after you hand in."}
                </p>
              )}
              {assessment.mode === "fixture" ? <Chip tone="fixture" /> : null}
            </section>

            {previous ? (
              <details className="v-student-comparison">
                <summary className="v-label-14">{`Compare with attempt ${previous.version}`}</summary>
                {changes ? (
                  <>
                    <p className="v-copy-14 v-student-pane__muted">Same rubric. These are changes in flagged categories, not proof that an answer is correct.</p>
                    <ul>
                      {changes.map((change) => (
                        <li key={change.questionId} className="v-copy-14">
                          <span className="v-label-14">{questions.find((q) => q.id === change.questionId)?.title ?? change.questionId}</span>
                          {change.still.length ? <p>{`Still flagged: ${change.still.map(flagLabel).join(", ")}`}</p> : null}
                          {change.added.length ? <p>{`Newly flagged: ${change.added.map(flagLabel).join(", ")}`}</p> : null}
                          {change.absent.length ? <p>{`No longer flagged: ${change.absent.map(flagLabel).join(", ")}`}</p> : null}
                          {change.uncertain ? <p className="v-student-pane__muted">One check needs review, so improvement is uncertain.</p> : null}
                          {!change.uncertain && !change.still.length && !change.added.length && !change.absent.length ? <p>No flags in either check.</p> : null}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : <p className="v-copy-14 v-student-pane__muted">Comparison needs two completed checks using the same rubric, questions and checking system.</p>}
                <Button variant="quiet" onClick={() => navigate(`/s/${previous.id}`)}>{`View attempt ${previous.version}`}</Button>
              </details>
            ) : null}

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
                ? "Check your work to see what to revisit on each page."
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
      <section className="v-student-finding" tabIndex={-1} ref={(node) => { questionRefs.current[question.question_id] = node; }}>
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
          <p className="v-copy-14 v-student-pane__muted">{needsAttention(question) ? "This question needs review. Check that every step is readable, or ask for help." : "No flags on this question."}</p>
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
                  <span className="v-label-12 v-student-flag__page">{entry.anchors.length ? `Page ${entry.page}` : "Question feedback"}</span>
                  <span className="v-copy-14 v-student-flag__message">{entry.flag.message}</span>
                  {entry.anchors.length && entry.anchors.every((anchor) => !anchor.bbox) ? <span className="v-copy-12 v-student-flag__location">Page location only. Check the relevant steps on this page.</span> : null}
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
            aria-controls="student-feedback-body"
            onClick={() => setSheetOpen((open) => !open)}
          >
            <span className="v-label-14">
              {Object.keys(attempt?.review.comments ?? {}).length
                ? "Feedback · Staff comments"
                : assessment
                ? `Feedback · ${attention.length ? attentionLabel : "No flags"}`
                : isRunning(job)
                  ? "Feedback · Checking your work…"
                  : "Feedback · Not checked yet"}
            </span>
            <Icon glyph={ChevronDown} size={16} />
          </button>
          {pane}
          {attempt ? (
            <div className="v-student-sheet__actions">
              <RevisionButton
                assignmentId={attempt.assignment_id}
                variant={revisionPrimary ? "primary" : "secondary"}
                size="lg"
                disabledReason={
                  uploadGate(dueAt).allowed ? null : "The due date has passed, so uploads are closed"
                }
              />
              <HandInButton
                submission={attempt}
                variant={revisionPrimary ? "secondary" : "primary"}
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
