import "./Wordmark.css";

export interface WordmarkProps {
  /** "sm" is the rail brand, "lg" is session setup */
  size?: "sm" | "lg";
  /** drops the word and keeps the mark, for the collapsed rail */
  markOnly?: boolean;
}

/** The mark is a teal rounded square with a white check, matching public/favicon.svg. */
export function Wordmark({ size = "sm", markOnly = false }: WordmarkProps) {
  return (
    <span className={`v-wordmark v-wordmark--${size}`}>
      <svg className="v-wordmark__mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect width="24" height="24" rx="6" fill="var(--v-teal-600)" />
        <path
          d="M6.5 12.4 10.2 16l7.3-8"
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {markOnly ? <span className="v-visually-hidden">Verity</span> : <span className="v-wordmark__word">Verity</span>}
    </span>
  );
}
