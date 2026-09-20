import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ApiError, VerityClient } from "../api/client";
import { clearSession, loadSession, saveSession, type Session } from "../api/session";
import type { Capabilities, Course, User } from "../api/types";
import { SessionContext, type SessionValue } from "./session-context";
import { SessionSetup } from "./SessionSetup";
import { Landing } from "../pages/landing";
import { Spinner } from "../components/Spinner";
import { demoViews, demoSession, type DemoOption, type DemoView } from "../api/demo";
import { DemoSetup } from "./DemoSetup";

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
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [views, setViews] = useState<DemoOption[] | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let live = true;
    void demoViews().then((options) => { if (live) setViews(options); });
    return () => { live = false; };
  }, []);

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

  // A stored session with nothing loaded yet is exactly the resume in flight: it either ends with
  // `loaded` set or with `session` cleared, so the boot state is derived, never set from an effect.
  const booting = session !== null && loaded === null;

  // resume the stored session on first paint
  useEffect(() => {
    if (!session || loaded) return;
    let live = true;
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

  const switchView = useCallback(async (view: DemoView) => {
    const next = await demoSession(view);
    const result = await load(next);
    if ((view === "student") !== (result.user.role === "student")) throw new Error("Wrong demo identity");
    saveSession(next);
    setSession(next);
    setLoaded(result);
    setMessage(null);
    navigate(result.courses[0] ? `/c/${result.courses[0].id}` : "/", { replace: true });
  }, [load, navigate]);

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
            demo: views?.length ? { views, switchView } : undefined,
          }
        : null,
    [loaded, signOut, refresh, views, switchView],
  );

  if (booting || views === null) {
    return (
      <div className="v-session-boot">
        <Spinner size={20} label="Checking your session" />
      </div>
    );
  }

  if (!value) {
    // "/" is the signed-out landing page; every other path needs an identity first.
    if (location.pathname === "/") return <Landing />;
    if (views.length) return <DemoSetup views={views} onContinue={switchView} />;
    return <SessionSetup message={message} onContinue={onContinue} />;
  }

  return (
    <SessionContext.Provider value={value}>
      <ExpiryWatch key={value.user.id} onExpired={onExpired}>{children}</ExpiryWatch>
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
