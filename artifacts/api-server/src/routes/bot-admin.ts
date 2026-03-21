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
 * Feature 15 — POST   /admin/chat/pin               pinChatMessage
 * Feature 16 — DELETE /admin/chat/pin               unpinChatMessage
 * Feature 17 — POST   /admin/chat/react             setMessageReaction on any message
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
  pinChatMessage,
  unpinChatMessage,
  setMessageReaction,
  banChatMember,
  getChatAdministrators,
  getChatMembersCount,
  createInvoiceLink,
  tgCall,
} from "../lib/telegram.js";
import { d1All, d1First, d1Run } from "../lib/d1.js";
import { getGroupParticipants, hasUserSession } from "../lib/user-client.js";

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

// ── Feature 19: Fetch group members ──────────────────────────────────────────
/**
 * POST /admin/chat/fetch-members
 * Body: { chat_id }
 *
 * Calls getChatAdministrators, upserts them to users + group_members,
 * and returns the list of all known members from DB for this chat.
 */
router.post("/admin/chat/fetch-members", requireAdmin, async (req, res) => {
  const { chat_id } = req.body as { chat_id: number | string };
  if (!chat_id) { res.status(400).json({ error: "chat_id required" }); return; }

  try {
    const admins = await getChatAdministrators(chat_id);
    const count  = await getChatMembersCount(chat_id);

    // Upsert each admin into users + group_members tables
    const ADMIN_ENV_ID = process.env.ADMIN_ID ?? "0";
    for (const a of admins as Array<{ user: { id: number; first_name: string; username?: string; is_bot?: boolean }; status: string }>) {
      if (a.user.is_bot || String(a.user.id) === ADMIN_ENV_ID) continue;
      await d1Run(
        `INSERT INTO users (telegram_id, first_name, username) VALUES (?, ?, ?)
         ON CONFLICT(telegram_id) DO UPDATE SET first_name=excluded.first_name, username=excluded.username`,
        [String(a.user.id), a.user.first_name, a.user.username ?? null],
      );
      await d1Run(
        `INSERT INTO group_members (chat_id, telegram_id, status) VALUES (?, ?, ?)
         ON CONFLICT(chat_id, telegram_id) DO UPDATE SET status=excluded.status`,
        [String(chat_id), String(a.user.id), a.status],
      );
    }

    const known = await d1All(
      `SELECT u.telegram_id, u.first_name, u.username, gm.status, gm.first_seen
       FROM group_members gm JOIN users u ON u.telegram_id = gm.telegram_id
       WHERE gm.chat_id = ?`,
      [String(chat_id)],
    );

    res.json({ ok: true, total_count: count, admins_fetched: admins.length, known_members: known });
  } catch (err) {
    console.error("[bot-admin/fetch-members]", err);
    res.status(500).json({ error: "Failed to fetch members" });
  }
});

// ── Feature 20: Tag All in a group ───────────────────────────────────────────
/**
 * POST /admin/chat/tag-all
 * Body: { chat_id }
 *
 * Sends one or more messages to the group mentioning every known member.
 */
router.post("/admin/chat/tag-all", requireAdmin, async (req, res) => {
  const { chat_id } = req.body as { chat_id: number | string };
  if (!chat_id) { res.status(400).json({ error: "chat_id required" }); return; }

  try {
    const members = await d1All<{ telegram_id: string; first_name: string; username: string | null }>(
      `SELECT u.telegram_id, u.first_name, u.username
       FROM group_members gm JOIN users u ON u.telegram_id = gm.telegram_id
       WHERE gm.chat_id = ? AND gm.status != 'left'`,
      [String(chat_id)],
    );

    if (!members.length) {
      res.json({ ok: true, messages_sent: 0, tagged: 0, note: "No tracked members for this chat" });
      return;
    }

    let text = "";
    let entities: unknown[] = [];
    let messagesSent = 0;

    const flush = async () => {
      if (!text.trim()) return;
      await tgCall("sendMessage", {
        chat_id,
        text,
        entities: entities.length ? entities : undefined,
      });
      messagesSent++;
      text = "";
      entities = [];
    };

    for (const m of members) {
      const part = m.username ? `@${m.username} ` : `${m.first_name || "User"} `;
      if (text.length + part.length > 4000) await flush();
      if (!m.username) {
        entities.push({
          type: "text_mention",
          offset: text.length,
          length: (m.first_name || "User").length,
          user: { id: parseInt(m.telegram_id), is_bot: false, first_name: m.first_name || "User" },
        });
      }
      text += part;
    }
    await flush();

    res.json({ ok: true, messages_sent: messagesSent, tagged: members.length });
  } catch (err) {
    console.error("[bot-admin/tag-all]", err);
    res.status(500).json({ error: "Failed to send tag-all" });
  }
});

// ── Feature 21: Premium subscription management ──────────────────────────────

/** GET /admin/premium — list all premium subscribers */
router.get("/admin/premium", requireAdmin, async (_req, res) => {
  try {
    const rows = await d1All(
      `SELECT ps.*, u.first_name, u.username
       FROM premium_subscriptions ps
       LEFT JOIN users u ON u.telegram_id = ps.telegram_id
       ORDER BY ps.created_at DESC`,
      [],
    );
    res.json({ ok: true, subscriptions: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to list premium" });
  }
});

/** POST /admin/premium/grant — manually grant premium to a telegram_id */
router.post("/admin/premium/grant", requireAdmin, async (req, res) => {
  const { telegram_id, days = 30 } = req.body as { telegram_id: string; days?: number };
  if (!telegram_id) { res.status(400).json({ error: "telegram_id required" }); return; }

  try {
    await d1Run(
      `INSERT INTO premium_subscriptions (telegram_id, amount_usd, expires_at, status, track_id)
       VALUES (?, 0, datetime('now', '+${Math.abs(days)} days'), 'active', 'manual')`,
      [String(telegram_id)],
    );

    // Notify the user if possible
    await tgCall("sendMessage", {
      chat_id: telegram_id,
      text: `⭐ You've been granted premium access for ${days} days!\n\nUse /tagall in any group where the bot is an admin.`,
    }).catch(() => {});

    res.json({ ok: true, telegram_id, days });
  } catch (err) {
    console.error("[bot-admin/premium/grant]", err);
    res.status(500).json({ error: "Failed to grant premium" });
  }
});

/** DELETE /admin/premium/revoke — revoke premium */
router.delete("/admin/premium/revoke", requireAdmin, async (req, res) => {
  const { telegram_id } = req.body as { telegram_id: string };
  if (!telegram_id) { res.status(400).json({ error: "telegram_id required" }); return; }

  try {
    await d1Run(
      `UPDATE premium_subscriptions SET status = 'revoked' WHERE telegram_id = ? AND status = 'active'`,
      [String(telegram_id)],
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to revoke premium" });
  }
});

/** POST /admin/premium/invoice — create a Stars invoice for premium subscription for a user */
router.post("/admin/premium/invoice", requireAdmin, async (req, res) => {
  const { telegram_id, days = 30 } = req.body as { telegram_id: string; days?: number };
  if (!telegram_id) { res.status(400).json({ error: "telegram_id required" }); return; }

  try {
    const stars = 250; // $5 at 50 Stars/dollar
    const link = await createInvoiceLink({
      title: `⭐ Premium — ${days}-Day Pass`,
      description: `Unlock group management features for ${days} days — Tag All, bulk actions, and more.`,
      payload: `premium-${telegram_id}-${days}`,
      currency: "XTR",
      prices: [{ label: "Premium Access", amount: stars }],
    });
    res.json({ ok: true, invoice_link: link, stars, days });
  } catch (err) {
    console.error("[bot-admin/premium/invoice]", err);
    res.status(500).json({ error: "Failed to create invoice" });
  }
});

// ── Feature 18: Ban all known users from a chat ───────────────────────────────
/**
 * POST /admin/chat/ban-all
 * Body: { chat_id, revoke_messages? }
 *
 * Fetches every user in the D1 users table (excluding the admin),
 * then calls banChatMember for each one concurrently.
 * Returns: { total, banned, failed, skipped, errors[] }
 */
router.post("/admin/chat/ban-all", requireAdmin, async (req, res) => {
  const { chat_id, revoke_messages = false } = req.body as {
    chat_id: number | string;
    revoke_messages?: boolean;
  };

  if (!chat_id) {
    res.status(400).json({ error: "chat_id is required" });
    return;
  }

  const ADMIN_STR = process.env.ADMIN_ID ?? "";
  const ADMIN_NUM = Number(ADMIN_STR);

  try {
    const seen = new Set<number>();
    const candidates: number[] = [];

    const addId = (n: number) => {
      if (!n || n === ADMIN_NUM || seen.has(n)) return;
      seen.add(n); candidates.push(n);
    };

    if (hasUserSession()) {
      const participants = await getGroupParticipants(chat_id);
      for (const p of participants) addId(Number(p.id));
    }

    const [chatMembers, allUsers] = await Promise.all([
      d1All<{ telegram_id: string }>(
        `SELECT telegram_id FROM group_members WHERE chat_id = ? AND status NOT IN ('left','kicked')`,
        [String(chat_id)],
      ).catch(() => [] as { telegram_id: string }[]),
      d1All<{ telegram_id: string }>("SELECT telegram_id FROM users").catch(() => [] as { telegram_id: string }[]),
    ]);
    for (const u of [...chatMembers, ...allUsers]) addId(Number(u.telegram_id));

    const results = await Promise.allSettled(
      candidates.map(id => banChatMember(chat_id, id, revoke_messages)),
    );

    const errors: string[] = [];
    let banned = 0;
    let failed = 0;

    for (const r of results) {
      if (r.status === "fulfilled") banned++;
      else { failed++; errors.push(r.reason?.message ?? String(r.reason)); }
    }

    res.json({
      ok: true,
      total: candidates.length,
      banned,
      failed,
      via_session: hasUserSession(),
      errors: errors.slice(0, 20),
    });
  } catch (err) {
    console.error("[bot-admin/ban-all] Error:", err);
    res.status(500).json({ error: "Failed to ban members" });
  }
});

// ─── Group Chats — list all tracked groups/channels ───────────────────────────

router.get("/admin/group-chats", requireAdmin, async (req, res) => {
  try {
    const chats = await d1All<{
      chat_id: string; title: string; chat_type: string;
      bot_is_admin: number; tracked_members: number; updated_at: string;
    }>(
      `SELECT gc.chat_id, gc.title, gc.type AS chat_type, gc.bot_is_admin, gc.updated_at,
              COUNT(gm.telegram_id) AS tracked_members
         FROM group_chats gc
         LEFT JOIN group_members gm ON gm.chat_id = gc.chat_id AND gm.status NOT IN ('left','kicked')
        GROUP BY gc.chat_id
        ORDER BY gc.bot_is_admin DESC, tracked_members DESC`,
      [],
    );
    res.json({ ok: true, chats });
  } catch (err) {
    console.error("[group-chats]", err);
    res.status(500).json({ error: "Failed to load group chats" });
  }
});

/** DELETE /admin/group-chats/:chatId — remove a group from tracking */
router.delete("/admin/group-chats/:chatId", requireAdmin, async (req, res) => {
  const { chatId } = req.params;
  try {
    await d1Run(`DELETE FROM group_members WHERE chat_id = ?`, [chatId]);
    await d1Run(`DELETE FROM group_chats WHERE chat_id = ?`, [chatId]);
    res.json({ ok: true });
  } catch (err) {
    console.error("[group-chats/delete]", err);
    res.status(500).json({ error: "Failed to remove group" });
  }
});

export default router;
