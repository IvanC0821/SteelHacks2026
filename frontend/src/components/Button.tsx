import type { ButtonHTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "./Icon";
import { Spinner } from "./Spinner";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
export type ButtonSize = "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  /** md is 40px tall, lg is 44px and is the floor for a primary control on touch */
  size?: ButtonSize;
  /** a lucide icon placed before the label, sized from the button size */
  icon?: LucideIcon;
  /** overlays a spinner without changing the button's width; also sets aria-busy and disables it */
  busy?: boolean;
  /** required when `disabled` is set: the one-sentence reason, surfaced as the native title */
  title?: string;
  /** hides the label visually; the label text still names the button for assistive tech */
  iconOnly?: boolean;
  /** Icon-only buttons may use aria-label instead of label children. */
  children?: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  icon,
  busy = false,
  iconOnly = false,
  disabled,
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const iconSize = size === "lg" ? 20 : 16;
  const classes = [
    "v-button",
    `v-button--${variant}`,
    `v-button--${size}`,
    iconOnly ? "v-button--icon-only" : "",
    busy ? "is-busy" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...rest} type={type} className={classes} disabled={disabled || busy} aria-busy={busy || undefined}>
      <span className="v-button__content">
        {icon ? <Icon glyph={icon} size={iconSize} /> : null}
        <span className={iconOnly ? "v-visually-hidden" : "v-button__label"}>{children}</span>
      </span>
      {busy ? (
        <span className="v-button__busy">
          <Spinner size={iconSize} />
        </span>
      ) : null}
    </button>
  );
}
