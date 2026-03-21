/**
 * Bot Admin Routes — exposes Bot API 9.5 management features to the admin panel.
 *
 * All routes require admin authentication.
 *
 * Feature 4  — POST   /admin/bot/draft           sendMessageDraft (streaming)
 * Feature 6  — POST   /admin/bot/profile-photo   setMyProfilePhoto
 * Feature 7  — DELETE /admin/bot/profile-photo   removeMyProfilePhoto
 * Feature 8  — POST   /admin/users/:id/tag       setChatMemberTag
 * Feature 9  — POST   /admin/users/:id/promote   promoteChatMember with can_manage_tags
 * Feature 10 — GET    /admin/users/:id/audios    getUserProfileAudios
 */

import { Router } from "express";
import { requireAdmin } from "../lib/auth.js";
import {
  sendMessageDraft,
  setMyProfilePhoto,
  removeMyProfilePhoto,
  setChatMemberTag,
  promoteChatMember,
  getUserProfileAudios,
} from "../lib/telegram.js";

const router = Router();

// ── Feature 4: sendMessageDraft — stream text to a user ─────────────────────

/**
 * POST /admin/bot/draft
 * Body: { chat_id, draft_id, text, parse_mode? }
 *
 * Call repeatedly with the same draft_id to animate streaming text.
 * Useful for long bot replies or AI-generated content.
 */
router.post("/admin/bot/draft", requireAdmin, async (req, res) => {
  const { chat_id, draft_id, text, parse_mode } = req.body as {
    chat_id: number | string;
    draft_id: number;
    text: string;
    parse_mode?: string;
  };

  if (!chat_id || !draft_id || !text) {
    res.status(400).json({ error: "chat_id, draft_id, and text are required" });
    return;
  }

  try {
    const extra: Record<string, unknown> = {};
    if (parse_mode) extra.parse_mode = parse_mode;

    const result = await sendMessageDraft(chat_id, draft_id, text, extra);
    res.json({ ok: true, result });
  } catch (err) {
    console.error("[bot-admin/draft] Error:", err);
    res.status(500).json({ error: "Failed to send draft message" });
  }
});

// ── Feature 6: setMyProfilePhoto ─────────────────────────────────────────────

/**
 * POST /admin/bot/profile-photo
 * Body: { photo } — file_id of a photo already uploaded to Telegram, or a public URL.
 */
router.post("/admin/bot/profile-photo", requireAdmin, async (req, res) => {
  const { photo } = req.body as { photo: string };
  if (!photo) {
    res.status(400).json({ error: "photo is required (file_id or URL)" });
    return;
  }

  try {
    const result = await setMyProfilePhoto(photo);
    res.json({ ok: true, result });
  } catch (err) {
    console.error("[bot-admin/profile-photo] Set error:", err);
    res.status(500).json({ error: "Failed to set profile photo" });
  }
});

// ── Feature 7: removeMyProfilePhoto ──────────────────────────────────────────

/**
 * DELETE /admin/bot/profile-photo
 * Removes the bot's current profile photo.
 */
router.delete("/admin/bot/profile-photo", requireAdmin, async (_req, res) => {
  try {
    const result = await removeMyProfilePhoto();
    res.json({ ok: true, result });
  } catch (err) {
    console.error("[bot-admin/profile-photo] Remove error:", err);
    res.status(500).json({ error: "Failed to remove profile photo" });
  }
});

// ── Feature 8: setChatMemberTag ───────────────────────────────────────────────

/**
 * POST /admin/users/:userId/tag
 * Body: { chat_id, tag? }
 *
 * Sets a visible tag on a member. Omit `tag` to remove the existing tag.
 * Common tags: "Donor", "VIP", "Subscriber", "Staff"
 */
router.post("/admin/users/:userId/tag", requireAdmin, async (req, res) => {
  const userId  = parseInt(req.params.userId, 10);
  const { chat_id, tag } = req.body as { chat_id: number | string; tag?: string };

  if (!chat_id || isNaN(userId)) {
    res.status(400).json({ error: "chat_id and userId are required" });
    return;
  }

  try {
    const result = await setChatMemberTag(chat_id, userId, tag);
    res.json({ ok: true, result, tag: tag ?? null });
  } catch (err) {
    console.error("[bot-admin/tag] Error:", err);
    res.status(500).json({ error: "Failed to set member tag" });
  }
});

// ── Feature 9: promoteChatMember with can_manage_tags ────────────────────────

/**
 * POST /admin/users/:userId/promote
 * Body: { chat_id, can_manage_tags, can_change_info, can_delete_messages,
 *         can_invite_users, can_restrict_members, can_pin_messages,
 *         can_promote_members, can_manage_chat, can_manage_video_chats,
 *         can_manage_topics }
 *
 * Promotes a chat member with the new Bot API 9.5 can_manage_tags right.
 */
router.post("/admin/users/:userId/promote", requireAdmin, async (req, res) => {
  const userId   = parseInt(req.params.userId, 10);
  const { chat_id, ...rights } = req.body as Record<string, unknown>;

  if (!chat_id || isNaN(userId)) {
    res.status(400).json({ error: "chat_id and userId are required" });
    return;
  }

  const allowedRights = [
    "can_change_info", "can_post_messages", "can_edit_messages",
    "can_delete_messages", "can_invite_users", "can_restrict_members",
    "can_pin_messages", "can_promote_members", "can_manage_chat",
    "can_manage_video_chats", "can_manage_topics", "can_manage_tags",
  ] as const;

  type Rights = Partial<Record<typeof allowedRights[number], boolean>>;
  const filteredRights: Rights = {};
  for (const key of allowedRights) {
    if (key in rights && typeof rights[key] === "boolean") {
      filteredRights[key] = rights[key] as boolean;
    }
  }

  try {
    const result = await promoteChatMember(chat_id as string | number, userId, filteredRights);
    res.json({ ok: true, result, rights: filteredRights });
  } catch (err) {
    console.error("[bot-admin/promote] Error:", err);
    res.status(500).json({ error: "Failed to promote member" });
  }
});

// ── Feature 10: getUserProfileAudios ─────────────────────────────────────────

/**
 * GET /admin/users/:userId/audios?offset=0&limit=100
 * Returns a list of audio files on the user's Telegram profile.
 */
router.get("/admin/users/:userId/audios", requireAdmin, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;
  const limit  = Math.min(parseInt(String(req.query.limit ?? "20"), 10) || 20, 100);

  try {
    const result = await getUserProfileAudios(userId, offset, limit);
    res.json({ ok: true, audios: result });
  } catch (err) {
    console.error("[bot-admin/audios] Error:", err);
    res.status(500).json({ error: "Failed to fetch profile audios" });
  }
});

export default router;
