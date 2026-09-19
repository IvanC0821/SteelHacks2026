import { useMemo, useReducer, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "../../app/PageHeader";
import { useSession } from "../../app/session-context";
import { Button } from "../../components/Button";
import { Field } from "../../components/Field";
import { Notice } from "../../components/Notice";
import { Score } from "../../components/Score";
import { ApiError } from "../../api/client";
import { AutoTextarea } from "./AutoTextarea";
import { dueDateError, toDueAtIso } from "./due-date";
import {
  initialQuestionsState,
  mapFieldErrors,
  questionsReducer,
  toQuestions,
  totalPoints,
  validateQuestions,
  type RowErrors,
} from "./questions";
import "./rubric.css";

export function NewAssignment() {
  const { courseId } = useParams();
  const { client, courses } = useSession();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [state, dispatch] = useReducer(questionsReducer, undefined, initialQuestionsState);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverRows, setServerRows] = useState<Record<string, RowErrors>>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const course = courses.find((c) => c.id === courseId) ?? null;
  const validation = useMemo(() => validateQuestions(state.rows), [state.rows]);
  const dueProblem = dueDateError(date, time);
  const titleError = submitted && title.trim() === "" ? "Give the assignment a title" : undefined;

  const errorFor = (key: string): RowErrors => ({
    ...(submitted ? validation.rows[key] : undefined),
    ...serverRows[key],
  });

  const create = async () => {
    setSubmitted(true);
    setServerRows({});
    setFormErrors([]);
    if (!courseId || title.trim() === "" || !validation.valid || dueProblem) return;
    setBusy(true);
    try {
      const assignment = await client.createAssignment(courseId, {
        title: title.trim(),
        questions: toQuestions(state.rows),
        due_at: toDueAtIso(date, time),
      });
      navigate(`/a/${assignment.id}/rubric`);
    } catch (cause) {
      if (cause instanceof ApiError && cause.fields.length > 0) {
        const mapped = mapFieldErrors(cause.fields, state.rows);
        setServerRows(mapped.rows);
        setFormErrors(mapped.form);
      } else if (cause instanceof ApiError && cause.denied) {
        setFormErrors(["Only the instructor of this course can create an assignment"]);
      } else {
        setFormErrors(["The assignment could not be created. Try again"]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="v-new">
      <PageHeader
        title="New assignment"
        subtitle={course?.name}
        right={
          <Button variant="primary" size="lg" busy={busy} onClick={create}>
            Create assignment
          </Button>
        }
      />

      <div className="v-new__body v-measure">
        {formErrors.length > 0 ? (
          <Notice tone="error">
            {formErrors.length === 1 ? formErrors[0] : formErrors.join(". ")}
          </Notice>
        ) : null}

        <div className="v-new__top">
          <Field
            label="Title"
            value={title}
            onChange={setTitle}
            error={titleError}
            placeholder="Homework 3"
            autoFocus
          />
          <div className="v-new__due">
            <Field label="Due date" type="date" value={date} onChange={setDate} hint="Optional" />
            <Field
              label="Time"
              type="time"
              value={time}
              onChange={setTime}
              hint="Defaults to 23:59"
              error={dueProblem ?? undefined}
            />
          </div>
        </div>

        <section className="v-new__questions" aria-label="Questions">
          <header className="v-new__questions-head">
            <h2 className="v-heading-16">Questions</h2>
            <p className="v-label-12">
              Total <Score value={totalPoints(state.rows)} size="sm" /> points
            </p>
          </header>

          <ol className="v-new__rows">
            {state.rows.map((row, index) => {
              const errors = errorFor(row.key);
              return (
                <li key={row.key} className="v-new__row">
                  <div className="v-new__row-head">
                    <span className="v-new__row-number v-label-12">{index + 1}</span>
                    <div className="v-new__row-move">
                      <Button
                        variant="quiet"
                        icon={ArrowUp}
                        iconOnly
                        aria-label={`Move question ${index + 1} up`}
                        disabled={index === 0}
                        title={index === 0 ? "This is the first question" : undefined}
                        onClick={() => dispatch({ type: "move", key: row.key, delta: -1 })}
                      />
                      <Button
                        variant="quiet"
                        icon={ArrowDown}
                        iconOnly
                        aria-label={`Move question ${index + 1} down`}
                        disabled={index === state.rows.length - 1}
                        title={index === state.rows.length - 1 ? "This is the last question" : undefined}
                        onClick={() => dispatch({ type: "move", key: row.key, delta: 1 })}
                      />
                      <Button
                        variant="quiet"
                        icon={Trash2}
                        iconOnly
                        aria-label={`Remove question ${index + 1}`}
                        disabled={state.rows.length === 1}
                        title={state.rows.length === 1 ? "An assignment needs one question" : undefined}
                        onClick={() => dispatch({ type: "remove", key: row.key })}
                      />
                    </div>
                  </div>

                  <div className="v-new__row-grid">
                    <Field
                      label="ID"
                      value={row.id}
                      onChange={(value) => dispatch({ type: "field", key: row.key, field: "id", value })}
                      error={errors.id}
                      className="v-new__field-id"
                    />
                    <Field
                      label="Title"
                      value={row.title}
                      onChange={(value) => dispatch({ type: "field", key: row.key, field: "title", value })}
                      error={errors.title}
                      placeholder="Solve the system"
                      className="v-new__field-title"
                    />
                    <Field
                      label="Points"
                      type="number"
                      value={row.points}
                      onChange={(value) => dispatch({ type: "field", key: row.key, field: "points", value })}
                      error={errors.points}
                      className="v-new__field-points"
                    />
                  </div>

                  <div className="v-new__prompt">
                    <label className="v-label-14" htmlFor={`prompt-${row.key}`}>
                      Prompt
                    </label>
                    <AutoTextarea
                      id={`prompt-${row.key}`}
                      value={row.prompt}
                      onValueChange={(value) => dispatch({ type: "field", key: row.key, field: "prompt", value })}
                      placeholder="What the question asks"
                      minRows={2}
                    />
                    {errors.prompt ? <p className="v-label-12 v-rubric__off">{errors.prompt}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="v-new__add">
            <Button variant="secondary" icon={Plus} onClick={() => dispatch({ type: "add" })}>
              Add question
            </Button>
            <p className="v-label-12">Questions and points lock when the first rubric is published.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
