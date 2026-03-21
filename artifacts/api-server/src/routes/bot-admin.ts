/**
 * Bot Admin Routes — exposes Bot API 9.5 management features to the admin panel.
 *
 * All routes require admin authentication.
 *
 * Feature  4 — POST   /admin/bot/draft              sendMessageDraft (streaming)
 * Feature  6 — POST   /admin/bot/profile-photo      setMyProfilePhoto
 * Feature  7 — DELETE /admin/bot/profile-photo      removeMyProfilePhoto
 * Feature  8 — POST   /admin/users/:id/tag          setChatMemberTag
 * Feature  9 — POST   /admin/users/:id/promote      promoteChatMember with can_manage_tags
 * Feature 10 — GET    /admin/users/:id/audios       getUserProfileAudios
 *
 * New features:
 * Feature 11 — POST   /admin/bot/setup              setMyCommands + setMyDescription + setMyShortDescription
 * Feature 12 — POST   /admin/bot/description        setMyDescription / setMyShortDescription only
 * Feature 13 — POST   /admin/bot/poll               sendPoll to a user
 * Feature 14 — GET    /admin/stars/transactions     getStarTransactions
 * Feature 15 — POST   /admin/stars/refund           refundStarPayment
 * Feature 16 — POST   /admin/chat/pin               pinChatMessage
 * Feature 17 — DELETE /admin/chat/pin               unpinChatMessage
 * Feature 18 — POST   /admin/chat/react             setMessageReaction on any message
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
  setMyCommands,
  setMyDescription,
  setMyShortDescription,
  sendPoll,
  getStarTransactions,
  refundStarPayment,
  pinChatMessage,
  unpinChatMessage,
  setMessageReaction,
} from "../lib/telegram.js";

const router = Router();

// ── Feature 4: sendMessageDraft — stream text to a user ──────────────────────

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

// ── Feature 11: Bot setup — setMyCommands + setMyDescription ─────────────────

/**
 * POST /admin/bot/setup
 * Applies the default bot command menu and description.
 * Call once after deployment to configure the bot's UI in Telegram.
 */
router.post("/admin/bot/setup", requireAdmin, async (_req, res) => {
  try {
    const commands = [
      { command: "start",   description: "Open the bot and mini app" },
      { command: "donate",  description: "Make a donation (crypto or Stars)" },
      { command: "history", description: "View your donation history" },
      { command: "help",    description: "Get help and contact info" },
    ];

    const description = "Contact the admin, make crypto donations, or donate Telegram Stars. All in one place.";
    const shortDescription = "Contact admin & donations";

    await Promise.all([
      setMyCommands(commands),
      setMyDescription(description),
      setMyShortDescription(shortDescription),
    ]);

    res.json({ ok: true, commands, description, shortDescription });
  } catch (err) {
    console.error("[bot-admin/setup] Error:", err);
    res.status(500).json({ error: "Failed to set up bot" });
  }
});

// ── Feature 12: setMyDescription / setMyShortDescription ─────────────────────

/**
 * POST /admin/bot/description
 * Body: { description?, short_description?, language_code? }
 */
router.post("/admin/bot/description", requireAdmin, async (req, res) => {
  const { description, short_description, language_code } = req.body as {
    description?: string;
    short_description?: string;
    language_code?: string;
  };

  if (!description && !short_description) {
    res.status(400).json({ error: "At least one of description or short_description is required" });
    return;
  }

  try {
    const results: Record<string, unknown> = {};
    if (description !== undefined) {
      results.description = await setMyDescription(description, language_code);
    }
    if (short_description !== undefined) {
      results.shortDescription = await setMyShortDescription(short_description, language_code);
    }
    res.json({ ok: true, ...results });
  } catch (err) {
    console.error("[bot-admin/description] Error:", err);
    res.status(500).json({ error: "Failed to update bot description" });
  }
});

// ── Feature 13: sendPoll ──────────────────────────────────────────────────────

/**
 * POST /admin/bot/poll
 * Body: {
 *   chat_id,
 *   question,
 *   options: string[],
 *   type?: "regular" | "quiz",
 *   correct_option_id?: number,
 *   is_anonymous?: boolean,
 *   allows_multiple_answers?: boolean,
 *   explanation?: string,
 * }
 *
 * Sends a native Telegram poll or quiz to any chat.
 */
router.post("/admin/bot/poll", requireAdmin, async (req, res) => {
  const {
    chat_id, question, options,
    type, correct_option_id, is_anonymous,
    allows_multiple_answers, explanation,
  } = req.body as {
    chat_id: number | string;
    question: string;
    options: string[];
    type?: "regular" | "quiz";
    correct_option_id?: number;
    is_anonymous?: boolean;
    allows_multiple_answers?: boolean;
    explanation?: string;
  };

  if (!chat_id || !question || !Array.isArray(options) || options.length < 2) {
    res.status(400).json({ error: "chat_id, question, and at least 2 options are required" });
    return;
  }

  const extra: Record<string, unknown> = {};
  if (type)                          extra.type = type;
  if (type === "quiz" && correct_option_id !== undefined) extra.correct_option_id = correct_option_id;
  if (is_anonymous !== undefined)    extra.is_anonymous = is_anonymous;
  if (allows_multiple_answers)       extra.allows_multiple_answers = allows_multiple_answers;
  if (explanation)                   extra.explanation = explanation;

  try {
    const result = await sendPoll(chat_id, question, options, extra);
    res.json({ ok: true, result });
  } catch (err) {
    console.error("[bot-admin/poll] Error:", err);
    res.status(500).json({ error: "Failed to send poll" });
  }
});

// ── Feature 14: getStarTransactions ──────────────────────────────────────────

/**
 * GET /admin/stars/transactions?offset=0&limit=100
 * Lists incoming Telegram Stars transactions.
 */
router.get("/admin/stars/transactions", requireAdmin, async (req, res) => {
  const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;
  const limit  = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 100);
  try {
    const result = await getStarTransactions(offset, limit);
    res.json({ ok: true, transactions: result });
  } catch (err) {
    console.error("[bot-admin/stars] Error:", err);
    res.status(500).json({ error: "Failed to fetch Star transactions" });
  }
});

// ── Feature 15: refundStarPayment ─────────────────────────────────────────────

/**
 * POST /admin/stars/refund
 * Body: { user_id, telegram_payment_charge_id }
 */
router.post("/admin/stars/refund", requireAdmin, async (req, res) => {
  const { user_id, telegram_payment_charge_id } = req.body as {
    user_id: number;
    telegram_payment_charge_id: string;
  };

  if (!user_id || !telegram_payment_charge_id) {
    res.status(400).json({ error: "user_id and telegram_payment_charge_id are required" });
    return;
  }

  try {
    const result = await refundStarPayment(user_id, telegram_payment_charge_id);
    res.json({ ok: true, result });
  } catch (err) {
    console.error("[bot-admin/refund] Error:", err);
    res.status(500).json({ error: "Failed to refund Stars payment" });
  }
});

// ── Feature 16: pinChatMessage ────────────────────────────────────────────────

/**
 * POST /admin/chat/pin
 * Body: { chat_id, message_id, disable_notification? }
 */
router.post("/admin/chat/pin", requireAdmin, async (req, res) => {
  const { chat_id, message_id, disable_notification = false } = req.body as {
    chat_id: number | string;
    message_id: number;
    disable_notification?: boolean;
  };

  if (!chat_id || !message_id) {
    res.status(400).json({ error: "chat_id and message_id are required" });
    return;
  }

  try {
    const result = await pinChatMessage(chat_id, message_id, disable_notification);
    res.json({ ok: true, result });
  } catch (err) {
    console.error("[bot-admin/pin] Error:", err);
    res.status(500).json({ error: "Failed to pin message" });
  }
});

// ── Feature 17: unpinChatMessage ──────────────────────────────────────────────

/**
 * DELETE /admin/chat/pin
 * Body: { chat_id, message_id? }  — omit message_id to unpin the most recent
 */
router.delete("/admin/chat/pin", requireAdmin, async (req, res) => {
  const { chat_id, message_id } = req.body as {
    chat_id: number | string;
    message_id?: number;
  };

  if (!chat_id) {
    res.status(400).json({ error: "chat_id is required" });
    return;
  }

  try {
    const result = await unpinChatMessage(chat_id, message_id);
    res.json({ ok: true, result });
  } catch (err) {
    console.error("[bot-admin/unpin] Error:", err);
    res.status(500).json({ error: "Failed to unpin message" });
  }
});

// ── Feature 18: setMessageReaction ───────────────────────────────────────────

/**
 * POST /admin/chat/react
 * Body: { chat_id, message_id, emoji?, is_big? }
 *
 * React to any message from the bot's account.
 * emoji defaults to "❤️". Set is_big=true for an animated "big" reaction.
 */
router.post("/admin/chat/react", requireAdmin, async (req, res) => {
  const { chat_id, message_id, emoji = "❤️", is_big = false } = req.body as {
    chat_id: number | string;
    message_id: number;
    emoji?: string;
    is_big?: boolean;
  };

  if (!chat_id || !message_id) {
    res.status(400).json({ error: "chat_id and message_id are required" });
    return;
  }

  try {
    const result = await setMessageReaction(
      chat_id,
      message_id,
      [{ type: "emoji", emoji }],
      is_big,
    );
    res.json({ ok: true, result, emoji });
  } catch (err) {
    console.error("[bot-admin/react] Error:", err);
    res.status(500).json({ error: "Failed to set reaction" });
  }
});

export default router;
