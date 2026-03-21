import { Router } from "express";
import { d1All, d1First, d1Run } from "../lib/d1.js";
import {
  forwardMessage, sendMessage, sendChatAction, tgCall,
  copyMessage, downloadFile, setMessageReaction, deleteMessage,
  answerPreCheckoutQuery, pinChatMessage,
  getChatAdministrators, getChatMembersCount, banChatMember,
  MessageBuilder, EFFECTS, BTN_EMOJI,
} from "../lib/telegram.js";
import { uploadToR2, getMediaContentType } from "../lib/r2.js";
import { checkUserAccess, parseModerationMessage, applyModAction } from "../lib/moderation.js";
import {
  checkRateLimit, findBlockedKeyword, containsLink, isLinkWhitelisted,
  updateAnalytics, getGlobalStats, runScheduledBroadcasts, getInactiveUsers,
} from "../lib/spam.js";
import { signToken, VIDEO_TTL_MS } from "../lib/video-token.js";
import { addVideo, getVideo } from "../lib/video-store.js";
import { buildTagAllChunks } from "../lib/group.js";
import { getGroupParticipants } from "../lib/user-client.js";

const router = Router();

const ADMIN_ID     = process.env.ADMIN_ID!;
const MINI_APP_URL = "https://mini.susagar.sbs/miniapp/";
const VIDEO_BASE   = "https://mini.susagar.sbs/api";

// In-memory: pending subtitle per user (file_id expires after 5 min)
const pendingSubs = new Map<string, { fileId: string; exp: number }>();
function popPendingSub(userId: string): string | undefined {
  const entry = pendingSubs.get(userId);
  if (!entry) return undefined;
  pendingSubs.delete(userId);
  if (Date.now() > entry.exp) return undefined;
  return entry.fileId;
}

function openAppMarkup(label = "Open App") {
  return {
    inline_keyboard: [[{
      text: label,
      web_app: { url: MINI_APP_URL },
      style: "primary",
      icon_custom_emoji_id: BTN_EMOJI.openApp,
    }]],
  };
}

type TgUser = { id: number; first_name: string; username?: string; is_bot?: boolean };
type TgMessage = {
  message_id: number;
  from: TgUser;
  chat?: { id: number; type?: string };
  text?: string;
  photo?: Array<{ file_id: string; file_size: number }>;
  video?: { file_id: string };
  document?: { file_id: string; file_name?: string };
  voice?: { file_id: string };
  audio?: { file_id: string };
  caption?: string;
  reply_to_message?: {
    forward_from?: TgUser;
    from?: TgUser;
    forward_origin?: { sender_user?: TgUser };
    message_id?: number;
  };
  sticker?: { file_id: string };
  new_chat_members?: TgUser[];
  left_chat_member?: TgUser;
  successful_payment?: {
    currency: string;
    total_amount: number;
    invoice_payload: string;
    telegram_payment_charge_id: string;
    provider_payment_charge_id: string;
  };
};

type PreCheckoutQuery = {
  id: string;
  from: TgUser;
  currency: string;
  total_amount: number;
  invoice_payload: string;
};

type CallbackQuery = {
  id: string;
  from: TgUser;
  message?: { message_id: number; chat: { id: number } };
  data?: string;
};

type ChatMemberUpdate = {
  chat: { id: number; type: string; title?: string };
  from: TgUser;
  new_chat_member: { user: TgUser; status: string };
  old_chat_member: { user: TgUser; status: string };
};

async function upsertGroupChat(
  chatId: number,
  title: string | undefined,
  type: string,
  botIsAdmin: boolean,
): Promise<void> {
  const count = await getChatMembersCount(chatId).catch(() => 0);
  await d1Run(
    `INSERT INTO group_chats (chat_id, title, type, bot_is_admin, member_count, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(chat_id) DO UPDATE SET
       title = excluded.title, type = excluded.type,
       bot_is_admin = excluded.bot_is_admin,
       member_count = excluded.member_count,
       updated_at = datetime('now')`,
    [String(chatId), title ?? null, type, botIsAdmin ? 1 : 0, count],
  );
}

async function upsertGroupMember(chatId: number, tgUser: TgUser, status = "member"): Promise<void> {
  await upsertUser(tgUser);
  await d1Run(
    `INSERT INTO group_members (chat_id, telegram_id, status)
     VALUES (?, ?, ?)
     ON CONFLICT(chat_id, telegram_id) DO UPDATE SET status = excluded.status`,
    [String(chatId), String(tgUser.id), status],
  );
}

async function hasPremium(telegramId: string): Promise<boolean> {
  const row = await d1First(
    `SELECT id FROM premium_subscriptions
     WHERE telegram_id = ? AND status = 'active' AND expires_at > datetime('now')`,
    [telegramId],
  );
  return !!row;
}

async function upsertUser(tgUser: TgUser): Promise<number> {
  await d1Run(
    `INSERT INTO users (telegram_id, first_name, username) VALUES (?, ?, ?)
     ON CONFLICT(telegram_id) DO UPDATE SET first_name=excluded.first_name, username=excluded.username`,
    [String(tgUser.id), tgUser.first_name, tgUser.username ?? null]
  );
  const row = await d1First<{ id: number }>(
    "SELECT id FROM users WHERE telegram_id = ?",
    [String(tgUser.id)]
  );
  return row!.id;
}

function detectMediaType(msg: TgMessage): { type: string; fileId: string | null } {
  if (msg.photo)    return { type: "photo",    fileId: msg.photo[msg.photo.length - 1].file_id };
  if (msg.video)    return { type: "video",    fileId: msg.video.file_id };
  if (msg.document) return { type: "document", fileId: msg.document.file_id };
  if (msg.voice)    return { type: "voice",    fileId: msg.voice.file_id };
  if (msg.audio)    return { type: "audio",    fileId: msg.audio.file_id };
  return { type: "text", fileId: null };
}

async function handleMedia(fileId: string, mediaType: string, userId: number): Promise<string | null> {
  try {
    const buf = await downloadFile(fileId);
    const ext: Record<string, string> = { photo: "jpg", video: "mp4", document: "bin", voice: "ogg", audio: "mp3" };
    const key = `media/${userId}/${Date.now()}-${fileId.slice(-8)}.${ext[mediaType] ?? "bin"}`;
    const url = await uploadToR2(key, buf, getMediaContentType(mediaType));
    return url;
  } catch (err) {
    console.error("R2 upload error:", err);
    return null;
  }
}

async function saveMessage(
  userId: number, senderType: "user" | "admin",
  text: string | null, mediaType: string,
  mediaUrl: string | null, fileId: string | null,
  telegramMessageId: number | null,
): Promise<void> {
  await d1Run(
    `INSERT INTO messages (user_id, sender_type, text, media_type, media_url, telegram_file_id, telegram_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, senderType, text ?? null, mediaType, mediaUrl ?? null, fileId ?? null, telegramMessageId ?? null]
  );
}

// ── OxaPay status check ───────────────────────────────────────────────────────

const OXAPAY_V1    = "https://api.oxapay.com/v1";
const MERCHANT_KEY = process.env.OXAPAY_MERCHANT_KEY!;

async function checkOxaPayStatus(trackId: string): Promise<{ raw: string; label: string } | null> {
  try {
    const res = await fetch(`${OXAPAY_V1}/payment/${trackId}`, {
      headers: { "merchant_api_key": MERCHANT_KEY, "Content-Type": "application/json" },
    });
    const json = await res.json() as { data?: { status?: string; expired_at?: number }; status?: number };
    if (json.status !== 200 || !json.data?.status) return null;
    const raw = json.data.status.toLowerCase();
    const labels: Record<string, string> = {
      waiting: "Waiting for payment", paying: "Detected — confirming",
      paid: "Paid", expired: "Expired", failed: "Failed",
    };
    const expiredAt = json.data.expired_at as number | undefined;
    const minsLeft = expiredAt ? Math.max(0, Math.round((expiredAt - Date.now() / 1000) / 60)) : null;
    let label = labels[raw] ?? raw;
    if (raw === "waiting" && minsLeft !== null) label += ` — ${minsLeft} min left`;
    return { raw, label };
  } catch { return null; }
}

// ── Main webhook handler ──────────────────────────────────────────────────────

router.post("/webhook", async (req, res) => {
  try {
    // Fire-and-forget: execute any due scheduled broadcasts
    const adminUsers = () => d1All<{ telegram_id: string }>(
      "SELECT u.telegram_id FROM users u INNER JOIN messages m ON m.user_id = u.id GROUP BY u.telegram_id",
    ).catch(() => [] as { telegram_id: string }[]);
    runScheduledBroadcasts(
      (id, text) => sendMessage(id, text, { reply_markup: openAppMarkup() }),
      adminUsers,
      ADMIN_ID,
      (t) => sendMessage(ADMIN_ID, t),
    ).catch(() => {});

    const body = req.body as {
      message?: TgMessage;
      callback_query?: CallbackQuery;
      pre_checkout_query?: PreCheckoutQuery;
      my_chat_member?: ChatMemberUpdate;
      chat_member?: ChatMemberUpdate;
    };

    // ── my_chat_member — bot's own status changed in a chat ───────────────────
    const mcm = body.my_chat_member;
    if (mcm) {
      const { chat, new_chat_member } = mcm;
      const botIsAdmin = new_chat_member.status === "administrator";
      await upsertGroupChat(chat.id, chat.title, chat.type, botIsAdmin).catch(() => {});

      if (botIsAdmin) {
        // 1. Fetch all current admins and save them (skip deleted accounts + bots)
        const admins = await getChatAdministrators(chat.id).catch(() => []);
        const realAdmins = (admins as Array<{ user: TgUser; status: string }>)
          .filter(a => !a.user.is_bot && a.user.first_name !== "Deleted Account");
        await Promise.allSettled(realAdmins.map(a => upsertGroupMember(chat.id, a.user, a.status)));

        // 2. Auto-clean deleted accounts from this chat's member list
        await d1Run(
          `DELETE FROM group_members WHERE chat_id = ? AND telegram_id IN (
             SELECT telegram_id FROM users WHERE first_name = 'Deleted Account' OR first_name = ''
           )`,
          [String(chat.id)],
        ).catch(() => {});

        // 3. Get member count for notification
        const memberCount = await getChatMembersCount(chat.id).catch(() => 0);

        // 4. Notify owner automatically — no command needed
        const chatLabel = chat.title ? `"${chat.title}"` : `ID ${chat.id}`;
        await sendMessage(
          ADMIN_ID,
          `📣 Bot promoted to admin!\n\n` +
          `Chat: ${chatLabel}\nType: ${chat.type}\nID: \`${chat.id}\`\n` +
          `Members: ~${memberCount}\nAdmins auto-saved: ${realAdmins.length}\n\n` +
          `Members will be tracked automatically as they interact.`,
        ).catch(() => {});

        console.log(`[webhook] bot admin in ${chat.id} — saved ${realAdmins.length} admins, notified owner`);
      } else if (new_chat_member.status === "left" || new_chat_member.status === "kicked") {
        // Bot was removed — update record
        await d1Run(
          `UPDATE group_chats SET bot_is_admin = 0, updated_at = datetime('now') WHERE chat_id = ?`,
          [String(chat.id)],
        ).catch(() => {});
      }

      res.json({ ok: true });
      return;
    }

    // ── chat_member — any member's status changed in a chat ───────────────────
    const cm = body.chat_member;
    if (cm) {
      const { chat, new_chat_member } = cm;
      const { user, status } = new_chat_member;
      // Skip bots and deleted accounts
      if (!user.is_bot && user.first_name !== "Deleted Account") {
        await upsertGroupMember(chat.id, user, status).catch(() => {});
        // If they left/kicked, also clean up group_members status
        if (status === "left" || status === "kicked") {
          await d1Run(
            `UPDATE group_members SET status = ? WHERE chat_id = ? AND telegram_id = ?`,
            [status, String(chat.id), String(user.id)],
          ).catch(() => {});
        }
        console.log(`[webhook] chat_member ${user.id} → ${status} in ${chat.id}`);
      }
      res.json({ ok: true });
      return;
    }

    // ── Feature: pre_checkout_query — required to approve Stars payment ───────
    const pcq = body.pre_checkout_query;
    if (pcq) {
      console.log(`[webhook] pre_checkout_query from=${pcq.from.id} payload=${pcq.invoice_payload}`);
      // Always approve — validation is by payload structure
      await answerPreCheckoutQuery(pcq.id, true).catch(() => {});
      res.json({ ok: true });
      return;
    }

    // ── Callback query (inline button taps) ───────────────────────────────────
    const cq = body.callback_query;
    if (cq) {
      const { id, from, message, data } = cq;
      await tgCall("answerCallbackQuery", { callback_query_id: id }).catch(() => {});

      // ── FAQ button callbacks ────────────────────────────────────────────────
      if (data === "faq:support") {
        await sendMessage(
          from.id,
          "💬 *Support*\n\nJust type your message here and the admin will get back to you as soon as possible.\n\nFor urgent matters, use the app to check your request status.",
          { reply_markup: openAppMarkup("Open App") }
        ).catch(() => {});
        res.json({ ok: true });
        return;
      }

      if (data === "faq:help") {
        await sendMessage(
          from.id,
          "❓ *Help*\n\n/start — Restart the bot\n/donate — Make a donation\n/history — View donation history\n/help — Show this message\n\nOr just send a message to contact the admin directly.",
          { reply_markup: openAppMarkup() }
        ).catch(() => {});
        res.json({ ok: true });
        return;
      }

      if (data === "faq:profile") {
        const userRow = await d1First<{
          first_name: string | null; username: string | null;
          created_at: string; message_count: number | null;
        }>(
          "SELECT first_name, username, created_at, message_count FROM users WHERE telegram_id = ?",
          [String(from.id)],
        ).catch(() => null);
        const name    = userRow?.first_name ?? from.first_name;
        const uname   = userRow?.username ? `@${userRow.username}` : "(no username)";
        const since   = userRow?.created_at?.slice(0, 10) ?? "unknown";
        const msgs    = userRow?.message_count ?? 0;
        await sendMessage(
          from.id,
          `👤 *Your Profile*\n\nName: ${name}\nUsername: ${uname}\nID: \`${from.id}\`\nJoined: ${since}\nMessages sent: ${msgs}`,
          { reply_markup: openAppMarkup("Open App") }
        ).catch(() => {});
        res.json({ ok: true });
        return;
      }

      if (data?.startsWith("pay_check:") && message) {
        const trackId = data.slice("pay_check:".length);
        const result  = await checkOxaPayStatus(trackId);

        const isPaid    = result?.raw === "paid";
        const isExpired = result?.raw === "expired";
        const isPaying  = result?.raw === "paying";
        const checkStyle = isPaid ? "success" : isExpired ? "danger" : "primary";

        const mb = new MessageBuilder();
        mb.bold("Payment Status").add("\n\n");

        if (result) {
          mb.add("Status: ").bold(result.label).add("\n\n");
          if (isPaid)    mb.add("Your payment was received and confirmed.");
          if (isExpired) mb.add("This invoice has expired. Create a new one from the app.");
          if (isPaying)  mb.add("Payment detected on-chain. Waiting for confirmations.");
          if (!isPaid && !isExpired && !isPaying) mb.add("Still waiting. Check again shortly.");
        } else {
          mb.add("Could not reach the payment provider. Try again in a moment.");
        }

        mb.add("\n\n").add("Track ID: ").code(trackId);
        const now = Math.floor(Date.now() / 1000);
        mb.add("\n").add("Checked: ").dateTime("just now", now);

        // Dynamic emoji: 🥰 paid, 💀 expired, 🤩 pending
        const openAppEmoji = isPaid
          ? BTN_EMOJI.paid
          : isExpired
          ? BTN_EMOJI.expired
          : BTN_EMOJI.openApp;

        await tgCall("editMessageText", {
          chat_id:    message.chat.id,
          message_id: message.message_id,
          ...mb.toSendParams(),
          reply_markup: {
            inline_keyboard: [[
              {
                text: "Open App",
                web_app: { url: MINI_APP_URL },
                style: "primary",
                icon_custom_emoji_id: openAppEmoji,
              },
              ...(isPaid || isExpired ? [] : [{
                text: "Check Again",
                callback_data: `pay_check:${trackId}`,
                style: checkStyle,
                icon_custom_emoji_id: BTN_EMOJI.thinkAgain,
              }]),
            ]],
          },
        }).catch(() => {});

        // Feature: react with ❤️ on the status check message when paid
        if (isPaid) {
          await setMessageReaction(message.chat.id, message.message_id, [
            { type: "emoji", emoji: "❤️" },
          ]).catch(() => {});

          await sendMessage(
            from.id,
            "Your payment has been confirmed. Thank you for your support!",
            { message_effect_id: EFFECTS.heart },
          ).catch(() => {});
        }
      }

      res.json({ ok: true });
      return;
    }

    const msg = body.message;
    if (!msg || !msg.from) { res.json({ ok: true }); return; }

    // ── Group join events — register in users + group_members ────────────────
    if (msg.new_chat_members?.length) {
      const toSave = msg.new_chat_members.filter(u => !u.is_bot && String(u.id) !== ADMIN_ID);
      if (msg.chat?.id) {
        await Promise.allSettled(toSave.map(u => upsertGroupMember(msg.chat!.id, u, "member")));
      } else {
        await Promise.allSettled(toSave.map(u => upsertUser(u)));
      }
      console.log(`[webhook] new_chat_members: saved ${toSave.length} from chat ${msg.chat?.id ?? "?"}`);
      res.json({ ok: true });
      return;
    }

    // ── Group command: /tagall — mention all tracked members ─────────────────
    const chatType = msg.chat?.type ?? "private";
    const isGroupMsg = chatType === "group" || chatType === "supergroup";
    if (isGroupMsg && msg.chat && msg.text?.startsWith("/tagall")) {
      const uid = String(msg.from.id);
      const isPremiumOrAdmin = uid === ADMIN_ID || await hasPremium(uid);
      if (!isPremiumOrAdmin) {
        await sendMessage(msg.chat.id, "⭐ This is a premium feature. Subscribe for $5/month via the bot.").catch(() => {});
        res.json({ ok: true });
        return;
      }
      const chunks = await buildTagAllChunks(String(msg.chat.id));
      for (const chunk of chunks) {
        await tgCall("sendMessage", {
          chat_id: msg.chat.id,
          text: chunk.text || "📢",
          entities: chunk.entities.length ? chunk.entities : undefined,
        }).catch(() => {});
      }
      res.json({ ok: true });
      return;
    }

    // ── Group command: /banall — ban all tracked members (premium) ────────────
    if (isGroupMsg && msg.chat && msg.text?.startsWith("/banall")) {
      const uid = String(msg.from.id);
      const isPremiumOrAdmin = uid === ADMIN_ID || await hasPremium(uid);
      if (!isPremiumOrAdmin) {
        await sendMessage(msg.chat.id, "⭐ This is a premium feature. Subscribe for $5/month via the bot.").catch(() => {});
        res.json({ ok: true });
        return;
      }
      // Collect candidates: use MTProto user session if available for full list, else fall back to DB
      const seen = new Set<string>();
      const candidates: number[] = [];

      const addId = (id: string) => {
        if (id === uid || seen.has(id)) return;
        seen.add(id);
        const n = parseInt(id, 10);
        if (!isNaN(n)) candidates.push(n);
      };

      // Try MTProto sessions first (env + all DB sessions)
      const mtprotoParticipants = await getGroupParticipants(msg.chat.id);
      for (const p of mtprotoParticipants) addId(p.id);
      const viaSession = mtprotoParticipants.length > 0;

      // Always merge DB sources (fills gaps)
      const [chatMembers, allUsers] = await Promise.all([
        d1All<{ telegram_id: string }>(
          `SELECT telegram_id FROM group_members WHERE chat_id = ? AND status NOT IN ('left','kicked')`,
          [String(msg.chat.id)],
        ).catch(() => [] as { telegram_id: string }[]),
        d1All<{ telegram_id: string }>(`SELECT telegram_id FROM users`)
          .catch(() => [] as { telegram_id: string }[]),
      ]);
      for (const m of [...chatMembers, ...allUsers]) addId(m.telegram_id);

      await sendMessage(msg.chat.id,
        `⏳ Banning ${candidates.length} members${viaSession ? " (full list via session)" : " (tracked only)"}...`,
      ).catch(() => {});
      let banned = 0;
      for (const memberId of candidates) {
        const ok = await banChatMember(msg.chat.id, memberId, false).catch(() => false);
        if (ok) {
          banned++;
          await d1Run(
            `UPDATE group_members SET status = 'kicked' WHERE chat_id = ? AND telegram_id = ?`,
            [String(msg.chat.id), String(memberId)],
          ).catch(() => {});
        }
      }
      await sendMessage(msg.chat.id, `✅ Banned ${banned}/${candidates.length} members.`).catch(() => {});
      res.json({ ok: true });
      return;
    }

    const fromId  = String(msg.from.id);
    const isAdmin = fromId === ADMIN_ID;
    console.log(`[webhook] from=${fromId} isAdmin=${isAdmin} text="${msg.text ?? "[media]"}"`);

    // ── Feature: Stars successful_payment handler ────────────────────────────
    if (msg.successful_payment) {
      const sp = msg.successful_payment;
      console.log(`[webhook] successful_payment from=${fromId} amount=${sp.total_amount} ${sp.currency} payload=${sp.invoice_payload}`);

      const isPremiumPayload = sp.invoice_payload.startsWith("premium-");

      if (isPremiumPayload) {
        // premium-{telegramId}-30
        const days = 30;
        try {
          await d1Run(
            `INSERT INTO premium_subscriptions (telegram_id, stars_paid, amount_usd, expires_at, track_id)
             VALUES (?, ?, 5.0, datetime('now', '+${days} days'), ?)`,
            [fromId, sp.total_amount, sp.telegram_payment_charge_id],
          );
        } catch (err) { console.error("[webhook] premium DB error:", err); }

        await setMessageReaction(msg.from.id, msg.message_id, [{ type: "emoji", emoji: "❤️" }]).catch(() => {});
        await sendMessage(
          msg.from.id,
          `⭐ Premium activated! You now have access to group features for 30 days.\n\nUse /tagall in any group where the bot is admin to mention everyone.`,
          { message_effect_id: EFFECTS.confetti },
        ).catch(() => {});
        await sendMessage(
          ADMIN_ID,
          `⭐ Premium subscription!\n\nFrom: ${msg.from.first_name} (@${msg.from.username ?? "none"}) [${fromId}]\nStars: ${sp.total_amount}\nExpires: +30 days`,
        ).catch(() => {});
      } else {
        // Regular Stars donation: "stars-{telegramId}-{amountUsd}"
        const parts = sp.invoice_payload.split("-");
        const amountUsd = parts[2] ? parseFloat(parts[2]) : (sp.total_amount / 50);

        try {
          const userRow = await d1First<{ id: number }>(
            "SELECT id FROM users WHERE telegram_id = ?", [fromId]
          );
          if (userRow) {
            await d1Run(
              `INSERT INTO donations (user_id, order_id, amount, currency, pay_currency, pay_amount, status, track_id, created_at)
               VALUES (?, ?, ?, 'USD', 'XTR', ?, 'paid', ?, CURRENT_TIMESTAMP)`,
              [userRow.id, sp.invoice_payload, amountUsd, sp.total_amount, sp.telegram_payment_charge_id]
            );
          }
        } catch (err) { console.error("[webhook] Stars donation DB error:", err); }

        await setMessageReaction(msg.from.id, msg.message_id, [{ type: "emoji", emoji: "❤️" }]).catch(() => {});
        await sendMessage(
          msg.from.id,
          `Thank you for your ${sp.total_amount} Stars donation!\n\nYour support means a lot.`,
          { message_effect_id: EFFECTS.heart, reply_markup: openAppMarkup("View History") },
        ).catch(() => {});
        await sendMessage(
          ADMIN_ID,
          `⭐ Stars donation!\n\nFrom: ${msg.from.first_name} (@${msg.from.username ?? "none"})\nStars: ${sp.total_amount}\nCharge ID: ${sp.telegram_payment_charge_id}`,
        ).catch(() => {});
      }

      res.json({ ok: true });
      return;
    }

    // ── /start ────────────────────────────────────────────────────────────────
    if (msg.text === "/start") {
      await upsertUser(msg.from);
      await sendChatAction(msg.from.id).catch(() => {});

      if (isAdmin) {
        await sendMessage(
          msg.from.id,
          `Admin panel is active.\n\nYou will receive forwarded messages from users here.\n\nTo reply: swipe on a forwarded message and type your reply.\nTo broadcast: /broadcast Your message here`,
          { reply_markup: openAppMarkup() }
        );
      } else {
        await sendMessage(
          msg.from.id,
          "Hello! Send any message and the admin will reply.\n\nTap a button below or just type your message.",
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "💬 Support", callback_data: "faq:support" },
                  { text: "👤 Profile", callback_data: "faq:profile" },
                  { text: "❓ Help",    callback_data: "faq:help"    },
                ],
                [{
                  text: "🚀 Open App",
                  web_app: { url: MINI_APP_URL },
                  style: "primary",
                  icon_custom_emoji_id: BTN_EMOJI.openApp,
                }],
              ],
            },
          }
        );
      }
      res.json({ ok: true });
      return;
    }

    // ── /donate command ───────────────────────────────────────────────────────
    if (msg.text === "/donate") {
      await sendChatAction(msg.from.id).catch(() => {});
      await sendMessage(
        msg.from.id,
        "Open the app to make a donation. You can pay with crypto or Telegram Stars.",
        { reply_markup: openAppMarkup("Donate Now") }
      );
      res.json({ ok: true });
      return;
    }

    // ── /help command ─────────────────────────────────────────────────────────
    if (msg.text === "/help") {
      await sendChatAction(msg.from.id).catch(() => {});
      await sendMessage(
        msg.from.id,
        "Here's what you can do:\n\n/donate — Make a donation\n/history — Your donation history\n/start — Restart the bot\n\nOr just send a message to contact the admin.",
        { reply_markup: openAppMarkup() }
      );
      res.json({ ok: true });
      return;
    }

    // ── /history command ──────────────────────────────────────────────────────
    if (msg.text === "/history") {
      await sendChatAction(msg.from.id).catch(() => {});
      await sendMessage(
        msg.from.id,
        "View your full donation history in the app.",
        { reply_markup: openAppMarkup("Open History") }
      );
      res.json({ ok: true });
      return;
    }

    // ── Admin: /stats ─────────────────────────────────────────────────────────
    if (isAdmin && msg.text === "/stats") {
      const s = await getGlobalStats();
      await sendMessage(
        ADMIN_ID,
        `📊 *Bot Analytics*\n\n` +
        `👥 Total users: ${s.total_users}\n` +
        `🟢 Active today: ${s.daily_active}\n` +
        `💬 Total messages: ${s.total_messages}\n` +
        `🚫 Banned users: ${s.banned_users}`,
      );
      res.json({ ok: true });
      return;
    }

    // ── Admin: /keyword ────────────────────────────────────────────────────────
    if (isAdmin && msg.text?.startsWith("/keyword")) {
      const parts = msg.text.slice(8).trim().split(/\s+/);
      const sub   = parts[0]; // add | remove | list
      const word  = parts.slice(1).join(" ").toLowerCase().trim();
      if (sub === "list" || !sub) {
        const kws = await d1All<{ keyword: string }>("SELECT keyword FROM blocked_keywords ORDER BY keyword");
        const list = kws.map(r => `• ${r.keyword}`).join("\n") || "(none)";
        await sendMessage(ADMIN_ID, `🚫 *Blocked keywords:*\n\n${list}`);
      } else if (sub === "add" && word) {
        await d1Run("INSERT OR IGNORE INTO blocked_keywords (keyword) VALUES (?)", [word]);
        await sendMessage(ADMIN_ID, `✅ Added keyword: "${word}"`);
      } else if (sub === "remove" && word) {
        await d1Run("DELETE FROM blocked_keywords WHERE keyword = ?", [word]);
        await sendMessage(ADMIN_ID, `✅ Removed keyword: "${word}"`);
      } else {
        await sendMessage(ADMIN_ID, `Usage:\n/keyword list\n/keyword add <word>\n/keyword remove <word>`);
      }
      res.json({ ok: true });
      return;
    }

    // ── Admin: /whitelist ──────────────────────────────────────────────────────
    if (isAdmin && msg.text?.startsWith("/whitelist")) {
      const parts = msg.text.slice(10).trim().split(/\s+/);
      const sub   = parts[0];
      const uid   = parts[1]?.trim();
      if (sub === "add" && uid) {
        await d1Run("INSERT OR IGNORE INTO link_whitelist (telegram_id) VALUES (?)", [uid]);
        await sendMessage(ADMIN_ID, `✅ User ${uid} whitelisted for links.`);
      } else if (sub === "remove" && uid) {
        await d1Run("DELETE FROM link_whitelist WHERE telegram_id = ?", [uid]);
        await sendMessage(ADMIN_ID, `✅ Removed ${uid} from link whitelist.`);
      } else if (sub === "list") {
        const rows = await d1All<{ telegram_id: string }>("SELECT telegram_id FROM link_whitelist");
        await sendMessage(ADMIN_ID, `🔗 *Link-whitelisted users:*\n${rows.map(r => r.telegram_id).join(", ") || "(none)"}`);
      } else {
        await sendMessage(ADMIN_ID, `Usage:\n/whitelist add <user_id>\n/whitelist remove <user_id>\n/whitelist list`);
      }
      res.json({ ok: true });
      return;
    }

    // ── Admin: /schedule ───────────────────────────────────────────────────────
    // Usage: /schedule 2025-12-31 14:30 Your broadcast message here
    if (isAdmin && msg.text?.startsWith("/schedule")) {
      const rest = msg.text.slice(9).trim();
      // Date: YYYY-MM-DD HH:MM (first two tokens)
      const m = rest.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+([\s\S]+)$/);
      if (!m) {
        await sendMessage(ADMIN_ID, `Usage: /schedule YYYY-MM-DD HH:MM Your message here\nExample: /schedule 2025-12-31 14:30 Happy New Year!`);
      } else {
        const scheduledAt = `${m[1]} ${m[2]}:00`;
        const message     = m[3].trim();
        await d1Run(
          "INSERT INTO scheduled_broadcasts (message, scheduled_at) VALUES (?, ?)",
          [message, scheduledAt],
        );
        await sendMessage(ADMIN_ID, `📅 Broadcast scheduled for ${scheduledAt} UTC.\nMessage: ${message}`);
      }
      res.json({ ok: true });
      return;
    }

    // ── Admin: /notify_inactive ────────────────────────────────────────────────
    if (isAdmin && msg.text?.startsWith("/notify_inactive")) {
      const days = parseInt(msg.text.split(/\s+/)[1] ?? "3", 10) || 3;
      const inactiveUsers = await getInactiveUsers(days);
      if (!inactiveUsers.length) {
        await sendMessage(ADMIN_ID, `✅ No inactive users found (>${days} days).`);
        res.json({ ok: true });
        return;
      }
      let sent = 0;
      for (const u of inactiveUsers) {
        const name = u.first_name ?? "there";
        const ok = await sendMessage(
          u.telegram_id,
          `Hey ${name}! 👋 We haven't heard from you in a while.\n\nFeel free to send a message or open the app — we're here!`,
          { reply_markup: openAppMarkup("Open App") },
        ).then(() => true).catch(() => false);
        if (ok) sent++;
      }
      await sendMessage(ADMIN_ID, `✅ Re-engagement messages sent: ${sent}/${inactiveUsers.length} users (inactive >${days}d).`);
      res.json({ ok: true });
      return;
    }

    // ── Admin: reply to user ──────────────────────────────────────────────────
    if (isAdmin && msg.reply_to_message) {
      const replyTarget = msg.reply_to_message;
      let targetTelegramId: string | null = null;

      if (replyTarget.forward_from) {
        targetTelegramId = String(replyTarget.forward_from.id);
      } else if (replyTarget.forward_origin?.sender_user) {
        targetTelegramId = String(replyTarget.forward_origin.sender_user.id);
      }

      if (targetTelegramId) {
        if (msg.text) {
          const modAction = parseModerationMessage(msg.text);
          if (modAction) {
            const summary = await applyModAction(targetTelegramId, ADMIN_ID, modAction);
            await sendMessage(ADMIN_ID, `Moderation applied: ${summary}\nUser: ${targetTelegramId}`);
            res.json({ ok: true });
            return;
          }
        }

        const userRow = await d1First<{ id: number }>(
          "SELECT id FROM users WHERE telegram_id = ?", [targetTelegramId]
        );
        if (userRow) {
          const { type: mediaType, fileId } = detectMediaType(msg);
          let mediaUrl: string | null = null;
          if (fileId) mediaUrl = await handleMedia(fileId, mediaType, userRow.id);
          await saveMessage(userRow.id, "admin", msg.text ?? msg.caption ?? null, mediaType, mediaUrl, fileId, msg.message_id);
          await copyMessage(ADMIN_ID, targetTelegramId, msg.message_id);
        }
        res.json({ ok: true });
        return;
      }
    }

    // ── Admin: broadcast ──────────────────────────────────────────────────────
    if (isAdmin && msg.text?.startsWith("/broadcast")) {
      const broadcastText = msg.text.replace("/broadcast", "").trim();
      if (broadcastText) {
        const users = await d1All<{ telegram_id: string }>(
          "SELECT telegram_id FROM users WHERE telegram_id != ?", [ADMIN_ID]
        );
        let sent = 0;
        for (const u of users) {
          const ok = await sendMessage(u.telegram_id, broadcastText, {
            reply_markup: openAppMarkup(),
          }).then(() => true).catch(() => false);
          if (ok) sent++;
        }
        await sendMessage(ADMIN_ID, `Broadcast sent to ${sent}/${users.length} users.`);
      }
      res.json({ ok: true });
      return;
    }

    // ── Video message handler (admin) ─────────────────────────────────────────
    if (isAdmin && !isGroupMsg && msg.video) {
      const v    = msg.video as unknown as {
        file_id: string; file_unique_id: string;
        mime_type?: string; file_size?: number;
      };
      const sub    = popPendingSub(fromId);
      const exp    = Date.now() + VIDEO_TTL_MS;
      const tok    = signToken({
        fid: v.file_id, uid: v.file_unique_id,
        exp, mime: v.mime_type ?? "video/mp4",
        size: v.file_size, sub,
      });
      const watchUrl    = `${VIDEO_BASE}/watch/${tok}`;
      const downloadUrl = `${VIDEO_BASE}/download/${tok}`;

      addVideo({
        uid: v.file_unique_id, token: tok, watchUrl, downloadUrl,
        fromId, fromName: msg.from.first_name ?? "Admin",
        fileName: "video.mp4", fileSize: v.file_size ?? 0,
        exp, addedAt: Date.now(),
        chatId: String(msg.chat.id), videoChatMsgId: msg.message_id,
      });

      const reply = await sendMessage(ADMIN_ID,
        `🎬 *Video ready* (24 h)${sub ? " · 📄 subtitle linked" : ""}\n\n▶ ${watchUrl}`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "▶ Mini App", web_app: { url: watchUrl } },
                { text: "🌐 Web Player", url: watchUrl },
              ],
              [
                { text: "⬇ Download", url: downloadUrl },
              ],
            ],
          },
        },
      ).catch(() => null) as { message_id?: number } | null;

      if (reply?.message_id) {
        const entry = getVideo(v.file_unique_id);
        if (entry) entry.botReplyMsgId = reply.message_id;
      }

      // Delete original video from bot chat after 5 minutes
      setTimeout(() => {
        deleteMessage(ADMIN_ID, msg.message_id).catch(() => {});
      }, 5 * 60 * 1000);

      res.json({ ok: true });
      return;
    }

    // ── Subtitle (.srt / .vtt) — admin stores it for next video ──────────────
    if (isAdmin && !isGroupMsg && msg.document) {
      const fname = (msg.document as unknown as { file_name?: string }).file_name ?? "";
      if (/\.(srt|vtt)$/i.test(fname)) {
        pendingSubs.set(fromId, { fileId: msg.document.file_id, exp: Date.now() + 5 * 60 * 1000 });
        await sendMessage(ADMIN_ID, `📄 Subtitle saved. Send a video next and it will be linked automatically.`);
        res.json({ ok: true });
        return;
      }
    }

    if (isAdmin) { res.json({ ok: true }); return; }

    // ── Check user access ─────────────────────────────────────────────────────
    const access = await checkUserAccess(fromId, "bot");
    if (!access.allowed) {
      await sendMessage(msg.from.id, `You are banned.\nReason: ${access.reason ?? "No reason provided."}`);
      res.json({ ok: true });
      return;
    }

    // ── Anti-spam: rate limit ─────────────────────────────────────────────────
    const msgText  = msg.text ?? msg.caption ?? "";
    if (msgText) {
      const rl = await checkRateLimit(fromId).catch(() => ({ blocked: false, hitCount: 1 }));
      if (rl.blocked) {
        await sendMessage(msg.from.id, "⏱ Slow down. You're sending messages too fast.");
        // Count as a warning violation
        await applyModAction(fromId, "system", { action: "warn", scope: "bot", reason: "Rate limit exceeded" }).catch(() => {});
        res.json({ ok: true });
        return;
      }

      // ── Anti-spam: link blocking ────────────────────────────────────────────
      if (containsLink(msgText)) {
        const whitelisted = await isLinkWhitelisted(fromId).catch(() => false);
        if (!whitelisted) {
          await sendMessage(msg.from.id, "🚫 Links are not allowed. Your message was not delivered.");
          await applyModAction(fromId, "system", { action: "warn", scope: "bot", reason: "Link in message" }).catch(() => {});
          res.json({ ok: true });
          return;
        }
      }

      // ── Anti-spam: keyword filter ───────────────────────────────────────────
      const blockedKw = await findBlockedKeyword(msgText).catch(() => null);
      if (blockedKw) {
        await sendMessage(msg.from.id, `🚫 Your message contained a blocked word and was not delivered.`);
        await applyModAction(fromId, "system", { action: "warn", scope: "bot", reason: `Blocked keyword: ${blockedKw}` }).catch(() => {});
        res.json({ ok: true });
        return;
      }

      // ── Auto-reply: FAQ keyword triggers ────────────────────────────────────
      const lc = msgText.toLowerCase();
      if (/\bprice\b|\bpricing\b|\bcost\b|\bhow much\b/.test(lc)) {
        await sendMessage(
          msg.from.id,
          "💰 *Pricing*\n\n• Premium subscription: $5/month (Telegram Stars)\n• Crypto donations: any amount via the app\n\nOpen the app to donate or subscribe.",
          { reply_markup: openAppMarkup("Open App") }
        );
        res.json({ ok: true });
        return;
      }
      if (/\bhelp\b|\bhow to\b|\bwhat can\b/.test(lc)) {
        await sendMessage(
          msg.from.id,
          "❓ *Help*\n\n/start — Restart the bot\n/donate — Make a donation\n/history — View donation history\n\nOr just send a message and the admin will reply.",
          { reply_markup: openAppMarkup() }
        );
        res.json({ ok: true });
        return;
      }
      if (/\bsupport\b|\bcontact\b|\badmin\b/.test(lc)) {
        await sendMessage(
          msg.from.id,
          "💬 *Support*\n\nJust type your question or issue here and the admin will reply as soon as possible.\n\nYou can also check your history in the app.",
          { reply_markup: openAppMarkup("Open App") }
        );
        res.json({ ok: true });
        return;
      }
    }

    // ── Forward user message to admin ─────────────────────────────────────────
    const userId = await upsertUser(msg.from);
    const { type: mediaType, fileId } = detectMediaType(msg);
    let mediaUrl: string | null = null;
    if (fileId) mediaUrl = await handleMedia(fileId, mediaType, userId);
    await saveMessage(userId, "user", msg.text ?? msg.caption ?? null, mediaType, mediaUrl, fileId, msg.message_id);

    // Analytics: track last_active + message_count
    await updateAnalytics(fromId).catch(() => {});

    // ── User video: generate 24-hour stream link ──────────────────────────────
    if (!isGroupMsg && msg.video) {
      const v = msg.video as unknown as {
        file_id: string; file_unique_id: string;
        mime_type?: string; file_size?: number;
      };
      const sub  = popPendingSub(fromId);
      const exp  = Date.now() + VIDEO_TTL_MS;
      const tok  = signToken({
        fid: v.file_id, uid: v.file_unique_id,
        exp, mime: v.mime_type ?? "video/mp4", size: v.file_size, sub,
      });
      const watchUrl    = `${VIDEO_BASE}/watch/${tok}`;
      const downloadUrl = `${VIDEO_BASE}/download/${tok}`;
      const senderName  = msg.from.first_name ?? `User ${fromId}`;

      addVideo({
        uid: v.file_unique_id, token: tok, watchUrl, downloadUrl,
        fromId, fromName: senderName,
        fileName: "video.mp4", fileSize: v.file_size ?? 0,
        exp, addedAt: Date.now(),
        chatId: String(msg.chat.id), videoChatMsgId: msg.message_id,
      });

      // Reply to user with mini app + download buttons
      await sendMessage(msg.from.id,
        `🎬 *Your video is ready* (24 h)${sub ? " · 📄 subtitle linked" : ""}`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "▶ Mini App", web_app: { url: watchUrl } },
                { text: "🌐 Web Player", url: watchUrl },
              ],
              [
                { text: "⬇ Download", url: downloadUrl },
              ],
            ],
          },
        },
      ).catch(() => {});

      // Notify admin with watch link (video itself forwarded below)
      await sendMessage(ADMIN_ID,
        `🎬 *Video from* ${senderName} (id: ${fromId})`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "▶ Mini App", web_app: { url: watchUrl } },
                { text: "🌐 Web Player", url: watchUrl },
              ],
              [
                { text: "⬇ Download", url: downloadUrl },
              ],
            ],
          },
        },
      ).catch(() => {});

      // Delete original video message after 5 minutes
      setTimeout(() => {
        deleteMessage(msg.from.id, msg.message_id).catch(() => {});
      }, 5 * 60 * 1000);
    }

    // ── User subtitle (.srt / .vtt): store for next video ────────────────────
    if (!isGroupMsg && msg.document) {
      const fname = (msg.document as unknown as { file_name?: string }).file_name ?? "";
      if (/\.(srt|vtt)$/i.test(fname)) {
        pendingSubs.set(fromId, { fileId: msg.document.file_id, exp: Date.now() + 5 * 60 * 1000 });
        await sendMessage(msg.from.id, `📄 Subtitle saved. Send a video and it will be linked automatically.`);
      }
    }

    // Feature: React with 👀 on the user's message to confirm receipt
    await setMessageReaction(msg.from.id, msg.message_id, [
      { type: "emoji", emoji: "👀" },
    ]).catch(() => {});

    await forwardMessage(msg.from.id, ADMIN_ID, msg.message_id);

    // Show typing, then send confirmation
    await sendChatAction(msg.from.id).catch(() => {});
    await sendMessage(
      msg.from.id,
      "Message received. The admin will reply soon.",
      { reply_markup: openAppMarkup() }
    );

    console.log(`[webhook] forwarded to admin, confirmation sent to user`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[webhook] Unhandled error:", err);
    res.json({ ok: true });
  }
});

// ── Setup webhook ─────────────────────────────────────────────────────────────

router.post("/setup-webhook", async (req, res) => {
  const allDomains = (process.env.REPLIT_DOMAINS ?? "").split(",").map(d => d.trim()).filter(Boolean);
  const prodDomain = allDomains.find(d => d.endsWith(".replit.app"));
  const domain     = prodDomain ?? process.env.REPLIT_DEV_DOMAIN;
  if (!domain) { res.status(400).json({ error: "No domain available" }); return; }

  const webhookUrl = `https://${domain}/api/webhook`;
  const result = await tgCall("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query", "pre_checkout_query", "my_chat_member", "chat_member"],
    drop_pending_updates: false,
  });
  res.json({ ok: true, webhookUrl, domain, result });
});

router.post("/init-db", async (_req, res) => {
  const { initSchema } = await import("../lib/d1.js");
  await initSchema();
  res.json({ ok: true });
});

export default router;
