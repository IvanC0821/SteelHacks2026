// The route table. Each page folder owns a fragment that default-exports RouteObject[]; this file
// spreads all five into the Shell's children and resolves the one path two tasks share.
//
// Conventions a fragment must follow:
//   path      absolute, e.g. "/a/:assignmentId/grade"
//   handle    { workspace?: boolean; roles?: Role[]; title?: string }  (see route-meta.ts)
//   element   the page; the Shell already renders the rail, so a page starts with <PageHeader>
//
// Two fragments may declare the same path when they differ by role (today only "/a/:assignmentId",
// student vs staff). They must agree on `workspace`.

import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { App } from "./App";
import { Shell } from "./Shell";
import { DevComponents } from "./DevComponents";
import { DevPdf } from "./DevPdf";
import { RoleSplit } from "./RoleSplit";
import type { RouteHandle } from "./route-meta";
import gradingRoutes from "../pages/grading/routes";
import rubricRoutes from "../pages/rubric/routes";
import studentRoutes from "../pages/student/routes";
import courseRoutes from "../pages/course/routes";
import landingRoutes from "../pages/landing/routes";

/** Every fragment, in the order the ownership table lists them. */
export const pageRoutes: RouteObject[] = [
  ...landingRoutes,
  ...courseRoutes,
  ...gradingRoutes,
  ...rubricRoutes,
  ...studentRoutes,
];

/** Collapses duplicate paths into one route that picks its element by the reader's role. */
export function mergeByPath(routes: RouteObject[]): RouteObject[] {
  const order: string[] = [];
  const groups = new Map<string, RouteObject[]>();
  for (const route of routes) {
    const key = route.path ?? "";
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)?.push(route);
  }

  return order.map((key) => {
    const group = groups.get(key) as RouteObject[];
    if (group.length === 1) return group[0];
    const handles = group.map((route) => (route.handle ?? {}) as RouteHandle);
    return {
      path: key,
      element: (
        <RoleSplit
          options={group.map((route, index) => ({
            roles: handles[index].roles,
            element: route.element,
          }))}
        />
      ),
      handle: {
        workspace: handles.some((handle) => handle.workspace),
        title: handles.find((handle) => handle.title)?.title,
        // the union: the Shell lets everyone through and RoleSplit picks the right page
        roles: undefined,
      } satisfies RouteHandle,
    } satisfies RouteObject;
  });
}

export const routeTable: RouteObject[] = [
  {
    // App owns SessionProvider and ToastProvider; everything below is signed in.
    element: <App />,
    children: [
      {
        // /session is a stable URL for the setup screen. Signed in, it bounces to the landing.
        path: "/session",
        element: <Navigate to="/" replace />,
      },
      {
        element: <Shell />,
        children: [
          ...mergeByPath(pageRoutes),
          {
            path: "/dev/components",
            element: <DevComponents />,
            handle: { title: "Components" } satisfies RouteHandle,
          },
          {
            // a dev harness for the PDF contract, not a product page
            path: "/dev/pdf",
            element: <DevPdf />,
            handle: { workspace: true, title: "PDF viewer" } satisfies RouteHandle,
          },
          {
            path: "*",
            element: <Navigate to="/" replace />,
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routeTable);
