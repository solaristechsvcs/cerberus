import crypto from "node:crypto";
import express, { Request, Response, NextFunction } from "express";

export type DashboardSession = { userId: string; username: string; guilds: { id: string; name: string; permissions: string; owner?: boolean }[]; expiresAt: number };
export interface AuthStore {
  put(id: string, kind: string, data: DashboardSession | null, expiresAt: number): Promise<void>;
  consumeState(id: string): Promise<boolean>;
  getSession(id: string): Promise<DashboardSession | null>;
  remove(id: string): Promise<void>;
}
export function cookieValue(req: Request, name: string): string | null {
  const values = (req.headers.cookie ?? "").split(";").map(v => v.trim()).filter(v => v.startsWith(`${name}=`));
  if (values.length !== 1) return null;
  try { return decodeURIComponent(values[0].slice(name.length + 1)); } catch { return null; }
}
const hash = (id: string) => crypto.createHash("sha256").update(id).digest("hex");
export function registerAuth(app: express.Express, options: {
  publicUrl: string; clientId: string; trustProxy?: string | string[] | number | false;
}, store: AuthStore, authenticate: (code: string, callback: string) => Promise<Omit<DashboardSession, "expiresAt">>): void {
  const publicUrl = new URL(options.publicUrl);
  if (!["http:", "https:"].includes(publicUrl.protocol) || publicUrl.username || publicUrl.password || publicUrl.pathname !== "/" || publicUrl.search || publicUrl.hash) {
    throw new Error("dashboard.publicUrl must be an HTTP(S) origin with no path, credentials, query or fragment.");
  }
  const origin = publicUrl.origin;
  const callback = `${origin}/oauth/callback`;
  const secure = publicUrl.protocol === "https:";
  if ((options.trustProxy as unknown) === true || (typeof options.trustProxy === "number" && (!Number.isInteger(options.trustProxy) || options.trustProxy < 0))) {
    throw new Error("dashboard.trustProxy must restrict trust to proxy IPs/CIDRs or a valid hop count.");
  }
  app.set("trust proxy", options.trustProxy ?? false);
  const cookie = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
  app.use(async (req, res, next) => {
    const id = cookieValue(req, "cerberus_session");
    if (id && /^[a-f0-9]{64}$/.test(id)) res.locals.dashboardSession = await store.getSession(hash(id));
    next();
  });
  app.get("/login", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    // Set host-only cookies only on the same origin used by Discord's callback.
    if (`${req.protocol}://${req.get("host")}` !== origin) return res.redirect(`${origin}/login`);
    const state = crypto.randomBytes(32).toString("hex");
    await store.put(hash(state), "state", null, Date.now() + 10 * 60 * 1000);
    const url = new URL("https://discord.com/oauth2/authorize");
    url.search = new URLSearchParams({ client_id: options.clientId, response_type: "code", redirect_uri: callback, scope: "identify guilds", state }).toString();
    res.cookie("cerberus_oauth_state", state, { ...cookie, maxAge: 10 * 60 * 1000 });
    res.redirect(url.toString());
  });
  app.get("/oauth/callback", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const expected = cookieValue(req, "cerberus_oauth_state");
    const state = req.query.state;
    res.clearCookie("cerberus_oauth_state", cookie);
    if (!expected || !/^[a-f0-9]{64}$/.test(expected) || typeof state !== "string" || !/^[a-f0-9]{64}$/.test(state) ||
        !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(state)) || !await store.consumeState(hash(expected))) {
      return res.status(400).send("Invalid OAuth state. Start a new login from the configured dashboard URL.");
    }
    if (typeof req.query.code !== "string" || !req.query.code || req.query.error) return res.status(400).send("Discord login was cancelled or invalid. Please sign in again.");
    try {
      const user = await authenticate(req.query.code, callback);
      const id = crypto.randomBytes(32).toString("hex");
      const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
      await store.put(hash(id), "session", { ...user, expiresAt }, expiresAt);
      const old = cookieValue(req, "cerberus_session");
      if (old) await store.remove(hash(old));
      res.cookie("cerberus_session", id, { ...cookie, maxAge: 8 * 60 * 60 * 1000 });
      res.redirect("/dashboard");
    } catch { res.status(500).send("Discord login failed. Please sign in again."); }
  });
  app.post("/logout", async (req, res) => {
    const id = cookieValue(req, "cerberus_session");
    if (id) await store.remove(hash(id));
    res.clearCookie("cerberus_session", cookie);
    res.status(204).end();
  });
  app.use((_error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(503).send("Dashboard authentication is temporarily unavailable. Please try again later.");
  });
}
