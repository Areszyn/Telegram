import { Router } from "express";
import { requireAdmin } from "../lib/auth.js";
import { d1Run, d1All, d1First } from "../lib/d1.js";
import { sendMessage } from "../lib/telegram.js";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function clientIp(req: import("express").Request): string {
  return (
    (req.headers["cf-connecting-ip"] as string) ||
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

// ── POST /user/device-info — called by Mini App on load ───────────────────────

router.post("/user/device-info", async (req, res) => {
  const telegramId = String(req.body.telegram_id ?? "");
  if (!telegramId) { res.status(400).json({ ok: false }); return; }

  const ip           = clientIp(req);
  const countryCode  = (req.headers["cf-ipcountry"] as string) || "XX";
  const { platform, language, timezone, screen, cookie_consent } = req.body;
  const userAgent    = (req.headers["user-agent"] as string) || null;

  // Best-effort city lookup (ip-api.com free tier, 45 req/min)
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
    } catch { /* ignore — non-critical */ }
  }

  await d1Run(
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

  res.json({ ok: true });
});

// ── GET /admin/user-metadata/:userId — accepts DB user id ─────────────────────

router.get("/admin/user-metadata/:userId", requireAdmin, async (req, res) => {
  // userId may be the DB integer id or a telegram_id string — try both
  const param = req.params.userId;
  let row = await d1First(
    `SELECT um.* FROM user_metadata um
     JOIN users u ON u.telegram_id = um.telegram_id
     WHERE u.id = ?`,
    [param],
  );
  if (!row) {
    // Fallback: param might be a telegram_id directly
    row = await d1First("SELECT * FROM user_metadata WHERE telegram_id = ?", [param]);
  }
  res.json(row ?? null);
});

// ── POST /user/deletion-request ───────────────────────────────────────────────

router.post("/user/deletion-request", async (req, res) => {
  const telegramId = String(req.body.telegram_id ?? "");
  const reason     = String(req.body.reason ?? "").trim();
  if (!telegramId || reason.length < 10) {
    res.status(400).json({ ok: false, error: "Reason must be at least 10 characters." });
    return;
  }

  const existing = await d1First(
    "SELECT id FROM deletion_requests WHERE telegram_id = ? AND status = 'pending'",
    [telegramId],
  );
  if (existing) {
    res.json({ ok: false, error: "You already have a pending deletion request." });
    return;
  }

  const user = await d1First<{ first_name?: string; username?: string }>(
    "SELECT first_name, username FROM users WHERE telegram_id = ?",
    [telegramId],
  );

  await d1Run(
    "INSERT INTO deletion_requests (telegram_id, first_name, username, reason) VALUES (?, ?, ?, ?)",
    [telegramId, user?.first_name ?? null, user?.username ?? null, reason],
  );

  const ADMIN_ID = process.env.ADMIN_ID!;
  const name     = user?.first_name ?? "Unknown";
  const handle   = user?.username ? ` @${user.username}` : "";
  await sendMessage(
    ADMIN_ID,
    `🗑️ *Data Deletion Request*\n\nUser: ${name}${handle} (ID: \`${telegramId}\`)\nReason: ${reason}\n\n_Review in Admin Panel → Users_`,
    { parse_mode: "Markdown" },
  ).catch(() => {});

  res.json({ ok: true });
});

// ── GET /user/deletion-request?telegram_id=xxx ────────────────────────────────

router.get("/user/deletion-request", async (req, res) => {
  const telegramId = String(req.query.telegram_id ?? "");
  if (!telegramId) { res.status(400).json({ ok: false }); return; }
  const row = await d1First(
    "SELECT id, status, admin_note, created_at FROM deletion_requests WHERE telegram_id = ? ORDER BY created_at DESC LIMIT 1",
    [telegramId],
  );
  res.json(row ?? null);
});

// ── GET /admin/deletion-requests ─────────────────────────────────────────────

router.get("/admin/deletion-requests", requireAdmin, async (req, res) => {
  const status = (req.query.status as string) || "pending";
  const rows   = await d1All(
    "SELECT * FROM deletion_requests WHERE status = ? ORDER BY created_at DESC LIMIT 100",
    [status],
  );
  res.json(rows);
});

// ── POST /admin/deletion-requests/:id/approve ─────────────────────────────────

router.post("/admin/deletion-requests/:id/approve", requireAdmin, async (req, res) => {
  const id  = req.params.id;
  const row = await d1First<{ telegram_id: string; status: string }>(
    "SELECT telegram_id, status FROM deletion_requests WHERE id = ?",
    [id],
  );
  if (!row)                    { res.status(404).json({ ok: false, error: "Not found" }); return; }
  if (row.status !== "pending") { res.status(400).json({ ok: false, error: "Already resolved" }); return; }

  const tid = row.telegram_id;

  // Wipe all user data
  await d1Run("DELETE FROM messages WHERE user_id = (SELECT id FROM users WHERE telegram_id = ?)", [tid]);
  await d1Run("DELETE FROM donations WHERE user_id = (SELECT id FROM users WHERE telegram_id = ?)", [tid]);
  await d1Run("DELETE FROM premium_subscriptions WHERE telegram_id = ?", [tid]);
  await d1Run("DELETE FROM user_sessions WHERE telegram_id = ?", [tid]);
  await d1Run("DELETE FROM user_metadata WHERE telegram_id = ?", [tid]);
  await d1Run("DELETE FROM moderation WHERE user_id = ?", [tid]);
  await d1Run("DELETE FROM moderation_logs WHERE user_id = ?", [tid]);
  await d1Run("DELETE FROM users WHERE telegram_id = ?", [tid]);

  const note = String(req.body.note ?? "Your data has been permanently deleted.").trim();
  await d1Run(
    "UPDATE deletion_requests SET status='approved', resolved_at=datetime('now'), admin_note=? WHERE id=?",
    [note, id],
  );

  await sendMessage(
    tid,
    `✅ *Data Deletion Approved*\n\nYour request has been approved and all your data has been permanently deleted from our systems.\n\n_${note}_`,
    { parse_mode: "Markdown" },
  ).catch(() => {});

  res.json({ ok: true });
});

// ── POST /admin/deletion-requests/:id/decline ─────────────────────────────────

router.post("/admin/deletion-requests/:id/decline", requireAdmin, async (req, res) => {
  const id  = req.params.id;
  const row = await d1First<{ telegram_id: string; status: string }>(
    "SELECT telegram_id, status FROM deletion_requests WHERE id = ?",
    [id],
  );
  if (!row)                    { res.status(404).json({ ok: false, error: "Not found" }); return; }
  if (row.status !== "pending") { res.status(400).json({ ok: false, error: "Already resolved" }); return; }

  const note = String(req.body.note ?? "Request declined by admin.").trim();
  await d1Run(
    "UPDATE deletion_requests SET status='declined', resolved_at=datetime('now'), admin_note=? WHERE id=?",
    [note, id],
  );

  await sendMessage(
    row.telegram_id,
    `❌ *Data Deletion Declined*\n\nYour deletion request was not approved.\n\nReason: ${note}\n\nIf you believe this is an error, contact support.`,
    { parse_mode: "Markdown" },
  ).catch(() => {});

  res.json({ ok: true });
});

export default router;
