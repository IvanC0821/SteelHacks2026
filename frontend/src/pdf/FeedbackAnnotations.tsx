import { useRef, useState } from "react";
import { isUsableBbox, type Mark } from "./marks";
import "./FeedbackAnnotations.css";

interface Props {
  marks: Mark[];
  width: number;
  height: number;
  onMarkSelect?: (id: string) => void;
}

/** Coordinates are canvas CSS pixels, derived from normalized evidence regions. */
export function FeedbackAnnotations({ marks, width, height, onMarkSelect }: Props) {
  const selected = marks.find((mark) => mark.selected)?.id ?? null;
  const [selection, setSelection] = useState<{ external: string | null; id: string | null }>({ external: null, id: null });
  const activeId = selection.external === selected || marks.some((mark) => mark.id === selection.id && mark.selected) ? selection.id : selected;
  const pins = useRef(new Map<string, HTMLButtonElement>());
  const active = marks.find((mark) => mark.id === activeId);
  const gutter = marks.filter((mark) => !isUsableBbox(mark.bbox));
  const position = (mark: Mark) => isUsableBbox(mark.bbox)
    ? { x: mark.bbox[0] * width, y: mark.bbox[1] * height }
    : { x: -16, y: 52 + gutter.indexOf(mark) * 46 };
  const point = active ? position(active) : null;
  const cardWidth = Math.min(280, Math.max(100, width - 24));
  const cardHeight = Math.min(230, height - 24);
  const left = point ? Math.max(12, Math.min(width - cardWidth - 12,
    point.x + 32 + cardWidth < width ? point.x + 32 : point.x - cardWidth - 32)) : 12;
  const top = point ? Math.max(12, Math.min(height - cardHeight - 12, point.y + 32)) : 12;
  const close = () => {
    setSelection({ external: selected, id: null });
    if (active) pins.current.get(active.id)?.focus({ preventScroll: true });
  };

  return (
    <div className="v-feedback-annotations" onKeyDown={(event) => {
      if (event.key === "Escape" && active) { event.stopPropagation(); close(); }
    }}>
      {active && point ? <svg className="v-feedback-annotations__connector" width={width} height={height} aria-hidden="true">
        <path d={`M ${point.x} ${point.y} L ${Math.max(left + 12, Math.min(left + cardWidth - 12, point.x))} ${top}`} />
      </svg> : null}
      {marks.map((mark) => {
        const p = position(mark);
        const expanded = activeId === mark.id;
        return <div key={mark.id}>
          {isUsableBbox(mark.bbox) ? <div className={`v-feedback-annotations__region${expanded ? " is-active" : ""}`}
            style={{ left: mark.bbox[0] * width, top: mark.bbox[1] * height,
              width: (mark.bbox[2] - mark.bbox[0]) * width, height: (mark.bbox[3] - mark.bbox[1]) * height }} /> : null}
          <button type="button" className={`v-feedback-annotations__pin${expanded ? " is-active" : ""}`}
            ref={(node) => { if (node) pins.current.set(mark.id, node); else pins.current.delete(mark.id); }}
            style={{ left: p.x, top: p.y }}
            aria-label={`Finding ${mark.label} on page ${mark.page}`}
            aria-expanded={expanded} aria-controls={expanded ? `feedback-${mark.id}` : undefined}
            onClick={() => {
              if (expanded) { close(); return; }
              setSelection({ external: selected, id: mark.id });
              onMarkSelect?.(mark.id);
            }}>
            {mark.label}
          </button>
        </div>;
      })}
      {active ? <section id={`feedback-${active.id}`} className="v-feedback-annotations__card"
        aria-label={`Feedback ${active.label}`} style={{ left, top, width: cardWidth, maxHeight: cardHeight }}>
        <header>
          <span className="v-feedback-annotations__eyebrow">Feedback {active.label}</span>
          <button type="button" aria-label="Close feedback" onClick={close}>&times;</button>
        </header>
        <strong>{active.title ?? "Review this step"}</strong>
        <p>{active.message}</p>
        <footer>{isUsableBbox(active.bbox) ? `Marked region on page ${active.page}` : `Page-level feedback · page ${active.page}. Exact location unavailable.`}</footer>
      </section> : null}
    </div>
  );
}
