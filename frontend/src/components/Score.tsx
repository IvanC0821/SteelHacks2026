import { deltaToneClass, formatDelta, formatPoints } from "./score-format";
import "./Score.css";

export type ScoreSize = "sm" | "md" | "lg";

export interface ScoreProps {
  /** null is rendered as "Needs review" in muted text, never as 0 */
  value: number | null;
  /** when given, printed as "value / max" */
  max?: number;
  /** adds the word Estimated under the number; never used for a released final score */
  estimated?: boolean;
  size?: ScoreSize;
  /** signed points in deduction red or credit green; `value` 0 renders as "0", not blank */
  delta?: boolean;
  /** overrides the muted "Needs review" text for a null value */
  nullLabel?: string;
  className?: string;
}

export function Score({
  value,
  max,
  estimated = false,
  size = "md",
  delta = false,
  nullLabel = "Needs review",
  className,
}: ScoreProps) {
  if (value === null) {
    return <span className={["v-score-null", className ?? ""].filter(Boolean).join(" ")}>{nullLabel}</span>;
  }

  const classes = [
    "v-score",
    "v-score-value",
    `v-score--${size}`,
    delta ? deltaToneClass(value) : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className="v-score-wrap">
      <span className={classes}>
        {delta ? formatDelta(value) : formatPoints(value)}
        {!delta && max !== undefined ? <span className="v-score-max"> / {formatPoints(max)}</span> : null}
      </span>
      {estimated ? <span className="v-score-estimated">Estimated</span> : null}
    </span>
  );
}
