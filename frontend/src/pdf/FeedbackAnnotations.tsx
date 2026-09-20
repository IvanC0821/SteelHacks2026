import { useRef, useState } from "react";
import { isUsableBbox, type Mark } from "./marks";
import "./FeedbackAnnotations.css";

interface Props {
  marks: Mark[];
  width: number;
  height: number;
  onMarkSelect?: (id: string) => void;
}

interface Point { x: number; y: number }
interface Region { left: number; top: number; right: number; bottom: number }
interface Anchor { pin: Point; target: Point | null; region: Region | null }

const PIN_RADIUS = 12;
const POINTER_GAP = 28;
const CARD_GAP = 18;
const SIDE_GAP = 50;
const PAGE_INSET = 12;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function locate(mark: Mark, width: number, height: number, gutterIndex: number): Anchor {
  if (!isUsableBbox(mark.bbox)) {
    return { pin: { x: -16, y: 52 + gutterIndex * 46 }, target: null, region: null };
  }
  const region = {
    left: mark.bbox[0] * width,
    top: mark.bbox[1] * height,
    right: mark.bbox[2] * width,
    bottom: mark.bbox[3] * height,
  };
  const y = (region.top + region.bottom) / 2;
  // The pin stays outside the evidence. At a page edge, use the opposite side
  // if it has space; a full-width region can still be reached from the gutter.
  const useRight = region.left < POINTER_GAP + PIN_RADIUS &&
    width - region.right >= POINTER_GAP + PIN_RADIUS;
  const target = { x: useRight ? region.right : region.left, y };
  return {
    region,
    target,
    pin: { x: target.x + (useRight ? POINTER_GAP : -POINTER_GAP), y },
  };
}

function pointerPath(anchor: Anchor): string {
  const { pin, target } = anchor;
  if (!target) return "";
  const direction = target.x > pin.x ? 1 : -1;
  return `M ${pin.x + direction * PIN_RADIUS} ${pin.y} L ${target.x} ${target.y} ` +
    `M ${target.x - direction * 5} ${target.y - 4} L ${target.x} ${target.y} ` +
    `L ${target.x - direction * 5} ${target.y + 4}`;
}

function placeCard(anchor: Anchor, width: number, height: number) {
  const cardWidth = Math.min(280, Math.max(100, width - PAGE_INSET * 2));
  const maxHeight = Math.min(230, height - PAGE_INSET * 2);
  const region = anchor.region;
  const left = clamp(region?.left ?? PAGE_INSET, PAGE_INSET, width - cardWidth - PAGE_INSET);
  if (!region) {
    return {
      left, top: clamp(anchor.pin.y + 32, PAGE_INSET, height - maxHeight - PAGE_INSET),
      width: cardWidth, maxHeight, transform: undefined, connector: null,
    };
  }

  // Prefer an adjacent side when the whole card fits. Otherwise put it below
  // or above the evidence, with its height limited to the available space.
  const middleY = (region.top + region.bottom) / 2;
  const sideTop = clamp(middleY - 28, PAGE_INSET, height - maxHeight - PAGE_INSET);
  // The card has natural height, so attach at its header rather than assuming
  // that its content fills maxHeight (especially near the bottom of a page).
  const sideY = sideTop + 28;
  if (width - region.right - SIDE_GAP - PAGE_INSET >= cardWidth) {
    return {
      left: region.right + SIDE_GAP, top: sideTop, width: cardWidth, maxHeight,
      transform: undefined,
      connector: { from: { x: region.right + SIDE_GAP, y: sideY }, to: { x: region.right, y: middleY } },
    };
  }
  if (region.left - SIDE_GAP - PAGE_INSET >= cardWidth) {
    return {
      left: region.left - SIDE_GAP - cardWidth, top: sideTop, width: cardWidth, maxHeight,
      transform: undefined,
      connector: { from: { x: region.left - SIDE_GAP, y: sideY }, to: { x: region.left, y: middleY } },
    };
  }
  const below = height - PAGE_INSET - region.bottom - CARD_GAP;
  const above = region.top - CARD_GAP - PAGE_INSET;
  if (Math.max(below, above) < 80) {
    // A region covering most of the page cannot leave room for a separate
    // card. Keep the card usable on the page and retain the real edge target.
    return {
      left, top: sideTop, width: cardWidth, maxHeight, transform: undefined,
      connector: { from: { x: left, y: sideY }, to: anchor.target! },
    };
  }
  const placeBelow = below >= maxHeight || below >= above;
  const edge = placeBelow ? region.bottom : region.top;
  const top = edge + (placeBelow ? CARD_GAP : -CARD_GAP);
  const connectorX = clamp(left + cardWidth / 2, region.left, region.right);
  return {
    left, top, width: cardWidth,
    maxHeight: Math.max(44, Math.min(maxHeight, placeBelow ? below : above)),
    transform: placeBelow ? undefined : "translateY(-100%)",
    connector: { from: { x: connectorX, y: top }, to: { x: connectorX, y: edge } },
  };
}

/** Coordinates are canvas CSS pixels, derived from normalized evidence regions. */
export function FeedbackAnnotations({ marks, width, height, onMarkSelect }: Props) {
  const selected = marks.find((mark) => mark.selected)?.id ?? null;
  const [selection, setSelection] = useState<{ external: string | null; id: string | null }>({ external: null, id: null });
  const activeId = selection.external === selected || marks.some((mark) => mark.id === selection.id && mark.selected) ? selection.id : selected;
  const pins = useRef(new Map<string, HTMLButtonElement>());
  const active = marks.find((mark) => mark.id === activeId);
  const gutter = marks.filter((mark) => !isUsableBbox(mark.bbox));
  const anchors = new Map(marks.map((mark) => [mark.id, locate(mark, width, height, gutter.indexOf(mark))]));
  const card = active ? placeCard(anchors.get(active.id)!, width, height) : null;
  const close = () => {
    setSelection({ external: selected, id: null });
    if (active) pins.current.get(active.id)?.focus({ preventScroll: true });
  };

  return (
    <div className="v-feedback-annotations" onKeyDown={(event) => {
      if (event.key === "Escape" && active) { event.stopPropagation(); close(); }
    }}>
      <svg className="v-feedback-annotations__leaders" width={width} height={height} aria-hidden="true">
        {marks.map((mark) => {
          const anchor = anchors.get(mark.id)!;
          return anchor.target ? <path key={mark.id} data-mark-id={mark.id}
            className={`v-feedback-annotations__pointer${activeId === mark.id ? " is-active" : ""}`}
            d={pointerPath(anchor)} /> : null;
        })}
        {card?.connector ? <path className="v-feedback-annotations__connector"
          d={`M ${card.connector.from.x} ${card.connector.from.y} L ${card.connector.to.x} ${card.connector.to.y}`} /> : null}
      </svg>
      {marks.map((mark) => {
        const { pin, region } = anchors.get(mark.id)!;
        const expanded = activeId === mark.id;
        return <div key={mark.id}>
          {region ? <div className={`v-feedback-annotations__region${expanded ? " is-active" : ""}`}
            style={{ left: region.left, top: region.top,
              width: region.right - region.left, height: region.bottom - region.top }} /> : null}
          <button type="button" className={`v-feedback-annotations__pin${expanded ? " is-active" : ""}`}
            ref={(node) => { if (node) pins.current.set(mark.id, node); else pins.current.delete(mark.id); }}
            style={{ left: pin.x, top: pin.y }}
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
      {active && card ? <section id={`feedback-${active.id}`} className="v-feedback-annotations__card"
        aria-label={`Feedback ${active.label}`} style={{ left: card.left, top: card.top,
          width: card.width, maxHeight: card.maxHeight, transform: card.transform }}>
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
