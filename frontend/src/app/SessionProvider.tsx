import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, VerityClient } from "../api/client";
import { clearSession, loadSession, saveSession, type Session } from "../api/session";
import type { Capabilities, Course, User } from "../api/types";
import { SessionContext, type SessionValue } from "./session-context";
import { SessionSetup } from "./SessionSetup";
import { Spinner } from "../components/Spinner";

interface Loaded {
  user: User;
  capabilities: Capabilities;
  courses: Course[];
  client: VerityClient;
}

/** Loads the stored session, calls me()/capabilities()/courses(), and renders SessionSetup when
 *  there is no valid session. Any 401 from anywhere in the tree comes back here through the
 *  `onExpired` callback the client errors are checked against. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [checking, setChecking] = useState(session !== null);
  const [message, setMessage] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id);
    },
    [],
  );

  const load = useCallback(async (next: Session): Promise<Loaded> => {
    const client = new VerityClient(next);
    const [user, capabilities, courses] = await Promise.all([
      client.me(),
      client.capabilities(),
      client.courses(),
    ]);
    return { user, capabilities, courses, client };
  }, []);

  // resume the stored session on first paint
  useEffect(() => {
    if (!session || loaded) return;
    let live = true;
    setChecking(true);
    load(session)
      .then((next) => {
        if (live) setLoaded(next);
      })
      .catch((cause: unknown) => {
        if (!live) return;
        clearSession();
        setSession(null);
        setMessage(
          cause instanceof ApiError && cause.expired
            ? "That session expired. Paste a current token to continue."
            : "That session could not be resumed. Paste a token to continue.",
        );
      })
      .finally(() => {
        if (live) setChecking(false);
      });
    return () => {
      live = false;
    };
  }, [session, loaded, load]);

  const onExpired = useCallback(() => {
    clearSession();
    setLoaded(null);
    setSession(null);
    setMessage("That session expired. Paste a current token to continue.");
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setLoaded(null);
    setSession(null);
    setMessage(null);
  }, []);

  const refresh = useCallback(() => {
    if (!session) return;
    void load(session)
      .then(setLoaded)
      .catch((cause: unknown) => {
        if (cause instanceof ApiError && cause.expired) onExpired();
      });
  }, [session, load, onExpired]);

  // The identity is confirmed before we commit, then held for a beat so the reader sees
  // "Continuing as <name>, <role>" before the app replaces the screen.
  const onContinue = useCallback(
    async (next: Session) => {
      const result = await load(next);
      saveSession(next);
      timers.current.push(
        window.setTimeout(() => {
          setSession(next);
          setLoaded(result);
          setMessage(null);
          navigate("/", { replace: true });
        }, 700),
      );
      return result.user;
    },
    [load, navigate],
  );

  const value: SessionValue | null = useMemo(
    () =>
      loaded
        ? {
            user: loaded.user,
            capabilities: loaded.capabilities,
            courses: loaded.courses,
            client: loaded.client,
            signOut,
            refresh,
          }
        : null,
    [loaded, signOut, refresh],
  );

  if (checking && !loaded) {
    return (
      <div className="v-session-boot">
        <Spinner size={20} label="Checking your session" />
      </div>
    );
  }

  if (!value) {
    return <SessionSetup message={message} onContinue={onContinue} />;
  }

  return (
    <SessionContext.Provider value={value}>
      <ExpiryWatch onExpired={onExpired}>{children}</ExpiryWatch>
    </SessionContext.Provider>
  );
}

/** A 401 raised anywhere under the Shell bubbles as an unhandled rejection or a thrown ApiError.
 *  Catching the window-level signal keeps every page from having to handle expiry itself. */
function ExpiryWatch({ onExpired, children }: { onExpired: () => void; children: ReactNode }) {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof ApiError && event.reason.expired) {
        event.preventDefault();
        onExpired();
      }
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, [onExpired]);
  return children;
}
