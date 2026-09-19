import { Outlet } from "react-router-dom";
import { SessionProvider } from "./SessionProvider";
import { ToastProvider } from "../components/Toast";

/** The router's root element: identity first, then the toast layer, then the matched route. */
export function App() {
  return (
    <SessionProvider>
      <ToastProvider>
        <Outlet />
      </ToastProvider>
    </SessionProvider>
  );
}
