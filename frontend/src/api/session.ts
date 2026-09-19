// The current identity: one bearer token, kept in localStorage for this browser only.
// Tokens come from `verity.cli` (or frontend/.dev/session.json locally). Never put a token in a URL.

export interface Session {
  token: string;
  api: string;
}

const KEY = "verity.session";
const DEFAULT_API = (import.meta.env.VITE_API_BASE as string | undefined) ?? "http://127.0.0.1:8026";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed.token) return null;
    return { token: parsed.token, api: parsed.api || DEFAULT_API };
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    /* private mode: the session lives in memory for this page only */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function defaultApiBase(): string {
  return DEFAULT_API;
}
