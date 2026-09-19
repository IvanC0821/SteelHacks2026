import type { LucideIcon } from "lucide-react";
import "./Icon.css";

export interface IconProps {
  /** any icon component from lucide-react, e.g. `import { Check } from "lucide-react"` */
  glyph: LucideIcon;
  /** 16 sits beside 14px text at stroke 1.5; 20 sits beside 16px text at stroke 1.75 */
  size?: 16 | 20;
  className?: string;
}

/** Applies the brief's one sizing rule so no caller picks a stroke width by hand.
 *  The icon always inherits `currentColor` from the text beside it. */
export function Icon({ glyph: Glyph, size = 16, className }: IconProps) {
  return (
    <Glyph
      className={className ? `v-icon ${className}` : "v-icon"}
      size={size}
      strokeWidth={size === 20 ? 1.75 : 1.5}
      absoluteStrokeWidth
      aria-hidden="true"
      focusable="false"
    />
  );
}
