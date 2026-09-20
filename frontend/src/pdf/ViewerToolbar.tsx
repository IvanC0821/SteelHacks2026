import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "../components/Button";
import { Kbd } from "../components/Kbd";
import "./ViewerToolbar.css";

export interface ViewerToolbarProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** "fit-width" or an explicit scale like 1.25 */
  zoom: "fit-width" | number;
  onZoomChange: (zoom: "fit-width" | number) => void;
  /** omit to hide the marks toggle entirely (a paper with no marks) */
  hideMarks?: boolean;
  onHideMarksChange?: (hide: boolean) => void;
  /** anything the page wants on the right of the row, e.g. a download or a Save and next */
  right?: ReactNode;
}

const STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

function stepZoom(current: number, direction: 1 | -1): number {
  const index = STEPS.findIndex((step) => step >= current - 0.001);
  const next = Math.min(STEPS.length - 1, Math.max(0, (index === -1 ? STEPS.length - 1 : index) + direction));
  return STEPS[next];
}

/** Wraps controls in narrow paper panes. The zoom read-out shows "Fit" until overridden. */
export function ViewerToolbar({
  page,
  pageCount,
  onPageChange,
  zoom,
  onZoomChange,
  hideMarks,
  onHideMarksChange,
  right,
}: ViewerToolbarProps) {
  const numeric = zoom === "fit-width" ? 1 : zoom;

  return (
    <div className="v-viewer-toolbar">
      <div className="v-viewer-toolbar__group v-viewer-toolbar__pages">
        <Button
          variant="quiet"
          icon={ChevronLeft}
          iconOnly
          aria-label="Previous page"
          disabled={page <= 1}
          title={page <= 1 ? "You are on the first page" : undefined}
          onClick={() => onPageChange(page - 1)}
        />
        <span className="v-label-14 v-viewer-toolbar__count">
          Page <span className="v-viewer-toolbar__n">{page}</span> of {pageCount}
        </span>
        <Button
          variant="quiet"
          icon={ChevronRight}
          iconOnly
          aria-label="Next page"
          disabled={page >= pageCount}
          title={page >= pageCount ? "You are on the last page" : undefined}
          onClick={() => onPageChange(page + 1)}
        />
      </div>

      <div className="v-viewer-toolbar__group v-viewer-toolbar__zoom-controls">
        <Button
          variant="quiet"
          icon={Minus}
          iconOnly
          aria-label="Zoom out"
          onClick={() => onZoomChange(stepZoom(numeric, -1))}
        />
        <Button
          variant="quiet"
          icon={Maximize2}
          iconOnly
          aria-label="Fit to width"
          onClick={() => onZoomChange("fit-width")}
        />
        <span className="v-label-12 v-viewer-toolbar__zoom">
          {zoom === "fit-width" ? "Fit" : `${Math.round(numeric * 100)}%`}
        </span>
        <Button
          variant="quiet"
          icon={Plus}
          iconOnly
          aria-label="Zoom in"
          onClick={() => onZoomChange(stepZoom(numeric, 1))}
        />
      </div>

      <div className="v-viewer-toolbar__right">
        {onHideMarksChange ? (
          <Button
            variant="quiet"
            icon={hideMarks ? EyeOff : Eye}
            aria-pressed={hideMarks}
            className="v-viewer-toolbar__marks"
            onClick={() => onHideMarksChange(!hideMarks)}
          >
            <span className="v-viewer-toolbar__toggle">
              {hideMarks ? "Show marks" : "Hide marks"}
              <Kbd>h</Kbd>
            </span>
          </Button>
        ) : null}
        {right}
      </div>
    </div>
  );
}
