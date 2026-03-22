import { Hono } from "hono";
import type { Env } from "../types.ts";
import { initSchema } from "../lib/d1.ts";

const health = new Hono<{ Bindings: Env }>();

health.get("/health", (c) =>
  c.json({ ok: true, ts: Date.now(), runtime: "cloudflare-worker" }),
);

health.get("/healthz", (c) =>
  c.json({ status: "ok" }),
);

health.post("/init-db", async (c) => {
  await initSchema(c.env.DB);
  return c.json({ ok: true });
});

health.post("/setup-webhook", async (c) => {
  const webhookUrl = "https://mini.susagar.sbs/api/webhook";
  const result = await fetch(
    `https://api.telegram.org/bot${c.env.BOT_TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: [
          "message", "callback_query", "pre_checkout_query",
          "my_chat_member", "chat_member",
        ],
        drop_pending_updates: false,
      }),
    },
  );
  const data = await result.json();
  return c.json({ ok: true, webhookUrl, data });
});

export default health;
