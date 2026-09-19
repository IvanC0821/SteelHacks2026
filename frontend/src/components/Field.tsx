import { useId, type ReactNode } from "react";
import "./Field.css";

export interface FieldProps {
  /** always visible; a placeholder is never a label */
  label: string;
  /** "input" (default), "textarea" or "select" */
  as?: "input" | "textarea" | "select";
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  /** a quiet sentence under the control */
  hint?: string;
  /** the 422 field error; shown below the control and wired through aria-describedby */
  error?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
  /** <option> elements, for as="select" */
  children?: ReactNode;
  /** a trailing element inside the row, e.g. a unit or a small button */
  trailing?: ReactNode;
  autoFocus?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

export function Field({
  label,
  as = "input",
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
  error,
  disabled,
  required,
  rows = 4,
  children,
  trailing,
  autoFocus,
  name,
  id,
  className,
}: FieldProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  const shared = {
    id: controlId,
    name: name ?? controlId,
    value,
    disabled,
    required,
    autoFocus,
    placeholder,
    "aria-describedby": describedBy,
    "aria-invalid": error ? (true as const) : undefined,
    className: "v-field__control",
  };

  return (
    <div className={["v-field", error ? "is-invalid" : "", className ?? ""].filter(Boolean).join(" ")}>
      <label className="v-label-14 v-field__label" htmlFor={controlId}>
        {label}
      </label>
      <div className="v-field__row">
        {as === "textarea" ? (
          <textarea {...shared} rows={rows} onChange={(e) => onChange(e.target.value)} />
        ) : as === "select" ? (
          <select {...shared} onChange={(e) => onChange(e.target.value)}>
            {children}
          </select>
        ) : (
          <input {...shared} type={type} onChange={(e) => onChange(e.target.value)} />
        )}
        {trailing ? <div className="v-field__trailing">{trailing}</div> : null}
      </div>
      {hint ? (
        <p className="v-label-12 v-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="v-label-12 v-field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
