import { Hono } from "hono";
import type { Env } from "../types.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import {
  sendMessage, sendChatAction, tgCall,
  setMessageReaction, answerPreCheckoutQuery,
  getChatAdministrators, getChatMembersCount,
  downloadFile, MessageBuilder, EFFECTS, BTN_EMOJI,
} from "../lib/telegram.ts";
import { uploadToR2, getMediaContentType } from "../lib/r2.ts";
import { checkUserAccess, parseModerationMessage, applyModAction } from "../lib/moderation.ts";
import {
  checkRateLimit, findBlockedKeyword, containsLink, isLinkWhitelisted,
  updateAnalytics, runScheduledBroadcasts,
} from "../lib/spam.ts";
import { signToken, VIDEO_TTL_MS } from "../lib/video-token.ts";
import { addVideo, getVideoByUid } from "../lib/video-store.ts";
import { buildTagAllChunks } from "../lib/group.ts";

const webhook = new Hono<{ Bindings: Env }>();

const MINI_APP_URL = "https://mini.susagar.sbs/miniapp/";
const VIDEO_BASE   = "https://mini.susagar.sbs/api";

function openAppMarkup(label = "Open App") {
  return {
    inline_keyboard: [[{
      text: label, web_app: { url: MINI_APP_URL },
      style: "primary", icon_custom_emoji_id: BTN_EMOJI.openApp,
    }]],
  };
}

type TgUser = { id: number; first_name: string; username?: string; is_bot?: boolean };
type TgMessage = {
  message_id: number; from: TgUser;
  chat?: { id: number; type?: string };
  text?: string;
  photo?: Array<{ file_id: string; file_size: number }>;
  video?: { file_id: string; file_unique_id: string; mime_type?: string; file_size?: number; file_name?: string };
  document?: { file_id: string; file_name?: string };
  voice?: { file_id: string };
  audio?: { file_id: string };
  caption?: string;
  reply_to_message?: {
    forward_from?: TgUser; from?: TgUser;
    forward_origin?: { sender_user?: TgUser };
    message_id?: number;
  };
  sticker?: { file_id: string };
  new_chat_members?: TgUser[];
  left_chat_member?: TgUser;
  successful_payment?: {
    currency: string; total_amount: number;
    invoice_payload: string; telegram_payment_charge_id: string;
    provider_payment_charge_id: string;
  };
};
type PreCheckoutQuery = { id: string; from: TgUser; currency: string; total_amount: number; invoice_payload: string };
type CallbackQuery    = { id: string; from: TgUser; message?: { message_id: number; chat: { id: number } }; data?: string };
type ChatMemberUpdate = { chat: { id: number; type: string; title?: string }; from: TgUser; new_chat_member: { user: TgUser; status: string }; old_chat_member: { user: TgUser; status: string } };

async function upsertUser(db: D1Database, tgUser: TgUser): Promise<number> {
  await d1Run(db,
    `INSERT INTO users (telegram_id, first_name, username) VALUES (?, ?, ?)
     ON CONFLICT(telegram_id) DO UPDATE SET first_name=excluded.first_name, username=excluded.username`,
    [String(tgUser.id), tgUser.first_name, tgUser.username ?? null],
  );
  const row = await d1First<{ id: number }>(db, "SELECT id FROM users WHERE telegram_id = ?", [String(tgUser.id)]);
  return row!.id;
}

async function upsertGroupMember(db: D1Database, token: string, chatId: number, tgUser: TgUser, status = "member"): Promise<void> {
  await upsertUser(db, tgUser);
  await d1Run(db,
    `INSERT INTO group_members (chat_id, telegram_id, status) VALUES (?, ?, ?)
     ON CONFLICT(chat_id, telegram_id) DO UPDATE SET status=excluded.status`,
    [String(chatId), String(tgUser.id), status],
  );
}

async function upsertGroupChat(db: D1Database, token: string, chatId: number, title: string | undefined, type: string, botIsAdmin: boolean): Promise<void> {
  const count = await getChatMembersCount(token, chatId).catch(() => 0);
  await d1Run(db,
    `INSERT INTO group_chats (chat_id, title, type, bot_is_admin, member_count, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(chat_id) DO UPDATE SET title=excluded.title, type=excluded.type, bot_is_admin=excluded.bot_is_admin, member_count=excluded.member_count, updated_at=datetime('now')`,
    [String(chatId), title ?? null, type, botIsAdmin ? 1 : 0, count],
  );
}

function detectMediaType(msg: TgMessage): { type: string; fileId: string | null } {
  if (msg.photo)    return { type: "photo",    fileId: msg.photo[msg.photo.length - 1].file_id };
  if (msg.video)    return { type: "video",    fileId: msg.video.file_id };
  if (msg.document) return { type: "document", fileId: msg.document.file_id };
  if (msg.voice)    return { type: "voice",    fileId: msg.voice.file_id };
  if (msg.audio)    return { type: "audio",    fileId: msg.audio.file_id };
  return { type: "text", fileId: null };
}

async function handleMedia(
  db: D1Database, token: string, bucket: R2Bucket, publicUrl: string,
  fileId: string, mediaType: string, userId: number,
): Promise<string | null> {
  try {
    const buf = await downloadFile(token, fileId);
    const ext: Record<string, string> = { photo: "jpg", video: "mp4", document: "bin", voice: "ogg", audio: "mp3" };
    const key = `media/${userId}/${Date.now()}-${fileId.slice(-8)}.${ext[mediaType] ?? "bin"}`;
    const url = await uploadToR2(bucket, publicUrl, key, buf, getMediaContentType(mediaType));
    return url;
  } catch (err) {
    console.error("R2 upload error:", err);
    return null;
  }
}

async function saveMessage(
  db: D1Database, userId: number, senderType: "user" | "admin",
  text: string | null, mediaType: string, mediaUrl: string | null,
  fileId: string | null, telegramMessageId: number | null,
): Promise<void> {
  await d1Run(db,
    `INSERT INTO messages (user_id, sender_type, text, media_type, media_url, telegram_file_id, telegram_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, senderType, text ?? null, mediaType, mediaUrl ?? null, fileId ?? null, telegramMessageId ?? null],
  );
}

async function checkOxaPayStatus(merchantKey: string, trackId: string): Promise<{ raw: string; label: string } | null> {
  try {
    const res  = await fetch(`https://api.oxapay.com/v1/payment/${trackId}`, {
      headers: { "merchant_api_key": merchantKey, "Content-Type": "application/json" },
    });
    const json = await res.json() as { data?: { status?: string; expired_at?: number }; status?: number };
    if (json.status !== 200 || !json.data?.status) return null;
    const raw = json.data.status.toLowerCase();
    const labels: Record<string, string> = {
      waiting: "Waiting for payment", paying: "Detected — confirming",
      paid: "Paid", expired: "Expired", failed: "Failed",
    };
    const minsLeft = json.data.expired_at ? Math.max(0, Math.round((json.data.expired_at - Date.now() / 1000) / 60)) : null;
    let label = labels[raw] ?? raw;
    if (raw === "waiting" && minsLeft !== null) label += ` — ${minsLeft} min left`;
    return { raw, label };
  } catch { return null; }
}

const BOT_API_MAX_SIZE = 20 * 1024 * 1024;

webhook.post("/webhook", async (c) => {
  const { BOT_TOKEN, ADMIN_ID, DB, BUCKET, R2_PUBLIC_URL, OXAPAY_MERCHANT_KEY } = c.env;
  const ctx = c.executionCtx;

  const secretHeader = c.req.header("x-telegram-bot-api-secret-token") ?? "";
  const expectedSecret = BOT_TOKEN.replace(/:/g, "_");
  if (secretHeader !== expectedSecret) {
    return c.json({ ok: false }, 403);
  }

  try {
    ctx.waitUntil(
      runScheduledBroadcasts(
        DB,
        (id, text) => sendMessage(BOT_TOKEN, id, text, { reply_markup: openAppMarkup() }),
        async () => d1All<{ telegram_id: string }>(DB,
          "SELECT u.telegram_id FROM users u INNER JOIN messages m ON m.user_id = u.id GROUP BY u.telegram_id",
        ).catch(() => []),
        ADMIN_ID,
        (t) => sendMessage(BOT_TOKEN, ADMIN_ID, t),
      ).catch(() => {}),
    );

    const body = await c.req.json<{
      message?: TgMessage;
      callback_query?: CallbackQuery;
      pre_checkout_query?: PreCheckoutQuery;
      my_chat_member?: ChatMemberUpdate;
      chat_member?: ChatMemberUpdate;
    }>();

    const mcm = body.my_chat_member;
    if (mcm) {
      const { chat, new_chat_member } = mcm;
      const botIsAdmin = new_chat_member.status === "administrator";
      await upsertGroupChat(DB, BOT_TOKEN, chat.id, chat.title, chat.type, botIsAdmin).catch(() => {});
      if (botIsAdmin) {
        const admins   = await getChatAdministrators(BOT_TOKEN, chat.id).catch(() => []);
        const realAdmins = (admins as Array<{ user: TgUser; status: string }>)
          .filter(a => !a.user.is_bot && a.user.first_name !== "Deleted Account");
        await Promise.allSettled(realAdmins.map(a => upsertGroupMember(DB, BOT_TOKEN, chat.id, a.user, a.status)));
        await d1Run(DB,
          `DELETE FROM group_members WHERE chat_id = ? AND telegram_id IN (
             SELECT telegram_id FROM users WHERE first_name = 'Deleted Account' OR first_name = ''
           )`, [String(chat.id)],
        ).catch(() => {});
        const memberCount = await getChatMembersCount(BOT_TOKEN, chat.id).catch(() => 0);
        const chatLabel   = chat.title ? `"${chat.title}"` : `ID ${chat.id}`;
        await sendMessage(BOT_TOKEN, ADMIN_ID,
          `📣 Bot promoted to admin!\n\nChat: ${chatLabel}\nType: ${chat.type}\nID: \`${chat.id}\`\nMembers: ~${memberCount}\nAdmins auto-saved: ${realAdmins.length}\n\nMembers will be tracked automatically as they interact.`,
        ).catch(() => {});
      } else if (new_chat_member.status === "left" || new_chat_member.status === "kicked") {
        await d1Run(DB, `UPDATE group_chats SET bot_is_admin = 0, updated_at = datetime('now') WHERE chat_id = ?`, [String(chat.id)]).catch(() => {});
      }
      return c.json({ ok: true });
    }

    const cm = body.chat_member;
    if (cm) {
      const { chat, new_chat_member } = cm;
      const { user, status } = new_chat_member;
      if (!user.is_bot && user.first_name !== "Deleted Account") {
        await upsertGroupMember(DB, BOT_TOKEN, chat.id, user, status).catch(() => {});
        if (status === "left" || status === "kicked") {
          await d1Run(DB, `UPDATE group_members SET status = ? WHERE chat_id = ? AND telegram_id = ?`,
            [status, String(chat.id), String(user.id)],
          ).catch(() => {});
        }
      }
      return c.json({ ok: true });
    }

    const pcq = body.pre_checkout_query;
    if (pcq) {
      await answerPreCheckoutQuery(BOT_TOKEN, pcq.id, true).catch(() => {});
      return c.json({ ok: true });
    }

    const cbq = body.callback_query;
    if (cbq) {
      const cqData   = cbq.data ?? "";
      const cqFromId = String(cbq.from.id);
      const isAdmin  = cqFromId === ADMIN_ID;

      if (cqData.startsWith("pay_check:")) {
        const trackId = cqData.slice("pay_check:".length);
        const status  = await checkOxaPayStatus(OXAPAY_MERCHANT_KEY, trackId);
        const text    = status ? `💰 Payment: ${status.label}` : "Could not fetch payment status.";
        await tgCall(BOT_TOKEN, "answerCallbackQuery", { callback_query_id: cbq.id, text, show_alert: false }).catch(() => {});
      } else {
        await tgCall(BOT_TOKEN, "answerCallbackQuery", { callback_query_id: cbq.id }).catch(() => {});
      }
      return c.json({ ok: true });
    }

    const msg = body.message;
    if (!msg?.from) return c.json({ ok: true });

    const fromId  = String(msg.from.id);
    const fromName = `${msg.from.first_name ?? ""}${msg.from.username ? " @" + msg.from.username : ""}`.trim();
    const isAdmin  = fromId === ADMIN_ID;
    const isGroupMsg = msg.chat?.type === "group" || msg.chat?.type === "supergroup" || msg.chat?.type === "channel";

    if (isGroupMsg) {
      if (msg.new_chat_members) {
        for (const u of msg.new_chat_members) {
          if (!u.is_bot) await upsertGroupMember(DB, BOT_TOKEN, msg.chat!.id, u, "member").catch(() => {});
        }
      }
      if (msg.left_chat_member && !msg.left_chat_member.is_bot) {
        await upsertGroupMember(DB, BOT_TOKEN, msg.chat!.id, msg.left_chat_member, "left").catch(() => {});
      }
      return c.json({ ok: true });
    }

    if (msg.successful_payment) {
      const sp      = msg.successful_payment;
      const payload = sp.invoice_payload;
      const stars   = sp.total_amount;
      const amountUsd = (stars / 50).toFixed(2);
      console.log(`[webhook] Stars payment: ${stars} XTR from ${fromId} payload=${payload}`);

      if (payload.startsWith("premium-")) {
        const parts = payload.split("-");
        const tid   = parts[1] ?? fromId;
        const days  = parseInt(parts[2] ?? "30", 10) || 30;
        await d1Run(DB,
          `INSERT INTO premium_subscriptions (telegram_id, stars_paid, amount_usd, expires_at, status, track_id)
           VALUES (?, ?, ?, datetime('now', '+${days} days'), 'active', ?)
           ON CONFLICT DO NOTHING`,
          [tid, stars, amountUsd, sp.telegram_payment_charge_id],
        ).catch(() => {});
        await sendMessage(BOT_TOKEN, fromId,
          `⭐ *Premium activated!*\n\nYou now have premium access for ${days} days.\n\nThank you for your support!`,
          { parse_mode: "Markdown", reply_markup: openAppMarkup() },
        ).catch(() => {});
        await sendMessage(BOT_TOKEN, ADMIN_ID,
          `⭐ *Premium purchase*\n\nUser: ${fromName} (${fromId})\nPayload: ${payload}\nStars: ${stars}\nAmount: $${amountUsd}`,
          { parse_mode: "Markdown" },
        ).catch(() => {});
      } else {
        const userId = await upsertUser(DB, msg.from);
        await d1Run(DB,
          `INSERT INTO donations (user_id, order_id, amount, currency, pay_currency, pay_amount, network, address, status, track_id)
           VALUES (?, ?, ?, 'USD', 'XTR', ?, 'Stars', 'N/A', 'paid', ?)`,
          [userId, payload, amountUsd, stars, sp.telegram_payment_charge_id],
        ).catch(() => {});
        const mb = new MessageBuilder();
        mb.bold("Thank you for your donation!").add("\n\n");
        mb.add("Amount: ").code(`${stars} Stars`).add(` (~$${amountUsd} USD)\n`);
        mb.add("This means a lot. ❤️");
        await sendMessage(BOT_TOKEN, fromId, mb.text, {
          entities: mb.entities,
          message_effect_id: EFFECTS.confetti,
          reply_markup: openAppMarkup(),
        }).catch(() => {});
        await sendMessage(BOT_TOKEN, ADMIN_ID,
          `💰 Stars donation: ${stars} XTR from ${fromName} (${fromId}) ~$${amountUsd} USD`,
        ).catch(() => {});
      }
      return c.json({ ok: true });
    }

    if (isAdmin && !isGroupMsg && msg.reply_to_message) {
      const rtm    = msg.reply_to_message;
      const target = rtm.forward_origin?.sender_user ?? rtm.forward_from ?? rtm.from;
      if (target && String(target.id) !== ADMIN_ID) {
        const targetId = String(target.id);
        const msgText  = msg.text ?? msg.caption ?? "";

        const modCmd = parseModerationMessage(msgText);
        if (modCmd) {
          const userRow = await d1First<{ id: number }>(DB, "SELECT id FROM users WHERE telegram_id = ?", [targetId]);
          if (userRow) {
            const summary = await applyModAction(DB, BOT_TOKEN, targetId, ADMIN_ID, modCmd);
            await sendMessage(BOT_TOKEN, ADMIN_ID, `✅ ${summary}`, { parse_mode: "Markdown" }).catch(() => {});
          } else {
            await sendMessage(BOT_TOKEN, ADMIN_ID, "⚠️ User not found in database.").catch(() => {});
          }
          return c.json({ ok: true });
        }

        const forwardResult = await tgCall(BOT_TOKEN, "copyMessage", {
          from_chat_id: ADMIN_ID, chat_id: targetId, message_id: msg.message_id,
        }).catch(() => null) as { message_id?: number } | null;

        const userId = await upsertUser(DB, target);
        await saveMessage(DB, userId, "admin", msg.text ?? msg.caption ?? null, detectMediaType(msg).type, null, null, forwardResult?.message_id ?? null);

        await sendMessage(BOT_TOKEN, ADMIN_ID, `✅ Reply sent to ${target.first_name} (${targetId}).`).catch(() => {});
        return c.json({ ok: true });
      }
    }

    if (isAdmin && !isGroupMsg && msg.text) {
      const text = msg.text;

      if (text.startsWith("/stats")) {
        const [userCount, msgCount, donCount] = await Promise.all([
          d1First<{ c: number }>(DB, "SELECT COUNT(*) as c FROM users").then(r => r?.c ?? 0),
          d1First<{ c: number }>(DB, "SELECT COUNT(*) as c FROM messages").then(r => r?.c ?? 0),
          d1First<{ c: number }>(DB, "SELECT COUNT(*) as c FROM donations WHERE status='paid'").then(r => r?.c ?? 0),
        ]);
        await sendMessage(BOT_TOKEN, ADMIN_ID,
          `📊 *Stats*\n\nUsers: ${userCount}\nMessages: ${msgCount}\nPaid donations: ${donCount}`,
          { parse_mode: "Markdown" },
        );
        return c.json({ ok: true });
      }

      if (text.startsWith("/keyword ")) {
        const keyword = text.slice("/keyword ".length).trim().toLowerCase();
        if (keyword) {
          await d1Run(DB, "INSERT OR IGNORE INTO blocked_keywords (keyword) VALUES (?)", [keyword]);
          await sendMessage(BOT_TOKEN, ADMIN_ID, `✅ Keyword blocked: "${keyword}"`);
        }
        return c.json({ ok: true });
      }

      if (text.startsWith("/whitelist ")) {
        const targetId = text.slice("/whitelist ".length).trim();
        if (targetId) {
          await d1Run(DB, "INSERT OR IGNORE INTO link_whitelist (telegram_id) VALUES (?)", [targetId]);
          await sendMessage(BOT_TOKEN, ADMIN_ID, `✅ ${targetId} added to link whitelist.`);
        }
        return c.json({ ok: true });
      }

      if (text.startsWith("/schedule ")) {
        const parts      = text.slice("/schedule ".length).trim().split("|").map(p => p.trim());
        const msgTxt     = parts[0] ?? "";
        const schedAtStr = parts[1] ?? "";
        if (msgTxt && schedAtStr) {
          await d1Run(DB, "INSERT INTO scheduled_broadcasts (message, scheduled_at) VALUES (?, ?)", [msgTxt, schedAtStr]);
          await sendMessage(BOT_TOKEN, ADMIN_ID, `✅ Broadcast scheduled for ${schedAtStr}.`);
        } else {
          await sendMessage(BOT_TOKEN, ADMIN_ID, "Usage: /schedule <message>|<YYYY-MM-DD HH:MM:SS>");
        }
        return c.json({ ok: true });
      }

      if (text.startsWith("/tagall")) {
        const chatIdStr = text.slice("/tagall".length).trim();
        if (!chatIdStr) {
          await sendMessage(BOT_TOKEN, ADMIN_ID, "Usage: /tagall <chat_id>");
          return c.json({ ok: true });
        }
        const chunks = await buildTagAllChunks(DB, chatIdStr);
        for (const chunk of chunks) {
          await tgCall(BOT_TOKEN, "sendMessage", {
            chat_id: parseInt(chatIdStr, 10), text: chunk.text || "📢",
            entities: chunk.entities.length ? chunk.entities : undefined,
          }).catch(() => {});
        }
        await sendMessage(BOT_TOKEN, ADMIN_ID, `✅ Tag-all sent (${chunks.length} messages).`);
        return c.json({ ok: true });
      }

      if (text.startsWith("/help")) {
        await sendMessage(BOT_TOKEN, ADMIN_ID,
          `*Admin Commands*\n\n/stats — global stats\n/keyword <word> — block keyword\n/whitelist <id> — whitelist user for links\n/schedule <msg>|<date> — schedule broadcast\n/tagall <chat\\_id> — tag all in group\n/broadcast <text> — message all users\n\n*Moderation* (reply to forwarded msg):\n!ban [bot|app|global] [reason]\n!warn [reason]\n!restrict [reason]\n!unban\n\n*Premium Features* (250 Stars/month):\n• Video streaming links\n• Tag All / Ban All (via Mini App)`,
          { parse_mode: "Markdown" },
        );
        return c.json({ ok: true });
      }

      if (text.startsWith("/broadcast")) {
        const broadcastText = text.replace("/broadcast", "").trim();
        if (broadcastText) {
          const users = await d1All<{ telegram_id: string }>(DB, "SELECT telegram_id FROM users WHERE telegram_id != ?", [ADMIN_ID]);
          let sent = 0;
          for (const u of users) {
            const ok = await sendMessage(BOT_TOKEN, u.telegram_id, broadcastText, { reply_markup: openAppMarkup() }).then(() => true).catch(() => false);
            if (ok) sent++;
          }
          await sendMessage(BOT_TOKEN, ADMIN_ID, `Broadcast sent to ${sent}/${users.length} users.`);
        }
        return c.json({ ok: true });
      }

      if (text === "/start") {
        await sendMessage(BOT_TOKEN, ADMIN_ID,
          `Admin panel is active.\n\nYou will receive forwarded messages from users here.\n\nTo reply: swipe on a forwarded message and write your reply.\nTo broadcast: /broadcast Your message here`,
          { reply_markup: openAppMarkup() },
        );
        return c.json({ ok: true });
      }
      if (text === "/donate" || text === "/history") {
        await sendMessage(BOT_TOKEN, ADMIN_ID, "✅ Bot operational.", { reply_markup: openAppMarkup() });
        return c.json({ ok: true });
      }
    }

    if (isAdmin && !isGroupMsg && msg.video) {
      const v = msg.video;
      if ((v.file_size ?? 0) > BOT_API_MAX_SIZE) {
        await sendMessage(BOT_TOKEN, ADMIN_ID,
          `⚠️ <b>Video too large for streaming</b>\n\nSize: ${((v.file_size ?? 0) / (1024 * 1024)).toFixed(1)} MB (limit: 20 MB)\n\nThe video is in your chat — send it directly to users or use a smaller file.`,
          { parse_mode: "HTML" },
        ).catch(() => {});
        return c.json({ ok: true });
      }
      const exp           = Date.now() + VIDEO_TTL_MS;
      const adminFileName = v.file_name ?? (msg.caption ? msg.caption.slice(0, 64).replace(/[\\/:*?"<>|]/g, "_") + ".mp4" : null) ?? `video_${new Date().toISOString().slice(0, 10)}.mp4`;
      const tok           = await signToken({ fid: v.file_id, uid: v.file_unique_id, exp, mime: v.mime_type ?? "video/mp4", size: v.file_size, name: adminFileName, amsgId: msg.message_id, acid: parseInt(ADMIN_ID, 10) }, BOT_TOKEN);
      const watchUrl      = `${VIDEO_BASE}/watch/${tok}`;
      const downloadUrl   = `${VIDEO_BASE}/download/${tok}`;
      ctx.waitUntil(
        addVideo(DB, { uid: v.file_unique_id, token: tok, watchUrl, downloadUrl, fromId: ADMIN_ID, fromName: msg.from.first_name ?? "Admin", fileName: adminFileName, fileSize: v.file_size ?? 0, exp, addedAt: Date.now(), chatId: String(msg.chat?.id ?? ADMIN_ID), videoChatMsgId: msg.message_id, adminMsgId: msg.message_id, adminChatId: parseInt(ADMIN_ID, 10) }).catch(() => {}),
      );
      await sendMessage(BOT_TOKEN, ADMIN_ID, `🎬 <b>Video ready</b> (24 h)`, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [{ text: "▶ Mini App", web_app: { url: watchUrl } }, { text: "🌐 Web Player", url: watchUrl }],
            [{ text: "⬇ Download", url: downloadUrl }],
          ],
        },
      }).catch(() => null);
      return c.json({ ok: true });
    }

    if (isAdmin) return c.json({ ok: true });

    const access = await checkUserAccess(DB, fromId, "bot");
    if (!access.allowed) {
      await sendMessage(BOT_TOKEN, msg.from.id, `You are banned.\nReason: ${access.reason ?? "No reason provided."}`);
      return c.json({ ok: true });
    }

    const msgText = msg.text ?? msg.caption ?? "";
    if (msgText) {
      const rl = await checkRateLimit(DB, fromId).catch(() => ({ blocked: false, hitCount: 1 }));
      if (rl.blocked) {
        await sendMessage(BOT_TOKEN, msg.from.id, "⏱ Slow down. You're sending messages too fast.");
        await applyModAction(DB, BOT_TOKEN, fromId, "system", { action: "warn", scope: "bot", reason: "Rate limit exceeded" }).catch(() => {});
        return c.json({ ok: true });
      }

      if (containsLink(msgText)) {
        const whitelisted = await isLinkWhitelisted(DB, fromId).catch(() => false);
        if (!whitelisted) {
          await sendMessage(BOT_TOKEN, msg.from.id, "🚫 Links are not allowed. Your message was not delivered.");
          await applyModAction(DB, BOT_TOKEN, fromId, "system", { action: "warn", scope: "bot", reason: "Link in message" }).catch(() => {});
          return c.json({ ok: true });
        }
      }

      const blockedKw = await findBlockedKeyword(DB, msgText).catch(() => null);
      if (blockedKw) {
        await sendMessage(BOT_TOKEN, msg.from.id, `🚫 Your message contained a blocked word and was not delivered.`);
        await applyModAction(DB, BOT_TOKEN, fromId, "system", { action: "warn", scope: "bot", reason: `Blocked keyword: ${blockedKw}` }).catch(() => {});
        return c.json({ ok: true });
      }

      const lc = msgText.toLowerCase();
      if (msg.text?.startsWith("/start")) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          `👋 *Welcome to Lifegram Bot!*\n\nThis bot lets you:\n• Contact the admin directly\n• Make crypto donations\n• Donate Telegram Stars\n\n⭐ *Premium Features* (250 Stars/month):\n• Video streaming & download links\n• Tag All members in groups\n• Ban All members in groups\n\nJust send a message and the admin will reply. Or open the app below.`,
          { parse_mode: "Markdown", reply_markup: openAppMarkup("Open App") },
        );
        return c.json({ ok: true });
      }
      if (msg.text?.startsWith("/donate")) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          `💰 *Donations*\n\nYou can donate via:\n• Crypto (USDT, BTC, ETH and more)\n• Telegram Stars\n\nOpen the app to get started!`,
          { parse_mode: "Markdown", reply_markup: openAppMarkup("Donate") },
        );
        return c.json({ ok: true });
      }
      if (msg.text?.startsWith("/history")) {
        await sendMessage(BOT_TOKEN, msg.from.id, "📋 View your donation history in the app:", { reply_markup: openAppMarkup("View History") });
        return c.json({ ok: true });
      }
      if (msg.text?.startsWith("/help")) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          "❓ *Help*\n\n/start — Restart the bot\n/donate — Make a donation\n/history — View donation history\n/premium — Get Premium access\n\n⭐ *Premium* unlocks: video streaming, tag all, ban all\n\nOr just send a message and the admin will reply.",
          { parse_mode: "Markdown", reply_markup: openAppMarkup() },
        );
        return c.json({ ok: true });
      }
      if (msg.text?.startsWith("/premium")) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          "⭐ *Premium Access*\n\nUnlock powerful features:\n• 🎬 Video stream & download links\n• 📢 Tag All members in groups\n• 🚫 Ban All members in groups\n\nOnly 250 Stars (~$5) per month.\nOpen the app to subscribe!",
          { parse_mode: "Markdown", reply_markup: openAppMarkup("Get Premium") },
        );
        return c.json({ ok: true });
      }
      if (/\bprice\b|\bpricing\b|\bcost\b|\bhow much\b/.test(lc)) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          "💰 *Pricing*\n\n• Premium subscription: 250 Stars (~$5/month)\n  → Video streaming, Tag All, Ban All\n• Crypto donations: any amount via the app\n\nOpen the app to donate or subscribe.",
          { parse_mode: "Markdown", reply_markup: openAppMarkup("Open App") },
        );
        return c.json({ ok: true });
      }
      if (/\bhelp\b|\bhow to\b|\bwhat can\b/.test(lc)) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          "❓ *Help*\n\n/start — Restart the bot\n/donate — Make a donation\n/history — View donation history\n/premium — Get Premium access\n\nOr just send a message and the admin will reply.",
          { parse_mode: "Markdown", reply_markup: openAppMarkup() },
        );
        return c.json({ ok: true });
      }
      if (/\bsupport\b|\bcontact\b|\badmin\b/.test(lc)) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          "💬 *Support*\n\nJust type your question or issue here and the admin will reply as soon as possible.\n\nYou can also check your history in the app.",
          { parse_mode: "Markdown", reply_markup: openAppMarkup("Open App") },
        );
        return c.json({ ok: true });
      }
    }

    const userId = await upsertUser(DB, msg.from);
    const { type: mediaType, fileId } = detectMediaType(msg);
    let mediaUrl: string | null = null;
    if (fileId) mediaUrl = await handleMedia(DB, BOT_TOKEN, BUCKET, R2_PUBLIC_URL, fileId, mediaType, userId);
    await saveMessage(DB, userId, "user", msg.text ?? msg.caption ?? null, mediaType, mediaUrl, fileId, msg.message_id);
    ctx.waitUntil(updateAnalytics(DB, fromId).catch(() => {}));

    if (!isGroupMsg && msg.video) {
      const v = msg.video;
      const hasPremium = await d1First<{ id: number }>(DB,
        `SELECT id FROM premium_subscriptions WHERE telegram_id = ? AND status = 'active' AND expires_at > datetime('now') LIMIT 1`,
        [fromId],
      ).then(r => !!r).catch(() => false);

      if (!hasPremium) {
        await setMessageReaction(BOT_TOKEN, msg.from.id, msg.message_id, [{ type: "emoji", emoji: "👀" }]).catch(() => {});
        await tgCall(BOT_TOKEN, "forwardMessage", { from_chat_id: msg.from.id, chat_id: ADMIN_ID, message_id: msg.message_id }).catch(() => {});
        await sendMessage(BOT_TOKEN, msg.from.id,
          `🔒 *Video Streaming is a Premium feature*\n\nUpgrade to Premium to unlock:\n• 24-hour video stream links\n• Web player & download links\n• Tag All & Ban All for groups\n\n⭐ Only 250 Stars (~$5/month)\n\nYour video has been forwarded to the admin.`,
          { parse_mode: "Markdown", reply_markup: openAppMarkup("Get Premium") },
        ).catch(() => {});
      } else if ((v.file_size ?? 0) > BOT_API_MAX_SIZE) {
        await setMessageReaction(BOT_TOKEN, msg.from.id, msg.message_id, [{ type: "emoji", emoji: "👀" }]).catch(() => {});
        await tgCall(BOT_TOKEN, "forwardMessage", { from_chat_id: msg.from.id, chat_id: ADMIN_ID, message_id: msg.message_id }).catch(() => {});
        await sendMessage(BOT_TOKEN, msg.from.id,
          `⚠️ *Video too large*\n\nThis video is ${((v.file_size ?? 0) / (1024 * 1024)).toFixed(1)} MB, which exceeds the 20 MB streaming limit.\n\nYour video has been forwarded to the admin. You can download it directly from the chat above.`,
          { parse_mode: "Markdown", reply_markup: openAppMarkup() },
        ).catch(() => {});
      } else {
        const exp        = Date.now() + VIDEO_TTL_MS;
        const senderName = msg.from.first_name ?? `User ${fromId}`;
        const userFileName = v.file_name ?? (msg.caption ? msg.caption.slice(0, 64).replace(/[\\/:*?"<>|]/g, "_") + ".mp4" : null) ?? `${senderName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.mp4`;
        await setMessageReaction(BOT_TOKEN, msg.from.id, msg.message_id, [{ type: "emoji", emoji: "⚡" }]).catch(() => {});
        const tok         = await signToken({ fid: v.file_id, uid: v.file_unique_id, exp, mime: v.mime_type ?? "video/mp4", size: v.file_size, name: userFileName, amsgId: msg.message_id, acid: parseInt(fromId, 10) }, BOT_TOKEN);
        const watchUrl    = `${VIDEO_BASE}/watch/${tok}`;
        const downloadUrl = `${VIDEO_BASE}/download/${tok}`;
        ctx.waitUntil(
          addVideo(DB, { uid: v.file_unique_id, token: tok, watchUrl, downloadUrl, fromId, fromName: senderName, fileName: userFileName, fileSize: v.file_size ?? 0, exp, addedAt: Date.now(), chatId: String(msg.chat?.id ?? fromId), videoChatMsgId: msg.message_id, adminMsgId: msg.message_id, adminChatId: parseInt(fromId, 10) }).catch(() => {}),
        );
        const videoBtns = { inline_keyboard: [[{ text: "▶ Mini App", web_app: { url: watchUrl } }, { text: "🌐 Web Player", url: watchUrl }], [{ text: "⬇ Download", url: downloadUrl }]] };
        await sendMessage(BOT_TOKEN, msg.from.id, `🎬 <b>Your video is ready</b> (24 h)\n\n⭐ Premium perks active`, { parse_mode: "HTML", reply_markup: videoBtns }).catch(() => {});
        await tgCall(BOT_TOKEN, "forwardMessage", { from_chat_id: msg.from.id, chat_id: ADMIN_ID, message_id: msg.message_id }).catch(() => null);
        await sendMessage(BOT_TOKEN, ADMIN_ID, `🎬 <b>Video from</b> ${senderName.replace(/</g,"&lt;").replace(/>/g,"&gt;")} (id: ${fromId}) ⭐`, { parse_mode: "HTML", reply_markup: videoBtns }).catch(() => {});
      }
    }

    if (!msg.video) {
      await setMessageReaction(BOT_TOKEN, msg.from.id, msg.message_id, [{ type: "emoji", emoji: "👀" }]).catch(() => {});
      await tgCall(BOT_TOKEN, "forwardMessage", { from_chat_id: msg.from.id, chat_id: ADMIN_ID, message_id: msg.message_id }).catch(() => {});
    }

    await sendChatAction(BOT_TOKEN, msg.from.id).catch(() => {});
    await sendMessage(BOT_TOKEN, msg.from.id, "Message received. The admin will reply soon.", { reply_markup: openAppMarkup() });
    console.log(`[webhook] forwarded to admin, confirmation sent to user ${fromId}`);
    return c.json({ ok: true });

  } catch (err) {
    console.error("[webhook] Unhandled error:", err);
    return c.json({ ok: true });
  }
});

export default webhook;
