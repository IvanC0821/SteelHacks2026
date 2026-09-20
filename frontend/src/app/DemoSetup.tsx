import { useState } from "react";
import type { DemoOption, DemoView } from "../api/demo";
import { Button, Field, Notice } from "../components";
import { Wordmark } from "./Wordmark";
import "./SessionSetup.css";

export function DemoSetup({ views, onContinue }: {
  views: DemoOption[];
  onContinue: (view: DemoView) => Promise<void>;
}) {
  const [view, setView] = useState<DemoView>("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="v-setup">
      <div className="v-setup__card">
        <Wordmark size="lg" />
        <p className="v-copy-16 v-setup__lede">Choose a view to explore Verity. You can switch anytime from the sidebar.</p>
        {error ? <Notice tone="error">{error}</Notice> : null}
        <form className="v-setup__form" onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true); setError(null);
          try { await onContinue(view); }
          catch { setError("This view could not be opened. Check that the local demo is running and try again."); }
          finally { setBusy(false); }
        }}>
          <Field as="select" label="View as" value={view} onChange={(value) => setView(value as DemoView)} disabled={busy}>
            {views.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </Field>
          <Button type="submit" variant="primary" size="lg" busy={busy}>Open workspace</Button>
        </form>
      </div>
    </main>
  );
}
