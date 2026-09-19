import type { ReactNode } from "react";
import "./Chip.css";

export type ChipTone = "neutral" | "teal" | "deduction" | "credit" | "hint" | "ai" | "fixture";

export interface ChipProps {
  tone?: ChipTone;
  /** a numbered circle before the label, matched to the numbered pin on the paper */
  number?: number;
  children?: ReactNode;
  /** selected chips carry the teal-100 tint and a left rule, matching list selection */
  selected?: boolean;
  className?: string;
  title?: string;
}

/** tone="ai" always prints "AI suggested" so the lavender is never the only signal.
 *  tone="fixture" always prints "Test fixture" so a fixture result is never read as model output. */
export function Chip({ tone = "neutral", number, children, selected = false, className, title }: ChipProps) {
  const fixedLabel = tone === "ai" ? "AI suggested" : tone === "fixture" ? "Test fixture" : null;
  const classes = ["v-chip", `v-chip--${tone}`, selected ? "is-selected" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} title={title}>
      {number !== undefined ? <span className="v-chip__number">{number}</span> : null}
      <span className="v-chip__label">{fixedLabel ?? children}</span>
      {fixedLabel && children ? <span className="v-chip__detail">{children}</span> : null}
    </span>
  );
}
