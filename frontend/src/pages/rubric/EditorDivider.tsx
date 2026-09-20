import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

const MIN_WIDTH = 320;
const MAX_WIDTH = 680;
const PAPER_MIN_WIDTH = 360;
const DIVIDER_WIDTH = 12;

interface EditorDividerProps {
  containerRef: RefObject<HTMLDivElement | null>;
  width: number;
  onWidthChange: (width: number) => void;
}

/** Keep room for the reference paper; keyboard and pointer users get the same range. */
export function EditorDivider({ containerRef, width, onWidthChange }: EditorDividerProps) {
  const [maximum, setMaximum] = useState(MAX_WIDTH);
  const clamp = (value: number) => Math.round(Math.min(maximum, Math.max(MIN_WIDTH, value)));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      if (window.matchMedia("(max-width: 760px)").matches) return;
      setMaximum(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, container.clientWidth - PAPER_MIN_WIDTH - DIVIDER_WIDTH)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  useLayoutEffect(() => {
    if (width > maximum) onWidthChange(maximum);
  }, [maximum, width, onWidthChange]);

  return (
    <div
      className="v-rubric__divider"
      role="separator"
      tabIndex={0}
      aria-label="Resize rubric editor"
      aria-orientation="vertical"
      aria-controls="rubric-editor"
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={maximum}
      aria-valuenow={width}
      aria-valuetext={`${width} pixels wide`}
      title="Drag to resize the editor, or use the left and right arrow keys"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const bounds = containerRef.current?.getBoundingClientRect();
        if (bounds) onWidthChange(clamp(bounds.right - event.clientX));
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onKeyDown={(event) => {
        const next = event.key === "ArrowLeft" ? width + 24
          : event.key === "ArrowRight" ? width - 24
            : event.key === "Home" ? MIN_WIDTH
              : event.key === "End" ? maximum
                : null;
        if (next === null) return;
        event.preventDefault();
        onWidthChange(clamp(next));
      }}
    />
  );
}
