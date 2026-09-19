import type { RouteObject } from "react-router-dom";
import { LandingRoute } from "./LandingRoute";

/** Task 5 owns `/`: the signed-out landing page, and a redirect for anyone already signed in. */
const routes: RouteObject[] = [
  {
    path: "/",
    element: <LandingRoute />,
    handle: { title: "Verity" },
  },
];

export default routes;
