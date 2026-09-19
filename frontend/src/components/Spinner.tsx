import "./Spinner.css";

export interface SpinnerProps {
  size?: 16 | 20;
  /** announced to screen readers when the spinner stands alone */
  label?: string;
}

/** A plain indeterminate spinner. Never paired with a fake percentage or a promised duration. */
export function Spinner({ size = 16, label }: SpinnerProps) {
  return (
    <span className={`v-spinner v-spinner--${size}`} role={label ? "status" : undefined}>
      {label ? <span className="v-visually-hidden">{label}</span> : null}
    </span>
  );
}
