import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Icon } from "../../components/Icon";
import { Score } from "../../components/Score";
import type { Question, Rubric } from "../../api/types";
import { CATEGORY_LABELS } from "./draft";
import { publishedDate, publishedTime, versionLine, versionSummary } from "./save";

export interface VersionsProps {
  rubrics: Rubric[];
  questions: Question[];
}

/** The quiet line under the header, with a popover listing every published version read-only. */
export function Versions({ rubrics, questions }: VersionsProps) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (rubrics.length === 0) {
    return <p className="v-label-12 v-rubric__versions-line">No version published yet</p>;
  }

  const latest = rubrics[rubrics.length - 1];
  const current = rubrics.find((rubric) => rubric.id === shown) ?? null;

  return (
    <div className="v-rubric__versions" ref={wrap}>
      <button
        type="button"
        className="v-rubric__versions-button v-label-12"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        {versionLine(latest)}
        <Icon glyph={ChevronDown} size={16} />
      </button>
      {open ? (
        <div className="v-rubric__popover" role="dialog" aria-label="Published rubric versions">
          <ul className="v-rubric__version-list">
            {[...rubrics].reverse().map((rubric) => (
              <li key={rubric.id}>
                <button
                  type="button"
                  className={`v-rubric__version ${shown === rubric.id ? "is-open" : ""}`}
                  aria-expanded={shown === rubric.id}
                  onClick={() => setShown(shown === rubric.id ? null : rubric.id)}
                >
                  <span className="v-heading-14">Rubric v{rubric.version}</span>
                  <span className="v-label-12">
                    {publishedDate(rubric.published_at)}, {publishedTime(rubric.published_at)} · {versionSummary(rubric)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {current ? (
            <div className="v-rubric__version-detail">
              {questions.map((question) => {
                const criteria = current.criteria.filter((c) => c.question_id === question.id);
                if (criteria.length === 0) return null;
                return (
                  <div key={question.id} className="v-rubric__version-question">
                    <p className="v-heading-14">{question.title}</p>
                    <ul>
                      {criteria.map((criterion) => (
                        <li key={criterion.id} className="v-rubric__version-criterion">
                          <span className="v-copy-14">{criterion.description}</span>
                          <span className="v-label-12">{CATEGORY_LABELS[criterion.category]}</span>
                          <Score value={criterion.points} size="sm" />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {current.instructor_notes.trim() ? (
                <div className="v-rubric__version-question">
                  <p className="v-heading-14">Notes</p>
                  <p className="v-copy-14">{current.instructor_notes}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
