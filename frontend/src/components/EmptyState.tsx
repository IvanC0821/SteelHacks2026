import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "./Icon";
import "./EmptyState.css";

export interface EmptyStateProps {
  /** a short noun phrase, sentence case, no terminal period */
  title: string;
  /** exactly one sentence saying what to do next */
  children: string;
  /** at most one action */
  action?: ReactNode;
  icon?: LucideIcon;
  /** drops the panel background and border, for use inside an existing panel */
  bare?: boolean;
  className?: string;
}

/** One sentence and one action. Never a shrug, never an illustration. */
export function EmptyState({ title, children, action, icon, bare = false, className }: EmptyStateProps) {
  return (
    <div className={["v-empty", bare ? "v-empty--bare" : "", className ?? ""].filter(Boolean).join(" ")}>
      {icon ? <Icon glyph={icon} size={20} className="v-empty__icon" /> : null}
      <div className="v-empty__text">
        <p className="v-heading-16">{title}</p>
        <p className="v-copy-14 v-empty__sentence">{children}</p>
      </div>
      {action}
    </div>
  );
}
