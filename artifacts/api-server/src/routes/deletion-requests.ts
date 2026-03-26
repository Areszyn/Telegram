import { Hono } from "hono";
import type { Env } from "../types.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import { requireAdmin, parseAuth } from "../lib/auth.ts";
import { sendMessage } from "../lib/telegram.ts";

const dr = new Hono<{ Bindings: Env }>();

dr.post("/user/device-info", async (c) => {
  const auth = await parseAuth(c);
  const body = await c.req.json<Record<string, unknown>>();
  const telegramId = auth ? String(auth.telegramId) : String(body.telegram_id ?? "");
  if (!telegramId) return c.json({ ok: false }, 400);

  const ip          = c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const countryCode = c.req.header("cf-ipcountry") ?? "XX";
  const { platform, language, timezone, screen, cookie_consent } = body as {
    platform?: string; language?: string; timezone?: string; screen?: string; cookie_consent?: string;
  };
  const userAgent = c.req.header("user-agent") ?? null;

  let city: string | null = null;
  if (ip && ip !== "unknown" && ip !== "::1" && !ip.startsWith("127.") && !ip.startsWith("10.")) {
    try {
      const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=city,regionName`, {
        signal: AbortSignal.timeout(2000),
      });
      if (geoRes.ok) {
        const geo = await geoRes.json() as { city?: string; regionName?: string };
        city = geo.city ? `${geo.city}${geo.regionName ? ", " + geo.regionName : ""}` : null;
      }
    } catch {}
  }

  await d1Run(c.env.DB,
    `INSERT INTO user_metadata
       (telegram_id, ip_address, country_code, city, user_agent, platform, language, timezone, screen, cookie_consent, first_seen, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
     ON CONFLICT(telegram_id) DO UPDATE SET
       ip_address     = excluded.ip_address,
       country_code   = excluded.country_code,
       city           = COALESCE(excluded.city, city),
       user_agent     = excluded.user_agent,
       platform       = excluded.platform,
       language       = excluded.language,
       timezone       = excluded.timezone,
       screen         = excluded.screen,
       cookie_consent = excluded.cookie_consent,
       last_seen      = datetime('now')`,
    [telegramId, ip, countryCode, city, userAgent, platform ?? null, language ?? null, timezone ?? null, screen ?? null, cookie_consent ?? "pending"],
  );
  return c.json({ ok: true });
});

dr.get("/admin/user-metadata/:userId", requireAdmin(), async (c) => {
  const param = c.req.param("userId");
  let row = await d1First(c.env.DB,
    `SELECT um.* FROM user_metadata um JOIN users u ON u.telegram_id = um.telegram_id WHERE u.id = ?`,
    [param],
  );
  if (!row) row = await d1First(c.env.DB, "SELECT * FROM user_metadata WHERE telegram_id = ?", [param]);
  return c.json(row ?? null);
});

dr.post("/user/deletion-request", async (c) => {
  const auth = await parseAuth(c);
  const body = await c.req.json<Record<string, unknown>>();
  const telegramId = auth ? String(auth.telegramId) : String(body.telegram_id ?? "");
  const reason     = String(body.reason ?? "").trim();
  if (!telegramId || reason.length < 10) {
    return c.json({ ok: false, error: "Reason must be at least 10 characters." }, 400);
  }

  const existing = await d1First(c.env.DB,
    "SELECT id FROM deletion_requests WHERE telegram_id = ? AND status = 'pending'",
    [telegramId],
  );
  if (existing) return c.json({ ok: false, error: "You already have a pending deletion request." });

  const user = await d1First<{ first_name?: string; username?: string }>(c.env.DB,
    "SELECT first_name, username FROM users WHERE telegram_id = ?",
    [telegramId],
  );

  await d1Run(c.env.DB,
    "INSERT INTO deletion_requests (telegram_id, first_name, username, reason) VALUES (?, ?, ?, ?)",
    [telegramId, user?.first_name ?? null, user?.username ?? null, reason],
  );

  const name   = user?.first_name ?? "Unknown";
  const handle = user?.username ? ` @${user.username}` : "";
  await sendMessage(c.env.BOT_TOKEN, c.env.ADMIN_ID,
    `🗑️ *Data Deletion Request*\n\nUser: ${name}${handle} (ID: \`${telegramId}\`)\nReason: ${reason}\n\n_Review in Admin Panel → Users_`,
    { parse_mode: "Markdown" },
  ).catch(() => {});

  return c.json({ ok: true });
});

dr.get("/user/deletion-request", async (c) => {
  const telegramId = c.req.query("telegram_id") ?? "";
  if (!telegramId) return c.json({ ok: false }, 400);
  const row = await d1First(c.env.DB,
    "SELECT id, status, admin_note, created_at FROM deletion_requests WHERE telegram_id = ? ORDER BY created_at DESC LIMIT 1",
    [telegramId],
  );
  return c.json(row ?? null);
});

dr.get("/admin/deletion-requests", requireAdmin(), async (c) => {
  const status = c.req.query("status") || "pending";
  const rows = await d1All(c.env.DB,
    "SELECT * FROM deletion_requests WHERE status = ? ORDER BY created_at DESC LIMIT 100",
    [status],
  );
  return c.json(rows);
});

dr.post("/admin/deletion-requests/:id/approve", requireAdmin(), async (c) => {
  const { id } = c.req.param();
  const row = await d1First<{ telegram_id: string; status: string }>(c.env.DB,
    "SELECT telegram_id, status FROM deletion_requests WHERE id = ?",
    [id],
  );
  if (!row) return c.json({ ok: false, error: "Not found" }, 404);
  if (row.status !== "pending") return c.json({ ok: false, error: "Already resolved" }, 400);

  const tid = row.telegram_id;
  await d1Run(c.env.DB, "DELETE FROM messages WHERE user_id = (SELECT id FROM users WHERE telegram_id = ?)", [tid]);
  await d1Run(c.env.DB, "DELETE FROM donations WHERE user_id = (SELECT id FROM users WHERE telegram_id = ?)", [tid]);
  await d1Run(c.env.DB, "DELETE FROM premium_subscriptions WHERE telegram_id = ?", [tid]);
  await d1Run(c.env.DB, "DELETE FROM user_sessions WHERE telegram_id = ?", [tid]);
  await d1Run(c.env.DB, "DELETE FROM user_metadata WHERE telegram_id = ?", [tid]);
  await d1Run(c.env.DB, "DELETE FROM moderation WHERE user_id = ?", [tid]);
  await d1Run(c.env.DB, "DELETE FROM moderation_logs WHERE user_id = ?", [tid]);
  await d1Run(c.env.DB, "DELETE FROM users WHERE telegram_id = ?", [tid]);

  const body = await c.req.json<{ note?: string }>();
  const note = String(body.note ?? "Your data has been permanently deleted.").trim();
  await d1Run(c.env.DB,
    "UPDATE deletion_requests SET status='approved', resolved_at=datetime('now'), admin_note=? WHERE id=?",
    [note, id],
  );
  await sendMessage(c.env.BOT_TOKEN, tid,
    `✅ *Data Deletion Approved*\n\nYour request has been approved and all your data has been permanently deleted.\n\n_${note}_`,
    { parse_mode: "Markdown" },
  ).catch(() => {});
  return c.json({ ok: true });
});

dr.post("/admin/deletion-requests/:id/decline", requireAdmin(), async (c) => {
  const { id } = c.req.param();
  const row = await d1First<{ telegram_id: string; status: string }>(c.env.DB,
    "SELECT telegram_id, status FROM deletion_requests WHERE id = ?",
    [id],
  );
  if (!row) return c.json({ ok: false, error: "Not found" }, 404);
  if (row.status !== "pending") return c.json({ ok: false, error: "Already resolved" }, 400);

  const body = await c.req.json<{ note?: string }>();
  const note = String(body.note ?? "Request declined by admin.").trim();
  await d1Run(c.env.DB,
    "UPDATE deletion_requests SET status='declined', resolved_at=datetime('now'), admin_note=? WHERE id=?",
    [note, id],
  );
  await sendMessage(c.env.BOT_TOKEN, row.telegram_id,
    `❌ *Data Deletion Declined*\n\nYour deletion request was not approved.\n\nReason: ${note}\n\nIf you believe this is an error, contact support.`,
    { parse_mode: "Markdown" },
  ).catch(() => {});
  return c.json({ ok: true });
});

export default dr;
