// Local Vite middleware only. Demo credentials stay in the ignored seed file, never the bundle.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const SESSION_FILE = fileURLToPath(new URL("../.dev/session.json", import.meta.url));

interface Seed {
  api: string;
  users: Record<string, { id: string; role: string; token: string }>;
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
          const student = seed.users["Farah Aziz"];
          const staff = seed.users["Dana Whitfield"];
          if (student?.role !== "student" || staff?.role !== "instructor" || !student.token || !staff.token) {
            return send(200, { available: false });
          }
          const url = new URL(req.url ?? "/", "http://localhost");
          if (url.pathname === "/views") {
            return send(200, { available: true, views: [
              { id: "student", label: "Student", userId: student.id },
              { id: "staff", label: "Instructor / TA", userId: staff.id },
            ] });
          }
          if (url.pathname === "/session") {
            const view = url.searchParams.get("view");
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
