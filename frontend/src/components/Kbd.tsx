import "./Kbd.css";

export interface KbdProps {
  /** the key as the user would press it, e.g. "h", "1", "Esc" */
  children: string;
}

/** A single key cap, used beside a keyboard-reachable action so the shortcut is discoverable. */
export function Kbd({ children }: KbdProps) {
  return <kbd className="v-kbd">{children}</kbd>;
}
