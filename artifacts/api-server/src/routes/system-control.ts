import { Hono } from "hono";
import type { Env } from "../types.ts";
import { requireAdmin } from "../lib/auth.ts";
import { d1All, d1Run, initSchema } from "../lib/d1.ts";

const systemControl = new Hono<{ Bindings: Env }>();

export async function logSystem(
  db: D1Database,
  level: "info" | "warn" | "error" | "success",
  source: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  try {
    await d1Run(db,
      `INSERT INTO system_logs (level, source, message, extra, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
      [level, source, message, extra ? JSON.stringify(extra) : null],
    );
  } catch {}
}

let logWriteCount = 0;
export async function logRequest(
  db: D1Database,
  method: string,
  path: string,
  status: number,
  latencyMs: number,
  ip?: string,
) {
  try {
    await d1Run(db,
      `INSERT INTO system_logs (level, source, message, method, path, status, latency_ms, ip, created_at)
       VALUES (?, 'request', ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        status >= 500 ? "error" : status >= 400 ? "warn" : "info",
        `${method} ${path} → ${status} (${latencyMs}ms)`,
        method, path, status, latencyMs, ip || null,
      ],
    );
    logWriteCount++;
    if (logWriteCount % 50 === 0) {
      await d1Run(db, `DELETE FROM system_logs WHERE created_at < datetime('now', '-7 days')`, []);
    }
  } catch {}
}

systemControl.post("/admin/system/restart", requireAdmin(), async (c) => {
  const results: { step: string; ok: boolean; error?: string; details?: unknown }[] = [];

  await logSystem(c.env.DB, "info", "system", "System restart initiated by admin");

  try {
    await initSchema(c.env.DB);
    results.push({ step: "Database schema", ok: true });
    await logSystem(c.env.DB, "success", "restart", "Database schema initialized");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ step: "Database schema", ok: false, error: msg });
    await logSystem(c.env.DB, "error", "restart", `Database schema failed: ${msg}`);
  }

  try {
    const webhookUrl = `https://${c.env.APP_DOMAIN}/api/webhook`;
    const secretToken = c.env.BOT_TOKEN.replace(/:/g, "_");
    const whAbort = new AbortController();
    const whTimeout = setTimeout(() => whAbort.abort(), 10000);
    const res = await fetch(`https://api.telegram.org/bot${c.env.BOT_TOKEN}/setWebhook`, {
      signal: whAbort.signal,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken,
        allowed_updates: ["message", "callback_query", "pre_checkout_query", "my_chat_member", "chat_member", "managed_bot"],
        drop_pending_updates: false,
      }),
    });
    clearTimeout(whTimeout);
    const data = await res.json() as { ok?: boolean; description?: string };
    if (data.ok) {
      results.push({ step: "Webhook setup", ok: true, details: { url: webhookUrl } });
      await logSystem(c.env.DB, "success", "restart", `Webhook set to ${webhookUrl}`);
    } else {
      results.push({ step: "Webhook setup", ok: false, error: data.description });
      await logSystem(c.env.DB, "error", "restart", `Webhook setup failed: ${data.description}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push({ step: "Webhook setup", ok: false, error: msg });
    await logSystem(c.env.DB, "error", "restart", `Webhook setup error: ${msg}`);
  }

  try {
    const botAbort = new AbortController();
    const botTimeout = setTimeout(() => botAbort.abort(), 10000);
    const res = await fetch(`https://api.telegram.org/bot${c.env.BOT_TOKEN}/getMe`, { signal: botAbort.signal });
    clearTimeout(botTimeout);
    const data = await res.json() as { ok?: boolean; result?: { username?: string } };
    if (data.ok) {
      results.push({ step: "Bot API", ok: true, details: { username: data.result?.username } });
      await logSystem(c.env.DB, "success", "restart", `Bot API online: @${data.result?.username}`);
    } else {
      results.push({ step: "Bot API", ok: false, error: "Bot API not ok" });
      await logSystem(c.env.DB, "error", "restart", "Bot API check failed");
    }
  } catch (e) {
    results.push({ step: "Bot API", ok: false, error: e instanceof Error ? e.message : String(e) });
  }

  try {
    const dbCheck = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM users").first<{ cnt: number }>();
    results.push({ step: "Database connection", ok: true, details: { users: dbCheck?.cnt } });
    await logSystem(c.env.DB, "success", "restart", `Database online — ${dbCheck?.cnt} users`);
  } catch (e) {
    results.push({ step: "Database connection", ok: false, error: e instanceof Error ? e.message : String(e) });
  }

  if (c.env.MTPROTO_BACKEND_URL) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${c.env.MTPROTO_BACKEND_URL}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        results.push({ step: "MTProto backend", ok: true });
        await logSystem(c.env.DB, "success", "restart", "MTProto backend online");
      } else {
        results.push({ step: "MTProto backend", ok: false, error: `HTTP ${res.status}` });
      }
    } catch (e) {
      results.push({ step: "MTProto backend", ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  try {
    await d1Run(c.env.DB,
      `DELETE FROM system_logs WHERE created_at < datetime('now', '-7 days')`,
    );
    await logSystem(c.env.DB, "success", "restart", "Log cleanup complete (>7 days removed)");
  } catch {}

  const allOk = results.every(r => r.ok);
  await logSystem(c.env.DB, allOk ? "success" : "warn", "system",
    `System restart completed: ${results.filter(r => r.ok).length}/${results.length} steps passed`);

  return c.json({ ok: true, allOk, results, ts: Date.now() });
});

systemControl.get("/admin/system/logs", requireAdmin(), async (c) => {
  const level = c.req.query("level");
  const source = c.req.query("source");
  const since = c.req.query("since");
  const rawLimit = Number(c.req.query("limit") || 100);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 500)) : 100;

  let sql = `SELECT id, level, source, message, method, path, status, latency_ms, ip, extra, created_at FROM system_logs WHERE 1=1`;
  const params: unknown[] = [];

  if (level) { sql += ` AND level = ?`; params.push(level); }
  if (source) { sql += ` AND source = ?`; params.push(source); }
  if (since) { sql += ` AND created_at > ?`; params.push(since); }

  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  const logs = await d1All(c.env.DB, sql, params);
  return c.json({ ok: true, logs, count: logs.length });
});

systemControl.get("/admin/system/logs/stats", requireAdmin(), async (c) => {
  const [total, errors, warns, today] = await Promise.all([
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM system_logs`).first<{ cnt: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM system_logs WHERE level = 'error'`).first<{ cnt: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM system_logs WHERE level = 'warn'`).first<{ cnt: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM system_logs WHERE created_at > datetime('now', '-1 day')`).first<{ cnt: number }>(),
  ]);
  return c.json({
    ok: true,
    total: total?.cnt || 0,
    errors: errors?.cnt || 0,
    warnings: warns?.cnt || 0,
    today: today?.cnt || 0,
  });
});

systemControl.delete("/admin/system/logs", requireAdmin(), async (c) => {
  await d1Run(c.env.DB, `DELETE FROM system_logs`);
  await logSystem(c.env.DB, "info", "system", "All logs cleared by admin");
  return c.json({ ok: true });
});

export default systemControl;
