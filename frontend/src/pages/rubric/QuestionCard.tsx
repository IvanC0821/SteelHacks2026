import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { formatPoints } from "../../components/score-format";
import type { Category, Criterion, Question } from "../../api/types";
import { AutoTextarea } from "./AutoTextarea";
import { CATEGORIES, CATEGORY_LABELS, pointsAssigned, pointsBalance } from "./draft";

export interface QuestionCardProps {
  question: Question;
  criteria: Criterion[];
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Pick<Criterion, "description" | "points" | "category">>) => void;
  onRemove: (id: string) => void;
}

/** One question's criteria, with the points it has left. The count is the honest one: what is
 *  assigned against the question's own maximum, red when it does not land exactly. */
export function QuestionCard({ question, criteria, canEdit, expanded, onToggle, onAdd, onUpdate, onRemove }: QuestionCardProps) {
  const assigned = pointsAssigned(criteria, question.id);
  const balance = pointsBalance(criteria, question);

  return (
    <section className={`v-rubric__card${expanded ? " is-expanded" : ""}`} aria-labelledby={`card-${question.id}`}>
      <h3>
        <button
          type="button"
          className="v-rubric__card-head"
          id={`card-${question.id}`}
          aria-expanded={expanded}
          aria-controls={`criteria-${question.id}`}
          onClick={onToggle}
        >
          <span className="v-rubric__card-title">
            <span className="v-heading-14">{question.title}</span>
            <span className={`v-label-12 ${balance === "exact" || criteria.length === 0 ? "" : "v-rubric__off"}`}>
              {formatPoints(assigned)} of {formatPoints(question.max_points)} points assigned
            </span>
          </span>
          <Icon glyph={ChevronDown} size={16} className="v-rubric__card-chevron" />
        </button>
      </h3>

      <div id={`criteria-${question.id}`} hidden={!expanded}>
        {expanded ? (
          <>
            <ul className="v-rubric__criteria">
              {criteria.map((criterion) => (
                <li key={criterion.id} className="v-rubric__criterion">
                  <AutoTextarea
                    value={criterion.description}
                    onValueChange={(value) => onUpdate(criterion.id, { description: value })}
                    placeholder="What earns these points"
                    aria-label={`Criterion for ${question.title}`}
                    disabled={!canEdit}
                  />
                  <div className="v-rubric__criterion-row">
                    <select
                      className="v-rubric__select"
                      value={criterion.category}
                      aria-label="Category"
                      disabled={!canEdit}
                      onChange={(event) => onUpdate(criterion.id, { category: event.target.value as Category })}
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category} value={category}>
                          {CATEGORY_LABELS[category]}
                        </option>
                      ))}
                    </select>
                    <input
                      className="v-rubric__points"
                      type="number"
                      min={0}
                      step={0.5}
                      value={Number.isFinite(criterion.points) ? criterion.points : ""}
                      aria-label="Points"
                      disabled={!canEdit}
                      onChange={(event) => onUpdate(criterion.id, { points: Number(event.target.value) })}
                    />
                    {canEdit ? (
                      <Button
                        variant="quiet"
                        icon={Trash2}
                        iconOnly
                        aria-label={`Remove criterion ${criterion.id}`}
                        onClick={() => onRemove(criterion.id)}
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>

            <footer className="v-rubric__card-foot">
              <p
                className={`v-label-12 ${balance === "exact" || criteria.length === 0 ? "" : "v-rubric__off"}`}
                role="status"
              >
                {formatPoints(assigned)} of {formatPoints(question.max_points)} points assigned
              </p>
              {canEdit ? (
                // One of these per question card, so the visible label needs the question behind it to
                // stay a distinct accessible name. The visible text stays the start of that name.
                <Button variant="quiet" icon={Plus} aria-label={`Add criterion to ${question.title}`} onClick={onAdd}>
                  Add criterion
                </Button>
              ) : null}
            </footer>
          </>
        ) : null}
      </div>
    </section>
  );
}
