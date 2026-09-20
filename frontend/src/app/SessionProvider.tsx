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
  const [switchDestination, setSwitchDestination] = useState<{ userId: string; path: string } | null>(null);
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

  const switchView = useCallback(async (view: DemoView, studentId?: string) => {
    let destination: string | null = null;
    let targetStudentId = studentId;
    const paperId = location.pathname.match(/^\/a\/[^/]+\/grade\/([^/]+)$/)?.[1]
      ?? location.pathname.match(/^\/s\/([^/]+)$/)?.[1];
    if (loaded && paperId && !studentId) {
      const paper = await loaded.client.submission(paperId);
      targetStudentId = paper.student_id;
      destination = view === "student" ? `/s/${paper.id}`
        : paper.final ? `/a/${paper.assignment_id}/grade/${paper.id}` : `/a/${paper.assignment_id}/overview`;
    }
    const account = views?.find((option) => option.id === "student")?.accounts?.find((item) => item.userId === targetStudentId);
    if (view === "student" && targetStudentId && !account) throw new Error("Student is not in this demo class");
    const next = await demoSession(view, view === "student" ? targetStudentId : undefined);
    const result = await load(next);
    if ((view === "student") !== (result.user.role === "student")) throw new Error("Wrong demo identity");
    if (view === "student" && targetStudentId && result.user.id !== targetStudentId) throw new Error("Wrong student identity");
    if (account && !result.courses.some((course) => course.id === account.courseId)) throw new Error("Wrong demo class");
    const nextPath = destination ?? (result.courses[0] ? `/c/${result.courses[0].id}` : "/");
    // Keep the new account from mounting on the previous student's route while the
    // router commits navigation. Failed account validation still leaves the old view intact.
    setSwitchDestination({ userId: result.user.id, path: nextPath });
    saveSession(next);
    setSession(next);
    setLoaded(result);
    setMessage(null);
    navigate(nextPath, { replace: true });
  }, [load, navigate, loaded, location.pathname, views]);

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

  if (switchDestination && loaded?.user.id === switchDestination.userId && location.pathname === switchDestination.path) {
    setSwitchDestination(null);
  }

  if (booting || views === null || (switchDestination &&
    (loaded?.user.id !== switchDestination.userId || location.pathname !== switchDestination.path))) {
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
