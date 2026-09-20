import { useEffect, useMemo, useRef } from "react";
import { Sparkles } from "lucide-react";
import { Button, Chip, Field, Notice, Score } from "../../components";
import type { Question, StaffSubmission } from "../../api/types";
import {
  categoryLabel,
  categoryTone,
  decisionMap,
  marksForQuestion,
  OUTCOME_LABEL,
  pagesSentence,
  questionAssessment,
  suggestedMetIds,
} from "./assessment";
import { conflictSentence, criteriaFor, progressSentence, validateDraft } from "./review-state";
import type { ReviewController } from "./useReview";
import "./RubricPane.css";

export interface RubricPaneProps {
  submission: StaffSubmission;
  questions: Question[];
  selectedQuestionId: string;
  onSelectQuestion: (questionId: string) => void;
  controller: ReviewController;
  readOnly: boolean;
  selectedFlagId: string | null;
  onSelectFlag: (flagId: string | null) => void;
  onGoToPage: (page: number) => void;
  onSaveAndNext: () => void;
  onSkip: () => void;
  /** true while the reviewer has pressed Save and the fields should show their errors */
  showErrors: boolean;
}

export function RubricPane({
  submission,
  questions,
  selectedQuestionId,
  onSelectQuestion,
  controller,
  readOnly,
  selectedFlagId,
  onSelectFlag,
  onGoToPage,
  onSaveAndNext,
  onSkip,
  showErrors,
}: RubricPaneProps) {
  const { state } = controller;
  const scrollRef = useRef<HTMLDivElement>(null);
  const question = questions.find((q) => q.id === selectedQuestionId) ?? questions[0];
  const criteria = useMemo(
    () => criteriaFor(submission.rubric.criteria, question?.id ?? ""),
    [submission.rubric.criteria, question?.id],
  );
  const decisions = useMemo(() => decisionMap(submission.assessment), [submission.assessment]);
  const qAssessment = questionAssessment(submission.assessment, question?.id ?? "");
  const draft = state.drafts[question?.id ?? ""] ?? { score: "", reason: "", tally: [] };
  const validity = validateDraft(draft, question?.max_points ?? 0);
  const pages = pagesSentence(submission.mapping, question?.id ?? "");
  const metIds = suggestedMetIds(criteria, decisions);
  const flags = qAssessment?.flags ?? [];
  const marks = marksForQuestion(submission.id, question?.id ?? "", flags, selectedFlagId);
  const isFixture = submission.assessment?.mode === "fixture";

  // A conflict arrives while the reviewer is deep in the pane: bring the notice into view.
  useEffect(() => {
    if (state.conflict) scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [state.conflict]);

  if (!question) {
    return (
      <div className="v-grade-pane">
        <Notice tone="info">This assignment has no questions.</Notice>
      </div>
    );
  }

  return (
    <div className="v-grade-pane">
      <div className="v-grade-pane__scroll" ref={scrollRef}>
        {submission.assessment ? (
          <p className="v-grade-pane__estimate">
            <span className="v-label-12 v-muted">Estimated, whole paper</span>
            <Score value={submission.assessment.score} max={submission.assessment.max_points} size="sm" />
            {isFixture ? <Chip tone="fixture" /> : null}
          </p>
        ) : null}

        <div className="v-grade-pane__chips" role="tablist" aria-label="Questions">
          {questions.map((q, index) => {
            const saved = state.saved[q.id];
            const estimate = questionAssessment(submission.assessment, q.id);
            const current = q.id === question.id;
            return (
              <button
                key={q.id}
                type="button"
                role="tab"
                aria-selected={current}
                className={`v-grade-qchip${current ? " is-current" : ""}${saved ? " is-saved" : ""}`}
                title={q.title}
                onClick={() => onSelectQuestion(q.id)}
              >
                <span className="v-grade-qchip__id">{`Q${index + 1}`}</span>
                <span className="v-grade-qchip__value">
                  {saved ? (
                    <Score value={saved.score} size="sm" />
                  ) : estimate && estimate.score !== null ? (
                    <span className="v-grade-qchip__estimate">{estimate.score}</span>
                  ) : (
                    <span className="v-grade-qchip__dash" aria-hidden="true">
                      —
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {state.conflict ? (
          <Notice
            tone="warn"
            title="This review moved"
            action={
              <Button variant="quiet" onClick={controller.dismissConflict}>
                Dismiss
              </Button>
            }
          >
            {conflictSentence(questions, state.conflict)}
          </Notice>
        ) : null}

        <section className="v-grade-pane__block">
          <h2 className="v-heading-16">{question.title}</h2>
          <p className="v-copy-14 v-grade-pane__prompt">{question.prompt}</p>
          {pages ? (
            <button type="button" className="v-grade-pane__pages" onClick={() => onGoToPage(firstPage(submission, question.id))}>
              {pages}
            </button>
          ) : (
            <p className="v-label-12 v-muted">The student did not map this question to a page.</p>
          )}
        </section>

        {!submission.assessment ? (
          <Notice tone="info">No automated estimate for this paper.</Notice>
        ) : null}

        <section className="v-grade-pane__block">
          <div className="v-grade-pane__block-head">
            <h3 className="v-heading-14">{`Rubric v${submission.rubric.version}`}</h3>
            {submission.assessment && metIds.length > 0 && !readOnly ? (
              <Button variant="quiet" icon={Sparkles} onClick={() => controller.fillFromSuggestion(question.id, metIds)}>
                Fill from suggestion
              </Button>
            ) : null}
          </div>
          <p className="v-label-12 v-muted v-grade-pane__tally-help">
            {readOnly
              ? "Criteria show points available. The saved score is below."
              : "Select criteria to fill the score below. Only the score and reason are saved."}
          </p>
          <ul className="v-grade-criteria">
            {criteria.map((criterion, index) => {
              const decision = decisions.get(criterion.id);
              const ticked = draft.tally.includes(criterion.id);
              return (
                <li key={criterion.id} className={`v-grade-criterion${ticked ? " is-ticked" : ""}`}>
                  <button
                    type="button"
                    className="v-grade-criterion__toggle"
                    aria-pressed={ticked}
                    disabled={readOnly}
                    onClick={() => controller.toggleCriterion(question.id, criterion.id)}
                  >
                    <span className="v-grade-criterion__key" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className="v-grade-criterion__body">
                      <span className="v-copy-14">{criterion.description}</span>
                      <span className="v-grade-criterion__meta">
                        <Chip>{categoryLabel(criterion.category)}</Chip>
                        {decision ? <Chip tone="ai">{OUTCOME_LABEL[decision.outcome]}</Chip> : null}
                      </span>
                    </span>
                    <span className="v-grade-criterion__points">
                      <Score value={criterion.points} delta={ticked} size="sm" />
                      <span className="v-label-12 v-muted">{ticked ? "In tally" : "Available"}</span>
                    </span>
                  </button>
                  {decision?.rationale ? (
                    <details className="v-grade-criterion__why">
                      <summary className="v-label-12">Why</summary>
                      <p className="v-copy-14">{decision.rationale}</p>
                    </details>
                  ) : null}
                </li>
              );
            })}
            {criteria.length === 0 ? (
              <li className="v-label-12 v-muted">This rubric version has no criteria for this question.</li>
            ) : null}
          </ul>
        </section>

        <section className="v-grade-pane__block v-grade-pane__decision">
          <Field
            label="Score"
            type="number"
            value={draft.score}
            onChange={(value) => controller.setScore(question.id, value)}
            disabled={readOnly}
            error={showErrors ? (validity.score ?? undefined) : undefined}
            trailing={<span className="v-label-14 v-muted">{`/ ${question.max_points}`}</span>}
            className="v-grade-pane__score-field"
          />
          <Field
            label="Reason"
            as="textarea"
            rows={2}
            value={draft.reason}
            onChange={(value) => controller.setReason(question.id, value)}
            disabled={readOnly}
            placeholder="Private to staff"
            error={showErrors ? (validity.reason ?? undefined) : undefined}
          />
        </section>

        {flags.length > 0 ? (
          <section className="v-grade-pane__block">
            <div className="v-grade-pane__block-head">
              <h3 className="v-heading-14">Flags on the paper</h3>
              {isFixture ? <Chip tone="fixture" /> : null}
            </div>
            <ul className="v-grade-flags">
              {flags.map((flag, index) => {
                const page = marks.find((m) => m.id.includes(flag.id))?.page;
                return (
                  <li key={flag.id}>
                    <button
                      type="button"
                      className={`v-grade-flag${flag.id === selectedFlagId ? " is-selected" : ""}`}
                      onClick={() => {
                        onSelectFlag(flag.id === selectedFlagId ? null : flag.id);
                        if (page) onGoToPage(page);
                      }}
                    >
                      <Chip tone={categoryTone(flag.category)} number={index + 1}>
                        {categoryLabel(flag.category)}
                      </Chip>
                      <span className="v-copy-14 v-grade-flag__message">{flag.message}</span>
                      {page ? <span className="v-label-12 v-muted">{`Page ${page}`}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>

      <footer className="v-grade-pane__footer">
        <div className="v-grade-pane__actions">
          <Button
            variant="primary"
            size="lg"
            busy={controller.busy === "save"}
            disabled={readOnly}
            title={readOnly ? "This review is closed for editing" : undefined}
            onClick={onSaveAndNext}
          >
            Save and next
          </Button>
          <Button variant="quiet" size="lg" onClick={onSkip}>
            Skip
          </Button>
        </div>
        <p className="v-label-12 v-grade-pane__progress" role="status">
          {progressSentence(questions, state.saved)}
        </p>
      </footer>
    </div>
  );
}

function firstPage(submission: StaffSubmission, questionId: string): number {
  return submission.mapping?.[questionId]?.[0] ?? 1;
}
