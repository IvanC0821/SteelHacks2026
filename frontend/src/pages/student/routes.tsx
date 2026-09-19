// Task 4 owns this file: the student workspace.
// `/a/:assignmentId` is shared with Task 5's staff view; src/app/routes.tsx picks by role.
import type { RouteObject } from "react-router-dom";
import { STUDENT } from "../../app/route-meta";
import { AssignmentPage } from "./AssignmentPage";
import { AssignPages } from "./AssignPages";
import { Feedback } from "./Feedback";

const routes: RouteObject[] = [
  {
    path: "/a/:assignmentId",
    element: <AssignmentPage />,
    handle: { roles: STUDENT, title: "Assignment" },
  },
  {
    path: "/s/:submissionId/pages",
    element: <AssignPages />,
    handle: { workspace: true, roles: STUDENT, title: "Assign pages" },
  },
  {
    path: "/s/:submissionId",
    element: <Feedback />,
    handle: { workspace: true, roles: STUDENT, title: "Feedback" },
  },
];

export default routes;
