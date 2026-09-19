import type { TabSpec } from "./Tabs";

/** Reads the active tab from a location's search string without rendering the control. */
export function activeTab(search: string, tabs: TabSpec[], param = "tab", defaultTab?: string): string {
  const value = new URLSearchParams(search).get(param);
  if (value && tabs.some((tab) => tab.id === value)) return value;
  return defaultTab ?? tabs[0]?.id ?? "";
}
