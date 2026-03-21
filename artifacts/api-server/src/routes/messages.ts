import { Router } from "express";
import { d1All, d1First, d1Run } from "../lib/d1.js";
import { validateTelegramInitData, requireAdmin } from "../lib/auth.js";
import { sendMessage } from "../lib/telegram.js";
import { checkUserAccess, getModerationRecord } from "../lib/moderation.js";

const router = Router();

function parseInitData(req: Parameters<Router>[0]): { telegramId: string; isAdmin: boolean } | null {
  const initData = req.headers["x-init-data"] as string | undefined;
  if (!initData) return null;
  const validated = validateTelegramInitData(initData);
  if (!validated) return null;
  const userStr = validated["user"];
  if (!userStr) return null;
  try {
    const user = JSON.parse(userStr) as { id: number };
    const telegramId = String(user.id);
    return { telegramId, isAdmin: requireAdmin(telegramId) };
  } catch {
    return null;
  }
}

router.get("/users", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const users = await d1All<{
    id: number; telegram_id: string; first_name: string; username: string; last_msg: string; last_msg_at: string;
  }>(`
    SELECT u.id, u.telegram_id, u.first_name, u.username,
           m.text AS last_msg, m.created_at AS last_msg_at, m.media_type AS last_media_type
    FROM users u
    LEFT JOIN messages m ON m.id = (
      SELECT id FROM messages WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
    )
    WHERE u.telegram_id != ?
    ORDER BY last_msg_at DESC NULLS LAST
  `, [process.env.ADMIN_ID!]);
  res.json(users);
});

router.get("/messages/:userId", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { userId } = req.params;

  if (auth.isAdmin) {
    const msgs = await d1All(
      "SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC",
      [userId]
    );
    res.json(msgs);
    return;
  }

  const userRow = await d1First<{ id: number }>(
    "SELECT id FROM users WHERE telegram_id = ?",
    [auth.telegramId]
  );
  if (!userRow || String(userRow.id) !== userId) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const msgs = await d1All(
    "SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC",
    [userId]
  );
  res.json(msgs);
});

router.get("/my-messages", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userRow = await d1First<{ id: number }>(
    "SELECT id FROM users WHERE telegram_id = ?",
    [auth.telegramId]
  );
  if (!userRow) { res.json([]); return; }
  const msgs = await d1All(
    "SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC",
    [userRow.id]
  );
  res.json(msgs);
});

router.get("/my-profile", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userRow = await d1First<{ id: number; telegram_id: string; first_name: string; username: string }>(
    "SELECT * FROM users WHERE telegram_id = ?",
    [auth.telegramId]
  );
  // Always check moderation status
  const access = await checkUserAccess(auth.telegramId, "app");
  const modRecord = !access.allowed || access.restricted ? await getModerationRecord(auth.telegramId) : null;
  const modInfo = {
    is_banned: !access.allowed,
    is_restricted: access.restricted,
    ban_reason: access.reason ?? null,
    ban_until: modRecord?.ban_until ?? null,
    warnings_count: modRecord?.warnings_count ?? 0,
  };
  if (!userRow) {
    res.json({ id: null, telegram_id: auth.telegramId, is_admin: auth.isAdmin, ...modInfo });
    return;
  }
  res.json({ ...userRow, is_admin: auth.isAdmin, ...modInfo });
});

router.post("/send-message", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { text, targetUserId } = req.body as { text: string; targetUserId?: number };

  if (auth.isAdmin && targetUserId) {
    const userRow = await d1First<{ id: number; telegram_id: string }>(
      "SELECT id, telegram_id FROM users WHERE id = ?",
      [targetUserId]
    );
    if (!userRow) { res.status(404).json({ error: "User not found" }); return; }
    await sendMessage(userRow.telegram_id, text);
    await d1Run(
      "INSERT INTO messages (user_id, sender_type, text, media_type) VALUES (?, 'admin', ?, 'text')",
      [userRow.id, text]
    );
    res.json({ ok: true });
    return;
  }

  if (!auth.isAdmin) {
    // Block banned/app-banned users from sending
    const access = await checkUserAccess(auth.telegramId, "app");
    if (!access.allowed) {
      res.status(403).json({ error: "banned", reason: access.reason ?? "You are banned from this service." });
      return;
    }
    let userRow = await d1First<{ id: number }>(
      "SELECT id FROM users WHERE telegram_id = ?",
      [auth.telegramId]
    );
    if (!userRow) { res.status(404).json({ error: "User not registered" }); return; }
    await d1Run(
      "INSERT INTO messages (user_id, sender_type, text, media_type) VALUES (?, 'user', ?, 'text')",
      [userRow.id, text]
    );
    await sendMessage(process.env.ADMIN_ID!, `📨 [MiniApp] ${auth.telegramId}:\n${text}`);
    res.json({ ok: true });
    return;
  }

  res.status(400).json({ error: "Bad request" });
});

router.post("/broadcast", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const { text } = req.body as { text: string };
  const users = await d1All<{ telegram_id: string }>(
    "SELECT telegram_id FROM users WHERE telegram_id != ?",
    [process.env.ADMIN_ID!]
  );
  let sent = 0;
  for (const u of users) {
    try {
      await sendMessage(u.telegram_id, text);
      sent++;
    } catch {}
  }
  res.json({ ok: true, sent, total: users.length });
});

export default router;
