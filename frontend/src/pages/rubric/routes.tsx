// Task 3 owns this file: the rubric studio and assignment setup.
import type { RouteObject } from "react-router-dom";
import { INSTRUCTOR, STAFF } from "../../app/route-meta";
import { NewAssignment } from "./NewAssignment";
import { RubricStudio } from "./RubricStudio";

const routes: RouteObject[] = [
  {
    path: "/a/:assignmentId/rubric",
    element: <RubricStudio />,
    handle: { workspace: true, roles: STAFF, title: "Rubric" },
  },
  {
    path: "/c/:courseId/new",
    element: <NewAssignment />,
    handle: { roles: INSTRUCTOR, title: "New assignment" },
  },
];

export default routes;
