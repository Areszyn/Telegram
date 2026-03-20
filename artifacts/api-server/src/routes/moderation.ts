import { Router } from "express";
import { d1All, d1First } from "../lib/d1.js";
import { validateTelegramInitData, requireAdmin } from "../lib/auth.js";
import {
  getModerationRecord, checkUserAccess,
  parseModerationMessage, applyModAction
} from "../lib/moderation.js";

const router = Router();

function parseAuth(req: Parameters<Router>[0]): { telegramId: string; isAdmin: boolean } | null {
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
  } catch { return null; }
}

// GET /moderation/my-status — user: check own ban status
router.get("/moderation/my-status", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const access = await checkUserAccess(auth.telegramId, "app");
  const record = await getModerationRecord(auth.telegramId);
  res.json({
    allowed: access.allowed,
    restricted: access.restricted,
    reason: access.reason ?? null,
    ban_until: record?.ban_until ?? null,
    warnings_count: record?.warnings_count ?? 0,
    status: record?.status ?? "active",
  });
});

// GET /moderation/user/:telegramId — admin: get user's moderation record
router.get("/moderation/user/:telegramId", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const record = await getModerationRecord(req.params.telegramId);
  res.json(record ?? { user_id: req.params.telegramId, status: "active", warnings_count: 0, bot_banned: 0, app_banned: 0, global_banned: 0 });
});

// POST /moderation/action — admin: apply moderation action
router.post("/moderation/action", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }

  const { targetUserId, action, scope, reason } = req.body as {
    targetUserId: string; action: string; scope?: string; reason?: string;
  };
  if (!targetUserId || !action) { res.status(400).json({ error: "targetUserId and action required" }); return; }

  const parsed = { action, scope: scope ?? "bot", reason: reason ?? "" } as Parameters<typeof applyModAction>[2];
  const summary = await applyModAction(targetUserId, auth.telegramId, parsed);
  res.json({ ok: true, summary });
});

// POST /moderation/chat-action — admin sends moderation text from mini app chat
router.post("/moderation/chat-action", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }

  const { text, targetUserId } = req.body as { text: string; targetUserId: string };
  if (!text || !targetUserId) { res.status(400).json({ error: "text and targetUserId required" }); return; }

  // Lookup telegram_id from user DB id
  const userRow = await d1First<{ telegram_id: string }>(
    "SELECT telegram_id FROM users WHERE id = ?", [targetUserId]
  );
  if (!userRow) { res.status(404).json({ error: "User not found" }); return; }

  const parsed = parseModerationMessage(text);
  if (!parsed) { res.status(400).json({ error: "Not a moderation command" }); return; }

  const summary = await applyModAction(userRow.telegram_id, auth.telegramId, parsed);
  res.json({ ok: true, summary, action: parsed.action, scope: parsed.scope });
});

// GET /moderation/logs — admin: get moderation log
router.get("/moderation/logs", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const logs = await d1All(`
    SELECT ml.*, u.first_name, u.username
    FROM moderation_logs ml
    LEFT JOIN users u ON u.telegram_id = ml.user_id
    ORDER BY ml.created_at DESC LIMIT 100
  `);
  res.json(logs);
});

// GET /moderation/all — admin: all moderation records
router.get("/moderation/all", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const records = await d1All(`
    SELECT m.*, u.first_name, u.username
    FROM moderation m
    JOIN users u ON u.telegram_id = m.user_id
    WHERE m.status != 'active' OR m.bot_banned=1 OR m.app_banned=1 OR m.global_banned=1
    ORDER BY m.updated_at DESC
  `);
  res.json(records);
});

export default router;
