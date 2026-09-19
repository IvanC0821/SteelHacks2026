import { useSearchParams } from "react-router-dom";
import "./Tabs.css";

export interface TabSpec {
  id: string;
  label: string;
  /** an optional count or chip rendered after the label */
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabSpec[];
  /** the search param that holds the active tab id; defaults to "tab" */
  param?: string;
  /** used when the param is absent; defaults to the first tab */
  defaultTab?: string;
  label: string;
  /** called after the URL is updated, if the page needs to react */
  onChange?: (id: string) => void;
}

/** URL-driven: the active tab lives in the query string so a link reaches it and Back works.
 *  Arrow keys move between tabs (roving tabindex); Tab leaves the group. */
export function Tabs({ tabs, param = "tab", defaultTab, label, onChange }: TabsProps) {
  const [params, setParams] = useSearchParams();
  const active = params.get(param) ?? defaultTab ?? tabs[0]?.id;

  const select = (id: string) => {
    const next = new URLSearchParams(params);
    next.set(param, id);
    setParams(next, { replace: true });
    onChange?.(id);
  };

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    select(next.id);
    document.getElementById(`v-tab-${next.id}`)?.focus();
  };

  return (
    <div className="v-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          id={`v-tab-${tab.id}`}
          type="button"
          role="tab"
          className="v-tabs__tab"
          aria-selected={tab.id === active}
          tabIndex={tab.id === active ? 0 : -1}
          onClick={() => select(tab.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {tab.label}
          {tab.badge !== undefined ? <span className="v-tabs__badge">{tab.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}
