import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { FileText, Sparkles } from "lucide-react";
import { PageHeader } from "../../app/PageHeader";
import { useAssignment } from "../../app/data";
import { useSession } from "../../app/session-context";
import { Button } from "../../components/Button";
import { Chip } from "../../components/Chip";
import { EmptyState } from "../../components/EmptyState";
import { Icon } from "../../components/Icon";
import { Notice } from "../../components/Notice";
import { Spinner } from "../../components/Spinner";
import { useToast } from "../../components/toast-context";
import { PdfViewer } from "../../pdf/PdfViewer";
import { usePdfBlob } from "../../pdf/usePdfBlob";
import { ApiError } from "../../api/client";
import type { AssignmentDetail, Criterion } from "../../api/types";
import { AUTOSAVE_DELAY, createDebounce, savedAtLabel } from "./autosave";
import { latestOfKind, setupChips } from "./documents";
import {
  criteriaFor,
  draftReducer,
  emptyDraft,
  isDirty,
  suggestedPoints,
  toRubricInput,
} from "./draft";
import { generateDisabledReason, useGeneratedDraft } from "./generate";
import { nextVersionLabel, publishBlockers, publishGateTitle, saveBlockers } from "./publish-gate";
import { QuestionCard } from "./QuestionCard";
import { saveDraft } from "./save";
import { SetupDrawer } from "./SetupDrawer";
import { setupSteps } from "./steps";
import { Versions } from "./Versions";
import "./rubric.css";

/** The header's Publish rubric button. The guided setup's third step points focus here instead
 *  of repeating the name, so the page never carries two buttons that read the same. */
const PUBLISH_BUTTON_ID = "publish-rubric";

const SAVE_ERRORS: Record<string, string> = {
  rubric_points_mismatch: "The server refused the draft: a question's points do not add up",
  rubric_question_coverage: "The server refused the draft: every question needs at least one criterion",
  duplicate_criterion: "The server refused the draft: two criteria share an ID",
  invalid_request: "The server refused the draft: check the criteria you just edited",
  course_access_denied: "Only the instructor can edit the rubric",
  network: "The draft could not reach the server. It is still here; try Save draft again",
};

export function RubricStudio() {
  const { assignmentId } = useParams();
  const { client, user, capabilities } = useSession();
  const { toast } = useToast();
  const assignment = useAssignment(assignmentId);
  const detail = assignment.data;

  const [state, dispatch] = useReducer(draftReducer, undefined, emptyDraft);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [paperOpen, setPaperOpen] = useState(false);
  const [page, setPage] = useState(1);

  const canEdit = user.role === "instructor";
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!detail || loadedFor.current === detail.id) return;
    loadedFor.current = detail.id;
    dispatch({ type: "load", draft: detail.rubric_draft ?? null, revision: detail.draft_revision ?? 0 });
    setSavedAt(null);
    setSaveError(null);
  }, [detail]);

  const questions = detail?.questions ?? [];
  const documents = useMemo(() => detail?.documents ?? [], [detail]);
  const rubrics = useMemo(() => detail?.rubrics ?? [], [detail]);
  const dirty = isDirty(state);
  const draftInput = useMemo(() => toRubricInput(state), [state]);
  const unsavable = saveBlockers(questions, draftInput);

  // --- saving -------------------------------------------------------------
  const latest = useRef({ state, detail, unsavable });
  useEffect(() => {
    latest.current = { state, detail, unsavable };
  }, [state, detail, unsavable]);

  const save = useCallback(async () => {
    const { state: now, detail: current, unsavable: blocked } = latest.current;
    if (!current || !canEdit || blocked.length > 0 || !isDirty(now)) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await saveDraft(client, current.id, toRubricInput(now), now.revision);
      dispatch({ type: "saved", draft: result.draft, revision: result.revision });
      setSavedAt(new Date());
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : "unknown";
      setSaveError(SAVE_ERRORS[code] ?? "The draft could not be saved. Try again");
    } finally {
      setSaving(false);
    }
  }, [canEdit, client]);

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  const autosave = useRef(createDebounce(() => void saveRef.current(), AUTOSAVE_DELAY));

  useEffect(() => {
    const debounced = autosave.current;
    if (!canEdit || !dirty || unsavable.length > 0) {
      debounced.cancel();
      return;
    }
    debounced.schedule();
    return () => debounced.cancel();
  }, [canEdit, dirty, unsavable.length, state]);

  // --- generated draft ----------------------------------------------------
  const onGenerated = useCallback((loaded: AssignmentDetail) => {
    dispatch({
      type: "load",
      draft: loaded.rubric_draft ?? null,
      revision: loaded.draft_revision ?? 0,
      generated: true,
    });
    assignment.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const generate = useGeneratedDraft(client, detail?.id ?? "", onGenerated);

  // --- publishing ---------------------------------------------------------
  const blockers = publishBlockers({
    questions,
    draft: state.criteria.length > 0 ? draftInput : null,
    dirty,
    rubrics,
    documents,
    role: user.role,
  });

  const publish = async () => {
    if (!detail) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const rubric = await client.publishRubric(detail.id);
      dispatch({ type: "reviewed" });
      generate.dismiss();
      toast({ message: `Rubric v${rubric.version} published` });
      assignment.refetch();
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : "unknown";
      setPublishError(
        code === "rubric_draft_required"
          ? "There is no draft to publish yet"
          : code === "course_access_denied"
            ? "Only the instructor can publish a rubric"
            : "The rubric could not be published. Try again",
      );
    } finally {
      setPublishing(false);
    }
  };

  /** Step 3 of the guided card: send the instructor to the real Publish rubric button, which
   *  carries the gate and its reason. Scrolled into view first so focus does not jump blind. */
  const goToPublish = () => {
    const target = document.getElementById(PUBLISH_BUTTON_ID);
    if (!target) return;
    target.scrollIntoView({ block: "nearest", behavior: "smooth" });
    target.focus({ preventScroll: true });
  };

  // --- the paper ----------------------------------------------------------
  const solution = latestOfKind(documents, "solution");
  const paperDocument = solution ?? latestOfKind(documents, "questions");
  const pdf = usePdfBlob(client, paperDocument?.id ?? null);

  if (assignment.loading && !detail) {
    return (
      <div className="v-rubric v-rubric--loading">
        <Spinner size={20} label="Loading the assignment" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="v-rubric v-rubric--loading">
        <EmptyState title="Assignment not found">
          {assignment.error === "course_access_denied"
            ? "This assignment belongs to a course you do not teach."
            : "That assignment id does not resolve. Pick one from the rail."}
        </EmptyState>
      </div>
    );
  }

  const chips = setupChips(documents);
  const steps = setupSteps(detail);
  const guided = documents.length === 0 && state.criteria.length === 0;
  const generateReason = generateDisabledReason(capabilities, solution !== null);

  const addCriterion = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return;
    dispatch({ type: "add", questionId, points: suggestedPoints(state.criteria, question) });
  };

  const saveLine = saving
    ? "Saving the draft"
    : saveError
      ? saveError
      : dirty && unsavable.length > 0
        ? `Not saved: ${unsavable[0]}`
        : dirty
          ? "Unsaved edits"
          : savedAt
            ? savedAtLabel(savedAt)
            : state.saved
              ? "Draft saved"
              : "No draft yet";

  return (
    <div className="v-rubric">
      <PageHeader
        title={`${detail.title} · Rubric`}
        right={
          <div className="v-rubric__actions">
            {blockers.length > 0 ? <p className="v-label-12 v-rubric__reason">{blockers[0]}</p> : null}
            <Button
              id={PUBLISH_BUTTON_ID}
              variant="primary"
              size="lg"
              disabled={blockers.length > 0 || publishing}
              busy={publishing}
              title={publishGateTitle(blockers)}
              onClick={publish}
            >
              Publish rubric
            </Button>
          </div>
        }
      />

      <div className="v-rubric__strip">
        <div className="v-rubric__chips">
          {chips.map((chip) => (
            <button
              key={chip.kind}
              type="button"
              className="v-rubric__chip"
              onClick={() => setSetupOpen(true)}
              aria-label={`${chip.label}: ${chip.detail ?? (canEdit ? "add" : "nothing attached")}. Open assignment setup`}
            >
              <Icon glyph={FileText} size={16} />
              <span className="v-label-14">{chip.label}</span>
              <span className="v-label-12 v-rubric__chip-detail">
                {chip.detail ?? (canEdit ? "Add" : "None")}
              </span>
            </button>
          ))}
        </div>
        <Versions rubrics={rubrics} questions={questions} />
      </div>

      {publishError ? (
        <Notice tone="error" className="v-rubric__banner">
          {publishError}
        </Notice>
      ) : null}

      <div className={`v-rubric__panes ${paperOpen ? "is-paper-open" : ""}`}>
        <section className="v-rubric__paper" aria-label="Reference document">
          <div className="v-rubric__paper-bar">
            <p className="v-label-12">
              {paperDocument
                ? `${solution ? "Instructor solution" : "Blank assignment"} · ${paperDocument.filename}`
                : "No reference attached"}
            </p>
            <Button variant="quiet" className="v-rubric__paper-toggle" onClick={() => setPaperOpen((was) => !was)}>
              {paperOpen ? "Hide solution" : "Show solution"}
            </Button>
          </div>
          {pdf.blob ? (
            <PdfViewer
              blob={pdf.blob}
              page={page}
              onPageChange={setPage}
              label={paperDocument?.filename ?? "Reference document"}
              className="v-rubric__viewer"
            />
          ) : pdf.loading ? (
            <div className="v-rubric__paper-empty">
              <Spinner size={20} label="Loading the document" />
            </div>
          ) : (
            <div className="v-rubric__paper-empty">
              <EmptyState
                title="Add the instructor solution"
                icon={FileText}
                action={
                  canEdit ? (
                    <Button variant="secondary" onClick={() => setSetupOpen(true)}>
                      Open setup
                    </Button>
                  ) : undefined
                }
              >
                {pdf.error
                  ? "That document could not be loaded. Open setup to check what is attached."
                  : "The rubric is written against the solution, which stays private to staff."}
              </EmptyState>
            </div>
          )}
        </section>

        <aside className="v-rubric__editor" aria-label="Rubric draft">
          <div className="v-rubric__editor-scroll">
          {guided ? (
            <section className="v-rubric__guide">
              <h2 className="v-heading-16">Set up {detail.title}</h2>
              <ol className="v-rubric__steps">
                {steps.map((step, index) => (
                  <li key={step.id} className={`v-rubric__step ${step.current ? "is-current" : ""}`}>
                    <span className="v-rubric__step-number">{index + 1}</span>
                    <div className="v-rubric__step-text">
                      <p className="v-heading-14">{step.title}</p>
                      <p className="v-copy-14">{step.sentence}</p>
                      {!canEdit ? null : step.id === "publish" && blockers.length > 0 ? (
                        // Not a disabled button: the header already carries Publish rubric with
                        // its own gate, and a second control reading the same name would give a
                        // screen reader two identical buttons. The step states the reason instead.
                        <p className="v-label-12 v-rubric__step-blocked">{blockers[0]}</p>
                      ) : (
                        <Button
                          variant={step.current ? "secondary" : "quiet"}
                          onClick={() => {
                            if (step.id === "solution") setSetupOpen(true);
                            else if (step.id === "draft") addCriterion(questions[0]?.id ?? "");
                            else goToPublish();
                          }}
                        >
                          {step.action}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {canEdit ? (
            <div className="v-rubric__editor-top">
              <Button
                variant="secondary"
                icon={Sparkles}
                onClick={generate.start}
                busy={generate.status === "running"}
                disabled={generateReason !== undefined || generate.status === "running"}
                title={generateReason}
              >
                Request generated draft
              </Button>
              {state.generated ? <Chip tone="ai" /> : null}
              {state.generated && capabilities.mode === "fixture" ? <Chip tone="fixture" /> : null}
            </div>
          ) : (
            <Notice tone="info" className="v-rubric__banner">
              TAs can read the rubric. Only the instructor edits and publishes it.
            </Notice>
          )}

          {generate.status === "running" ? (
            <p className="v-rubric__generating v-copy-14" role="status">
              <Spinner size={16} /> Generating a draft from your solution…
            </p>
          ) : null}
          {generate.message ? (
            <Notice tone="warn" className="v-rubric__banner" action={<Button variant="quiet" onClick={generate.dismiss}>Dismiss</Button>}>
              {generate.message}
            </Notice>
          ) : null}
          {state.generated ? (
            <Notice tone="info" className="v-rubric__banner">
              Generated draft loaded. Review every line before publishing.
            </Notice>
          ) : null}

          <div className="v-rubric__cards">
            {questions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                criteria={criteriaFor(state.criteria, question.id)}
                canEdit={canEdit}
                onAdd={() => addCriterion(question.id)}
                onUpdate={(id, patch: Partial<Criterion>) => dispatch({ type: "update", id, patch })}
                onRemove={(id) => dispatch({ type: "remove", id })}
              />
            ))}
          </div>

          <div className="v-rubric__notes">
            <label className="v-label-14" htmlFor="instructor-notes">
              Notes to the model and TAs
            </label>
            <textarea
              id="instructor-notes"
              className="v-rubric__textarea"
              rows={4}
              value={state.instructorNotes}
              disabled={!canEdit}
              placeholder="Alternative methods, strictness"
              onChange={(event) => dispatch({ type: "notes", value: event.target.value })}
            />
          </div>
          </div>

          <footer className="v-rubric__save">
            <div className="v-rubric__save-text">
              <p className={`v-label-12 ${saveError ? "v-rubric__off" : ""}`} role="status">
                {saveLine}
              </p>
              <p className="v-label-12">Publishing creates {nextVersionLabel(rubrics)}</p>
            </div>
            {canEdit ? (
              <Button
                variant="secondary"
                disabled={!dirty || unsavable.length > 0 || saving}
                busy={saving}
                title={!dirty ? "Nothing to save" : unsavable[0]}
                onClick={() => {
                  autosave.current.cancel();
                  void save();
                }}
              >
                Save draft
              </Button>
            ) : null}
          </footer>
        </aside>
      </div>

      <SetupDrawer
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        client={client}
        assignmentId={detail.id}
        documents={documents}
        capabilities={capabilities}
        canUpload={canEdit}
        onUploaded={assignment.refetch}
      />
    </div>
  );
}
