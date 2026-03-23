import { Hono } from "hono";
import type { Env } from "../types.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import { parseAuth } from "../lib/auth.ts";
import {
  sendMessage, sendChatAction, pinChatMessage,
  createInvoiceLink, MessageBuilder, tgCall,
  banChatMember, isBotAdminInChat,
  EFFECTS, BTN_EMOJI,
} from "../lib/telegram.ts";
import { hasAnySessions, hasOwnSession } from "../lib/user-client.ts";
import { buildTagAllChunks, buildBanCandidates } from "../lib/group.ts";

const donations = new Hono<{ Bindings: Env }>();

const OXAPAY_V1 = "https://api.oxapay.com/v1";

const CURRENCY_NETWORKS: Record<string, string[]> = {
  USDT: ["TRC20", "BEP20", "ERC20", "TON", "SOL", "POL"],
  USDC: ["ERC20", "BEP20", "SOL", "POL"],
  BNB:  ["BEP20"],
  SOL:  ["SOL"],
  TON:  ["TON"],
  BTC:  ["BTC"],
  ETH:  ["ERC20"],
  DOGE: ["DOGE"],
  LTC:  ["LTC"],
  POL:  ["POL"],
  TRX:  ["TRC20"],
  SHIB: ["ERC20"],
  XMR:  ["XMR"],
  DAI:  ["ERC20", "BEP20"],
  BCH:  ["BCH"],
  XRP:  ["XRP"],
  DOGS: ["TON"],
  NOT:  ["TON"],
};

const NETWORK_FULL_TO_SHORT: Record<string, string> = {
  "Tron Network":         "TRC20",
  "Ethereum Network":     "ERC20",
  "Binance Smart Chain":  "BEP20",
  "Bitcoin Network":      "BTC",
  "Litecoin Network":     "LTC",
  "Dogecoin Network":     "DOGE",
  "Solana Network":       "SOL",
  "TON Network":          "TON",
  "Polygon Network":      "POL",
  "Monero Network":       "XMR",
  "Bitcoin Cash Network": "BCH",
  "XRP Network":          "XRP",
};

const SHORT_TO_OXA_NETWORK: Record<string, string> = {
  TRC20: "TRON", BEP20: "BSC", ERC20: "ETH", BTC: "BTC",
  LTC: "LTC", DOGE: "DOGE", SOL: "SOL", TON: "TON",
  POL: "POL", XMR: "XMR", BCH: "BCH", XRP: "XRP",
};

function normalizeNetworkName(full: string): string {
  return NETWORK_FULL_TO_SHORT[full] ?? full;
}

function normalizeStatus(raw: string): string {
  const map: Record<string, string> = {
    waiting: "pending", paying: "confirming", paid: "paid",
    expired: "expired", failed: "failed", cancelled: "failed",
    canceled: "failed", refunded: "failed",
  };
  return map[raw.toLowerCase()] ?? raw.toLowerCase();
}

type OxaData = Record<string, unknown>;
type OxaResponse = { data?: OxaData; status: number; message?: string };

function oxaHeaders(merchantKey: string) {
  return { "merchant_api_key": merchantKey, "Content-Type": "application/json" };
}

async function oxaGet(merchantKey: string, path: string, params: Record<string, string> = {}): Promise<OxaResponse> {
  const url = new URL(`${OXAPAY_V1}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), { headers: oxaHeaders(merchantKey) });
  return res.json() as Promise<OxaResponse>;
}

async function oxaPost(merchantKey: string, path: string, body: Record<string, unknown>): Promise<OxaResponse> {
  const res = await fetch(`${OXAPAY_V1}${path}`, {
    method: "POST",
    headers: oxaHeaders(merchantKey),
    body: JSON.stringify(body),
  });
  return res.json() as Promise<OxaResponse>;
}

function openAppMarkup(env: Env, label = "Open App") {
  return { inline_keyboard: [[{ text: label, web_app: { url: env.MINIAPP_URL } }]] };
}

donations.get("/donations/currencies", async (c) => {
  try {
    const data = await oxaGet(c.env.OXAPAY_MERCHANT_KEY, "/payment/accepted-currencies");
    const list = (data.data?.list as string[] | undefined) ?? [];
    const coins = list.map(symbol => ({ symbol, networks: CURRENCY_NETWORKS[symbol] ?? [] }));
    return c.json({ coins });
  } catch {
    return c.json({ error: "Failed to fetch currencies" }, 500);
  }
});

donations.post("/donations/create", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { amount, pay_currency, network, description = "" } =
    await c.req.json<{ amount: number; pay_currency: string; network?: string; description?: string }>();

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return c.json({ error: "Invalid amount" }, 400);
  if (!pay_currency) return c.json({ error: "pay_currency is required" }, 400);

  const userRow = await d1First<{ id: number }>(c.env.DB, "SELECT id FROM users WHERE telegram_id = ?", [auth.telegramId]);
  if (!userRow) return c.json({ error: "User not found — please send a message to the bot first." }, 404);

  const orderId = `inv-${auth.telegramId}-${Date.now()}`;
  let oxa: OxaResponse;
  try {
    oxa = await oxaPost(c.env.OXAPAY_MERCHANT_KEY, "/payment/white-label", {
      amount: Number(amount), currency: "USD", pay_currency,
      ...(network ? { network } : {}),
      lifetime: 30, fee_paid_by_payer: 1, under_paid_coverage: 0,
      description: description || `Donation from ${auth.telegramId}`,
      order_id: orderId, callback_url: `https://${c.env.APP_DOMAIN}/api/donate/callback`,
      return_url: `${c.env.MINIAPP_URL}donate`,
    });
  } catch {
    return c.json({ error: "Payment provider unreachable. Try again." }, 502);
  }

  if (oxa.status !== 200 || !oxa.data) {
    return c.json({ error: (oxa.message) ?? `OxaPay error (status ${oxa.status})` }, 400);
  }

  const d = oxa.data;
  const trackId     = d.track_id as string;
  const address     = d.address as string;
  const payAmount   = d.pay_amount as number;
  const payCurrency = d.pay_currency as string;
  const networkFull = d.network as string;
  const networkShort = normalizeNetworkName(networkFull);
  const qrCode      = d.qr_code as string | undefined;
  const expiredAt   = d.expired_at as number;

  await d1Run(c.env.DB,
    `INSERT INTO donations (user_id, order_id, amount, currency, pay_currency, pay_amount, network, address, status, track_id, qr_code, expired_at)
     VALUES (?, ?, ?, 'USD', ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [userRow.id, orderId, Number(amount), payCurrency, payAmount, networkShort, address, trackId, qrCode ?? null, expiredAt],
  );

  try {
    const minsLeft  = Math.max(0, Math.round((expiredAt - Date.now() / 1000) / 60));
    const addrShort = address.length > 20 ? `${address.slice(0, 10)}...${address.slice(-10)}` : address;
    await sendChatAction(c.env.BOT_TOKEN, auth.telegramId).catch(() => {});
    const mb = new MessageBuilder();
    mb.bold("Payment Invoice").add("\n\n");
    mb.add("Donate ").bold(`$${Number(amount).toFixed(2)} USD`).add("\n\n");
    mb.add("Amount: ").code(`${payAmount} ${payCurrency}`).add("\n");
    mb.add("Network: ").bold(networkShort).add("\n");
    mb.add("Address: ").code(addrShort).add("\n\n");
    mb.add("Expires: ").dateTime(`~${minsLeft} min`, expiredAt).add(" from now");
    const sent = await sendMessage(c.env.BOT_TOKEN, auth.telegramId, mb.text, {
      entities: mb.entities,
      message_effect_id: EFFECTS.confetti,
      reply_markup: {
        inline_keyboard: [
          [{
            text: "Open App", web_app: { url: `${c.env.MINIAPP_URL}donate` },
            style: "primary", icon_custom_emoji_id: BTN_EMOJI.openApp,
          }, {
            text: "Check Payment", callback_data: `pay_check:${trackId}`,
            style: "primary", icon_custom_emoji_id: BTN_EMOJI.checkPay,
          }],
          [{ text: "Copy Address", copy_text: { text: address }, style: "success", icon_custom_emoji_id: BTN_EMOJI.copyAddr }],
        ],
      },
    }) as { message_id?: number } | undefined;
    if (sent?.message_id) await pinChatMessage(c.env.BOT_TOKEN, auth.telegramId, sent.message_id, true).catch(() => {});
  } catch (err) {
    console.error("[donations/create] Bot notification failed:", err);
  }

  return c.json({ ok: true, trackId, orderId, address, payAmount, payCurrency, network: networkShort, networkFull, qrCode, expiredAt, amount: Number(amount) });
});

donations.get("/donations/status/:trackId", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { trackId } = c.req.param();
  let oxa: OxaResponse;
  try {
    oxa = await oxaGet(c.env.OXAPAY_MERCHANT_KEY, `/payment/${trackId}`);
  } catch {
    return c.json({ error: "Payment provider unreachable" }, 502);
  }
  if (oxa.status !== 200 || !oxa.data) return c.json({ error: "Could not retrieve payment status" }, 400);
  const rawStatus  = oxa.data.status as string;
  const normalized = normalizeStatus(rawStatus);
  await d1Run(c.env.DB, "UPDATE donations SET status = ? WHERE track_id = ?", [normalized, trackId]);
  const donation = await d1First(c.env.DB, "SELECT * FROM donations WHERE track_id = ?", [trackId]);
  return c.json({ ok: true, status: normalized, rawStatus, donation, oxaData: oxa.data });
});

donations.post("/donations/stars/create", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { amount } = await c.req.json<{ amount: number }>();
  if (!amount || isNaN(Number(amount)) || Number(amount) < 1) return c.json({ error: "Minimum $1.00 required" }, 400);
  const stars   = Math.max(1, Math.round(Number(amount) * 50));
  const payload = `stars-${auth.telegramId}-${Number(amount).toFixed(2)}-${Date.now()}`;
  try {
    const invoiceLink = await createInvoiceLink(c.env.BOT_TOKEN, {
      title: "Donation", description: `$${Number(amount).toFixed(2)} USD donation`,
      payload, currency: "XTR", prices: [{ label: "Donation", amount: stars }],
    });
    return c.json({ ok: true, invoiceLink, stars, amount: Number(amount) });
  } catch (err) {
    console.error("[donations/stars/create]", err);
    return c.json({ error: "Failed to create Stars invoice" }, 500);
  }
});

async function handleOxaCallback(db: D1Database, body: Record<string, unknown>, label: string): Promise<void> {
  const trackId  = body.track_id as string | undefined;
  const orderId  = body.order_id as string | undefined;
  const status   = body.status as string | undefined;
  if (!status) return;
  const normalized = normalizeStatus(status);
  if (trackId) {
    await d1Run(db, "UPDATE donations SET status = ? WHERE track_id = ?", [normalized, trackId]).catch(() => {});
  } else if (orderId) {
    await d1Run(db, "UPDATE donations SET status = ? WHERE order_id = ?", [normalized, orderId]).catch(() => {});
  }
  console.log(`[${label}] status=${normalized} trackId=${trackId ?? "?"} orderId=${orderId ?? "?"}`);
}

donations.post("/donate/callback", async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  await handleOxaCallback(c.env.DB, body, "donate/callback");
  return c.json({ ok: true });
});

donations.post("/donations/callback", async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  await handleOxaCallback(c.env.DB, body, "donations/callback");
  return c.json({ ok: true });
});

donations.get("/donations/history", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const userRow = await d1First<{ id: number }>(c.env.DB, "SELECT id FROM users WHERE telegram_id = ?", [auth.telegramId]);
  if (!userRow) return c.json([]);
  const rows = await d1All(c.env.DB, "SELECT * FROM donations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50", [userRow.id]);
  return c.json(rows);
});

donations.post("/donations/static-address", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { network } = await c.req.json<{ network: string }>();
  if (!network) return c.json({ error: "network is required" }, 400);
  const userRow = await d1First<{ id: number }>(c.env.DB, "SELECT id FROM users WHERE telegram_id = ?", [auth.telegramId]);
  if (!userRow) return c.json({ error: "User not found" }, 404);
  const existing = await d1First(c.env.DB, "SELECT * FROM static_addresses WHERE user_id = ? AND network = ?", [userRow.id, network]);
  if (existing) return c.json({ ok: true, address: existing });
  const orderId    = `sa-${auth.telegramId}-${network}`;
  const oxaNetwork = SHORT_TO_OXA_NETWORK[network] ?? network;
  let oxa: OxaResponse;
  try {
    oxa = await oxaPost(c.env.OXAPAY_MERCHANT_KEY, "/payment/static-address", {
      network: oxaNetwork, callback_url: `https://${c.env.APP_DOMAIN}/api/donate/callback`,
      order_id: orderId, description: `Static address for user ${auth.telegramId} on ${network}`,
    });
  } catch {
    return c.json({ error: "Payment provider unreachable" }, 502);
  }
  if (oxa.status !== 200 || !oxa.data?.address) return c.json({ error: (oxa.message) ?? "Failed to generate address" }, 400);
  const d = oxa.data;
  const address      = d.address as string;
  const networkFull  = d.network as string;
  const networkShort = normalizeNetworkName(networkFull);
  const trackId      = d.track_id as string;
  const qrCode       = d.qr_code as string | undefined;
  const memo         = d.memo as string | undefined;
  await d1Run(c.env.DB,
    "INSERT OR IGNORE INTO static_addresses (user_id, address, network, track_id, qr_code, memo) VALUES (?, ?, ?, ?, ?, ?)",
    [userRow.id, address, networkShort, trackId, qrCode ?? null, memo ?? null],
  );
  const saved = await d1First(c.env.DB, "SELECT * FROM static_addresses WHERE address = ?", [address]);
  return c.json({ ok: true, address: saved });
});

donations.get("/donations/static-addresses", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const userRow = await d1First<{ id: number }>(c.env.DB, "SELECT id FROM users WHERE telegram_id = ?", [auth.telegramId]);
  if (!userRow) return c.json([]);
  const addrs = await d1All(c.env.DB, "SELECT * FROM static_addresses WHERE user_id = ? ORDER BY created_at DESC", [userRow.id]);
  return c.json(addrs);
});

donations.delete("/donations/static-address", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { address } = await c.req.json<{ address: string }>();
  if (!address) return c.json({ error: "address required" }, 400);
  const userRow = await d1First<{ id: number }>(c.env.DB, "SELECT id FROM users WHERE telegram_id = ?", [auth.telegramId]);
  const addrRow = await d1First(c.env.DB, "SELECT * FROM static_addresses WHERE address = ? AND user_id = ?", [address, userRow?.id]);
  if (!addrRow) return c.json({ error: "Address not found" }, 404);
  let oxa: OxaResponse;
  try {
    oxa = await oxaPost(c.env.OXAPAY_MERCHANT_KEY, "/payment/static-address/revoke", { address });
  } catch {
    return c.json({ error: "Payment provider unreachable" }, 502);
  }
  if (oxa.status !== 200) return c.json({ error: (oxa.message) ?? "Failed to revoke" }, 400);
  await d1Run(c.env.DB, "DELETE FROM static_addresses WHERE address = ?", [address]);
  return c.json({ ok: true });
});

donations.get("/donations/admin/all", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Forbidden" }, 403);
  const rows = await d1All(c.env.DB, `
    SELECT d.*, u.first_name, u.username, u.telegram_id
    FROM donations d JOIN users u ON u.id = d.user_id
    ORDER BY d.created_at DESC LIMIT 200
  `);
  return c.json(rows);
});

donations.get("/donations/admin/static-addresses", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Forbidden" }, 403);
  const rows = await d1All(c.env.DB, `
    SELECT sa.*, u.first_name, u.username, u.telegram_id
    FROM static_addresses sa JOIN users u ON u.id = sa.user_id
    ORDER BY sa.created_at DESC
  `);
  return c.json(rows);
});

donations.post("/donations/admin/verify", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Forbidden" }, 403);
  const { trackId } = await c.req.json<{ trackId: string }>();
  if (!trackId) return c.json({ error: "trackId required" }, 400);
  let oxa: OxaResponse;
  try {
    oxa = await oxaGet(c.env.OXAPAY_MERCHANT_KEY, `/payment/${trackId}`);
  } catch {
    return c.json({ error: "Payment provider unreachable" }, 502);
  }
  if (oxa.status !== 200 || !oxa.data) return c.json({ error: "Could not retrieve payment status" }, 400);
  const rawStatus  = oxa.data.status as string;
  const normalized = normalizeStatus(rawStatus);
  await d1Run(c.env.DB, "UPDATE donations SET status = ? WHERE track_id = ?", [normalized, trackId]);
  return c.json({ ok: true, status: normalized, rawStatus, oxaData: oxa.data });
});

async function isPremiumActive(db: D1Database, telegramId: string, adminId: string): Promise<boolean> {
  if (telegramId === adminId) return true;
  const row = await d1First<{ id: number }>(db,
    `SELECT id FROM premium_subscriptions WHERE telegram_id = ? AND status = 'active' AND expires_at > datetime('now') LIMIT 1`,
    [telegramId],
  ).catch(() => null);
  return !!row;
}

async function checkChatPermission(
  db: D1Database,
  chatId: string,
  uid: string,
  adminId: string,
): Promise<{ allowed: boolean; addedBy: string | null }> {
  if (uid === adminId) return { allowed: true, addedBy: null };
  const row = await d1First<{ added_by: string | null }>(db,
    "SELECT added_by FROM group_chats WHERE chat_id = ?",
    [chatId],
  ).catch(() => null);
  const addedBy = row?.added_by ?? null;
  return { allowed: addedBy === uid, addedBy };
}

donations.get("/premium/status", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  try {
    const row = await d1First<{ expires_at: string; stars_paid: number; created_at: string }>(c.env.DB,
      `SELECT expires_at, stars_paid, created_at FROM premium_subscriptions
       WHERE telegram_id = ? AND status = 'active' AND expires_at > datetime('now')
       ORDER BY expires_at DESC LIMIT 1`,
      [auth.telegramId],
    );
    return c.json({ ok: true, active: !!row, subscription: row ?? null });
  } catch {
    return c.json({ error: "Failed to check premium" }, 500);
  }
});

donations.post("/premium/create", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  try {
    const stars = 250;
    const link = await createInvoiceLink(c.env.BOT_TOKEN, {
      subscription_period: 2592000,
      title: "⭐ Premium — 30-Day Pass",
      description: "Unlock Tag All, Ban All, Silent Ban, and Group Tools via Mini App. Active for 30 days.",
      payload: `premium-${auth.telegramId}-30`,
      currency: "XTR",
      prices: [{ label: "Premium Access (30 days)", amount: stars }],
    });
    return c.json({ ok: true, invoice_link: link, stars });
  } catch (err) {
    console.error("[premium/create]", err);
    return c.json({ error: "Failed to create premium invoice" }, 500);
  }
});

donations.get("/premium/groups", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const uid = auth.telegramId;
  const isAdmin = uid === c.env.ADMIN_ID;
  try {
    const chats = isAdmin
      ? await d1All<{ chat_id: string; title: string; chat_type: string; member_count: number; added_by: string | null; bot_is_admin: number }>(c.env.DB,
          `SELECT gc.chat_id, gc.title, gc.type AS chat_type, gc.added_by, gc.bot_is_admin,
                  COUNT(gm.telegram_id) AS member_count
             FROM group_chats gc
             LEFT JOIN group_members gm ON gm.chat_id = gc.chat_id AND gm.status NOT IN ('left','kicked')
            GROUP BY gc.chat_id
            ORDER BY gc.bot_is_admin DESC, member_count DESC`,
        )
      : await d1All<{ chat_id: string; title: string; chat_type: string; member_count: number; added_by: string | null; bot_is_admin: number }>(c.env.DB,
          `SELECT gc.chat_id, gc.title, gc.type AS chat_type, gc.added_by, gc.bot_is_admin,
                  COUNT(gm.telegram_id) AS member_count
             FROM group_chats gc
             LEFT JOIN group_members gm ON gm.chat_id = gc.chat_id AND gm.status NOT IN ('left','kicked')
            WHERE gc.added_by = ?
            GROUP BY gc.chat_id
            ORDER BY gc.bot_is_admin DESC, member_count DESC`,
          [uid],
        );
    const hasSession = isAdmin
      ? await hasAnySessions(c.env.DB)
      : await hasOwnSession(c.env.DB, uid);
    return c.json({ ok: true, chats, has_session: hasSession });
  } catch (err) {
    console.error("[premium/groups]", err);
    return c.json({ error: "Failed to load groups" }, 500);
  }
});

donations.post("/premium/tag-all", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const uid = auth.telegramId;
  const isAdmin = uid === c.env.ADMIN_ID;
  if (!(await isPremiumActive(c.env.DB, uid, c.env.ADMIN_ID))) {
    return c.json({ error: "Premium required" }, 403);
  }
  const { chat_id } = await c.req.json<{ chat_id?: string }>();
  if (!chat_id) return c.json({ error: "chat_id required" }, 400);
  const perm = await checkChatPermission(c.env.DB, chat_id, uid, c.env.ADMIN_ID);
  if (!perm.allowed) {
    return c.json({ error: "You don't have permission to manage this chat." }, 403);
  }
  if (!isAdmin && !(await isBotAdminInChat(c.env.BOT_TOKEN, chat_id))) {
    return c.json({ error: "Bot is not an admin in this chat. Add the bot as admin first." }, 403);
  }
  const sessionUid = isAdmin ? c.env.ADMIN_ID : uid;
  if (!isAdmin && !(await hasOwnSession(c.env.DB, uid))) {
    return c.json({ error: "You need to add your Telegram session in Settings to use this feature." }, 403);
  }
  try {
    const env = { MTPROTO_BACKEND_URL: c.env.MTPROTO_BACKEND_URL, MTPROTO_API_KEY: c.env.MTPROTO_API_KEY, adminTelegramId: sessionUid };
    const chunks = await buildTagAllChunks(c.env.DB, chat_id, env);
    if (!chunks.length) {
      return c.json({ ok: true, chunks_sent: 0, message: "No members to tag in this chat." });
    }
    let sent = 0;
    for (const chunk of chunks) {
      await tgCall(c.env.BOT_TOKEN, "sendMessage", {
        chat_id, text: chunk.text || "📢",
        entities: chunk.entities.length ? chunk.entities : undefined,
      }).catch(() => {});
      sent++;
    }
    return c.json({ ok: true, chunks_sent: sent });
  } catch (err) {
    console.error("[premium/tag-all]", err);
    return c.json({ error: "Failed to tag members" }, 500);
  }
});

donations.post("/premium/ban-all", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const uid = auth.telegramId;
  const isAdmin = uid === c.env.ADMIN_ID;
  if (!(await isPremiumActive(c.env.DB, uid, c.env.ADMIN_ID))) {
    return c.json({ error: "Premium required" }, 403);
  }
  const { chat_id, revoke_messages = false } = await c.req.json<{ chat_id?: string; revoke_messages?: boolean }>();
  if (!chat_id) return c.json({ error: "chat_id required" }, 400);
  const perm = await checkChatPermission(c.env.DB, chat_id, uid, c.env.ADMIN_ID);
  if (!perm.allowed) {
    return c.json({ error: "You don't have permission to manage this chat." }, 403);
  }
  if (!isAdmin && !(await isBotAdminInChat(c.env.BOT_TOKEN, chat_id))) {
    return c.json({ error: "Bot is not an admin in this chat. Add the bot as admin first." }, 403);
  }
  if (!isAdmin && !(await hasOwnSession(c.env.DB, uid))) {
    return c.json({ error: "You need to add your Telegram session in Settings to use this feature." }, 403);
  }
  const sessionUid = isAdmin ? c.env.ADMIN_ID : uid;
  try {
    const env = { MTPROTO_BACKEND_URL: c.env.MTPROTO_BACKEND_URL, MTPROTO_API_KEY: c.env.MTPROTO_API_KEY, adminTelegramId: sessionUid };
    const candidates = await buildBanCandidates(c.env.DB, chat_id, uid, c.env.ADMIN_ID, env);
    if (!candidates.length) {
      return c.json({ ok: true, banned: 0, total: 0, message: "No members to ban in this chat." });
    }
    let banned = 0;
    for (const memberId of candidates) {
      const ok = await banChatMember(c.env.BOT_TOKEN, chat_id, memberId, revoke_messages).catch(() => false);
      if (ok) {
        banned++;
        await d1Run(c.env.DB, "UPDATE group_members SET status = 'kicked' WHERE chat_id = ? AND telegram_id = ?", [chat_id, String(memberId)]).catch(() => {});
      }
    }
    return c.json({ ok: true, banned, total: candidates.length });
  } catch (err) {
    console.error("[premium/ban-all]", err);
    return c.json({ error: "Failed to ban members" }, 500);
  }
});

donations.post("/premium/silent-ban", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const uid = auth.telegramId;
  const isAdmin = uid === c.env.ADMIN_ID;
  if (!(await isPremiumActive(c.env.DB, uid, c.env.ADMIN_ID))) {
    return c.json({ error: "Premium required" }, 403);
  }
  const { chat_id } = await c.req.json<{ chat_id?: string }>();
  if (!chat_id) return c.json({ error: "chat_id required" }, 400);
  const perm = await checkChatPermission(c.env.DB, chat_id, uid, c.env.ADMIN_ID);
  if (!perm.allowed) {
    return c.json({ error: "You don't have permission to manage this chat." }, 403);
  }
  if (!isAdmin && !(await isBotAdminInChat(c.env.BOT_TOKEN, chat_id))) {
    return c.json({ error: "Bot is not an admin in this chat. Add the bot as admin first." }, 403);
  }
  if (!isAdmin && !(await hasOwnSession(c.env.DB, uid))) {
    return c.json({ error: "You need to add your Telegram session in Settings to use this feature." }, 403);
  }
  const sessionUid = isAdmin ? c.env.ADMIN_ID : uid;
  try {
    const env = { MTPROTO_BACKEND_URL: c.env.MTPROTO_BACKEND_URL, MTPROTO_API_KEY: c.env.MTPROTO_API_KEY, adminTelegramId: sessionUid };
    const candidates = await buildBanCandidates(c.env.DB, chat_id, uid, c.env.ADMIN_ID, env);
    if (!candidates.length) {
      return c.json({ ok: true, banned: 0, total: 0, message: "No members to ban in this chat." });
    }
    let banned = 0;
    const failed: string[] = [];
    for (const memberId of candidates) {
      const ok = await banChatMember(c.env.BOT_TOKEN, chat_id, memberId, true).catch(() => false);
      if (ok) {
        banned++;
        await d1Run(c.env.DB, "UPDATE group_members SET status = 'kicked' WHERE chat_id = ? AND telegram_id = ?", [chat_id, String(memberId)]).catch(() => {});
      } else {
        failed.push(String(memberId));
      }
    }
    await sendMessage(c.env.BOT_TOKEN, uid,
      `🔇 <b>Silent Ban Complete</b>\n\nChat: <code>${chat_id}</code>\nBanned: ${banned}/${candidates.length}\nMessages deleted: yes${failed.length ? `\nFailed: ${failed.slice(0, 10).join(", ")}${failed.length > 10 ? "..." : ""}` : ""}`,
      { parse_mode: "HTML" },
    ).catch(() => {});
    return c.json({ ok: true, banned, total: candidates.length, failed: failed.length });
  } catch (err) {
    console.error("[premium/silent-ban]", err);
    return c.json({ error: "Failed to silent ban members" }, 500);
  }
});

export default donations;

export async function pollPendingDonations(db: D1Database, merchantKey: string): Promise<void> {
  const pending = await d1All<{ track_id: string }>(db,
    `SELECT track_id FROM donations
     WHERE status IN ('pending', 'confirming')
       AND track_id IS NOT NULL
       AND created_at < datetime('now', '-2 minutes')
     LIMIT 50`,
  );
  if (!pending.length) return;
  console.log(`[poller] Checking ${pending.length} pending donation(s)`);
  for (const row of pending) {
    try {
      const oxa = await oxaGet(merchantKey, `/payment/${row.track_id}`);
      if (oxa.status === 200 && oxa.data?.status) {
        const normalized = normalizeStatus(oxa.data.status as string);
        await d1Run(db, "UPDATE donations SET status = ? WHERE track_id = ?", [normalized, row.track_id]);
      }
    } catch (e) {
      console.error("[poller]", row.track_id, e);
    }
  }
}
