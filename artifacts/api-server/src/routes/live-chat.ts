import { Hono } from "hono";
import type { Env } from "../types.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import { parseAuth } from "../lib/auth.ts";
import { checkUserAccess } from "../lib/moderation.ts";
import { sendMessage as tgSendMessage } from "../lib/telegram.ts";

const liveChat = new Hono<{ Bindings: Env }>();

liveChat.post("/live-chat/send", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const { text, to_id } = await c.req.json<{ text: string; to_id?: string }>();
  if (!text || !text.trim()) return c.json({ error: "Text is required" }, 400);
  if (text.length > 4000) return c.json({ error: "Message too long (max 4000 chars)" }, 400);

  const fromId = auth.telegramId;
  let toId: string;

  if (auth.isAdmin) {
    if (!to_id) return c.json({ error: "to_id required for admin" }, 400);
    toId = to_id;
  } else {
    const access = await checkUserAccess(c.env.DB, auth.telegramId, "app");
    if (!access.allowed) return c.json({ error: "banned", reason: access.reason ?? "You are banned." }, 403);
    if (access.muted) return c.json({ error: "muted", reason: "You are currently muted." }, 403);
    toId = c.env.ADMIN_ID;
  }

  await d1Run(
    c.env.DB,
    "INSERT INTO live_chat_messages (from_id, to_id, text) VALUES (?, ?, ?)",
    [fromId, toId, text.trim()],
  );

  const preview = text.trim().length > 150 ? text.trim().slice(0, 150) + "…" : text.trim();

  if (auth.isAdmin) {
    tgSendMessage(c.env.BOT_TOKEN, toId,
      `💬 New live chat message from Admin:\n\n${preview}`,
    ).catch(() => {});
  } else {
    const user = await d1First<{ first_name: string; username: string }>(
      c.env.DB,
      "SELECT first_name, username FROM users WHERE telegram_id = ?",
      [fromId],
    );
    const senderName = user?.first_name || user?.username || `User ${fromId}`;
    tgSendMessage(c.env.BOT_TOKEN, c.env.ADMIN_ID,
      `💬 Live chat from ${senderName}:\n\n${preview}`,
    ).catch(() => {});
  }

  return c.json({ ok: true });
});

liveChat.get("/live-chat/messages", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const withUser = c.req.query("with");
  const afterRaw = parseInt(c.req.query("after") ?? "0", 10);
  const after = afterRaw > 0 ? afterRaw : 0;
  const limitRaw = parseInt(c.req.query("limit") ?? "100", 10);
  const limit = Math.max(1, Math.min(limitRaw || 100, 200));

  const myId = auth.telegramId;
  let partnerId: string;

  if (auth.isAdmin) {
    if (!withUser) return c.json({ error: "with param required" }, 400);
    partnerId = withUser;
  } else {
    partnerId = c.env.ADMIN_ID;
  }

  let sql: string;
  const params: unknown[] = [myId, partnerId, partnerId, myId];

  if (after > 0) {
    sql = `SELECT * FROM live_chat_messages
           WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))
             AND id > ?
           ORDER BY created_at ASC LIMIT ?`;
    params.push(after, limit);
  } else {
    sql = `SELECT * FROM live_chat_messages
           WHERE ((from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?))
           ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);
  }

  const msgs = await d1All(c.env.DB, sql, params);

  if (after <= 0) msgs.reverse();

  if (auth.isAdmin && partnerId) {
    await d1Run(
      c.env.DB,
      "UPDATE live_chat_messages SET read = 1 WHERE from_id = ? AND to_id = ? AND read = 0",
      [partnerId, myId],
    );
  } else if (!auth.isAdmin) {
    await d1Run(
      c.env.DB,
      "UPDATE live_chat_messages SET read = 1 WHERE from_id = ? AND to_id = ? AND read = 0",
      [partnerId, myId],
    );
  }

  return c.json(msgs);
});

liveChat.get("/live-chat/conversations", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Forbidden" }, 403);

  const adminId = c.env.ADMIN_ID;

  const convos = await d1All<{
    partner_id: string;
    last_text: string;
    last_at: string;
    unread: number;
  }>(c.env.DB, `
    SELECT
      CASE WHEN from_id = ? THEN to_id ELSE from_id END AS partner_id,
      text AS last_text,
      created_at AS last_at,
      (SELECT COUNT(*) FROM live_chat_messages lc2
       WHERE lc2.from_id = CASE WHEN lc.from_id = ? THEN lc.to_id ELSE lc.from_id END
         AND lc2.to_id = ?
         AND lc2.read = 0
      ) AS unread
    FROM live_chat_messages lc
    WHERE lc.id IN (
      SELECT MAX(id) FROM live_chat_messages
      WHERE from_id = ? OR to_id = ?
      GROUP BY CASE WHEN from_id = ? THEN to_id ELSE from_id END
    )
    ORDER BY lc.created_at DESC
  `, [adminId, adminId, adminId, adminId, adminId, adminId]);

  const partnerIds = convos.map(c => c.partner_id);
  let userMap: Record<string, { first_name: string; username: string; avatar: string | null }> = {};
  if (partnerIds.length > 0) {
    const placeholders = partnerIds.map(() => "?").join(",");
    const users = await d1All<{ telegram_id: string; first_name: string; username: string; avatar: string | null }>(
      c.env.DB,
      `SELECT telegram_id, first_name, username, avatar FROM users WHERE telegram_id IN (${placeholders})`,
      partnerIds,
    );
    userMap = Object.fromEntries(users.map(u => [u.telegram_id, { first_name: u.first_name, username: u.username, avatar: u.avatar }]));
  }

  const result = convos.map(cv => ({
    ...cv,
    first_name: userMap[cv.partner_id]?.first_name || "User",
    username: userMap[cv.partner_id]?.username || null,
    avatar: userMap[cv.partner_id]?.avatar || null,
  }));

  return c.json(result);
});

liveChat.get("/live-chat/unread-count", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const myId = auth.telegramId;
  const row = await d1First<{ c: number }>(
    c.env.DB,
    "SELECT COUNT(*) as c FROM live_chat_messages WHERE to_id = ? AND read = 0",
    [myId],
  );

  return c.json({ unread: row?.c ?? 0 });
});

export default liveChat;
