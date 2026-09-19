import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { ToastContext, type ToastRequest } from "./toast-context";
import "./Toast.css";

interface LiveToast extends ToastRequest {
  id: number;
}

const DISMISS_AFTER = 5000;

/** Wrap the app once. Toasts announce through role="status" and enter over 350ms. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<LiveToast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (request: ToastRequest) => {
      const id = nextId.current++;
      setItems((current) => [...current, { ...request, id }]);
      window.setTimeout(() => dismiss(id), DISMISS_AFTER);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="v-toast-layer" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`v-toast v-toast--${item.tone ?? "confirm"}`}>
            <span className="v-toast__message">{item.message}</span>
            {item.action ? (
              <button
                type="button"
                className="v-toast__action"
                onClick={() => {
                  item.action?.onClick();
                  dismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
