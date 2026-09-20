import { useEffect, useRef, useState, type ReactNode } from "react";
import { openDocument, type PdfDocument } from "./pdfjs";
import { Spinner } from "../components/Spinner";
import "./PageThumbnails.css";

export interface PageThumbnailsProps {
  blob: Blob;
  /** the 1-based pages currently selected; the tile shows the selection rule and aria-pressed */
  selected?: number[];
  onSelect?: (page: number) => void;
  /** chips or badges drawn over each tile, keyed by 1-based page number */
  overlay?: (page: number) => ReactNode;
  /** where the overlay sits on the tile; "bottom" keeps the page's first lines readable */
  overlayPosition?: "top" | "bottom";
  /** CSS width of one tile; the height follows the page's aspect ratio */
  tileWidth?: number;
  /** "row" scrolls horizontally (a strip under a toolbar); "grid" wraps (page mapping) */
  layout?: "row" | "grid";
  label?: string;
  className?: string;
}

/** Small selectable page tiles. Task 4 uses this for page mapping; the chip slot over each tile
 *  is where the question chips land. */
export function PageThumbnails({
  blob,
  selected = [],
  onSelect,
  overlay,
  overlayPosition = "top",
  tileWidth = 116,
  layout = "grid",
  label = "Pages",
  className,
}: PageThumbnailsProps) {
  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    let live = true;
    let opened: PdfDocument | null = null;
    setDoc(null);
    setCount(0);
    openDocument(blob)
      .then((document) => {
        if (!live) {
          void document.loadingTask.destroy();
          return;
        }
        opened = document;
        if (!live) return;
        setDoc(document);
        setCount(document.numPages);
      })
      .catch(() => {
        /* the viewer beside this reports the failure; the strip just stays empty */
      });
    return () => {
      live = false;
      void opened?.loadingTask.destroy();
    };
  }, [blob]);

  if (!doc) {
    return (
      <div className={["v-thumbs", `v-thumbs--${layout}`, className ?? ""].filter(Boolean).join(" ")}>
        <Spinner size={16} label="Loading pages" />
      </div>
    );
  }

  return (
    <ul
      className={["v-thumbs", `v-thumbs--${layout}`, className ?? ""].filter(Boolean).join(" ")}
      aria-label={label}
    >
      {Array.from({ length: count }, (_, index) => index + 1).map((page) => (
        <li key={page} className="v-thumbs__item">
          <Thumb
            doc={doc}
            page={page}
            width={tileWidth}
            selected={selected.includes(page)}
            onSelect={onSelect}
          />
          {overlay ? <div className={`v-thumbs__overlay v-thumbs__overlay--${overlayPosition}`}>{overlay(page)}</div> : null}
        </li>
      ))}
    </ul>
  );
}

function Thumb({
  doc,
  page,
  width,
  selected,
  onSelect,
}: {
  doc: PdfDocument;
  page: number;
  width: number;
  selected: boolean;
  onSelect?: (page: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [height, setHeight] = useState(Math.round(width * 1.294));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    void doc.getPage(page).then((pdfPage) => {
      if (cancelled) return;
      const natural = pdfPage.getViewport({ scale: 1 });
      const scale = width / natural.width;
      const viewport = pdfPage.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      setHeight(Math.floor(viewport.height));
      task = pdfPage.render({
        canvas,
        viewport,
        transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      });
      (task as unknown as { promise: Promise<void> }).promise.catch(() => {
        /* cancelled */
      });
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, page, width]);

  const inner = (
    <>
      <canvas ref={canvasRef} className="v-thumbs__canvas" style={{ width, height }} />
      <span className="v-label-12 v-thumbs__number">{page}</span>
    </>
  );

  if (!onSelect) {
    return <div className={`v-thumbs__tile${selected ? " is-selected" : ""}`}>{inner}</div>;
  }
  return (
    <button
      type="button"
      className={`v-thumbs__tile${selected ? " is-selected" : ""}`}
      aria-pressed={selected}
      aria-label={`Page ${page}`}
      onClick={() => onSelect(page)}
    >
      {inner}
    </button>
  );
}
