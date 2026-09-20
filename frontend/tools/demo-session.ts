// Local Vite middleware only. Demo credentials stay in the ignored seed file, never the bundle.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const SESSION_FILE = fileURLToPath(new URL("../.dev/session.json", import.meta.url));

interface Seed {
  api: string;
  course_id: string;
  users: Record<string, { id: string; role: string; token: string }>;
}

interface RosterMember { id: string; name: string; role: string }

export function studentAccounts(seed: Seed, roster: RosterMember[]) {
  const local = new Map(Object.values(seed.users).map((user) => [user.id, user]));
  return roster.filter((member) => member.role === "student" && local.get(member.id)?.role === "student" && local.get(member.id)?.token)
    .map((member) => ({ userId: member.id, name: member.name, courseId: seed.course_id }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function localRequest(host: string | undefined, origin: string | undefined, address: string | undefined): boolean {
  try {
    const target = new URL(`http://${host}`);
    return !!host && LOOPBACK.has(target.hostname) && ADDRESSES.has(address ?? "")
      && (!origin || new URL(origin).origin === target.origin);
  } catch { return false; }
}

export function demoSession(): Plugin {
  return {
    name: "verity-local-demo",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__verity_demo", async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/json");
        res.setHeader("X-Content-Type-Options", "nosniff");
        const send = (status: number, data: unknown) => {
          res.statusCode = status;
          res.end(JSON.stringify(data));
        };
        if (process.env.VERITY_DEMO === "0") return send(200, { available: false });
        if (!localRequest(req.headers.host, req.headers.origin, req.socket.remoteAddress)) {
          return send(403, { available: false });
        }
        if (req.method !== "GET") return send(405, { available: false });
        try {
          const seed = JSON.parse(await readFile(SESSION_FILE, "utf8")) as Seed;
          const api = new URL(seed.api);
          if (api.protocol !== "http:" || !LOOPBACK.has(api.hostname)) return send(200, { available: false });
          const staff = seed.users["Dana Whitfield"];
          if (staff?.role !== "instructor" || !staff.token || !seed.course_id) {
            return send(200, { available: false });
          }
          const rosterResponse = await fetch(`${seed.api}/api/courses/${encodeURIComponent(seed.course_id)}/members`, {
            headers: { Authorization: `Bearer ${staff.token}` }, signal: AbortSignal.timeout(5000),
          });
          if (!rosterResponse.ok) return send(200, { available: false });
          const roster = await rosterResponse.json() as RosterMember[];
          const accounts = studentAccounts(seed, roster);
          const defaultStudent = accounts.find((account) => account.userId === seed.users["Farah Aziz"]?.id) ?? accounts[0];
          if (!defaultStudent) return send(200, { available: false });
          const url = new URL(req.url ?? "/", "http://localhost");
          if (url.pathname === "/views") {
            return send(200, { available: true, views: [
              { id: "student", label: "Student", userId: defaultStudent.userId, accounts },
              { id: "staff", label: "Instructor / TA", userId: staff.id },
            ] });
          }
          if (url.pathname === "/session") {
            const view = url.searchParams.get("view");
            const studentId = url.searchParams.get("studentId") ?? defaultStudent.userId;
            const student = accounts.some((account) => account.userId === studentId)
              ? Object.values(seed.users).find((user) => user.id === studentId) : null;
            const identity = view === "student" ? student : view === "staff" ? staff : null;
            if (!identity) return send(400, { available: false });
            return send(200, { token: identity.token, api: seed.api });
          }
          return send(404, { available: false });
        } catch {
          return send(200, { available: false });
        }
      });
    },
  };
}
