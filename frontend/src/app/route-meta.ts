import type { Role } from "../api/types";

/** Attached to a route object as `handle`. The Shell reads it through `useMatches()`. */
export interface RouteHandle {
  /** collapses the rail to 56px so the paper gets the width */
  workspace?: boolean;
  /** the roles allowed here; omit for everyone signed in */
  roles?: Role[];
  /** a short name for the rail's active state and the document title */
  title?: string;
}

/** True when this identity may see the route. A route with no `roles` is open to everyone. */
export function allowsRole(handle: RouteHandle | undefined, role: Role): boolean {
  if (!handle?.roles || handle.roles.length === 0) return true;
  return handle.roles.includes(role);
}

/** The last matched handle wins, so a child route can override its parent. */
export function resolveHandle(matches: Array<{ handle?: unknown }>): RouteHandle {
  let result: RouteHandle = {};
  for (const match of matches) {
    const handle = match.handle as RouteHandle | undefined;
    if (handle) result = { ...result, ...handle };
  }
  return result;
}

/** The one sentence a reader in the wrong role sees. */
export function wrongRoleSentence(role: Role): string {
  return role === "student"
    ? "This page is for the instructor and TAs, so there is nothing here for you."
    : "This page is for students, so there is nothing here for you.";
}

export const STAFF: Role[] = ["ta", "instructor"];
export const STUDENT: Role[] = ["student"];
export const INSTRUCTOR: Role[] = ["instructor"];
