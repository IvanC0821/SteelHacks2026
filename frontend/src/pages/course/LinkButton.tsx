import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface LinkButtonProps {
  to: string;
  variant?: "primary" | "secondary" | "quiet";
  size?: "md" | "lg";
  children: ReactNode;
  className?: string;
}

/** A link that looks like a Button. Navigation is a link, not a button: it opens in a new tab,
 *  it has a URL, and the keyboard treats it the way readers expect. */
export function LinkButton({ to, variant = "secondary", size = "md", children, className }: LinkButtonProps) {
  const classes = ["v-button", `v-button--${variant}`, `v-button--${size}`, "v-link-button", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <Link to={to} className={classes}>
      <span className="v-button__content">{children}</span>
    </Link>
  );
}
