import type { ReactNode } from "react";
import { AlertTriangle, CircleCheck, Info, OctagonAlert } from "lucide-react";
import { Icon } from "./Icon";
import "./Notice.css";

export type NoticeTone = "info" | "success" | "warn" | "error";

export interface NoticeProps {
  tone?: NoticeTone;
  /** an optional bolder first line; the body carries the sentence */
  title?: string;
  children: ReactNode;
  /** a single trailing action, e.g. a Retry button */
  action?: ReactNode;
  className?: string;
}

const GLYPH = { info: Info, success: CircleCheck, warn: AlertTriangle, error: OctagonAlert } as const;

/** An inline block, never a floating alert. Errors use role="alert"; info is silent. */
export function Notice({ tone = "info", title, children, action, className }: NoticeProps) {
  return (
    <div
      className={["v-notice", `v-notice--${tone}`, className ?? ""].filter(Boolean).join(" ")}
      role={tone === "error" ? "alert" : undefined}
    >
      <Icon glyph={GLYPH[tone]} size={16} className="v-notice__icon" />
      <div className="v-notice__text">
        {title ? <p className="v-heading-14">{title}</p> : null}
        <div className="v-copy-14">{children}</div>
      </div>
      {action ? <div className="v-notice__action">{action}</div> : null}
    </div>
  );
}
