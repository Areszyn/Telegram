import { Hono } from "hono";
import type { Env } from "../types.ts";
import { d1All, d1First } from "../lib/d1.ts";
import { parseAuth } from "../lib/auth.ts";
import {
  getModerationRecord, checkUserAccess,
  parseModerationMessage, applyModAction,
  getWarningHistory,
  type ParsedAction,
} from "../lib/moderation.ts";

const moderation = new Hono<{ Bindings: Env }>();

moderation.get("/moderation/my-status", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const access = await checkUserAccess(c.env.DB, auth.telegramId, "app");
  const record = await getModerationRecord(c.env.DB, auth.telegramId);
  return c.json({
    allowed:        access.allowed,
    restricted:     access.restricted,
    muted:          access.muted,
    reason:         access.reason ?? null,
    ban_until:      record?.ban_until ?? null,
    mute_until:     record?.mute_until ?? null,
    warnings_count: record?.warnings_count ?? 0,
    status:         record?.status ?? "active",
  });
});

moderation.get("/moderation/user/:telegramId", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Forbidden" }, 403);
  const record = await getModerationRecord(c.env.DB, c.req.param("telegramId"));
  return c.json(record ?? {
    user_id:       c.req.param("telegramId"),
    status:        "active",
    warnings_count: 0,
    bot_banned:    0,
    app_banned:    0,
    global_banned: 0,
  });
});

moderation.post("/moderation/action", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Forbidden" }, 403);
  const { targetUserId, action, scope, reason } =
    await c.req.json<{ targetUserId: string; action: string; scope?: string; reason?: string }>();
  if (!targetUserId || !action) return c.json({ error: "targetUserId and action required" }, 400);
  const parsed = { action, scope: scope ?? "bot", reason: reason ?? "" } as ParsedAction;
  const summary = await applyModAction(c.env.DB, c.env.BOT_TOKEN, targetUserId, auth.telegramId, parsed);
  return c.json({ ok: true, summary });
});

moderation.post("/moderation/chat-action", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Forbidden" }, 403);
  const { text, targetUserId } = await c.req.json<{ text: string; targetUserId: string }>();
  if (!text || !targetUserId) return c.json({ error: "text and targetUserId required" }, 400);
  const userRow = await d1First<{ telegram_id: string }>(c.env.DB,
    "SELECT telegram_id FROM users WHERE id = ?", [targetUserId],
  );
  if (!userRow) return c.json({ error: "User not found" }, 404);
  const parsed = parseModerationMessage(text);
  if (!parsed) return c.json({ error: "Not a moderation command" }, 400);
  const summary = await applyModAction(c.env.DB, c.env.BOT_TOKEN, userRow.telegram_id, auth.telegramId, parsed);
  return c.json({ ok: true, summary, action: parsed.action, scope: parsed.scope });
});

moderation.get("/moderation/logs", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Forbidden" }, 403);
  const logs = await d1All(c.env.DB, `
    SELECT ml.*, u.first_name, u.username
    FROM moderation_logs ml
    LEFT JOIN users u ON u.telegram_id = ml.user_id
    ORDER BY ml.created_at DESC LIMIT 100
  `);
  return c.json(logs);
});

moderation.get("/moderation/all", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Forbidden" }, 403);
  const records = await d1All(c.env.DB, `
    SELECT m.*, u.first_name, u.username
    FROM moderation m
    JOIN users u ON u.telegram_id = m.user_id
    WHERE m.status != 'active' OR m.bot_banned=1 OR m.app_banned=1 OR m.global_banned=1 OR m.warnings_count > 0
    ORDER BY m.updated_at DESC
  `);
  return c.json(records);
});

moderation.get("/moderation/warnings/:telegramId", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Forbidden" }, 403);
  const history = await getWarningHistory(c.env.DB, c.req.param("telegramId"));
  return c.json(history);
});

export default moderation;
