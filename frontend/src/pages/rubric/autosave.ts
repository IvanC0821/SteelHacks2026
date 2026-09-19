// Autosave: 1.5s after the last edit, and never two saves in flight. Explicit Save draft calls
// `flush`, which cancels the pending timer and saves immediately.

export const AUTOSAVE_DELAY = 1500;

export interface Debounced {
  schedule: () => void;
  flush: () => void;
  cancel: () => void;
  pending: () => boolean;
}

export function createDebounce(run: () => void, delay = AUTOSAVE_DELAY): Debounced {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return {
    schedule() {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        run();
      }, delay);
    },
    flush() {
      cancel();
      run();
    },
    cancel,
    pending: () => timer !== null,
  };
}

/** "Draft saved 12:03" — the local clock, no seconds, no fake precision. */
export function savedAtLabel(at: Date): string {
  return `Draft saved ${at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase()}`;
}
