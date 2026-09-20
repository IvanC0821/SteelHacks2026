import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { assessmentState, Button, Score, StatusChip } from "../../components";
import type { StaffSubmission } from "../../api/types";
import { entryFor, estimateOf, switcherLabel } from "./queue";
import "./QueueSwitcher.css";

export interface QueueSwitcherProps {
  queue: StaffSubmission[];
  currentId: string | null;
  onSelect: (submissionId: string) => void;
}

/** The header's paper switcher: previous, the roster popover, next. The queue lives here, not in
 *  a left pane, so the paper keeps the width. */
export function QueueSwitcher({ queue, currentId, onSelect }: QueueSwitcherProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const entry = entryFor(queue, currentId);
  const index = entry ? entry.position - 1 : -1;

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const step = (delta: 1 | -1) => {
    const next = queue[index + delta];
    if (next) onSelect(next.id);
  };

  return (
    <div className="v-grade-switcher" ref={wrapRef}>
      <Button
        variant="quiet"
        icon={ChevronLeft}
        iconOnly
        aria-label="Previous paper"
        disabled={index <= 0}
        title={index <= 0 ? "This is the first paper" : undefined}
        onClick={() => step(-1)}
      />
      <button
        type="button"
        className="v-grade-switcher__label"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((was) => !was)}
      >
        <span className="v-grade-switcher__full">{switcherLabel(entry)}</span>
        <span className="v-grade-switcher__compact">{switcherLabel(entry, true)}</span>
      </button>
      <Button
        variant="quiet"
        icon={ChevronRight}
        iconOnly
        aria-label="Next paper"
        disabled={index < 0 || index >= queue.length - 1}
        title={index >= queue.length - 1 ? "This is the last paper" : undefined}
        onClick={() => step(1)}
      />

      {open ? (
        <div className="v-grade-switcher__popover" role="menu" aria-label="Papers handed in">
          <p className="v-label-12 v-grade-switcher__heading">
            <span>Papers handed in</span>
            <span>Estimated</span>
          </p>
          <ul className="v-grade-switcher__list">
            {queue.map((paper) => {
              const estimate = estimateOf(paper);
              return (
                <li key={paper.id}>
                  <button
                    type="button"
                    role="menuitem"
                    className={`v-grade-switcher__item${paper.id === currentId ? " is-current" : ""}`}
                    aria-current={paper.id === currentId ? "true" : undefined}
                    onClick={() => {
                      onSelect(paper.id);
                      setOpen(false);
                    }}
                  >
                    <span className="v-grade-switcher__name v-copy-14">{paper.student_name}</span>
                    <span className="v-grade-switcher__meta">
                      <StatusChip kind="review" status={paper.review.status} />
                      {estimate ? (
                        <Score value={estimate.score} max={estimate.max} size="sm" />
                      ) : (
                        <StatusChip kind="assessment" status={assessmentState(paper.assessment)} />
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="v-label-12 v-grade-switcher__foot">
            <Users size={14} strokeWidth={1.5} aria-hidden="true" /> Estimates are automated, not grades
          </p>
        </div>
      ) : null}
    </div>
  );
}
