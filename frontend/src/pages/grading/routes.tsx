// Task 2 owns this file: the grading workspace routes.
// Both paths render the same workspace; without a submission id it resolves the first paper
// still needing review and replaces the URL.
import type { RouteObject } from "react-router-dom";
import { STAFF } from "../../app/route-meta";
import { GradingWorkspace } from "./GradingWorkspace";

const routes: RouteObject[] = [
  {
    path: "/a/:assignmentId/grade",
    element: <GradingWorkspace />,
    handle: { workspace: true, roles: STAFF, title: "Grading" },
  },
  {
    path: "/a/:assignmentId/grade/:submissionId",
    element: <GradingWorkspace />,
    handle: { workspace: true, roles: STAFF, title: "Grading" },
  },
];

export default routes;
