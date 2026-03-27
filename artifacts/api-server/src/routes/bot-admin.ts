import { Hono } from "hono";
import type { Env } from "../types.ts";
import { requireAdmin } from "../lib/auth.ts";
import {
  sendMessageDraft, setMyProfilePhoto, removeMyProfilePhoto,
  setChatMemberTag, promoteChatMember,
  setMyCommands, setMyDescription, setMyShortDescription,
  sendPoll, getStarTransactions, pinChatMessage, unpinChatMessage,
  setMessageReaction, banChatMember, getChatAdministrators,
  getChatMembersCount, tgCall, isBotAdminInChat,
} from "../lib/telegram.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import { buildBanCandidates, buildTagAllChunks } from "../lib/group.ts";

const admin = new Hono<{ Bindings: Env }>();

admin.post("/admin/bot/draft", requireAdmin(), async (c) => {
  const { chat_id, draft_id, text, parse_mode } =
    await c.req.json<{ chat_id: number | string; draft_id: number; text: string; parse_mode?: string }>();
  if (!chat_id || !draft_id || !text) return c.json({ error: "chat_id, draft_id, and text are required" }, 400);
  try {
    const extra: Record<string, unknown> = {};
    if (parse_mode) extra.parse_mode = parse_mode;
    const result = await sendMessageDraft(c.env.BOT_TOKEN, chat_id, draft_id, text, extra);
    return c.json({ ok: true, result });
  } catch (err) {
    console.error("[bot-admin/draft]", err);
    return c.json({ error: "Failed to send draft message" }, 500);
  }
});

admin.post("/admin/bot/stream", requireAdmin(), async (c) => {
  const { chat_id, text, speed, parse_mode, chunk_size } =
    await c.req.json<{ chat_id: number | string; text: string; speed?: number; parse_mode?: string; chunk_size?: number }>();
  if (!chat_id || !text) return c.json({ error: "chat_id and text are required" }, 400);

  const token = c.env.BOT_TOKEN;
  const draftId = Date.now() % 2147483647;
  const delayMs = Math.max(30, Math.min(speed || 80, 500));
  const chunkSz = Math.max(1, Math.min(chunk_size || 3, 20));
  const extra: Record<string, unknown> = {};
  if (parse_mode) extra.parse_mode = parse_mode;

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const streamTask = (async () => {
    try {
      let current = "";
      const chars = [...text];
      for (let i = 0; i < chars.length; i += chunkSz) {
        current += chars.slice(i, i + chunkSz).join("");
        try {
          await sendMessageDraft(token, chat_id, draftId, current + " ▌", extra);
        } catch (e: any) {
          if (e?.message?.includes("429")) {
            await new Promise(r => setTimeout(r, 1000));
            await sendMessageDraft(token, chat_id, draftId, current + " ▌", extra);
          }
        }
        const progress = Math.round((Math.min(i + chunkSz, chars.length) / chars.length) * 100);
        await writer.write(encoder.encode(`data: ${JSON.stringify({ progress, length: current.length })}\n\n`));
        if (i + chunkSz < chars.length) {
          await new Promise(r => setTimeout(r, delayMs));
        }
      }

      await sendMessageDraft(token, chat_id, draftId, text, extra);
      await new Promise(r => setTimeout(r, 200));

      const finalResult = await tgCall(token, "sendMessage", { chat_id, text, ...extra });
      await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true, progress: 100, result: finalResult })}\n\n`));
    } catch (err: any) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: err?.message || "Stream failed" })}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  void streamTask;

  return new Response(readable, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive",
    },
  });
});

admin.post("/admin/bot/profile-photo", requireAdmin(), async (c) => {
  const { photo } = await c.req.json<{ photo: string }>();
  if (!photo) return c.json({ error: "photo is required" }, 400);
  try {
    const result = await setMyProfilePhoto(c.env.BOT_TOKEN, photo);
    return c.json({ ok: true, result });
  } catch (err) {
    return c.json({ error: "Failed to set profile photo" }, 500);
  }
});

admin.delete("/admin/bot/profile-photo", requireAdmin(), async (c) => {
  try {
    const result = await removeMyProfilePhoto(c.env.BOT_TOKEN);
    return c.json({ ok: true, result });
  } catch {
    return c.json({ error: "Failed to remove profile photo" }, 500);
  }
});

admin.post("/admin/users/:userId/avatar", requireAdmin(), async (c) => {
  const userId = c.req.param("userId");
  const { avatar_id } = await c.req.json<{ avatar_id: number }>();
  if (!userId) return c.json({ error: "userId required" }, 400);
  if (!avatar_id || typeof avatar_id !== "number" || avatar_id < 1 || avatar_id > 50) {
    return c.json({ error: "Invalid avatar_id (1-50)" }, 400);
  }
  const result = await d1Run(c.env.DB, "UPDATE users SET avatar = ? WHERE id = ?", [String(avatar_id), parseInt(userId, 10)]);
  if (!result?.meta?.changes) return c.json({ error: "User not found" }, 404);
  return c.json({ ok: true, avatar: avatar_id });
});

admin.post("/admin/users/:userId/tag", requireAdmin(), async (c) => {
  const userId  = parseInt(c.req.param("userId"), 10);
  const { chat_id, tag } = await c.req.json<{ chat_id: number | string; tag?: string }>();
  if (!chat_id || isNaN(userId)) return c.json({ error: "chat_id and userId are required" }, 400);
  try {
    const result = await setChatMemberTag(c.env.BOT_TOKEN, chat_id, userId, tag);
    return c.json({ ok: true, result, tag: tag ?? null });
  } catch (err) {
    return c.json({ error: "Failed to set member tag" }, 500);
  }
});

admin.post("/admin/users/:userId/promote", requireAdmin(), async (c) => {
  const userId = parseInt(c.req.param("userId"), 10);
  const body   = await c.req.json<Record<string, unknown>>();
  const { chat_id, ...rights } = body;
  if (!chat_id || isNaN(userId)) return c.json({ error: "chat_id and userId are required" }, 400);
  const allowedRights = [
    "can_change_info","can_post_messages","can_edit_messages","can_delete_messages",
    "can_invite_users","can_restrict_members","can_pin_messages","can_promote_members",
    "can_manage_chat","can_manage_video_chats","can_manage_topics","can_manage_tags",
  ] as const;
  type Rights = Partial<Record<typeof allowedRights[number], boolean>>;
  const filteredRights: Rights = {};
  for (const key of allowedRights) {
    if (key in rights && typeof rights[key] === "boolean") filteredRights[key] = rights[key] as boolean;
  }
  try {
    const result = await promoteChatMember(c.env.BOT_TOKEN, chat_id as string | number, userId, filteredRights);
    return c.json({ ok: true, result, rights: filteredRights });
  } catch {
    return c.json({ error: "Failed to promote member" }, 500);
  }
});

admin.get("/admin/users/:userId/audios", requireAdmin(), async (c) => {
  const userId = parseInt(c.req.param("userId"), 10);
  if (isNaN(userId)) return c.json({ error: "Invalid userId" }, 400);
  const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;
  const limit  = Math.min(parseInt(c.req.query("limit") ?? "20", 10) || 20, 100);

  if (!c.env.MTPROTO_BACKEND_URL || c.env.MTPROTO_BACKEND_URL.includes("placeholder")) {
    return c.json({ error: "MTProto backend not configured" }, 503);
  }

  const session = await d1First<{
    session_string: string; api_id: number; api_hash: string;
  }>(c.env.DB,
    "SELECT session_string, api_id, api_hash FROM user_sessions WHERE status = 'active' ORDER BY last_used DESC LIMIT 1",
    [],
  );
  if (!session) {
    return c.json({ error: "No active session available. Add a session in Session Management first." }, 400);
  }

  try {
    const mtRes = await fetch(`${c.env.MTPROTO_BACKEND_URL}/mtproto/user-audios`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": c.env.MTPROTO_API_KEY },
      body: JSON.stringify({
        session_string: session.session_string,
        api_id: session.api_id,
        api_hash: session.api_hash,
        user_id: userId,
        offset,
        limit,
      }),
    });
    const data = await mtRes.json() as { ok?: boolean; audios?: unknown[]; updated_session?: string; error?: string };
    if (data.updated_session) {
      await d1Run(c.env.DB, "UPDATE user_sessions SET session_string = ?, last_used = datetime('now') WHERE session_string = ?",
        [data.updated_session, session.session_string]);
    }
    if (!data.ok) return c.json({ error: data.error || "Failed to fetch audios" }, 500);
    return c.json({ ok: true, audios: data.audios || [] });
  } catch (e) {
    console.error("[admin/user-audios]", e);
    return c.json({ error: "Failed to fetch profile audios" }, 500);
  }
});

admin.get("/admin/audio/:docId/:accessHash", requireAdmin(), async (c) => {
  const docId = c.req.param("docId");
  const accessHash = c.req.param("accessHash");
  const fileRef = c.req.query("ref") || "";
  if (!docId || !accessHash) return c.json({ error: "docId and accessHash required" }, 400);

  if (!c.env.MTPROTO_BACKEND_URL || c.env.MTPROTO_BACKEND_URL.includes("placeholder")) {
    return c.json({ error: "MTProto backend not configured" }, 503);
  }

  const session = await d1First<{
    session_string: string; api_id: number; api_hash: string;
  }>(c.env.DB,
    "SELECT session_string, api_id, api_hash FROM user_sessions WHERE status = 'active' ORDER BY last_used DESC LIMIT 1",
    [],
  );
  if (!session) return c.json({ error: "No active session" }, 400);

  try {
    const mtRes = await fetch(`${c.env.MTPROTO_BACKEND_URL}/mtproto/download-media`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": c.env.MTPROTO_API_KEY },
      body: JSON.stringify({
        session_string: session.session_string,
        api_id: session.api_id,
        api_hash: session.api_hash,
        document_id: docId,
        access_hash: accessHash,
        file_reference: fileRef,
      }),
    });

    if (!mtRes.ok || !mtRes.body) {
      return c.json({ error: "Failed to download audio" }, 502);
    }

    const updatedSession = mtRes.headers.get("x-updated-session");
    if (updatedSession) {
      await d1Run(c.env.DB, "UPDATE user_sessions SET session_string = ?, last_used = datetime('now') WHERE session_string = ?",
        [updatedSession, session.session_string]);
    }

    const mimeType = c.req.query("mime") || "audio/mpeg";
    const headers = new Headers();
    headers.set("content-type", mimeType);
    const cl = mtRes.headers.get("content-length");
    if (cl) headers.set("content-length", cl);
    headers.set("cache-control", "private, no-store");
    return new Response(mtRes.body, { status: 200, headers });
  } catch (e) {
    console.error("[admin/audio-download]", e);
    return c.json({ error: "Failed to stream audio" }, 500);
  }
});

admin.post("/admin/bot/setup", requireAdmin(), async (c) => {
  try {
    const commands = [
      { command: "start",   description: "Open the bot and mini app" },
      { command: "donate",  description: "Make a donation (crypto or Stars)" },
      { command: "history", description: "View your donation history" },
      { command: "premium", description: "Get Premium — Tag All, Ban All, Silent Ban" },
      { command: "help",    description: "Get help and contact info" },
    ];
    const description      = "Contact the admin, make crypto donations, or donate Telegram Stars. Premium: Tag All, Ban All, Silent Ban for groups.";
    const shortDescription = "Contact admin · Donations · Premium group tools";
    await Promise.all([
      setMyCommands(c.env.BOT_TOKEN, commands),
      setMyDescription(c.env.BOT_TOKEN, description),
      setMyShortDescription(c.env.BOT_TOKEN, shortDescription),
    ]);
    return c.json({ ok: true, commands, description, shortDescription });
  } catch (err) {
    return c.json({ error: "Failed to set up bot" }, 500);
  }
});

admin.post("/admin/bot/description", requireAdmin(), async (c) => {
  const { description, short_description, language_code } =
    await c.req.json<{ description?: string; short_description?: string; language_code?: string }>();
  if (!description && !short_description) return c.json({ error: "At least one of description or short_description is required" }, 400);
  const results: Record<string, unknown> = {};
  if (description !== undefined)      results.description      = await setMyDescription(c.env.BOT_TOKEN, description, language_code);
  if (short_description !== undefined) results.shortDescription = await setMyShortDescription(c.env.BOT_TOKEN, short_description, language_code);
  return c.json({ ok: true, ...results });
});

admin.post("/admin/bot/poll", requireAdmin(), async (c) => {
  const { chat_id, question, options, type, correct_option_id, is_anonymous, allows_multiple_answers, explanation } =
    await c.req.json<{
      chat_id: number | string; question: string; options: string[];
      type?: "regular" | "quiz"; correct_option_id?: number;
      is_anonymous?: boolean; allows_multiple_answers?: boolean; explanation?: string;
    }>();
  if (!chat_id || !question || !Array.isArray(options) || options.length < 2) {
    return c.json({ error: "chat_id, question, and at least 2 options are required" }, 400);
  }
  const extra: Record<string, unknown> = {};
  if (type) extra.type = type;
  if (type === "quiz" && correct_option_id !== undefined) extra.correct_option_id = correct_option_id;
  if (is_anonymous !== undefined) extra.is_anonymous = is_anonymous;
  if (allows_multiple_answers)    extra.allows_multiple_answers = allows_multiple_answers;
  if (explanation)                extra.explanation = explanation;
  try {
    const result = await sendPoll(c.env.BOT_TOKEN, chat_id, question, options, extra);
    return c.json({ ok: true, result });
  } catch {
    return c.json({ error: "Failed to send poll" }, 500);
  }
});

admin.get("/admin/stars/transactions", requireAdmin(), async (c) => {
  const offset = parseInt(c.req.query("offset") ?? "0", 10) || 0;
  const limit  = Math.min(parseInt(c.req.query("limit") ?? "100", 10) || 100, 100);
  try {
    const result = await getStarTransactions(c.env.BOT_TOKEN, offset, limit);
    return c.json({ ok: true, transactions: result });
  } catch {
    return c.json({ error: "Failed to fetch Star transactions" }, 500);
  }
});

admin.post("/admin/chat/pin", requireAdmin(), async (c) => {
  const { chat_id, message_id, disable_notification = false } =
    await c.req.json<{ chat_id: number | string; message_id: number; disable_notification?: boolean }>();
  if (!chat_id || !message_id) return c.json({ error: "chat_id and message_id are required" }, 400);
  try {
    const result = await pinChatMessage(c.env.BOT_TOKEN, chat_id, message_id, disable_notification);
    return c.json({ ok: true, result });
  } catch {
    return c.json({ error: "Failed to pin message" }, 500);
  }
});

admin.delete("/admin/chat/pin", requireAdmin(), async (c) => {
  const { chat_id, message_id } = await c.req.json<{ chat_id: number | string; message_id?: number }>();
  if (!chat_id) return c.json({ error: "chat_id is required" }, 400);
  try {
    const result = await unpinChatMessage(c.env.BOT_TOKEN, chat_id, message_id);
    return c.json({ ok: true, result });
  } catch {
    return c.json({ error: "Failed to unpin message" }, 500);
  }
});

admin.post("/admin/chat/react", requireAdmin(), async (c) => {
  const { chat_id, message_id, emoji = "❤️", is_big = false } =
    await c.req.json<{ chat_id: number | string; message_id: number; emoji?: string; is_big?: boolean }>();
  if (!chat_id || !message_id) return c.json({ error: "chat_id and message_id are required" }, 400);
  try {
    const result = await setMessageReaction(c.env.BOT_TOKEN, chat_id, message_id, [{ type: "emoji", emoji }], is_big);
    return c.json({ ok: true, result, emoji });
  } catch {
    return c.json({ error: "Failed to set reaction" }, 500);
  }
});

admin.post("/admin/chat/fetch-members", requireAdmin(), async (c) => {
  const { chat_id } = await c.req.json<{ chat_id: number | string }>();
  if (!chat_id) return c.json({ error: "chat_id required" }, 400);
  try {
    const [admins, count] = await Promise.all([
      getChatAdministrators(c.env.BOT_TOKEN, chat_id),
      getChatMembersCount(c.env.BOT_TOKEN, chat_id),
    ]);
    for (const a of admins as Array<{ user: { id: number; first_name: string; username?: string; is_bot?: boolean }; status: string }>) {
      if (a.user.is_bot || String(a.user.id) === c.env.ADMIN_ID) continue;
      await d1Run(c.env.DB,
        `INSERT INTO users (telegram_id, first_name, username) VALUES (?, ?, ?)
         ON CONFLICT(telegram_id) DO UPDATE SET first_name=excluded.first_name, username=excluded.username`,
        [String(a.user.id), a.user.first_name, a.user.username ?? null],
      );
      await d1Run(c.env.DB,
        `INSERT INTO group_members (chat_id, telegram_id, status) VALUES (?, ?, ?)
         ON CONFLICT(chat_id, telegram_id) DO UPDATE SET status=excluded.status`,
        [String(chat_id), String(a.user.id), a.status],
      );
    }
    const known = await d1All(c.env.DB,
      `SELECT u.telegram_id, u.first_name, u.username, gm.status, gm.first_seen
       FROM group_members gm JOIN users u ON u.telegram_id = gm.telegram_id
       WHERE gm.chat_id = ?`,
      [String(chat_id)],
    );
    return c.json({ ok: true, total_count: count, admins_fetched: (admins as unknown[]).length, known_members: known });
  } catch (err) {
    return c.json({ error: "Failed to fetch members" }, 500);
  }
});

admin.post("/admin/chat/tag-all", requireAdmin(), async (c) => {
  const { chat_id } = await c.req.json<{ chat_id: number | string }>();
  if (!chat_id) return c.json({ error: "chat_id required" }, 400);
  const chatIdStr = String(chat_id);
  if (!(await isBotAdminInChat(c.env.BOT_TOKEN, chatIdStr))) {
    return c.json({ error: "Bot is not an admin in this group. Add the bot as admin first." }, 403);
  }
  try {
    const env = { MTPROTO_BACKEND_URL: c.env.MTPROTO_BACKEND_URL, MTPROTO_API_KEY: c.env.MTPROTO_API_KEY, adminTelegramId: c.env.ADMIN_ID };
    const chunks = await buildTagAllChunks(c.env.DB, chatIdStr, env);
    if (!chunks.length) return c.json({ ok: true, messages_sent: 0, tagged: 0, note: "No tracked members for this chat" });
    let sent = 0;
    for (const chunk of chunks) {
      await tgCall(c.env.BOT_TOKEN, "sendMessage", { chat_id: chatIdStr, text: chunk.text, entities: chunk.entities.length ? chunk.entities : undefined });
      sent++;
    }
    return c.json({ ok: true, messages_sent: sent, chunks_sent: sent });
  } catch {
    return c.json({ error: "Failed to send tag-all" }, 500);
  }
});

admin.post("/admin/chat/ban-all", requireAdmin(), async (c) => {
  const { chat_id, revoke_messages = false } = await c.req.json<{ chat_id: number | string; revoke_messages?: boolean }>();
  if (!chat_id) return c.json({ error: "chat_id is required" }, 400);
  const chatIdStr = String(chat_id);
  if (!(await isBotAdminInChat(c.env.BOT_TOKEN, chatIdStr))) {
    return c.json({ error: "Bot is not an admin in this group. Add the bot as admin first." }, 403);
  }
  try {
    const env = { MTPROTO_BACKEND_URL: c.env.MTPROTO_BACKEND_URL, MTPROTO_API_KEY: c.env.MTPROTO_API_KEY, adminTelegramId: c.env.ADMIN_ID };
    const candidates = await buildBanCandidates(c.env.DB, chatIdStr, c.env.ADMIN_ID, c.env.ADMIN_ID, env);
    if (!candidates.length) {
      return c.json({ ok: true, total: 0, banned: 0, failed: 0, errors: [] });
    }
    let banned = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const id of candidates) {
      const ok = await banChatMember(c.env.BOT_TOKEN, chatIdStr, id, revoke_messages).catch(() => false);
      if (ok) {
        banned++;
        await d1Run(c.env.DB, "UPDATE group_members SET status = 'kicked' WHERE chat_id = ? AND telegram_id = ?", [chatIdStr, String(id)]).catch(() => {});
      } else {
        failed++;
        errors.push(String(id));
      }
    }
    return c.json({ ok: true, total: candidates.length, banned, failed, errors: errors.slice(0, 20) });
  } catch (err) {
    return c.json({ error: "Failed to ban members" }, 500);
  }
});

admin.post("/admin/chat/silent-ban", requireAdmin(), async (c) => {
  const { chat_id } = await c.req.json<{ chat_id: number | string }>();
  if (!chat_id) return c.json({ error: "chat_id is required" }, 400);
  const chatIdStr = String(chat_id);
  if (!(await isBotAdminInChat(c.env.BOT_TOKEN, chatIdStr))) {
    return c.json({ error: "Bot is not an admin in this group. Add the bot as admin first." }, 403);
  }
  try {
    const env = { MTPROTO_BACKEND_URL: c.env.MTPROTO_BACKEND_URL, MTPROTO_API_KEY: c.env.MTPROTO_API_KEY, adminTelegramId: c.env.ADMIN_ID };
    const candidates = await buildBanCandidates(c.env.DB, chatIdStr, c.env.ADMIN_ID, c.env.ADMIN_ID, env);
    if (!candidates.length) {
      return c.json({ ok: true, total: 0, banned: 0, failed: 0, failed_ids: [] });
    }
    let banned = 0;
    const failedIds: string[] = [];
    for (const id of candidates) {
      const ok = await banChatMember(c.env.BOT_TOKEN, chatIdStr, id, true).catch(() => false);
      if (ok) {
        banned++;
        await d1Run(c.env.DB, "UPDATE group_members SET status = 'kicked' WHERE chat_id = ? AND telegram_id = ?", [chatIdStr, String(id)]).catch(() => {});
      } else {
        failedIds.push(String(id));
      }
    }
    return c.json({ ok: true, total: candidates.length, banned, failed: failedIds.length, failed_ids: failedIds.slice(0, 20) });
  } catch (err) {
    return c.json({ error: "Failed to silent ban members" }, 500);
  }
});

admin.get("/admin/premium", requireAdmin(), async (c) => {
  try {
    const rows = await d1All(c.env.DB, `
      SELECT ps.*, u.first_name, u.username
      FROM premium_subscriptions ps LEFT JOIN users u ON u.telegram_id = ps.telegram_id
      ORDER BY ps.created_at DESC
    `);
    return c.json({ ok: true, subscriptions: rows });
  } catch {
    return c.json({ error: "Failed to list premium" }, 500);
  }
});

admin.post("/admin/premium/grant", requireAdmin(), async (c) => {
  const { telegram_id, days = 30 } = await c.req.json<{ telegram_id: string; days?: number }>();
  if (!telegram_id) return c.json({ error: "telegram_id required" }, 400);
  try {
    const safeDays = (Number.isFinite(days) && days > 0 && days <= 365) ? Math.abs(days) : 30;
    const trackId = `manual-${telegram_id}-${Date.now()}`;
    await d1Run(c.env.DB,
      `INSERT INTO premium_subscriptions (telegram_id, amount_usd, expires_at, status, track_id)
       VALUES (?, 0, datetime('now', '+' || ? || ' days'), 'active', ?)`,
      [String(telegram_id), String(safeDays), trackId],
    );
    await tgCall(c.env.BOT_TOKEN, "sendMessage", {
      chat_id: telegram_id,
      text: `⭐ You've been granted premium access for ${safeDays} days!\n\nUse /tagall in any group where the bot is an admin.`,
    }).catch(() => {});
    return c.json({ ok: true, telegram_id, days: safeDays });
  } catch {
    return c.json({ error: "Failed to grant premium" }, 500);
  }
});

admin.delete("/admin/premium/revoke", requireAdmin(), async (c) => {
  const { telegram_id } = await c.req.json<{ telegram_id: string }>();
  if (!telegram_id) return c.json({ error: "telegram_id required" }, 400);
  try {
    await d1Run(c.env.DB, `UPDATE premium_subscriptions SET status = 'revoked' WHERE telegram_id = ? AND status = 'active'`, [String(telegram_id)]);
    await tgCall(c.env.BOT_TOKEN, "sendMessage", {
      chat_id: telegram_id,
      text: "⚠️ Your premium subscription has been revoked by the admin.\n\nYou can re-subscribe anytime via the app.",
    }).catch(() => {});
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "Failed to revoke premium" }, 500);
  }
});

admin.get("/admin/widget-plans", requireAdmin(), async (c) => {
  try {
    const rows = await d1All(c.env.DB, `
      SELECT ws.*, u.first_name, u.username
      FROM widget_subscriptions ws LEFT JOIN users u ON u.telegram_id = ws.telegram_id
      ORDER BY ws.id DESC
    `);
    return c.json({ ok: true, subscriptions: rows });
  } catch {
    return c.json({ error: "Failed to list widget plans" }, 500);
  }
});

admin.get("/admin/widget-boosts", requireAdmin(), async (c) => {
  try {
    const rows = await d1All(c.env.DB, `
      SELECT wb.*, u.first_name, u.username
      FROM widget_boosts wb LEFT JOIN users u ON u.telegram_id = wb.telegram_id
      ORDER BY wb.id DESC
    `);
    return c.json({ ok: true, boosts: rows });
  } catch {
    return c.json({ error: "Failed to list widget boosts" }, 500);
  }
});

admin.post("/admin/boost/grant", requireAdmin(), async (c) => {
  const { telegram_id, boost_key, amount } = await c.req.json<{ telegram_id: string; boost_key: string; amount?: number }>();
  if (!telegram_id) return c.json({ error: "telegram_id required" }, 400);
  const validBoosts: Record<string, { label: string; defaultAmount: number }> = {
    msgsPerDay: { label: "+msgs/day", defaultAmount: 500 },
    widgets: { label: "+widgets", defaultAmount: 2 },
    faq: { label: "+FAQ items", defaultAmount: 5 },
    trainUrls: { label: "+training URLs", defaultAmount: 3 },
    social: { label: "+social links", defaultAmount: 3 },
  };
  if (!(boost_key in validBoosts)) return c.json({ error: "Invalid boost_key. Valid: " + Object.keys(validBoosts).join(", ") }, 400);
  const boostAmount = amount ?? validBoosts[boost_key].defaultAmount;
  if (!Number.isFinite(boostAmount) || boostAmount <= 0) return c.json({ error: "Invalid amount" }, 400);
  try {
    const trackId = `manual-boost-${telegram_id}-${Date.now()}`;
    await d1Run(c.env.DB,
      "INSERT INTO widget_boosts (telegram_id, boost_type, amount, payment_method, track_id, expires_at) VALUES (?, ?, ?, 'manual', ?, datetime('now', '+30 days'))",
      [String(telegram_id), boost_key, boostAmount, trackId],
    );
    await tgCall(c.env.BOT_TOKEN, "sendMessage", {
      chat_id: telegram_id,
      text: `⚡ You've been granted a boost: +${boostAmount} ${validBoosts[boost_key].label}\n\nThis boost is active for 30 days.`,
    }).catch(() => {});
    return c.json({ ok: true, telegram_id, boost_key, amount: boostAmount });
  } catch {
    return c.json({ error: "Failed to grant boost" }, 500);
  }
});

admin.post("/admin/widget-plan/grant", requireAdmin(), async (c) => {
  const { telegram_id, plan = "pro", days = 30 } = await c.req.json<{ telegram_id: string; plan?: string; days?: number }>();
  if (!telegram_id) return c.json({ error: "telegram_id required" }, 400);
  const validPlans = ["standard", "pro"];
  if (!validPlans.includes(plan)) return c.json({ error: "Plan must be 'standard' or 'pro'" }, 400);
  try {
    const safeDays = (Number.isFinite(days) && days > 0 && days <= 365) ? Math.abs(days) : 30;
    const trackId = `manual-widget-${telegram_id}-${Date.now()}`;
    await d1Run(c.env.DB,
      `INSERT INTO widget_subscriptions (telegram_id, plan, stars_paid, expires_at, status, track_id)
       VALUES (?, ?, 0, datetime('now', '+' || ? || ' days'), 'active', ?)`,
      [String(telegram_id), plan, String(safeDays), trackId],
    );
    const label = plan === "pro" ? "Pro" : "Standard";
    await tgCall(c.env.BOT_TOKEN, "sendMessage", {
      chat_id: telegram_id,
      text: `⭐ You've been granted Widget ${label} plan for ${safeDays} days!\n\nEnjoy your upgraded widget features.`,
    }).catch(() => {});
    return c.json({ ok: true, telegram_id, plan, days: safeDays });
  } catch {
    return c.json({ error: "Failed to grant widget plan" }, 500);
  }
});

admin.delete("/admin/widget-plan/revoke", requireAdmin(), async (c) => {
  const { telegram_id } = await c.req.json<{ telegram_id: string }>();
  if (!telegram_id) return c.json({ error: "telegram_id required" }, 400);
  try {
    await d1Run(c.env.DB, `UPDATE widget_subscriptions SET status = 'revoked' WHERE telegram_id = ? AND status = 'active'`, [String(telegram_id)]);
    await tgCall(c.env.BOT_TOKEN, "sendMessage", {
      chat_id: telegram_id,
      text: "⚠️ Your widget plan has been revoked by the admin.\n\nYou can re-subscribe anytime from Widget Settings.",
    }).catch(() => {});
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "Failed to revoke widget plan" }, 500);
  }
});

admin.post("/admin/premium/invoice", requireAdmin(), async (c) => {
  const { telegram_id } = await c.req.json<{ telegram_id: string }>();
  if (!telegram_id) return c.json({ error: "telegram_id required" }, 400);
  try {
    const stars = 250;
    const result = await tgCall(c.env.BOT_TOKEN, "sendInvoice", {
      chat_id: telegram_id,
      title: "⭐ Premium — 30-Day Subscription",
      description: "Unlock group management features — Tag All, Ban All, Silent Ban & more. Renews every 30 days.",
      payload: `premium-${telegram_id}-30`,
      currency: "XTR",
      prices: [{ label: "Premium Access", amount: stars }],
      subscription_period: 2592000,
    });
    return c.json({ ok: true, stars, days: 30, sent: true, result });
  } catch {
    return c.json({ error: "Failed to send subscription invoice" }, 500);
  }
});

admin.get("/admin/group-chats", requireAdmin(), async (c) => {
  try {
    const chats = await d1All(c.env.DB,
      `SELECT gc.chat_id, gc.title, gc.type AS chat_type, gc.bot_is_admin, gc.updated_at,
              COUNT(gm.telegram_id) AS tracked_members
         FROM group_chats gc
         LEFT JOIN group_members gm ON gm.chat_id = gc.chat_id AND gm.status NOT IN ('left','kicked')
        GROUP BY gc.chat_id
        ORDER BY gc.bot_is_admin DESC, tracked_members DESC`,
    );
    return c.json({ ok: true, chats });
  } catch {
    return c.json({ error: "Failed to load group chats" }, 500);
  }
});

admin.delete("/admin/group-chats/:chatId", requireAdmin(), async (c) => {
  const { chatId } = c.req.param();
  try {
    await d1Run(c.env.DB, `DELETE FROM group_members WHERE chat_id = ?`, [chatId]);
    await d1Run(c.env.DB, `DELETE FROM group_chats WHERE chat_id = ?`, [chatId]);
    return c.json({ ok: true });
  } catch {
    return c.json({ error: "Failed to remove group" }, 500);
  }
});

admin.get("/admin/webhook-info", requireAdmin(), async (c) => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${c.env.BOT_TOKEN}/getWebhookInfo`);
    const data = await res.json() as { result?: { url?: string; pending_update_count?: number; last_error_message?: string; last_error_date?: number } };
    return c.json({
      url: data.result?.url ?? null,
      pending: data.result?.pending_update_count ?? 0,
      lastError: data.result?.last_error_message ?? null,
      lastErrorDate: data.result?.last_error_date ?? null,
    });
  } catch {
    return c.json({ error: "Failed to fetch webhook info" }, 500);
  }
});

admin.get("/admin/db-stats", requireAdmin(), async (c) => {
  try {
    const [users, messages, donations, groups, premium] = await Promise.all([
      d1First<{ c: number }>(c.env.DB, "SELECT COUNT(*) as c FROM users"),
      d1First<{ c: number }>(c.env.DB, "SELECT COUNT(*) as c FROM messages"),
      d1First<{ c: number }>(c.env.DB, "SELECT COUNT(*) as c FROM donations"),
      d1First<{ c: number }>(c.env.DB, "SELECT COUNT(*) as c FROM group_chats"),
      d1First<{ c: number }>(c.env.DB, "SELECT COUNT(*) as c FROM premium_subscriptions WHERE status='active' AND expires_at > datetime('now')"),
    ]);
    return c.json({
      users: users?.c ?? 0,
      messages: messages?.c ?? 0,
      donations: donations?.c ?? 0,
      groups: groups?.c ?? 0,
      premium: premium?.c ?? 0,
    });
  } catch {
    return c.json({ error: "Failed to fetch DB stats" }, 500);
  }
});

export default admin;
