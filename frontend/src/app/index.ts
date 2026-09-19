// The shell contract for Tasks 2-5. Documented in design/DESIGN.md.
export { App } from "./App";
export { Shell } from "./Shell";
export { PageHeader, type PageHeaderProps } from "./PageHeader";
export { Wordmark, type WordmarkProps } from "./Wordmark";
export { Placeholder, type PlaceholderProps } from "./Placeholder";
export { RoleSplit, type RoleSplitOption } from "./RoleSplit";
export { SessionProvider } from "./SessionProvider";
export { SessionSetup, type SessionSetupProps } from "./SessionSetup";
export { useSession, useClient, useUser, useCapabilities, type SessionValue } from "./session-context";
export {
  useResource,
  useAssignment,
  useAssignments,
  useSubmission,
  useSubmissions,
  usePrimaryCourse,
  type Resource,
} from "./data";
export {
  allowsRole,
  resolveHandle,
  wrongRoleSentence,
  STAFF,
  STUDENT,
  INSTRUCTOR,
  type RouteHandle,
} from "./route-meta";
export { router, routeTable, pageRoutes, mergeByPath } from "./routes";
