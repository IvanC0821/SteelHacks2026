import { createContext, useContext } from "react";
import type { VerityClient } from "../api/client";
import type { Capabilities, Course, User } from "../api/types";

export interface SessionValue {
  /** the current identity, always present inside the Shell */
  user: User;
  capabilities: Capabilities;
  client: VerityClient;
  /** the courses this identity belongs to; `courses[0]` is the rail's course */
  courses: Course[];
  /** clears localStorage and returns to session setup */
  signOut: () => void;
  /** refetches me/capabilities/courses, e.g. after a course is created */
  refresh: () => void;
}

export const SessionContext = createContext<SessionValue | null>(null);

/** The whole session. Only valid inside <SessionProvider>'s signed-in tree. */
export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside a signed-in <SessionProvider> tree");
  return value;
}

/** The typed API client for the current identity. Throws when there is no session. */
export function useClient(): VerityClient {
  return useSession().client;
}

/** The current identity. */
export function useUser(): User {
  return useSession().user;
}

/** What the backend provider can actually do right now. */
export function useCapabilities(): Capabilities {
  return useSession().capabilities;
}
