import { Hono } from "hono";
import type { Env } from "../types.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import {
  sendMessage, sendChatAction, tgCall, deleteMessage,
  setMessageReaction, answerPreCheckoutQuery,
  getChatAdministrators, getChatMembersCount, banChatMember,
  isBotAdminInChat,
  downloadFile, MessageBuilder, EFFECTS, BTN_EMOJI,
} from "../lib/telegram.ts";
import { uploadToR2, getMediaContentType } from "../lib/r2.ts";
import { checkUserAccess, parseModerationMessage, applyModAction } from "../lib/moderation.ts";
import {
  checkRateLimit, findBlockedKeyword, containsLink, isLinkWhitelisted,
  updateAnalytics, runScheduledBroadcasts,
} from "../lib/spam.ts";
import { buildTagAllChunks, buildBanCandidates } from "../lib/group.ts";
import { hasOwnSession } from "../lib/user-client.ts";

const webhook = new Hono<{ Bindings: Env }>();


function getMiniAppUrl(env: Env) { return env.MINIAPP_URL; }

function openAppMarkup(_env: Env, label = "Open App") {
  return {
    inline_keyboard: [[{
      text: label, web_app: { url: "https://lifegram-miniapp.pages.dev/miniapp/" },
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
    is_recurring?: boolean;
    is_first_recurring?: boolean;
    subscription_expiration_date?: number;
  };
};
type PreCheckoutQuery = { id: string; from: TgUser; currency: string; total_amount: number; invoice_payload: string };
type CallbackQuery    = { id: string; from: TgUser; message?: { message_id: number; chat: { id: number } }; data?: string };
type ChatMemberUpdate = { chat: { id: number; type: string; title?: string }; from: TgUser; new_chat_member: { user: TgUser; status: string }; old_chat_member: { user: TgUser; status: string } };

async function upsertUser(db: D1Database, tgUser: TgUser): Promise<number> {
  await d1Run(db,
    `INSERT INTO users (telegram_id, first_name, username, is_bot) VALUES (?, ?, ?, ?)
     ON CONFLICT(telegram_id) DO UPDATE SET first_name=excluded.first_name, username=excluded.username, is_bot=excluded.is_bot`,
    [String(tgUser.id), tgUser.first_name, tgUser.username ?? null, tgUser.is_bot ? 1 : 0],
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

async function upsertGroupChat(db: D1Database, token: string, chatId: number, title: string | undefined, type: string, botIsAdmin: boolean, addedBy?: string): Promise<void> {
  const count = await getChatMembersCount(token, chatId).catch(() => 0);
  await d1Run(db,
    `INSERT INTO group_chats (chat_id, title, type, bot_is_admin, member_count, added_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(chat_id) DO UPDATE SET
       title=excluded.title, type=excluded.type, bot_is_admin=excluded.bot_is_admin,
       member_count=excluded.member_count, updated_at=datetime('now'),
       added_by=COALESCE(excluded.added_by, group_chats.added_by)`,
    [String(chatId), title ?? null, type, botIsAdmin ? 1 : 0, count, addedBy ?? null],
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
  _db: D1Database, _token: string, _bucket: R2Bucket, _publicUrl: string,
  _fileId: string, _mediaType: string, _userId: number,
): Promise<string | null> {
  return null;
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

webhook.post("/webhook", async (c) => {
  const env = c.env;
  const { BOT_TOKEN, ADMIN_ID, DB, BUCKET, R2_PUBLIC_URL, OXAPAY_MERCHANT_KEY, MTPROTO_BACKEND_URL, MTPROTO_API_KEY } = env;
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
        (id, text) => sendMessage(BOT_TOKEN, id, text, { reply_markup: openAppMarkup(env) }),
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
      const { chat, new_chat_member, from: promotedBy } = mcm;
      const botIsAdmin = new_chat_member.status === "administrator";
      const addedBy = botIsAdmin && promotedBy.id ? String(promotedBy.id) : undefined;
      await upsertGroupChat(DB, BOT_TOKEN, chat.id, chat.title, chat.type, botIsAdmin, addedBy).catch(() => {});
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
      const pcqPayload = pcq.invoice_payload ?? "";
      const pcqCurrency = pcq.currency ?? "";
      const pcqAmount = pcq.total_amount ?? 0;

      if (pcqCurrency !== "XTR") {
        await answerPreCheckoutQuery(BOT_TOKEN, pcq.id, false, "Only Telegram Stars payments are accepted.").catch(() => {});
        return c.json({ ok: true });
      }

      let pcqValid = false;
      if (pcqPayload.startsWith("premium-")) {
        pcqValid = pcqAmount === 250;
      } else if (pcqPayload.startsWith("widgetplan-")) {
        const pcqPlan = pcqPayload.split("-")[2];
        const validPrices: Record<string, number> = { standard: 100, pro: 250 };
        pcqValid = !!pcqPlan && validPrices[pcqPlan] === pcqAmount;
      } else if (pcqPayload.startsWith("wboost-")) {
        const boostKey = pcqPayload.split("-")[2];
        const boostPrices: Record<string, number> = { extra_messages: 50, extra_widgets: 75, extra_faq: 30, extra_training: 40, extra_social: 25 };
        pcqValid = !!boostKey && boostPrices[boostKey] === pcqAmount;
      } else if (pcqPayload.startsWith("stars-")) {
        pcqValid = pcqAmount >= 1;
      }

      if (!pcqValid) {
        await answerPreCheckoutQuery(BOT_TOKEN, pcq.id, false, "Payment validation failed. Please try again.").catch(() => {});
      } else {
        await answerPreCheckoutQuery(BOT_TOKEN, pcq.id, true).catch(() => {});
      }
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

    if (!isAdmin) {
      const earlyAccess = await checkUserAccess(DB, fromId, "bot");
      if (!earlyAccess.allowed) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          `🚫 You are banned from this bot.\nReason: ${earlyAccess.reason ?? "No reason provided."}\n\nContact the admin if you believe this is a mistake.`,
        ).catch(() => {});
        return c.json({ ok: true });
      }
      if (earlyAccess.muted) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          `🔇 You are currently muted and cannot send messages. Please wait for the mute to expire.`,
        ).catch(() => {});
        return c.json({ ok: true });
      }
    }

    if (msg.successful_payment) {
      const sp      = msg.successful_payment;
      const payload = sp.invoice_payload;
      const stars   = sp.total_amount;
      const amountUsd = (stars / 50).toFixed(2);
      const isRecurring = sp.is_recurring === true;
      const isFirstRecurring = sp.is_first_recurring === true;
      const subscriptionExpDate = sp.subscription_expiration_date;
      console.log(`[webhook] Stars payment: ${stars} XTR from ${fromId} payload=${payload} recurring=${isRecurring} firstRecurring=${isFirstRecurring}`);

      if (payload.startsWith("premium-")) {
        const parts = payload.split("-");
        const tid   = parts[1] ?? fromId;
        const rawDays = parseInt(parts[2] ?? "30", 10);
        const days  = (Number.isFinite(rawDays) && rawDays > 0 && rawDays <= 365) ? rawDays : 30;
        let premiumGranted = false;

        if (isRecurring && !isFirstRecurring) {
          try {
            const existingSub = await d1First<{ id: number }>(DB,
              `SELECT id FROM premium_subscriptions WHERE telegram_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
              [tid],
            );
            if (existingSub) {
              if (subscriptionExpDate) {
                const expiresAt = new Date(subscriptionExpDate * 1000).toISOString();
                await d1Run(DB,
                  `UPDATE premium_subscriptions SET expires_at = ?, stars_paid = stars_paid + ? WHERE id = ?`,
                  [expiresAt, stars, existingSub.id],
                );
              } else {
                await d1Run(DB,
                  `UPDATE premium_subscriptions SET expires_at = datetime('now', '+' || ? || ' days'), stars_paid = stars_paid + ? WHERE id = ?`,
                  [String(days), stars, existingSub.id],
                );
              }
              premiumGranted = true;
            } else {
              await d1Run(DB,
                `INSERT INTO premium_subscriptions (telegram_id, stars_paid, amount_usd, expires_at, status, track_id)
                 VALUES (?, ?, ?, datetime('now', '+' || ? || ' days'), 'active', ?)`,
                [tid, stars, amountUsd, String(days), sp.telegram_payment_charge_id],
              );
              premiumGranted = true;
            }
          } catch (dbErr) {
            const dbMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
            console.error("[webhook] premium renewal failed:", dbMsg);
          }
          if (premiumGranted) {
            await sendMessage(BOT_TOKEN, fromId,
              `🔄 *Premium renewed!*\n\nYour premium subscription has been renewed for another ${days} days.\n\nThank you for your continued support!`,
              { parse_mode: "Markdown", reply_markup: openAppMarkup(env) },
            ).catch(() => {});
            await sendMessage(BOT_TOKEN, ADMIN_ID,
              `🔄 *Premium renewal*\n\nUser: ${fromName} (${fromId})\nStars: ${stars}`,
              { parse_mode: "Markdown" },
            ).catch(() => {});
          }
        } else {
          try {
            await d1Run(DB,
              `INSERT INTO premium_subscriptions (telegram_id, stars_paid, amount_usd, expires_at, status, track_id)
               VALUES (?, ?, ?, datetime('now', '+' || ? || ' days'), 'active', ?)`,
              [tid, stars, amountUsd, String(days), sp.telegram_payment_charge_id],
            );
            premiumGranted = true;
          } catch (dbErr) {
            const dbMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
            if (dbMsg.includes("UNIQUE") || dbMsg.includes("constraint")) {
              premiumGranted = true;
            } else {
              console.error("[webhook] premium insert failed:", dbMsg);
              await sendMessage(BOT_TOKEN, fromId,
                `⚠️ Payment received but premium activation failed. Please contact support.\n\nCharge ID: ${sp.telegram_payment_charge_id}`,
              ).catch(() => {});
              await sendMessage(BOT_TOKEN, ADMIN_ID,
                `⚠️ *Premium activation failed*\n\nUser: ${fromName} (${fromId})\nCharge: ${sp.telegram_payment_charge_id}\nError: ${dbMsg}`,
                { parse_mode: "Markdown" },
              ).catch(() => {});
            }
          }
          if (premiumGranted) {
            await sendMessage(BOT_TOKEN, fromId,
              `⭐ *Premium activated!*\n\nYou now have premium access for ${days} days.\n\nThank you for your support!`,
              { parse_mode: "Markdown", reply_markup: openAppMarkup(env) },
            ).catch(() => {});
            await sendMessage(BOT_TOKEN, ADMIN_ID,
              `⭐ *Premium purchase*\n\nUser: ${fromName} (${fromId})\nPayload: ${payload}\nStars: ${stars}\nAmount: $${amountUsd}`,
              { parse_mode: "Markdown" },
            ).catch(() => {});
          }
        }
      } else if (payload.startsWith("widgetplan-")) {
        const parts = payload.split("-");
        const tid = parts[1] ?? fromId;
        const plan = parts[2];
        const validPlans: Record<string, number> = { standard: 100, pro: 250 };
        if (!plan || !validPlans[plan] || stars < validPlans[plan]) {
          console.error(`[webhook] Invalid widget plan purchase: plan=${plan} stars=${stars}`);
          await sendMessage(BOT_TOKEN, ADMIN_ID,
            `⚠️ Invalid widget plan payment: plan=${plan}, stars=${stars}, from ${fromName} (${fromId})`,
          ).catch(() => {});
          return c.json({ ok: true });
        }
        let planGranted = false;

        if (isRecurring && !isFirstRecurring) {
          try {
            const existingPlan = await d1First<{ id: number }>(DB,
              `SELECT id FROM widget_subscriptions WHERE telegram_id = ? AND plan = ? AND status = 'active' ORDER BY id DESC LIMIT 1`,
              [tid, plan],
            );
            if (existingPlan) {
              if (subscriptionExpDate) {
                const expiresAt = new Date(subscriptionExpDate * 1000).toISOString();
                await d1Run(DB,
                  `UPDATE widget_subscriptions SET expires_at = ?, stars_paid = stars_paid + ? WHERE id = ?`,
                  [expiresAt, stars, existingPlan.id],
                );
              } else {
                await d1Run(DB,
                  `UPDATE widget_subscriptions SET expires_at = datetime('now', '+30 days'), stars_paid = stars_paid + ? WHERE id = ?`,
                  [stars, existingPlan.id],
                );
              }
              planGranted = true;
            } else {
              await d1Run(DB,
                `INSERT INTO widget_subscriptions (telegram_id, plan, stars_paid, expires_at, status, track_id)
                 VALUES (?, ?, ?, datetime('now', '+30 days'), 'active', ?)`,
                [tid, plan, stars, sp.telegram_payment_charge_id],
              );
              planGranted = true;
            }
          } catch (dbErr) {
            console.error("[webhook] widget plan renewal failed:", dbErr);
          }
          if (planGranted) {
            const planLabel = plan === "pro" ? "Pro" : "Standard";
            await sendMessage(BOT_TOKEN, fromId,
              `🔄 *Widget ${planLabel} plan renewed!*\n\nYour plan has been renewed for another 30 days.`,
              { parse_mode: "Markdown", reply_markup: openAppMarkup(env) },
            ).catch(() => {});
            await sendMessage(BOT_TOKEN, ADMIN_ID,
              `🔄 *Widget plan renewal*\n\nUser: ${fromName} (${fromId})\nPlan: ${planLabel}\nStars: ${stars}`,
              { parse_mode: "Markdown" },
            ).catch(() => {});
          }
        } else {
          try {
            await d1Run(DB,
              `INSERT INTO widget_subscriptions (telegram_id, plan, stars_paid, expires_at, status, track_id)
               VALUES (?, ?, ?, datetime('now', '+30 days'), 'active', ?)`,
              [tid, plan, stars, sp.telegram_payment_charge_id],
            );
            planGranted = true;
          } catch (dbErr) {
            const dbMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
            if (dbMsg.includes("UNIQUE") || dbMsg.includes("constraint")) {
              planGranted = true;
            } else {
              console.error("[webhook] widget plan insert failed:", dbMsg);
              await sendMessage(BOT_TOKEN, fromId,
                `⚠️ Payment received but plan activation failed. Please contact support.\n\nCharge ID: ${sp.telegram_payment_charge_id}`,
              ).catch(() => {});
            }
          }
          if (planGranted) {
            const planLabel = plan === "pro" ? "Pro" : "Standard";
            await sendMessage(BOT_TOKEN, fromId,
              `⭐ *Widget ${planLabel} plan activated!*\n\nYour widget plan is now active for 30 days.\n\nThank you!`,
              { parse_mode: "Markdown", reply_markup: openAppMarkup(env) },
            ).catch(() => {});
            await sendMessage(BOT_TOKEN, ADMIN_ID,
              `⭐ *Widget plan purchase*\n\nUser: ${fromName} (${fromId})\nPlan: ${planLabel}\nStars: ${stars}\nAmount: $${amountUsd}`,
              { parse_mode: "Markdown" },
            ).catch(() => {});
          }
        }
      } else if (payload.startsWith("wboost-")) {
        const parts = payload.split("-");
        const tid = parts[1] ?? fromId;
        const boostKey = parts[2];
        const boostDefs: Record<string, { type: string; amount: number; label: string; stars: number }> = {
          extra_messages: { type: "msgsPerDay", amount: 500, label: "+500 msgs/day", stars: 50 },
          extra_widgets:  { type: "widgets", amount: 2, label: "+2 widgets", stars: 75 },
          extra_faq:      { type: "faq", amount: 5, label: "+5 FAQ items", stars: 30 },
          extra_training: { type: "trainUrls", amount: 3, label: "+3 training URLs", stars: 40 },
          extra_social:   { type: "social", amount: 3, label: "+3 social links", stars: 25 },
        };
        const boostDef = boostKey ? boostDefs[boostKey] : undefined;
        if (!boostDef || stars < boostDef.stars) {
          console.error(`[webhook] Invalid boost purchase: key=${boostKey} stars=${stars}`);
          return c.json({ ok: true });
        }
        try {
          await d1Run(DB,
            "INSERT INTO widget_boosts (telegram_id, boost_type, amount, payment_method, track_id) VALUES (?, ?, ?, 'stars', ?)",
            [tid, boostDef.type, boostDef.amount, sp.telegram_payment_charge_id],
          );
          await sendMessage(BOT_TOKEN, fromId,
            `⚡ *Boost activated: ${boostDef.label}*\n\nYour widget limits have been permanently increased!`,
            { parse_mode: "Markdown", reply_markup: openAppMarkup(env) },
          ).catch(() => {});
          await sendMessage(BOT_TOKEN, ADMIN_ID,
            `⚡ *Boost purchase*\n\nUser: ${fromName} (${fromId})\nBoost: ${boostDef.label}\nStars: ${stars}`,
            { parse_mode: "Markdown" },
          ).catch(() => {});
        } catch (dbErr) {
          console.error("[webhook] boost insert failed:", dbErr);
        }
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
          reply_markup: openAppMarkup(env),
        }).catch(() => {});
        await sendMessage(BOT_TOKEN, ADMIN_ID,
          `💰 Stars donation: ${stars} XTR from ${fromName} (${fromId}) ~$${amountUsd} USD`,
        ).catch(() => {});
      }
      return c.json({ ok: true });
    }

    if (isAdmin && !isGroupMsg && msg.reply_to_message) {
      const rtm    = msg.reply_to_message;
      const fwdTarget = rtm.forward_origin?.sender_user ?? rtm.forward_from;
      let targetId: string | null = fwdTarget ? String(fwdTarget.id) : null;
      let targetName: string | null = fwdTarget?.first_name ?? null;

      if (!targetId || targetId === ADMIN_ID) {
        const repliedMsgId = rtm.message_id;
        if (repliedMsgId) {
          const fwdRow = await d1First<{ user_telegram_id: string }>(
            DB, "SELECT user_telegram_id FROM forwarded_messages WHERE forwarded_msg_id = ?", [repliedMsgId],
          );
          if (fwdRow) {
            targetId = fwdRow.user_telegram_id;
            const userInfo = await d1First<{ first_name: string }>(DB, "SELECT first_name FROM users WHERE telegram_id = ?", [targetId]);
            targetName = userInfo?.first_name ?? `User ${targetId}`;
          }
        }
      }

      if (targetId && targetId !== ADMIN_ID) {
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

        const userRow = await d1First<{ id: number }>(DB, "SELECT id FROM users WHERE telegram_id = ?", [targetId]);
        if (userRow) {
          await saveMessage(DB, userRow.id, "admin", msg.text ?? msg.caption ?? null, detectMediaType(msg).type, null, null, forwardResult?.message_id ?? null);
        }

        await sendMessage(BOT_TOKEN, ADMIN_ID, `✅ Reply sent to ${targetName ?? targetId} (${targetId}).`).catch(() => {});
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
        ).catch(() => {});
        return c.json({ ok: true });
      }

      if (text.startsWith("/keyword ")) {
        const keyword = text.slice("/keyword ".length).trim().toLowerCase();
        if (keyword) {
          await d1Run(DB, "INSERT OR IGNORE INTO blocked_keywords (keyword) VALUES (?)", [keyword]);
          await sendMessage(BOT_TOKEN, ADMIN_ID, `✅ Keyword blocked: "${keyword}"`).catch(() => {});
        }
        return c.json({ ok: true });
      }

      if (text.startsWith("/whitelist ")) {
        const targetId = text.slice("/whitelist ".length).trim();
        if (targetId) {
          await d1Run(DB, "INSERT OR IGNORE INTO link_whitelist (telegram_id) VALUES (?)", [targetId]);
          await sendMessage(BOT_TOKEN, ADMIN_ID, `✅ ${targetId} added to link whitelist.`).catch(() => {});
        }
        return c.json({ ok: true });
      }

      if (text.startsWith("/schedule ")) {
        const parts      = text.slice("/schedule ".length).trim().split("|").map(p => p.trim());
        const msgTxt     = parts[0] ?? "";
        const schedAtStr = parts[1] ?? "";
        if (msgTxt && schedAtStr) {
          await d1Run(DB, "INSERT INTO scheduled_broadcasts (message, scheduled_at) VALUES (?, ?)", [msgTxt, schedAtStr]);
          await sendMessage(BOT_TOKEN, ADMIN_ID, `✅ Broadcast scheduled for ${schedAtStr}.`).catch(() => {});
        } else {
          await sendMessage(BOT_TOKEN, ADMIN_ID, "Usage: /schedule <message>|<YYYY-MM-DD HH:MM:SS>").catch(() => {});
        }
        return c.json({ ok: true });
      }

      if (text.startsWith("/tagall")) {
        const chatIdStr = text.slice("/tagall".length).trim();
        if (!chatIdStr) {
          await sendMessage(BOT_TOKEN, ADMIN_ID, "Usage: /tagall <chat_id>").catch(() => {});
          return c.json({ ok: true });
        }
        if (!(await isBotAdminInChat(BOT_TOKEN, chatIdStr))) {
          await sendMessage(BOT_TOKEN, ADMIN_ID, "❌ Bot is not an admin in this chat. Add the bot as admin first.").catch(() => {});
          return c.json({ ok: true });
        }
        const chunks = await buildTagAllChunks(DB, chatIdStr, { MTPROTO_BACKEND_URL, MTPROTO_API_KEY, adminTelegramId: ADMIN_ID });
        if (!chunks.length) {
          await sendMessage(BOT_TOKEN, ADMIN_ID, "ℹ️ No members to tag in this chat.").catch(() => {});
          return c.json({ ok: true });
        }
        for (const chunk of chunks) {
          await tgCall(BOT_TOKEN, "sendMessage", {
            chat_id: chatIdStr, text: chunk.text || "📢",
            entities: chunk.entities.length ? chunk.entities : undefined,
          }).catch(() => {});
        }
        await sendMessage(BOT_TOKEN, ADMIN_ID, `✅ Tag-all sent (${chunks.length} messages).`).catch(() => {});
        return c.json({ ok: true });
      }

      if (text.startsWith("/banall")) {
        const chatIdStr = text.slice("/banall".length).trim();
        if (!chatIdStr) {
          await sendMessage(BOT_TOKEN, ADMIN_ID, "Usage: /banall <chat_id>").catch(() => {});
          return c.json({ ok: true });
        }
        if (!(await isBotAdminInChat(BOT_TOKEN, chatIdStr))) {
          await sendMessage(BOT_TOKEN, ADMIN_ID, "❌ Bot is not an admin in this chat. Add the bot as admin first.").catch(() => {});
          return c.json({ ok: true });
        }
        const mtEnv = { MTPROTO_BACKEND_URL, MTPROTO_API_KEY, adminTelegramId: ADMIN_ID };
        const candidates = await buildBanCandidates(DB, chatIdStr, ADMIN_ID, ADMIN_ID, mtEnv);
        if (!candidates.length) {
          await sendMessage(BOT_TOKEN, ADMIN_ID, "ℹ️ No members to ban in this chat.").catch(() => {});
          return c.json({ ok: true });
        }
        let banned = 0;
        for (const memberId of candidates) {
          const ok = await banChatMember(BOT_TOKEN, chatIdStr, memberId, false).catch(() => false);
          if (ok) banned++;
        }
        await sendMessage(BOT_TOKEN, ADMIN_ID, `✅ Ban-all done: ${banned}/${candidates.length} banned.`).catch(() => {});
        return c.json({ ok: true });
      }

      if (text.startsWith("/silentban")) {
        const chatIdStr = text.slice("/silentban".length).trim();
        if (!chatIdStr) {
          await sendMessage(BOT_TOKEN, ADMIN_ID, "Usage: /silentban <chat_id>").catch(() => {});
          return c.json({ ok: true });
        }
        if (!(await isBotAdminInChat(BOT_TOKEN, chatIdStr))) {
          await sendMessage(BOT_TOKEN, ADMIN_ID, "❌ Bot is not an admin in this chat. Add the bot as admin first.").catch(() => {});
          return c.json({ ok: true });
        }
        await deleteMessage(BOT_TOKEN, msg.chat!.id, msg.message_id).catch(() => {});
        const mtEnvSilent = { MTPROTO_BACKEND_URL, MTPROTO_API_KEY, adminTelegramId: ADMIN_ID };
        const candidates = await buildBanCandidates(DB, chatIdStr, ADMIN_ID, ADMIN_ID, mtEnvSilent);
        if (!candidates.length) {
          await sendMessage(BOT_TOKEN, ADMIN_ID, "ℹ️ No members to ban in this chat.").catch(() => {});
          return c.json({ ok: true });
        }
        let banned = 0;
        const failed: string[] = [];
        for (const memberId of candidates) {
          const ok = await banChatMember(BOT_TOKEN, chatIdStr, memberId, true).catch(() => false);
          if (ok) { banned++; } else { failed.push(String(memberId)); }
        }
        await sendMessage(BOT_TOKEN, ADMIN_ID,
          `🔇 *Silent Ban Complete*\n\nChat: \`${chatIdStr}\`\nBanned: ${banned}/${candidates.length}\nMessages deleted: yes${failed.length ? `\nFailed IDs: ${failed.slice(0, 10).join(", ")}${failed.length > 10 ? "..." : ""}` : ""}`,
          { parse_mode: "Markdown" },
        ).catch(() => {});
        return c.json({ ok: true });
      }

      if (text.startsWith("/help")) {
        await sendMessage(BOT_TOKEN, ADMIN_ID,
          `*Admin Commands*\n\n/stats — global stats\n/keyword <word> — block keyword\n/whitelist <id> — whitelist user for links\n/schedule <msg>|<date> — schedule broadcast\n/tagall <chat\\_id> — tag all in group\n/banall <chat\\_id> — ban all in group\n/silentban <chat\\_id> — silent ban (deletes cmd, DM report)\n/broadcast <text> — message all users\n\n*Moderation* (reply to forwarded msg):\n!ban [bot|app|global] [reason]\n!warn [reason]\n!restrict [reason]\n!unban\n\n*Premium Features* (250 Stars/month):\n• 📢 Tag All members\n• 🚫 Ban All members\n• 🔇 Silent Ban (stealth mode)\n• Group management via Mini App`,
          { parse_mode: "Markdown" },
        ).catch(() => {});
        return c.json({ ok: true });
      }

      if (text.startsWith("/broadcast")) {
        const broadcastText = text.replace("/broadcast", "").trim();
        if (broadcastText) {
          const users = await d1All<{ telegram_id: string }>(DB, "SELECT telegram_id FROM users WHERE telegram_id != ?", [ADMIN_ID]);
          let sent = 0;
          for (const u of users) {
            const ok = await sendMessage(BOT_TOKEN, u.telegram_id, broadcastText, { reply_markup: openAppMarkup(env) }).then(() => true).catch(() => false);
            if (ok) sent++;
          }
          await sendMessage(BOT_TOKEN, ADMIN_ID, `📡 Broadcast sent to ${sent}/${users.length} users.`).catch(() => {});
        }
        return c.json({ ok: true });
      }

      if (text === "/start") {
        await sendMessage(BOT_TOKEN, ADMIN_ID,
          `Admin panel is active.\n\nYou will receive forwarded messages from users here.\n\nTo reply: swipe on a forwarded message and write your reply.\nTo broadcast: /broadcast Your message here`,
          { reply_markup: openAppMarkup(env) },
        ).catch(() => {});
        return c.json({ ok: true });
      }
      if (text === "/donate" || text === "/history") {
        await sendMessage(BOT_TOKEN, ADMIN_ID, "✅ Bot operational.", { reply_markup: openAppMarkup(env) }).catch(() => {});
        return c.json({ ok: true });
      }
    }

    if (isAdmin) return c.json({ ok: true });

    const msgText = msg.text ?? msg.caption ?? "";
    if (msgText) {
      const rl = await checkRateLimit(DB, fromId).catch(() => ({ blocked: false, hitCount: 1 }));
      if (rl.blocked) {
        await sendMessage(BOT_TOKEN, msg.from.id, "⏱ Slow down. You're sending messages too fast.").catch(() => {});
        await applyModAction(DB, BOT_TOKEN, fromId, "system", { action: "warn", scope: "bot", reason: "Rate limit exceeded" }).catch(() => {});
        return c.json({ ok: true });
      }

      if (containsLink(msgText)) {
        const whitelisted = await isLinkWhitelisted(DB, fromId).catch(() => false);
        if (!whitelisted) {
          await sendMessage(BOT_TOKEN, msg.from.id, "🚫 Links are not allowed. Your message was not delivered.").catch(() => {});
          await applyModAction(DB, BOT_TOKEN, fromId, "system", { action: "warn", scope: "bot", reason: "Link in message" }).catch(() => {});
          return c.json({ ok: true });
        }
      }

      const blockedKw = await findBlockedKeyword(DB, msgText).catch(() => null);
      if (blockedKw) {
        await sendMessage(BOT_TOKEN, msg.from.id, `🚫 Your message contained a blocked word and was not delivered.`).catch(() => {});
        await applyModAction(DB, BOT_TOKEN, fromId, "system", { action: "warn", scope: "bot", reason: `Blocked keyword: ${blockedKw}` }).catch(() => {});
        return c.json({ ok: true });
      }

      if (!isGroupMsg && msg.text && (msg.text.startsWith("/tagall") || msg.text.startsWith("/banall") || msg.text.startsWith("/silentban"))) {
        const isPrem = fromId === ADMIN_ID || !!(await d1First<{ id: number }>(DB,
          `SELECT id FROM premium_subscriptions WHERE telegram_id = ? AND status = 'active' AND expires_at > datetime('now') LIMIT 1`,
          [fromId],
        ).catch(() => null));
        if (!isPrem) {
          await sendMessage(BOT_TOKEN, msg.from.id,
            "⭐ *Premium Required*\n\nThis command requires a Premium subscription.\nOnly 250 Stars/month — open the app to subscribe!",
            { parse_mode: "Markdown", reply_markup: openAppMarkup(env, "Get Premium") },
          ).catch(() => {});
          return c.json({ ok: true });
        }
        const isAdminUser = fromId === ADMIN_ID;
        const pmText = msg.text;
        const cmd = pmText.startsWith("/tagall") ? "tagall" : pmText.startsWith("/banall") ? "banall" : "silentban";
        const chatIdStr = pmText.slice(`/${cmd}`.length).trim();
        if (!chatIdStr) {
          await sendMessage(BOT_TOKEN, msg.from.id, `Usage: /${cmd} <chat_id>`).catch(() => {});
          return c.json({ ok: true });
        }
        const chatRow = await d1First<{ added_by: string | null }>(DB, "SELECT added_by FROM group_chats WHERE chat_id = ?", [chatIdStr]).catch(() => null);
        if (!isAdminUser && chatRow?.added_by !== fromId) {
          await sendMessage(BOT_TOKEN, msg.from.id, "❌ You don't have permission to manage this chat.").catch(() => {});
          return c.json({ ok: true });
        }
        if (!isAdminUser && !(await isBotAdminInChat(BOT_TOKEN, chatIdStr))) {
          await sendMessage(BOT_TOKEN, msg.from.id, "❌ Bot is not an admin in this chat. Add the bot as admin first.").catch(() => {});
          return c.json({ ok: true });
        }
        if (!isAdminUser && !(await hasOwnSession(DB, fromId))) {
          await sendMessage(BOT_TOKEN, msg.from.id,
            "❌ You need to add your Telegram session in the Mini App (Settings) to use this feature.",
            { reply_markup: openAppMarkup(env, "Open Settings") },
          ).catch(() => {});
          return c.json({ ok: true });
        }
        const sessionUid = isAdminUser ? ADMIN_ID : fromId;
        const mtEnvPrem = { MTPROTO_BACKEND_URL, MTPROTO_API_KEY, adminTelegramId: sessionUid };
        if (cmd === "tagall") {
          const chunks = await buildTagAllChunks(DB, chatIdStr, mtEnvPrem);
          if (!chunks.length) {
            await sendMessage(BOT_TOKEN, msg.from.id, "ℹ️ No members to tag in this chat.").catch(() => {});
            return c.json({ ok: true });
          }
          for (const chunk of chunks) {
            await tgCall(BOT_TOKEN, "sendMessage", {
              chat_id: chatIdStr, text: chunk.text || "📢",
              entities: chunk.entities.length ? chunk.entities : undefined,
            }).catch(() => {});
          }
          await sendMessage(BOT_TOKEN, msg.from.id, `✅ Tag-all sent (${chunks.length} messages).`).catch(() => {});
        } else {
          const revokeMsg = cmd === "silentban";
          const candidates = await buildBanCandidates(DB, chatIdStr, fromId, ADMIN_ID, mtEnvPrem);
          if (!candidates.length) {
            await sendMessage(BOT_TOKEN, msg.from.id, "ℹ️ No members to ban in this chat.").catch(() => {});
            return c.json({ ok: true });
          }
          let banned = 0;
          const failed: string[] = [];
          for (const memberId of candidates) {
            const ok = await banChatMember(BOT_TOKEN, chatIdStr, memberId, revokeMsg).catch(() => false);
            if (ok) {
              banned++;
              await d1Run(DB, "UPDATE group_members SET status = 'kicked' WHERE chat_id = ? AND telegram_id = ?", [chatIdStr, String(memberId)]).catch(() => {});
            } else { failed.push(String(memberId)); }
          }
          const label = cmd === "silentban" ? "🔇 Silent Ban Complete" : "✅ Ban-all Complete";
          await sendMessage(BOT_TOKEN, msg.from.id,
            `${label}\n\nChat: <code>${chatIdStr}</code>\nBanned: ${banned}/${candidates.length}${revokeMsg ? "\nMessages deleted: yes" : ""}${failed.length ? `\nFailed: ${failed.slice(0, 10).join(", ")}${failed.length > 10 ? "..." : ""}` : ""}`,
            { parse_mode: "HTML" },
          ).catch(() => {});
        }
        return c.json({ ok: true });
      }

      const lc = msgText.toLowerCase();
      if (msg.text?.startsWith("/start")) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          `👋 *Welcome to Lifegram Bot!*\n\n🤖 *AI Chat Hub* — Chat with GPT-4o, Gemini, Claude & more (bring your own API keys)\n💬 *Live Support* — Direct messaging with the admin\n🌐 *Live Chat Widget* — Embed a chat widget on your website\n💰 *Donations* — Crypto (BTC, ETH, USDT) & Telegram Stars\n\n⭐ *Premium* (250 Stars/mo):\n📢 Tag All · 🚫 Ban All · 🔇 Silent Ban\n🌐 Remove widget watermark · 📱 Group tools\n\n⚡ Send a message to reach the admin, or open the app:`,
          { parse_mode: "Markdown", reply_markup: openAppMarkup(env, "Open App") },
        ).catch(() => {});
        return c.json({ ok: true });
      }
      if (msg.text?.startsWith("/donate")) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          `💰 *Donations*\n\nYou can donate via:\n• Crypto (USDT, BTC, ETH and more)\n• Telegram Stars\n\nOpen the app to get started!`,
          { parse_mode: "Markdown", reply_markup: openAppMarkup(env, "Donate") },
        ).catch(() => {});
        return c.json({ ok: true });
      }
      if (msg.text?.startsWith("/history")) {
        await sendMessage(BOT_TOKEN, msg.from.id, "📋 View your donation history in the app:", { reply_markup: openAppMarkup(env, "View History") }).catch(() => {});
        return c.json({ ok: true });
      }
      if (msg.text?.startsWith("/help")) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          "❓ *Help*\n\n/start — Welcome & overview\n/donate — Make a donation\n/history — View donation history\n/premium — Get Premium access\n\n🤖 *AI Chat* — Use GPT, Gemini, Claude in the app\n🌐 *Widget* — Embed live chat on your website\n⭐ *Premium* — Tag All, Ban All, Silent Ban, watermark-free widgets & more\n\nSend any message to reach the admin.",
          { parse_mode: "Markdown", reply_markup: openAppMarkup(env) },
        ).catch(() => {});
        return c.json({ ok: true });
      }
      if (msg.text?.startsWith("/premium")) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          "⭐ *Premium Access — 250 Stars/mo*\n\n📢 Tag All — mention every group member\n🚫 Ban All — remove all members instantly\n🔇 Silent Ban — stealth ban + delete messages\n🌐 Widget watermark removal — clean branding\n📱 Group management via Mini App\n🤖 AI Chat with 12+ models\n\nSubscribe in the app:",
          { parse_mode: "Markdown", reply_markup: openAppMarkup(env, "Get Premium") },
        ).catch(() => {});
        return c.json({ ok: true });
      }
      if (/\bprice\b|\bpricing\b|\bcost\b|\bhow much\b/.test(lc)) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          "💰 *Pricing*\n\n⭐ *Premium* — 250 Stars (~$5/month)\n• Group tools: Tag All, Ban All, Silent Ban\n• Widget watermark removal\n• Full AI Chat access\n\n💸 *Crypto donations* — any amount\n• BTC, ETH, USDT and more\n\nOpen the app to subscribe or donate:",
          { parse_mode: "Markdown", reply_markup: openAppMarkup(env, "Open App") },
        ).catch(() => {});
        return c.json({ ok: true });
      }
      if (/\bhelp\b|\bhow to\b|\bwhat can\b/.test(lc)) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          "❓ *Help*\n\n/start — Welcome & overview\n/donate — Crypto & Stars donations\n/history — Donation history\n/premium — Premium subscription\n\n🤖 AI Chat, 🌐 Widgets, 💬 Live Chat — all in the app.\nSend any message to reach the admin.",
          { parse_mode: "Markdown", reply_markup: openAppMarkup(env) },
        ).catch(() => {});
        return c.json({ ok: true });
      }
      if (/\bsupport\b|\bcontact\b|\badmin\b/.test(lc)) {
        await sendMessage(BOT_TOKEN, msg.from.id,
          "💬 *Support*\n\nType your question here — the admin will reply as soon as possible.\n\nYou can also use Live Chat in the app for real-time messaging.",
          { parse_mode: "Markdown", reply_markup: openAppMarkup(env, "Open App") },
        ).catch(() => {});
        return c.json({ ok: true });
      }
    }

    const userId = await upsertUser(DB, msg.from);
    const { type: mediaType, fileId } = detectMediaType(msg);
    let mediaUrl: string | null = null;
    if (fileId) mediaUrl = await handleMedia(DB, BOT_TOKEN, BUCKET, R2_PUBLIC_URL, fileId, mediaType, userId);
    await saveMessage(DB, userId, "user", msg.text ?? msg.caption ?? null, mediaType, mediaUrl, fileId, msg.message_id);
    ctx.waitUntil(updateAnalytics(DB, fromId).catch(() => {}));

    await setMessageReaction(BOT_TOKEN, msg.from.id, msg.message_id, [{ type: "emoji", emoji: "👀" }]).catch(() => {});
    const fwdResult = await tgCall(BOT_TOKEN, "forwardMessage", { from_chat_id: msg.from.id, chat_id: ADMIN_ID, message_id: msg.message_id }).catch(() => null) as { message_id?: number } | null;

    if (fwdResult?.message_id) {
      await d1Run(DB,
        "INSERT OR REPLACE INTO forwarded_messages (forwarded_msg_id, user_telegram_id) VALUES (?, ?)",
        [fwdResult.message_id, fromId],
      ).catch(() => {});
    }

    await sendChatAction(BOT_TOKEN, msg.from.id).catch(() => {});
    await sendMessage(BOT_TOKEN, msg.from.id, "Message received. The admin will reply soon.", { reply_markup: openAppMarkup(env) }).catch(() => {});
    console.log(`[webhook] forwarded to admin (fwd_msg_id=${fwdResult?.message_id}), confirmation sent to user ${fromId}`);
    return c.json({ ok: true });

  } catch (err) {
    console.error("[webhook] Unhandled error:", err);
    return c.json({ ok: true });
  }
});

export default webhook;
