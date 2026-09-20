import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronsUpDown, FileQuestion, Keyboard } from "lucide-react";
import { PageHeader, useSession } from "../../app";
import { Button, Chip, Dialog, EmptyState, Field, Kbd, Notice, Spinner, useToast } from "../../components";
import { PdfViewer, usePdfBlob } from "../../pdf";
import { flagIdFromMark, marksForQuestion, questionAssessment } from "./assessment";
import { headerState, releaseToast } from "./header-state";
import { useAssessmentJob, useAssignment, useFinalQueue, useSubmission } from "./hooks";
import { isFieldTarget, KEY_ROWS, matchKey } from "./keymap";
import { firstUnreviewed, neighbour } from "./queue";
import { criteriaFor } from "./review-state";
import { QueueSwitcher } from "./QueueSwitcher";
import { RubricPane } from "./RubricPane";
import { useReview } from "./useReview";
import "./GradingWorkspace.css";

/** The staff grading workspace: the final queue, one paper at a time beside the rubric.
 *  The human decides; the automated assessment is only a suggestion. */
export function GradingWorkspace() {
  const { assignmentId, submissionId } = useParams();
  const navigate = useNavigate();
  const { client, user } = useSession();
  const { toast } = useToast();

  const queue = useFinalQueue(client, assignmentId ?? null);
  const assignment = useAssignment(client, assignmentId ?? null);
  const questions = useMemo(() => assignment.data?.questions ?? [], [assignment.data]);

  // /grade with no paper resolves to the first one still needing review.
  useEffect(() => {
    if (submissionId || !assignmentId || !queue.data || queue.data.length === 0) return;
    const first = firstUnreviewed(queue.data);
    if (first) navigate(`/a/${assignmentId}/grade/${first.id}`, { replace: true });
  }, [submissionId, assignmentId, queue.data, navigate]);

  const submission = useSubmission(client, submissionId ?? null);
  const paper = submission.data;
  const job = useAssessmentJob(client, paper?.job_id ?? null);
  const pdf = usePdfBlob(client, paper?.document_id ?? null);

  // A new paper, or the questions landing, resets the selection: first question, page 1, nothing
  // selected. Derived during render from the key rather than reset in an effect, so the workspace
  // never paints one frame of the previous paper's selection.
  const selectionKey = `${submissionId ?? ""}|${questions.map((q) => q.id).join(",")}`;
  const [storedSelection, setStoredSelection] = useState<Selection>(() =>
    freshSelection(selectionKey, questions),
  );
  const selection =
    storedSelection.key === selectionKey ? storedSelection : freshSelection(selectionKey, questions);

  const patchSelection = useCallback(
    (change: Partial<Omit<Selection, "key">>) => {
      setStoredSelection((prev) => ({
        ...(prev.key === selectionKey ? prev : freshSelection(selectionKey, questions)),
        ...change,
      }));
    },
    [selectionKey, questions],
  );

  const selectedQuestionId = selection.questionId;
  const selectedFlagId = selection.flagId;
  const page = selection.page;
  const showErrors = selection.showErrors;
  const setSelectedFlagId = useCallback((flagId: string | null) => patchSelection({ flagId }), [patchSelection]);
  const setPage = useCallback((next: number) => patchSelection({ page: next }), [patchSelection]);

  const [hideMarks, setHideMarks] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const controller = useReview(client, paper ?? null, questions, submission.reload, submission.applyReview);
  const { state } = controller;

  const currentQuestion = questions.find((q) => q.id === selectedQuestionId) ?? questions[0] ?? null;
  const header = paper
    ? headerState({ role: user.role, status: state.status, questions, saved: state.saved, job })
    : null;

  const marks = useMemo(() => {
    if (!paper || !currentQuestion) return [];
    const qa = questionAssessment(paper.assessment, currentQuestion.id);
    return marksForQuestion(paper.id, currentQuestion.id, qa?.flags ?? [], selectedFlagId);
  }, [paper, currentQuestion, selectedFlagId]);

  const goToPaper = useCallback(
    (id: string) => {
      if (assignmentId) navigate(`/a/${assignmentId}/grade/${id}`);
    },
    [assignmentId, navigate],
  );

  const stepQuestion = useCallback(
    (delta: 1 | -1) => {
      if (!currentQuestion) return;
      const index = questions.findIndex((q) => q.id === currentQuestion.id);
      const next = questions[index + delta];
      if (next) patchSelection({ questionId: next.id, flagId: null, showErrors: false });
    },
    [currentQuestion, patchSelection, questions],
  );

  const saveAndNext = useCallback(async () => {
    if (!currentQuestion || !paper) return;
    patchSelection({ showErrors: true });
    const outcome = await controller.saveQuestion(currentQuestion.id);
    if (outcome.ok) {
      // Clear before stepping: on the last question there is nothing to step to, and the fields
      // should still come out of their error state now that the save went through.
      patchSelection({ showErrors: false });
      stepQuestion(1);
      void queue.reload();
    } else if (outcome.code && !outcome.stale && outcome.code !== "invalid_input") {
      toast({ message: `The save failed (${outcome.code}). Nothing was overwritten.`, tone: "error" });
    }
  }, [controller, currentQuestion, paper, patchSelection, queue, stepQuestion, toast]);

  // The keyboard map. "h" belongs to the viewer, which binds it itself.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const command = matchKey(event, { inField: isFieldTarget(event.target), helpOpen });
      if (!command) return;
      switch (command.kind) {
        case "criterion": {
          if (!paper || !currentQuestion || header?.readOnly) return;
          const criteria = criteriaFor(paper.rubric.criteria, currentQuestion.id);
          const criterion = criteria[command.index];
          if (criterion) {
            event.preventDefault();
            controller.toggleCriterion(currentQuestion.id, criterion.id);
          }
          return;
        }
        case "prevQuestion":
          event.preventDefault();
          stepQuestion(-1);
          return;
        case "nextQuestion":
          event.preventDefault();
          stepQuestion(1);
          return;
        case "prevPaper":
        case "nextPaper": {
          const next = neighbour(queue.data ?? [], submissionId ?? null, command.kind === "nextPaper" ? 1 : -1);
          if (next) {
            event.preventDefault();
            goToPaper(next.id);
          }
          return;
        }
        case "save":
          event.preventDefault();
          void saveAndNext();
          return;
        case "help":
          event.preventDefault();
          setHelpOpen(true);
          return;
        case "closeHelp":
          setHelpOpen(false);
          return;
        default:
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [controller, currentQuestion, goToPaper, header?.readOnly, helpOpen, paper, queue.data, saveAndNext, stepQuestion, submissionId]);

  const title = assignment.data?.title ?? "Grading";

  if (queue.error) {
    return (
      <>
        <PageHeader title={title} />
        <div className="v-grade__center">
          <Notice tone="error">{`The queue could not be loaded (${queue.error.code}).`}</Notice>
        </div>
      </>
    );
  }

  if (!queue.loading && (queue.data?.length ?? 0) === 0) {
    return (
      <>
        <PageHeader title={title} />
        <div className="v-grade__center">
          <EmptyState title="Nothing to grade" icon={FileQuestion}>
            No papers handed in yet.
          </EmptyState>
        </div>
      </>
    );
  }

  const headerRight = (
    <div className="v-grade__header-right">
      {header?.chip ? <Chip tone={header.chip === "Released" ? "credit" : "teal"}>{header.chip}</Chip> : null}
      {header?.canReopen ? (
        <Button variant="quiet" onClick={() => setReopenOpen(true)}>
          Reopen
        </Button>
      ) : null}
      {header?.primary === "complete" ? (
        <Button
          variant="primary"
          size="lg"
          busy={controller.busy === "complete"}
          disabled={header.disabledReason !== null}
          title={header.disabledReason ?? undefined}
          onClick={async () => {
            const outcome = await controller.complete();
            if (outcome.ok) {
              toast({ message: "Review completed" });
              void queue.reload();
            }
          }}
        >
          Complete review
        </Button>
      ) : null}
      {header?.primary === "release" ? (
        <Button variant="primary" size="lg" onClick={() => setReleaseOpen(true)}>
          Release scores
        </Button>
      ) : null}
      <Button
        variant="quiet"
        icon={Keyboard}
        iconOnly
        aria-label="Keyboard shortcuts"
        onClick={() => setHelpOpen(true)}
      />
    </div>
  );

  return (
    <>
      <PageHeader
        title={title}
        left={
          <QueueSwitcher queue={queue.data ?? []} currentId={submissionId ?? null} onSelect={goToPaper} />
        }
        right={headerRight}
      />

      <div className="v-grade">
        <section className="v-grade__paper" aria-label="The paper">
          {pdf.loading || submission.loading ? (
            <div className="v-grade__center">
              <Spinner label="Loading the paper" />
            </div>
          ) : pdf.error ? (
            <div className="v-grade__center">
              <Notice tone="error">{`The paper could not be loaded (${pdf.error}).`}</Notice>
            </div>
          ) : pdf.blob ? (
            <PdfViewer
              blob={pdf.blob}
              page={page}
              onPageChange={setPage}
              marks={marks}
              hideMarks={hideMarks}
              onHideMarksChange={setHideMarks}
              onMarkSelect={(id) => setSelectedFlagId(flagIdFromMark(id))}
              label={paper ? `${paper.student_name}, handed in` : "Paper"}
            />
          ) : null}
        </section>

        <aside className={`v-grade__pane${sheetOpen ? " is-open" : ""}`} aria-label="Rubric and review">
          <button
            type="button"
            className="v-grade__grabber"
            aria-expanded={sheetOpen}
            onClick={() => setSheetOpen((was) => !was)}
          >
            <ChevronsUpDown size={16} strokeWidth={1.5} aria-hidden="true" />
            {sheetOpen ? "Hide the rubric" : "Show the rubric"}
          </button>
          {submission.error ? (
            <div className="v-grade__center">
              <Notice tone="error">{`This paper could not be loaded (${submission.error.code}).`}</Notice>
            </div>
          ) : paper && questions.length > 0 ? (
            <RubricPane
              submission={paper}
              questions={questions}
              selectedQuestionId={currentQuestion?.id ?? ""}
              onSelectQuestion={(id) => patchSelection({ questionId: id, flagId: null, showErrors: false })}
              controller={controller}
              readOnly={header?.readOnly ?? false}
              selectedFlagId={selectedFlagId}
              onSelectFlag={setSelectedFlagId}
              onGoToPage={setPage}
              onSaveAndNext={saveAndNext}
              onSkip={() => stepQuestion(1)}
              showErrors={showErrors}
            />
          ) : (
            <div className="v-grade__center">
              <Spinner label="Loading the review" />
            </div>
          )}
        </aside>
      </div>

      <Dialog
        open={helpOpen}
        title="Keyboard"
        description="These work anywhere in the workspace except inside a field."
        onClose={() => setHelpOpen(false)}
        secondary={{ label: "Close", onClick: () => setHelpOpen(false) }}
      >
        <ul className="v-grade__keys">
          {KEY_ROWS.map((row) => (
            <li key={row.label}>
              <span className="v-grade__keycaps">
                {row.keys.map((key, index) =>
                  key === "…" ? (
                    <span key={index} className="v-muted">
                      …
                    </span>
                  ) : (
                    <Kbd key={index}>{key}</Kbd>
                  ),
                )}
              </span>
              <span className="v-copy-14">{row.label}</span>
            </li>
          ))}
        </ul>
      </Dialog>

      <Dialog
        open={releaseOpen}
        title="Release scores"
        description={
          paper
            ? `${paper.student_name} will see the final score for every question. You can reopen the review afterwards.`
            : ""
        }
        onClose={() => setReleaseOpen(false)}
        primary={{
          label: "Release scores",
          busy: controller.busy === "release",
          onClick: async () => {
            const outcome = await controller.release();
            setReleaseOpen(false);
            if (outcome.ok && paper) {
              toast({ message: releaseToast(paper.student_name) });
              void queue.reload();
            }
          },
        }}
        secondary={{ label: "Cancel", onClick: () => setReleaseOpen(false) }}
      />

      <Dialog
        open={reopenOpen}
        title="Reopen this review"
        description="The final score goes back to pending until the review is completed and released again."
        onClose={() => setReopenOpen(false)}
        primary={{
          label: "Reopen",
          busy: controller.busy === "reopen",
          disabled: reopenReason.trim().length === 0,
          onClick: async () => {
            const outcome = await controller.reopen(reopenReason.trim());
            if (outcome.ok) {
              setReopenOpen(false);
              setReopenReason("");
              toast({ message: "Review reopened" });
              void queue.reload();
            }
          },
        }}
        secondary={{ label: "Cancel", onClick: () => setReopenOpen(false) }}
      >
        <Field
          label="Reason"
          as="textarea"
          rows={3}
          value={reopenReason}
          onChange={setReopenReason}
          hint="Recorded in the audit log, not shown to the student."
        />
      </Dialog>
    </>
  );
}

/** Everything about the workspace that belongs to one paper: which question is open, which flag
 *  is picked, which page the viewer shows and whether the fields are showing their errors yet. */
interface Selection {
  /** the paper and its question ids; a change means a different paper or a late-arriving rubric */
  key: string;
  questionId: string;
  flagId: string | null;
  showErrors: boolean;
  page: number;
}

function freshSelection(key: string, questions: { id: string }[]): Selection {
  return { key, questionId: questions[0]?.id ?? "", flagId: null, showErrors: false, page: 1 };
}
