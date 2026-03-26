import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types.ts";
import health from "./routes/health.ts";
import webhook from "./routes/webhook.ts";
import messages from "./routes/messages.ts";
import moderation from "./routes/moderation.ts";
import sessions from "./routes/sessions.ts";
import spam from "./routes/spam.ts";
import dr from "./routes/deletion-requests.ts";
import donations from "./routes/donations.ts";
import botAdmin from "./routes/bot-admin.ts";
import privacy from "./routes/privacy.ts";
import { pollPendingDonations } from "./routes/donations.ts";
import { initSchema } from "./lib/d1.ts";
import file from "./routes/file.ts";
import liveChat from "./routes/live-chat.ts";
import phishing from "./routes/phishing.ts";
import widgetRoutes from "./routes/widget.ts";
import aiChat from "./routes/ai-chat.ts";

const app = new Hono<{ Bindings: Env }>();

app.onError((err, c) => {
  console.error("[worker-error]", c.req.method, c.req.url, err?.message ?? err);
  return c.json({ error: "Internal server error" }, 500);
});

app.use(cors({
  origin: "*",
  allowHeaders: ["Content-Type", "x-init-data", "authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

app.route("/", health);
app.route("/", privacy);

const api = new Hono<{ Bindings: Env }>();
api.route("/", health);
api.route("/", webhook);
api.route("/", messages);
api.route("/", moderation);
api.route("/", sessions);
api.route("/", spam);
api.route("/", dr);
api.route("/", donations);
api.route("/", botAdmin);
api.route("/", privacy);
api.route("/", file);
api.route("/", liveChat);
api.route("/", phishing);
api.route("/", widgetRoutes);
api.route("/", aiChat);

app.route("/api", api);

function getPagesOrigin(env: Env) { return env.PAGES_ORIGIN || env.MINIAPP_URL.replace(/\/+$/, ""); }

app.get("/miniapp", (c) => c.redirect("/miniapp/", 301));

app.get("/miniapp/*", async (c) => {
  const url = new URL(c.req.url);
  const origin = getPagesOrigin(c.env);
  const stripped = url.pathname.replace(/^\/miniapp/, "") || "/";
  const pagesUrlObj = new URL(stripped, origin);
  for (const [k, v] of url.searchParams) pagesUrlObj.searchParams.set(k, v);
  if (stripped === "/" || stripped.endsWith(".html")) {
    pagesUrlObj.searchParams.set("_cb", String(Date.now()));
  }
  const pagesUrl = pagesUrlObj.toString();
  const pagesHost = new URL(origin).host;
  const fwdHeaders = new Headers(c.req.raw.headers);
  fwdHeaders.set("host", pagesHost);
  fwdHeaders.delete("cf-connecting-ip");
  fwdHeaders.delete("cf-ray");
  fwdHeaders.set("cache-control", "no-cache");
  const res = await fetch(pagesUrl, {
    method: c.req.method,
    headers: fwdHeaders,
    cf: { cacheTtl: 0, cacheEverything: false } as any,
  });
  const headers = new Headers(res.headers);
  headers.delete("x-frame-options");
  const ct = headers.get("content-type") ?? "";
  if (ct.includes("text/html")) {
    headers.set("cache-control", "no-cache, no-store, must-revalidate");
    headers.set("pragma", "no-cache");
    headers.set("expires", "0");
    headers.delete("etag");
    headers.delete("last-modified");
    headers.set("vary", "Accept-Encoding");
    let html = await res.text();
    html = html.replace(/<!-- Cloudflare Pages Analytics -->[\s\S]*?<!-- Cloudflare Pages Analytics -->/g, "");
    html = html.replace(/<script>\(function\(\)\{function c\(\)[\s\S]*?<\/script>/g, "");
    html = html.replace(/<script[^>]*cloudflareinsights[^>]*>[\s\S]*?<\/script>/g, "");
    html = html.replace(/<script[^>]*cf-beacon[^>]*>[\s\S]*?<\/script>/g, "");
    headers.set("content-length", String(new TextEncoder().encode(html).length));
    return new Response(html, { status: res.status, headers });
  }
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(res.body, {
    status: res.status,
    headers,
  });
});

app.get("/", (c) =>
  c.json({ name: "Lifegram API", runtime: "cloudflare-worker", web_version: "2.7.4", landing_page: "https://areszyn.com" }),
);

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(req, env, ctx);
  },

  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      await pollPendingDonations(env.DB, env.OXAPAY_MERCHANT_KEY);
    } catch (e) {
      console.error("[scheduled] pollPendingDonations failed:", e);
    }
  },
} satisfies ExportedHandler<Env>;
