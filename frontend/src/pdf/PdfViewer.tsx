import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { openDocument, type PdfDocument } from "./pdfjs";
import { isUsableBbox, marksByPage, type Mark, type MarkTone } from "./marks";
import { ViewerToolbar } from "./ViewerToolbar";
import { Spinner } from "../components/Spinner";
import { Notice } from "../components/Notice";
import "./PdfViewer.css";

export interface PdfViewerProps {
  blob: Blob;
  /** controlled current page, 1-based */
  page: number;
  onPageChange: (page: number) => void;
  /** "fit-width" recomputes on resize; a number is an explicit scale where 1 = 100% */
  zoom?: "fit-width" | number;
  onZoomChange?: (zoom: "fit-width" | number) => void;
  marks?: Mark[];
  onMarkSelect?: (id: string) => void;
  /** hides every pin and page tint without unmounting the canvases */
  hideMarks?: boolean;
  onHideMarksChange?: (hide: boolean) => void;
  /** replaces the built-in toolbar when false; the page then supplies its own controls */
  toolbar?: boolean;
  /** extra content on the right of the toolbar row */
  toolbarRight?: React.ReactNode;
  /** accessible name for the scrolling region */
  label?: string;
  className?: string;
}

const GAP = 24;
const TONE_ORDER: MarkTone[] = ["deduction", "hint", "credit"];

interface PageSize {
  width: number;
  height: number;
}

/** Renders every page as a canvas in one vertical scroll on the canvas ground.
 *  Marks with a bbox get an outlined box and a pin at its top-left; marks without one get a pin in
 *  the page's margin gutter and a tinted page edge, never an invented coordinate. */
export function PdfViewer({
  blob,
  page,
  onPageChange,
  zoom = "fit-width",
  onZoomChange,
  marks = [],
  onMarkSelect,
  hideMarks = false,
  onHideMarksChange,
  toolbar = true,
  toolbarRight,
  label = "Paper",
  className,
}: PdfViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);
  const programmatic = useRef(false);

  const [doc, setDoc] = useState<PdfDocument | null>(null);
  const [sizes, setSizes] = useState<PageSize[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState(0);

  // open the document and read every page's natural size up front, so the scroll height is right
  // before a single page has rendered
  useEffect(() => {
    let live = true;
    let opened: PdfDocument | null = null;
    setDoc(null);
    setSizes([]);
    setError(null);
    openDocument(blob)
      .then(async (document) => {
        if (!live) {
          void document.loadingTask.destroy();
          return;
        }
        opened = document;
        const next: PageSize[] = [];
        for (let n = 1; n <= document.numPages; n++) {
          const pdfPage = await document.getPage(n);
          const viewport = pdfPage.getViewport({ scale: 1 });
          next.push({ width: viewport.width, height: viewport.height });
        }
        if (!live) return;
        setDoc(document);
        setSizes(next);
      })
      .catch(() => {
        if (live) setError("This PDF could not be opened.");
      });
    return () => {
      live = false;
      void opened?.loadingTask.destroy();
    };
  }, [blob]);

  // available width for fit-to-width
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const measure = () => setAvailable(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [doc]);

  const base = sizes[0]?.width ?? 612;
  // 32px gutter + 24px of breathing room on each side
  const fitScale = available > 0 ? Math.max(0.2, (available - 32 - GAP * 2) / base) : 1;
  const scale = zoom === "fit-width" ? fitScale : zoom;

  // scroll the requested page into view when the page prop moves from outside
  useEffect(() => {
    const target = pageRefs.current[page - 1];
    const node = scrollRef.current;
    if (!target || !node) return;
    if (Math.abs(target.offsetTop - node.scrollTop) < 8) return;
    programmatic.current = true;
    node.scrollTo({ top: target.offsetTop - GAP, behavior: "auto" });
    window.setTimeout(() => {
      programmatic.current = false;
    }, 60);
  }, [page, scale, sizes.length]);

  // report the page the reader is actually looking at
  const onScroll = useCallback(() => {
    if (programmatic.current) return;
    const node = scrollRef.current;
    if (!node) return;
    const anchor = node.scrollTop + node.clientHeight / 3;
    let current = 1;
    for (let index = 0; index < pageRefs.current.length; index++) {
      const element = pageRefs.current[index];
      if (element && element.offsetTop <= anchor) current = index + 1;
    }
    if (current !== page) onPageChange(current);
  }, [page, onPageChange]);

  // "h" toggles the marks, per the brief
  useEffect(() => {
    if (!onHideMarksChange) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "h" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      onHideMarksChange(!hideMarks);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hideMarks, onHideMarksChange]);

  const grouped = marksByPage(marks);

  return (
    <div className={["v-pdf", className ?? ""].filter(Boolean).join(" ")}>
      {toolbar ? (
        <ViewerToolbar
          page={page}
          pageCount={sizes.length || 1}
          onPageChange={onPageChange}
          zoom={zoom}
          onZoomChange={onZoomChange ?? (() => {})}
          hideMarks={hideMarks}
          onHideMarksChange={marks.length > 0 ? onHideMarksChange : undefined}
          right={toolbarRight}
        />
      ) : null}

      <div className="v-pdf__scroll" ref={scrollRef} onScroll={onScroll} tabIndex={0} aria-label={label}>
        {error ? (
          <div className="v-pdf__state">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : !doc ? (
          <div className="v-pdf__state">
            <Spinner size={20} label="Loading the paper" />
          </div>
        ) : (
          sizes.map((size, index) => (
            <PdfPage
              key={index}
              doc={doc}
              number={index + 1}
              size={size}
              scale={scale}
              marks={hideMarks ? [] : (grouped.get(index + 1) ?? [])}
              onMarkSelect={onMarkSelect}
              register={(node) => {
                pageRefs.current[index] = node;
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface PdfPageProps {
  doc: PdfDocument;
  number: number;
  size: PageSize;
  scale: number;
  marks: Mark[];
  onMarkSelect?: (id: string) => void;
  register: (node: HTMLDivElement | null) => void;
}

function PdfPage({ doc, number, size, scale, marks, onMarkSelect, register }: PdfPageProps) {
  const holder = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(number <= 2);

  const width = Math.round(size.width * scale);
  const height = Math.round(size.height * scale);

  // lazy render: only pages within a screen of the viewport get painted
  useEffect(() => {
    const node = holder.current;
    if (!node || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setNear(true);
      },
      { root: node.closest(".v-pdf__scroll"), rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near]);

  useEffect(() => {
    if (!near) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    void doc.getPage(number).then((pdfPage) => {
      if (cancelled) return;
      const viewport = pdfPage.getViewport({ scale });
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      task = pdfPage.render({
        canvas,
        viewport,
        transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
      });
      (task as unknown as { promise: Promise<void> }).promise.catch(() => {
        /* cancelled by a zoom change */
      });
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, number, scale, near]);

  const gutter = marks.filter((mark) => !isUsableBbox(mark.bbox));
  const boxed = marks.filter((mark) => isUsableBbox(mark.bbox));
  const edge = TONE_ORDER.find((tone) => marks.some((mark) => mark.tone === tone));

  return (
    <div
      className="v-pdf-page"
      data-page={number}
      ref={(node) => {
        holder.current = node;
        register(node);
      }}
    >
      <div className="v-pdf-page__gutter" style={{ height }}>
        <span className="v-label-12 v-pdf-page__number">{number}</span>
        {gutter.map((mark) => (
          <MarkPin key={mark.id} mark={mark} onMarkSelect={onMarkSelect} />
        ))}
      </div>
      <div
        className={["v-pdf-page__paper", edge ? `has-edge-${edge}` : ""].filter(Boolean).join(" ")}
        style={{ width, height }}
      >
        <canvas ref={canvasRef} className="v-pdf-page__canvas" aria-label={`Page ${number}`} role="img" />
        {boxed.map((mark) => {
          const [left, top, right, bottom] = mark.bbox as [number, number, number, number];
          return (
            <div
              key={mark.id}
              className={`v-pdf-box v-pdf-box--${mark.tone}${mark.selected ? " is-selected" : ""}`}
              style={{
                left: `${left * 100}%`,
                top: `${top * 100}%`,
                width: `${(right - left) * 100}%`,
                height: `${(bottom - top) * 100}%`,
              }}
            >
              <MarkPin mark={mark} onMarkSelect={onMarkSelect} className="v-pdf-box__pin" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MarkPin({
  mark,
  onMarkSelect,
  className,
}: {
  mark: Mark;
  onMarkSelect?: (id: string) => void;
  className?: string;
}) {
  const classes = [
    "v-pdf-pin",
    `v-pdf-pin--${mark.tone}`,
    mark.selected ? "is-selected" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!onMarkSelect) {
    return <span className={classes}>{mark.label}</span>;
  }
  return (
    <button
      type="button"
      className={classes}
      aria-label={`Finding ${mark.label} on page ${mark.page}`}
      aria-pressed={mark.selected}
      onClick={() => onMarkSelect(mark.id)}
    >
      {mark.label}
    </button>
  );
}
