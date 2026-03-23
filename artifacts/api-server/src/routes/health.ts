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

health.get("/health/db", async (c) => {
  try {
    const result = await c.env.DB.prepare("SELECT 1 as ok").first<{ ok: number }>();
    return c.json({ status: "ok", db: result?.ok === 1 ? "connected" : "error" });
  } catch (e) {
    return c.json({ status: "error", error: e instanceof Error ? e.message : "DB unreachable" }, 503);
  }
});

health.get("/health/bot", async (c) => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${c.env.BOT_TOKEN}/getMe`);
    const data = await res.json() as { ok?: boolean; result?: { username?: string } };
    if (data.ok) {
      return c.json({ status: "ok", bot: data.result?.username || "connected" });
    }
    return c.json({ status: "error", error: "Bot API returned not ok" }, 502);
  } catch (e) {
    return c.json({ status: "error", error: e instanceof Error ? e.message : "Bot API unreachable" }, 503);
  }
});

health.post("/init-db", async (c) => {
  await initSchema(c.env.DB);
  return c.json({ ok: true });
});

health.post("/setup-webhook", async (c) => {
  const webhookUrl = `https://${c.env.APP_DOMAIN}/api/webhook`;
  const secretToken = c.env.BOT_TOKEN.replace(/:/g, "_");

  const result = await fetch(
    `https://api.telegram.org/bot${c.env.BOT_TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken,
        allowed_updates: [
          "message", "callback_query", "pre_checkout_query",
          "my_chat_member", "chat_member",
        ],
        drop_pending_updates: false,
      }),
    },
  );
  const data = await result.json() as { ok?: boolean; description?: string };

  if (!result.ok || !data.ok) {
    return c.json({ ok: false, error: data.description ?? "Failed to set webhook", webhookUrl }, 502);
  }

  const infoRes = await fetch(
    `https://api.telegram.org/bot${c.env.BOT_TOKEN}/getWebhookInfo`,
  );
  const info = await infoRes.json() as { result?: { url?: string; pending_update_count?: number; last_error_message?: string } };

  return c.json({
    ok: true,
    webhookUrl,
    pending: info.result?.pending_update_count ?? 0,
    lastError: info.result?.last_error_message ?? null,
  });
});

export default health;
