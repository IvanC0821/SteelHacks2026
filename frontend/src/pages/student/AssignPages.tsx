import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button, Chip, Kbd, Notice, Spinner, useToast } from "../../components";
import { PageHeader, useAssignment, useCapabilities, useClient, useSubmission } from "../../app";
import { PageThumbnails, usePdfBlob } from "../../pdf";
import { ApiError } from "../../api/client";
import type { Question, StudentSubmission } from "../../api/types";
import { Stepper } from "./Stepper";
import {
  completeness,
  mappingPayload,
  pagesFor,
  questionsOnPage,
  saveBlockedReason,
  selectionFromMapping,
  togglePage,
  type PageSelection,
} from "./lib/mapping";
import "./student.css";

interface Draft {
  /** the attempt and saved mapping this draft was started from */
  key: string;
  selection: PageSelection;
  /** the question the tiles toggle */
  active: string;
}

const SAVE_FAILURES: Record<string, string> = {
  map_every_question: "Give every question at least one page before saving.",
  invalid_page_mapping: "One of those pages is not in this PDF. Pick pages from the thumbnails.",
  attempt_frozen_upload_revision:
    "This attempt is already checked. Upload a revision to change the pages.",
  deadline_passed: "The due date has passed, so this attempt can no longer be changed.",
};

/** Step 2: which pages hold which question. A page may belong to several questions and a question
 *  may span pages, so this is a toggle per (question, page), never a single-select. */
export function AssignPages() {
  const { submissionId = "" } = useParams();
  const client = useClient();
  const capabilities = useCapabilities();
  const navigate = useNavigate();
  const { toast } = useToast();

  const submission = useSubmission(submissionId);
  const attempt = (submission.data ?? null) as StudentSubmission | null;
  const assignment = useAssignment(attempt?.assignment_id);
  const pdf = usePdfBlob(client, attempt?.document_id ?? null);

  const questions: Question[] = useMemo(() => assignment.data?.questions ?? [], [assignment.data]);
  const pageCount = attempt?.document.page_count ?? 0;

  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<"save" | "check" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // The saved mapping is the starting point; the draft takes over as soon as the reader touches a
  // tile. Keying the draft to the attempt means a refetch or a different attempt resets it without
  // an effect that writes state during render.
  const key = attempt ? `${attempt.id}:${JSON.stringify(attempt.mapping ?? {})}` : "";
  const saved = useMemo(
    () => (attempt ? selectionFromMapping(attempt.mapping, questions, attempt.document.page_count) : {}),
    [attempt, questions],
  );
  const view: Draft =
    draft && draft.key === key ? draft : { key, selection: saved, active: questions[0]?.id ?? "" };
  const { selection, active } = view;

  const state = completeness(selection, questions);
  const canCheck = capabilities.mode !== "unconfigured" && capabilities.automated_assessment;
  // A checked or handed-in attempt is frozen; the backend refuses a new mapping (409).
  const frozen = Boolean(attempt?.sealed || attempt?.final);
  const blocked = frozen
    ? "This attempt is already checked. Upload a revision to change its pages."
    : saveBlockedReason(selection, questions);

  function setActive(questionId: string) {
    setDraft({ ...view, active: questionId });
  }

  function toggle(page1: number) {
    if (!active) return;
    setDraft({ ...view, selection: togglePage(selection, active, page1 - 1) });
  }

  // number keys pick a question; arrows walk the tiles; space toggles the focused tile natively
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (/^[1-9]$/.test(event.key)) {
        const question = questions[Number(event.key) - 1];
        if (question) {
          event.preventDefault();
          setDraft((current) =>
            current && current.key === key
              ? { ...current, active: question.id }
              : { key, selection: saved, active: question.id },
          );
        }
        return;
      }
      if (!event.key.startsWith("Arrow")) return;
      const tiles = Array.from(gridRef.current?.querySelectorAll<HTMLButtonElement>("button.v-thumbs__tile") ?? []);
      if (tiles.length === 0) return;
      const index = tiles.findIndex((tile) => tile === document.activeElement);
      const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
      const next = index < 0 ? 0 : Math.min(tiles.length - 1, Math.max(0, index + step));
      event.preventDefault();
      tiles[next]?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [questions, key, saved]);

  async function save(then: "stay" | "check") {
    setBusy(then === "check" ? "check" : "save");
    setProblem(null);
    try {
      await client.saveMapping(submissionId, mappingPayload(selection, questions));
      if (then === "stay") {
        toast({ message: "Pages saved" });
        submission.refetch();
        return;
      }
      await client.startAssessment(submissionId);
      navigate(`/s/${submissionId}`);
    } catch (cause) {
      const code = cause instanceof ApiError ? cause.code : "network";
      setProblem(SAVE_FAILURES[code] ?? "That did not save. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const actions = (
    <>
      <Button
        variant="secondary"
        disabled={Boolean(blocked) || busy !== null}
        busy={busy === "save"}
        title={blocked ?? undefined}
        onClick={() => void save("stay")}
      >
        Save pages
      </Button>
      {canCheck ? (
        <Button
          variant="primary"
          size="lg"
          disabled={!state.complete || frozen || busy !== null}
          busy={busy === "check"}
          title={blocked ?? (state.complete ? undefined : "Give every question at least one page first")}
          onClick={() => void save("check")}
        >
          Check my work
        </Button>
      ) : null}
    </>
  );

  const header = (
    <PageHeader
      title={assignment.data ? `${assignment.data.title} · Attempt ${attempt?.version ?? ""}` : "Assign pages"}
      left={<Stepper current={2} />}
      right={<div className="v-student-header-actions v-student-assign-actions">{actions}</div>}
    />
  );

  if (submission.error || assignment.error) {
    return (
      <>
        {header}
        <div className="v-student-page">
          <Notice tone="error">This attempt could not be loaded.</Notice>
        </div>
      </>
    );
  }

  return (
    <>
      {header}
      <div className="v-student-workspace v-student-workspace--stack">
        <div className="v-student-workspace__paper v-student-assign__pages" ref={gridRef}>
          {pdf.error ? (
            <div className="v-student-workspace__state">
              <Notice tone="error">{`Your PDF could not be fetched (${pdf.error}).`}</Notice>
            </div>
          ) : pdf.blob ? (
            <PageThumbnails
              blob={pdf.blob}
              layout="grid"
              tileWidth={176}
              label={`Pages of attempt ${attempt?.version ?? ""}`}
              overlayPosition="bottom"
              selected={active ? pagesFor(selection, active).map((p) => p + 1) : []}
              onSelect={frozen ? undefined : toggle}
              overlay={(page) => (
                <span className="v-student-assign__chips">
                  {questionsOnPage(selection, questions, page - 1).map((question) => (
                    <Chip
                      key={question.id}
                      tone={question.id === active ? "teal" : "neutral"}
                      title={question.title}
                    >
                      {shortName(question, questions)}
                    </Chip>
                  ))}
                </span>
              )}
            />
          ) : (
            <div className="v-student-workspace__state">
              <Spinner size={20} label="Loading your pages" />
            </div>
          )}
        </div>

        <aside className="v-student-workspace__pane" aria-label="Questions">
          <div className="v-student-pane__body">
            {frozen ? (
              <Notice tone="info">
                This attempt is already checked, so its pages are fixed. Upload a revision to change
                which pages hold which question.
              </Notice>
            ) : (
              <p className="v-copy-14 v-student-pane__lede">
                Pick a question, then click every page that holds your answer. A page can belong to
                more than one question.
              </p>
            )}
            <ul className="v-student-question-list">
              {questions.map((question, index) => {
                const pages = pagesFor(selection, question.id);
                return (
                  <li key={question.id}>
                    <button
                      type="button"
                      className={`v-student-question${question.id === active ? " is-active" : ""}`}
                      aria-current={question.id === active}
                      onClick={() => setActive(question.id)}
                    >
                      <span className="v-student-question__head">
                        <span className="v-label-14">{`${index + 1}. ${question.title}`}</span>
                        <Kbd>{String(index + 1)}</Kbd>
                      </span>
                      <span className="v-copy-14 v-student-question__pages">
                        {pages.length === 0
                          ? "No pages yet"
                          : `Page${pages.length > 1 ? "s" : ""} ${pages.map((p) => p + 1).join(", ")}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="v-student-pane__footer">
            {problem ? <Notice tone="error">{problem}</Notice> : null}
            {!canCheck ? (
              <Notice tone="info">
                Automated assessment is not connected yet. You can still hand in for staff review.
              </Notice>
            ) : null}
            <p className="v-copy-14 v-student-pane__count" role="status">
              {state.sentence}
            </p>
            <div className="v-student-pane__actions">{actions}</div>
            <p className="v-label-12 v-student-pane__hint">
              {pageCount > 0 ? `${pageCount} pages in this PDF. ` : ""}
              {frozen
                ? "Every page stays as you assigned it."
                : "Number keys pick a question, arrows move between pages, space toggles one."}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

/** "Q1" style short name, matched to the question's position in the assignment. */
function shortName(question: Question, questions: Question[]): string {
  const index = questions.findIndex((q) => q.id === question.id);
  return `Q${index + 1}`;
}
