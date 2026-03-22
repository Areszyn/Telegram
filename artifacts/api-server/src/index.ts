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
import video from "./routes/video.ts";
import botAdmin from "./routes/bot-admin.ts";
import privacy from "./routes/privacy.ts";
import { pollPendingDonations } from "./routes/donations.ts";
import { initSchema } from "./lib/d1.ts";

const app = new Hono<{ Bindings: Env }>();

app.use(cors({
  origin: "*",
  allowHeaders: ["Content-Type", "x-init-data", "authorization"],
  allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

app.route("/", health);
app.route("/", privacy);
app.route("/", video);

const api = new Hono<{ Bindings: Env }>();
api.route("/", health);
api.route("/", webhook);
api.route("/", messages);
api.route("/", moderation);
api.route("/", sessions);
api.route("/", spam);
api.route("/", dr);
api.route("/", donations);
api.route("/", video);
api.route("/", botAdmin);
api.route("/", privacy);

app.route("/api", api);

app.get("/", (c) =>
  c.json({ name: "Lifegram API", runtime: "cloudflare-worker", version: "2.0.0" }),
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
