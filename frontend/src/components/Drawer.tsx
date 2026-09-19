import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button";
import "./Drawer.css";

export interface DrawerProps {
  open: boolean;
  title: string;
  /** "right" is the default detail drawer; "left" is the phone navigation rail */
  side?: "right" | "left";
  /** CSS width; defaults to the 360px panel token */
  width?: string;
  children: ReactNode;
  onClose: () => void;
}

/** Travels 40px with opacity over 200ms, never the full width, so the paper behind stays legible.
 *  Escape closes it and focus returns to the trigger. */
export function Drawer({ open, title, side = "right", width, children, onClose }: DrawerProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      (restoreRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="v-drawer-layer">
      <div className="v-drawer-backdrop" onClick={onClose} />
      <div
        className={`v-drawer v-drawer--${side}`}
        style={width ? { width } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={surfaceRef}
      >
        <div className="v-drawer__head">
          <h2 className="v-heading-16">{title}</h2>
          <Button variant="quiet" icon={X} iconOnly aria-label="Close" onClick={onClose} />
        </div>
        <div className="v-drawer__body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
