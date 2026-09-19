import type { RouteObject } from "react-router-dom";
import { STAFF } from "../../app/route-meta";
import { CourseHome } from "./CourseHome";
import { Overview } from "./Overview";
import { Reports } from "./Reports";

/** Task 5 owns the course home, the staff assignment page and its Overview and Reports tabs.
 *  `/a/:assignmentId` is shared with Task 4: staff land on Overview, students on their workspace,
 *  and the router's RoleSplit picks between the two. */
const routes: RouteObject[] = [
  {
    path: "/c/:courseId",
    element: <CourseHome />,
    handle: { title: "Course" },
  },
  {
    path: "/a/:assignmentId",
    element: <Overview />,
    handle: { roles: STAFF, title: "Overview" },
  },
  {
    path: "/a/:assignmentId/overview",
    element: <Overview />,
    handle: { roles: STAFF, title: "Overview" },
  },
  {
    path: "/a/:assignmentId/reports",
    element: <Reports />,
    handle: { roles: STAFF, title: "Reports" },
  },
];

export default routes;
