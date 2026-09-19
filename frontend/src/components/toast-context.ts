import { createContext, useContext } from "react";

export type ToastTone = "confirm" | "error";

export interface ToastRequest {
  message: string;
  tone?: ToastTone;
  /** an undo affordance is better than a confirmation dialog for reversible actions */
  action?: { label: string; onClick: () => void };
}

export interface ToastApi {
  /** Only for consequential confirmations: a save that landed, a release, a failed write. */
  toast: (request: ToastRequest) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside <ToastProvider>");
  return value;
}
