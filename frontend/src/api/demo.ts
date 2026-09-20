import type { Session } from "./session";

export type DemoView = "student" | "staff";
export interface DemoOption { id: DemoView; label: string; userId: string }

export async function demoViews(): Promise<DemoOption[]> {
  if (!import.meta.env.DEV) return [];
  try {
    const response = await fetch("/__verity_demo/views", { cache: "no-store" });
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return [];
    const data = await response.json();
    return data.available && Array.isArray(data.views) ? data.views : [];
  } catch { return []; }
}

export async function demoSession(view: DemoView): Promise<Session> {
  const response = await fetch(`/__verity_demo/session?view=${view}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Demo account unavailable");
  const data = await response.json();
  if (typeof data.token !== "string" || typeof data.api !== "string") throw new Error("Demo account unavailable");
  return { token: data.token, api: data.api };
}
