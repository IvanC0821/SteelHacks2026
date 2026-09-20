import { useId, useState } from "react";
import { Users } from "lucide-react";
import type { DemoView } from "../api/demo";
import { Icon } from "../components";
import { useSession } from "./session-context";

export function ViewSwitcher({ collapsed }: { collapsed: boolean }) {
  const { user, demo } = useSession();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!demo) return null;
  const students = demo.views.find((view) => view.id === "student")?.accounts ?? [];
  const selected = students.some((student) => student.userId === user.id) ? "student"
    : demo.views.find((view) => view.userId === user.id)?.id ?? "";
  return (
    <div className={`v-view-switch${collapsed ? " is-compact" : ""}`}>
      <label htmlFor={id} className={collapsed ? "v-visually-hidden" : "v-label-12 v-muted"}>View as</label>
      <div className="v-view-switch__control">
        {collapsed ? <Icon glyph={Users} size={20} /> : null}
        <select
          id={id}
          value={selected}
          disabled={busy}
          aria-busy={busy}
          title={collapsed ? "Switch between Student and Instructor / TA" : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={async (event) => {
            const view = event.target.value as DemoView;
            setBusy(true); setError(null);
            try { await demo.switchView(view); }
            catch { setError("Could not switch views. Try again."); }
            finally { setBusy(false); }
          }}
        >
          {!selected ? <option value="" hidden>{user.role === "student" ? "Student" : "Instructor / TA"}</option> : null}
          {demo.views.map((view) => <option key={view.id} value={view.id}>{view.label}</option>)}
        </select>
      </div>
      {selected === "student" && students.length > 0 ? (
        <>
          <label htmlFor={`${id}-student`} className={collapsed ? "v-visually-hidden" : "v-label-12 v-muted"}>Student</label>
          <div className="v-view-switch__control">
            {collapsed ? <Icon glyph={Users} size={20} /> : null}
            <select
              id={`${id}-student`}
              value={user.id}
              disabled={busy}
              title={`Student: ${user.name}`}
              onChange={async (event) => {
                setBusy(true); setError(null);
                try { await demo.switchView("student", event.target.value); }
                catch { setError("Could not open this student's view. Try again."); }
                finally { setBusy(false); }
              }}
            >
              {students.map((student) => <option key={student.userId} value={student.userId}>{student.name}</option>)}
            </select>
          </div>
        </>
      ) : null}
      {busy && !collapsed ? <p className="v-label-12" role="status">Switching view…</p> : null}
      {error ? <p className="v-label-12 v-view-switch__error" id={`${id}-error`} role="alert">{error}</p> : null}
    </div>
  );
}
