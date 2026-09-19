import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button";
import "./Dialog.css";

export interface DialogAction {
  label: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  /** danger paints the primary action in deduction red */
  danger?: boolean;
}

export interface DialogProps {
  open: boolean;
  title: string;
  /** one sentence under the title, optional */
  description?: string;
  children?: ReactNode;
  /** the confirming action; rendered as the one primary */
  primary?: DialogAction;
  /** the dismissing action; defaults to a Cancel that calls onClose */
  secondary?: DialogAction;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Escape closes, focus is trapped, the page behind is inert, and the backdrop click dismisses.
 *  Confirmation is reserved for irreversible actions; prefer an undo toast elsewhere. */
export function Dialog({ open, title, description, children, primary, secondary, onClose }: DialogProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<Element | null>(null);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!open) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const surface = surfaceRef.current;
      if (!surface) return;
      const items = Array.from(surface.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [open, onClose],
  );

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement;
    document.addEventListener("keydown", onKeyDown, true);
    const timer = window.setTimeout(() => {
      surfaceRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    }, 0);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      window.clearTimeout(timer);
      (restoreRef.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  return createPortal(
    <div className="v-dialog-layer">
      <div className="v-dialog-backdrop" onClick={onClose} />
      <div
        className="v-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="v-dialog-title"
        aria-describedby={description ? "v-dialog-description" : undefined}
        ref={surfaceRef}
      >
        <div className="v-dialog__head">
          <h2 className="v-heading-16" id="v-dialog-title">
            {title}
          </h2>
          <Button variant="quiet" icon={X} iconOnly aria-label="Close" onClick={onClose} />
        </div>
        {description ? (
          <p className="v-copy-14 v-dialog__description" id="v-dialog-description">
            {description}
          </p>
        ) : null}
        {children ? <div className="v-dialog__body">{children}</div> : null}
        {primary || secondary ? (
          <div className="v-dialog__actions">
            <Button variant="quiet" onClick={secondary?.onClick ?? onClose} disabled={secondary?.disabled}>
              {secondary?.label ?? "Cancel"}
            </Button>
            {primary ? (
              <Button
                variant={primary.danger ? "danger" : "primary"}
                onClick={primary.onClick}
                busy={primary.busy}
                disabled={primary.disabled}
              >
                {primary.label}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
