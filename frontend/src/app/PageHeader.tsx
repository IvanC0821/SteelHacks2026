import type { ReactNode } from "react";
import "./PageHeader.css";

export interface PageHeaderProps {
  /** the page title, rendered in .v-heading-20 (serif) */
  title: string;
  /** a back link, a switcher or a chip, placed before the title */
  left?: ReactNode;
  /** the one primary action for this view, plus at most one quiet neighbour */
  right?: ReactNode;
  /** a quiet line after the title, e.g. "Homework 1 · 4 questions" only when a sentence will not do */
  subtitle?: string;
  /** sticks the row to the top of a scrolling content page */
  sticky?: boolean;
  className?: string;
}

/** The one 52px row every page starts with. Never two stacked headers. */
export function PageHeader({ title, left, right, subtitle, sticky = false, className }: PageHeaderProps) {
  return (
    <header
      className={["v-page-header", sticky ? "is-sticky" : "", className ?? ""].filter(Boolean).join(" ")}
    >
      {left ? <div className="v-page-header__left">{left}</div> : null}
      <div className="v-page-header__title">
        <h1 className="v-heading-20">{title}</h1>
        {subtitle ? <p className="v-label-12 v-page-header__subtitle">{subtitle}</p> : null}
      </div>
      {right ? <div className="v-page-header__right">{right}</div> : null}
    </header>
  );
}
