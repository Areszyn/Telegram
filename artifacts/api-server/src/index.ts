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
import widgetRoutes, { pollPendingWidgetPlanPayments } from "./routes/widget.ts";
import aiChat from "./routes/ai-chat.ts";
import notices from "./routes/notices.ts";

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
api.route("/", notices);

app.route("/api", api);

app.get("/", (c) =>
  c.json({ name: "Lifegram API", runtime: "cloudflare-worker", web_version: "2.7.5", landing_page: "https://areszyn.org" }),
);

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(req, env, ctx);
  },

  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    try {
      await initSchema(env.DB);
    } catch (e) {
      console.error("[scheduled] initSchema failed:", e);
    }
    try {
      await pollPendingDonations(env.DB, env.OXAPAY_MERCHANT_KEY);
    } catch (e) {
      console.error("[scheduled] pollPendingDonations failed:", e);
    }
    try {
      await pollPendingWidgetPlanPayments(env.DB, env.OXAPAY_MERCHANT_KEY);
    } catch (e) {
      console.error("[scheduled] pollPendingWidgetPlanPayments failed:", e);
    }
  },
} satisfies ExportedHandler<Env>;
