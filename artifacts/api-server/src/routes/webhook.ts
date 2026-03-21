import { Router } from "express";
import { d1All, d1First, d1Run } from "../lib/d1.js";
import {
  forwardMessage, sendMessage, sendChatAction, tgCall,
  copyMessage, downloadFile, setMessageReaction,
  answerPreCheckoutQuery, pinChatMessage,
  getChatAdministrators, getChatMembersCount, banChatMember,
  MessageBuilder, EFFECTS, BTN_EMOJI,
} from "../lib/telegram.js";
import { uploadToR2, getMediaContentType } from "../lib/r2.js";
import { checkUserAccess, parseModerationMessage, applyModAction } from "../lib/moderation.js";
import { buildTagAllChunks } from "../lib/group.js";

const router = Router();

const ADMIN_ID   = process.env.ADMIN_ID!;
const MINI_APP_URL = "https://mini.susagar.sbs/miniapp/";

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
      // Collect candidates: tracked members in this chat + all known users (bot will skip non-members)
      const [chatMembers, allUsers] = await Promise.all([
        d1All<{ telegram_id: string }>(
          `SELECT telegram_id FROM group_members WHERE chat_id = ? AND status NOT IN ('left','kicked')`,
          [String(msg.chat.id)],
        ).catch(() => [] as { telegram_id: string }[]),
        d1All<{ telegram_id: string }>(
          `SELECT telegram_id FROM users`,
        ).catch(() => [] as { telegram_id: string }[]),
      ]);
      // Merge and deduplicate, exclude the invoker
      const seen = new Set<string>();
      const candidates: number[] = [];
      for (const m of [...chatMembers, ...allUsers]) {
        if (m.telegram_id === uid || seen.has(m.telegram_id)) continue;
        seen.add(m.telegram_id);
        const parsed = parseInt(m.telegram_id, 10);
        if (!isNaN(parsed)) candidates.push(parsed);
      }
      await sendMessage(msg.chat.id, `⏳ Banning ${candidates.length} members...`).catch(() => {});
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
          "Hello! Send any message and the admin will reply.\n\nYou can also donate or open the app using the button below.",
          { reply_markup: openAppMarkup() }
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

    if (isAdmin) { res.json({ ok: true }); return; }

    // ── Check user access ─────────────────────────────────────────────────────
    const access = await checkUserAccess(fromId, "bot");
    if (!access.allowed) {
      await sendMessage(msg.from.id, `You are banned.\nReason: ${access.reason ?? "No reason provided."}`);
      res.json({ ok: true });
      return;
    }

    // ── Forward user message to admin ─────────────────────────────────────────
    const userId = await upsertUser(msg.from);
    const { type: mediaType, fileId } = detectMediaType(msg);
    let mediaUrl: string | null = null;
    if (fileId) mediaUrl = await handleMedia(fileId, mediaType, userId);
    await saveMessage(userId, "user", msg.text ?? msg.caption ?? null, mediaType, mediaUrl, fileId, msg.message_id);

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
    allowed_updates: ["message", "callback_query", "pre_checkout_query"],
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
