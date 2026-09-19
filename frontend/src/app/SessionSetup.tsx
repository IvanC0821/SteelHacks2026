import { useState } from "react";
import { ApiError } from "../api/client";
import { defaultApiBase, type Session } from "../api/session";
import type { User } from "../api/types";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Notice } from "../components/Notice";
import { Icon } from "../components/Icon";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Wordmark } from "./Wordmark";
import "./SessionSetup.css";

export interface SessionSetupProps {
  /** a sentence explaining why the reader is here, e.g. an expired session */
  message?: string | null;
  /** resolves with the identity when the token works; rejects with an ApiError otherwise */
  onContinue: (session: Session) => Promise<User>;
}

const ROLE_WORD = { student: "student", ta: "TA", instructor: "instructor" } as const;

/** The first screen. One field, one primary, the API base folded under Advanced. */
export function SessionSetup({ message, onContinue }: SessionSetupProps) {
  const [token, setToken] = useState("");
  const [api, setApi] = useState(defaultApiBase());
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [welcome, setWelcome] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token.trim()) {
      setError("Paste the token first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await onContinue({ token: token.trim(), api: api.trim() || defaultApiBase() });
      setWelcome(`Continuing as ${user.name}, ${ROLE_WORD[user.role]}`);
    } catch (cause) {
      setBusy(false);
      if (cause instanceof ApiError && cause.expired) setError("That token is not valid or has expired.");
      else if (cause instanceof ApiError && cause.code === "network")
        setError(`No answer from ${api.trim() || defaultApiBase()}. Check that the backend is running.`);
      else setError("That token did not work. Check it and try again.");
    }
  };

  return (
    <main className="v-setup">
      <div className="v-setup__card">
        <Wordmark size="lg" />
        <p className="v-copy-16 v-setup__lede">
          Paste the access token your instructor or the local setup printed.
        </p>

        {message ? <Notice tone="warn">{message}</Notice> : null}

        <form className="v-setup__form" onSubmit={submit}>
          <Field
            label="Access token"
            value={token}
            onChange={setToken}
            type="password"
            autoFocus
            error={error ?? undefined}
            name="token"
          />

          <div className="v-setup__advanced">
            <button
              type="button"
              className="v-setup__disclosure v-label-14"
              aria-expanded={advanced}
              onClick={() => setAdvanced((open) => !open)}
            >
              <Icon glyph={advanced ? ChevronDown : ChevronRight} size={16} />
              Advanced
            </button>
            {advanced ? (
              <Field
                label="API base"
                value={api}
                onChange={setApi}
                hint="Change this only if the backend is not on the default port."
                name="api"
              />
            ) : null}
          </div>

          <Button type="submit" variant="primary" size="lg" busy={busy} className="v-setup__submit">
            Continue
          </Button>
        </form>

        {welcome ? (
          <p className="v-copy-14 v-setup__welcome" role="status">
            {welcome}
          </p>
        ) : null}
      </div>
    </main>
  );
}
