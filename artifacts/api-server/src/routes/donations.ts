import { Router } from "express";
import { d1All, d1First, d1Run } from "../lib/d1.js";
import { validateTelegramInitData, isAdminId } from "../lib/auth.js";
import { getGroupParticipants } from "../lib/user-client.js";
import {
  sendMessage, sendChatAction, pinChatMessage,
  createInvoiceLink, MessageBuilder, tgCall,
  EFFECTS, BTN_EMOJI,
} from "../lib/telegram.js";

const router = Router();

const OXAPAY_V1 = "https://api.oxapay.com/v1";
const MERCHANT_KEY = process.env.OXAPAY_MERCHANT_KEY!;

// ─── Network/Currency mappings ────────────────────────────────────────────────

const CURRENCY_NETWORKS: Record<string, string[]> = {
  USDT:  ["TRC20", "BEP20", "ERC20", "TON", "SOL", "POL"],
  USDC:  ["ERC20", "BEP20", "SOL", "POL"],
  BNB:   ["BEP20"],
  SOL:   ["SOL"],
  TON:   ["TON"],
  BTC:   ["BTC"],
  ETH:   ["ERC20"],
  DOGE:  ["DOGE"],
  LTC:   ["LTC"],
  POL:   ["POL"],
  TRX:   ["TRC20"],
  SHIB:  ["ERC20"],
  XMR:   ["XMR"],
  DAI:   ["ERC20", "BEP20"],
  BCH:   ["BCH"],
  XRP:   ["XRP"],
  DOGS:  ["TON"],
  NOT:   ["TON"],
};

// Map OxaPay full network names back to short codes for display
const NETWORK_FULL_TO_SHORT: Record<string, string> = {
  "Tron Network":        "TRC20",
  "Ethereum Network":    "ERC20",
  "Binance Smart Chain": "BEP20",
  "Bitcoin Network":     "BTC",
  "Litecoin Network":    "LTC",
  "Dogecoin Network":    "DOGE",
  "Solana Network":      "SOL",
  "TON Network":         "TON",
  "Polygon Network":     "POL",
  "Monero Network":      "XMR",
  "Bitcoin Cash Network":"BCH",
  "XRP Network":         "XRP",
};

function normalizeNetworkName(full: string): string {
  return NETWORK_FULL_TO_SHORT[full] ?? full;
}

// ─── Status normalization ─────────────────────────────────────────────────────

function normalizeStatus(raw: string): string {
  const map: Record<string, string> = {
    waiting:    "pending",
    paying:     "confirming",
    paid:       "paid",
    expired:    "expired",
    failed:     "failed",
    cancelled:  "failed",
    canceled:   "failed",
    refunded:   "failed",
  };
  return map[raw.toLowerCase()] ?? raw.toLowerCase();
}

// ─── OxaPay v1 client ─────────────────────────────────────────────────────────

type OxaData = Record<string, unknown>;
type OxaResponse = { data?: OxaData; status: number; message?: string; error?: unknown };

const OXA_HEADERS = {
  "merchant_api_key": MERCHANT_KEY,
  "Content-Type": "application/json",
};

async function oxaGet(path: string, params: Record<string, string> = {}): Promise<OxaResponse> {
  const url = new URL(`${OXAPAY_V1}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  console.log(`[OxaPay v1] GET ${path}`, params);
  try {
    const res = await fetch(url.toString(), { headers: OXA_HEADERS });
    const data = await res.json() as OxaResponse;
    console.log(`[OxaPay v1] Response GET ${path}: status=${data.status}`);
    return data;
  } catch (err) {
    console.error(`[OxaPay v1] Network error GET ${path}:`, err);
    throw err;
  }
}

async function oxaPost(path: string, body: Record<string, unknown>): Promise<OxaResponse> {
  console.log(`[OxaPay v1] POST ${path}`, JSON.stringify(body));
  try {
    const res = await fetch(`${OXAPAY_V1}${path}`, {
      method: "POST",
      headers: OXA_HEADERS,
      body: JSON.stringify(body),
    });
    const data = await res.json() as OxaResponse;
    console.log(`[OxaPay v1] Response POST ${path}: status=${data.status}`, JSON.stringify(data.data ?? {}));
    return data;
  } catch (err) {
    console.error(`[OxaPay v1] Network error POST ${path}:`, err);
    throw err;
  }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function parseInitData(req: Parameters<Router>[0]): { telegramId: string; isAdmin: boolean } | null {
  const initData = req.headers["x-init-data"] as string | undefined;
  if (!initData) return null;
  const validated = validateTelegramInitData(initData);
  if (!validated) return null;
  const userStr = validated["user"];
  if (!userStr) return null;
  try {
    const user = JSON.parse(userStr) as { id: number };
    const telegramId = String(user.id);
    return { telegramId, isAdmin: isAdminId(telegramId) };
  } catch {
    return null;
  }
}

// Fixed production URLs — custom domains
const CALLBACK_URL = "https://mini.susagar.sbs/api/donate/callback";
const APP_BASE_URL = "https://mini.susagar.sbs/miniapp";

// Static address network name mapping (OxaPay format for static-address endpoint)
const SHORT_TO_OXA_NETWORK: Record<string, string> = {
  TRC20: "TRON",
  BEP20: "BSC",
  ERC20: "ETH",
  BTC:   "BTC",
  LTC:   "LTC",
  DOGE:  "DOGE",
  SOL:   "SOL",
  TON:   "TON",
  POL:   "POL",
  XMR:   "XMR",
  BCH:   "BCH",
  XRP:   "XRP",
};

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /donations/currencies — accepted currencies with network options
router.get("/donations/currencies", async (_req, res) => {
  try {
    const data = await oxaGet("/payment/accepted-currencies");
    const list = (data.data?.list as string[] | undefined) ?? [];
    const coins = list.map(symbol => ({
      symbol,
      networks: CURRENCY_NETWORKS[symbol] ?? [],
    }));
    res.json({ coins });
  } catch {
    res.status(500).json({ error: "Failed to fetch currencies" });
  }
});

// POST /donations/create — white-label invoice (returns address + pay_amount inline)
router.post("/donations/create", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { amount, pay_currency, network, description = "" } = req.body as {
    amount: number; pay_currency: string; network?: string; description?: string;
  };

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    res.status(400).json({ error: "Invalid amount" }); return;
  }
  if (!pay_currency) {
    res.status(400).json({ error: "pay_currency is required" }); return;
  }

  const userRow = await d1First<{ id: number }>("SELECT id FROM users WHERE telegram_id = ?", [auth.telegramId]);
  if (!userRow) { res.status(404).json({ error: "User not found — please send a message to the bot first." }); return; }

  const orderId = `inv-${auth.telegramId}-${Date.now()}`;

  let oxa: OxaResponse;
  try {
    oxa = await oxaPost("/payment/white-label", {
      amount: Number(amount),
      currency: "USD",
      pay_currency,
      ...(network ? { network } : {}),
      lifetime: 30,
      fee_paid_by_payer: 1,
      under_paid_coverage: 0,
      description: description || `Donation from ${auth.telegramId}`,
      order_id: orderId,
      callback_url: CALLBACK_URL,
      return_url: `${APP_BASE_URL}/donate`,
    });
  } catch {
    res.status(502).json({ error: "Payment provider unreachable. Try again." }); return;
  }

  if (oxa.status !== 200 || !oxa.data) {
    console.error("[donations/create] OxaPay rejected:", oxa);
    res.status(400).json({ error: (oxa.message as string) ?? `OxaPay error (status ${oxa.status})` }); return;
  }

  const d = oxa.data;
  const trackId = d.track_id as string;
  const address = d.address as string;
  const payAmount = d.pay_amount as number;
  const payCurrency = d.pay_currency as string;
  const networkFull = d.network as string;
  const networkShort = normalizeNetworkName(networkFull);
  const qrCode = d.qr_code as string | undefined;
  const expiredAt = d.expired_at as number;

  await d1Run(
    `INSERT INTO donations (user_id, order_id, amount, currency, pay_currency, pay_amount, network, address, status, track_id, qr_code, expired_at)
     VALUES (?, ?, ?, 'USD', ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [userRow.id, orderId, Number(amount), payCurrency, payAmount, networkShort, address, trackId, qrCode ?? null, expiredAt]
  );

  console.log(`[donations/create] Created: orderId=${orderId} trackId=${trackId} address=${address} amount=${payAmount} ${payCurrency}`);

  // ── Bot notification (Bot API 9.5: entities, date_time, style, emoji, effect, pin) ──
  try {
    const minsLeft  = Math.max(0, Math.round((expiredAt - Date.now() / 1000) / 60));
    const addrShort = address.length > 20
      ? `${address.slice(0, 10)}...${address.slice(-10)}`
      : address;

    // Feature: sendChatAction — show "typing..." before the invoice arrives
    await sendChatAction(auth.telegramId).catch(() => {});

    const mb = new MessageBuilder();
    mb.bold("Payment Invoice").add("\n\n");
    mb.add("Donate ").bold(`$${Number(amount).toFixed(2)} USD`).add("\n\n");
    mb.add("Amount: ").code(`${payAmount} ${payCurrency}`).add("\n");
    mb.add("Network: ").bold(networkShort).add("\n");
    mb.add("Address: ").code(addrShort).add("\n\n");
    mb.add("Expires: ").dateTime(`~${minsLeft} min`, expiredAt).add(" from now");

    // Feature: message_effect_id — confetti animation on the invoice notification
    const sent = await sendMessage(auth.telegramId, mb.text, {
      entities: mb.entities,
      message_effect_id: EFFECTS.confetti,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Open App",
              web_app: { url: `${APP_BASE_URL}/donate` },
              style: "primary",
              icon_custom_emoji_id: BTN_EMOJI.openApp,
            },
            {
              text: "Check Payment",
              callback_data: `pay_check:${trackId}`,
              style: "primary",
              icon_custom_emoji_id: BTN_EMOJI.checkPay,
            },
          ],
          [
            {
              text: "Copy Address",
              copy_text: { text: address },
              style: "success",
              icon_custom_emoji_id: BTN_EMOJI.copyAddr,
            },
          ],
        ],
      },
    }) as { message_id?: number } | undefined;

    // Feature: pinChatMessage — pin the invoice silently (no notification)
    if (sent?.message_id) {
      await pinChatMessage(auth.telegramId, sent.message_id, true).catch(() => {});
    }
  } catch (err) {
    console.error("[donations/create] Bot notification failed:", err);
  }

  res.json({
    ok: true,
    trackId,
    orderId,
    address,
    payAmount,
    payCurrency,
    network: networkShort,
    networkFull,
    qrCode,
    expiredAt,
    amount: Number(amount),
  });
});

// GET /donations/status/:trackId — poll live payment status from OxaPay
router.get("/donations/status/:trackId", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { trackId } = req.params;
  console.log(`[donations/status] trackId=${trackId}`);

  let oxa: OxaResponse;
  try {
    oxa = await oxaGet(`/payment/${trackId}`);
  } catch {
    res.status(502).json({ error: "Payment provider unreachable" }); return;
  }

  if (oxa.status !== 200 || !oxa.data) {
    res.status(400).json({ error: "Could not retrieve payment status" }); return;
  }

  const rawStatus = oxa.data.status as string;
  const normalized = normalizeStatus(rawStatus);

  await d1Run(
    "UPDATE donations SET status = ? WHERE track_id = ?",
    [normalized, trackId]
  );

  const donation = await d1First("SELECT * FROM donations WHERE track_id = ?", [trackId]);
  res.json({ ok: true, status: normalized, rawStatus, donation, oxaData: oxa.data });
});

// POST /donations/stars/create — create a Telegram Stars payment link
// 50 Stars ≈ $1 USD (official rate)
router.post("/donations/stars/create", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { amount } = req.body as { amount: number };
  if (!amount || isNaN(Number(amount)) || Number(amount) < 1) {
    res.status(400).json({ error: "Minimum $1.00 required" }); return;
  }

  const stars = Math.max(1, Math.round(Number(amount) * 50));
  const payload = `stars-${auth.telegramId}-${Number(amount).toFixed(2)}-${Date.now()}`;

  try {
    const invoiceLink = await createInvoiceLink({
      title: "Donation",
      description: `$${Number(amount).toFixed(2)} USD donation`,
      payload,
      currency: "XTR",
      prices: [{ label: "Donation", amount: stars }],
    });

    res.json({ ok: true, invoiceLink, stars, amount: Number(amount) });
  } catch (err) {
    console.error("[donations/stars/create] Error:", err);
    res.status(500).json({ error: "Failed to create Stars invoice" });
  }
});

// Shared OxaPay callback handler
async function handleOxaCallback(body: Record<string, unknown>, label: string): Promise<void> {
  const trackId = body.track_id as string | undefined;
  const orderId = body.order_id as string | undefined;
  const status = body.status as string | undefined;
  const type = body.type as string | undefined;

  console.log(`[${label}] Webhook type=${type} trackId=${trackId} orderId=${orderId} status=${status}`);

  if (!status) {
    console.warn(`[${label}] Missing status`);
    return;
  }

  const normalized = normalizeStatus(status);

  let updated = false;
  if (trackId) {
    const r = await d1Run("UPDATE donations SET status = ? WHERE track_id = ?", [normalized, trackId]);
    updated = (r.meta?.changes as number ?? 0) > 0;
  }
  if (!updated && orderId) {
    const r = await d1Run("UPDATE donations SET status = ? WHERE order_id = ?", [normalized, orderId]);
    updated = (r.meta?.changes as number ?? 0) > 0;
  }
  console.log(`[${label}] Updated DB: ${updated}, normalized status: ${normalized}`);
}

// POST /donate/callback — primary OxaPay webhook (https://areszyn.com/api/donate/callback)
router.post("/donate/callback", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  await handleOxaCallback(body, "donate/callback");
  res.json({ ok: true });
});

// POST /donations/callback — legacy alias kept for backwards compatibility
router.post("/donations/callback", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  await handleOxaCallback(body, "donations/callback");
  res.json({ ok: true });
});

// GET /donations/history — user's donation history
router.get("/donations/history", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userRow = await d1First<{ id: number }>("SELECT id FROM users WHERE telegram_id = ?", [auth.telegramId]);
  if (!userRow) { res.json([]); return; }
  const rows = await d1All(
    "SELECT * FROM donations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    [userRow.id]
  );
  res.json(rows);
});

// POST /donations/static-address — generate static address for a network
router.post("/donations/static-address", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { network } = req.body as { network: string };
  if (!network) { res.status(400).json({ error: "network is required" }); return; }

  const userRow = await d1First<{ id: number }>("SELECT id FROM users WHERE telegram_id = ?", [auth.telegramId]);
  if (!userRow) { res.status(404).json({ error: "User not found" }); return; }

  const existing = await d1First("SELECT * FROM static_addresses WHERE user_id = ? AND network = ?", [userRow.id, network]);
  if (existing) { res.json({ ok: true, address: existing }); return; }

  const orderId = `sa-${auth.telegramId}-${network}`;
  // OxaPay static-address endpoint uses different network format (TRON, BSC, ETH, etc.)
  const oxaNetwork = SHORT_TO_OXA_NETWORK[network] ?? network;

  let oxa: OxaResponse;
  try {
    oxa = await oxaPost("/payment/static-address", {
      network: oxaNetwork,
      callback_url: CALLBACK_URL,
      order_id: orderId,
      description: `Static address for user ${auth.telegramId} on ${network}`,
    });
  } catch {
    res.status(502).json({ error: "Payment provider unreachable" }); return;
  }

  if (oxa.status !== 200 || !oxa.data?.address) {
    console.error("[donations/static-address] OxaPay rejected:", oxa);
    res.status(400).json({ error: (oxa.message as string) ?? "Failed to generate address" }); return;
  }

  const d = oxa.data;
  const address = d.address as string;
  const networkFull = d.network as string;
  const networkShort = normalizeNetworkName(networkFull);
  const trackId = d.track_id as string;
  const qrCode = d.qr_code as string | undefined;
  const memo = d.memo as string | undefined;

  await d1Run(
    `INSERT OR IGNORE INTO static_addresses (user_id, address, network, track_id, qr_code, memo)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userRow.id, address, networkShort, trackId, qrCode ?? null, memo ?? null]
  );

  const saved = await d1First("SELECT * FROM static_addresses WHERE address = ?", [address]);
  res.json({ ok: true, address: saved });
});

// GET /donations/static-addresses — user's static addresses
router.get("/donations/static-addresses", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userRow = await d1First<{ id: number }>("SELECT id FROM users WHERE telegram_id = ?", [auth.telegramId]);
  if (!userRow) { res.json([]); return; }
  const addrs = await d1All(
    "SELECT * FROM static_addresses WHERE user_id = ? ORDER BY created_at DESC",
    [userRow.id]
  );
  res.json(addrs);
});

// DELETE /donations/static-address — revoke
router.delete("/donations/static-address", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { address } = req.body as { address: string };
  if (!address) { res.status(400).json({ error: "address required" }); return; }

  const userRow = await d1First<{ id: number }>("SELECT id FROM users WHERE telegram_id = ?", [auth.telegramId]);
  const addrRow = await d1First("SELECT * FROM static_addresses WHERE address = ? AND user_id = ?", [address, userRow?.id]);
  if (!addrRow) { res.status(404).json({ error: "Address not found" }); return; }

  let oxa: OxaResponse;
  try {
    oxa = await oxaPost("/payment/static-address/revoke", { address });
  } catch {
    res.status(502).json({ error: "Payment provider unreachable" }); return;
  }

  if (oxa.status !== 200) {
    res.status(400).json({ error: (oxa.message as string) ?? "Failed to revoke" }); return;
  }

  await d1Run("DELETE FROM static_addresses WHERE address = ?", [address]);
  res.json({ ok: true });
});

// ─── Admin routes ─────────────────────────────────────────────────────────────

router.get("/donations/admin/all", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const rows = await d1All(`
    SELECT d.*, u.first_name, u.username, u.telegram_id
    FROM donations d JOIN users u ON u.id = d.user_id
    ORDER BY d.created_at DESC LIMIT 200
  `);
  res.json(rows);
});

router.get("/donations/admin/static-addresses", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const rows = await d1All(`
    SELECT sa.*, u.first_name, u.username, u.telegram_id
    FROM static_addresses sa JOIN users u ON u.id = sa.user_id
    ORDER BY sa.created_at DESC
  `);
  res.json(rows);
});

// Admin: manually verify payment status
router.post("/donations/admin/verify", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const { trackId } = req.body as { trackId: string };
  if (!trackId) { res.status(400).json({ error: "trackId required" }); return; }

  let oxa: OxaResponse;
  try {
    oxa = await oxaGet(`/payment/${trackId}`);
  } catch {
    res.status(502).json({ error: "Payment provider unreachable" }); return;
  }

  if (oxa.status !== 200 || !oxa.data) {
    res.status(400).json({ error: "Could not retrieve payment status" }); return;
  }

  const rawStatus = oxa.data.status as string;
  const normalized = normalizeStatus(rawStatus);
  await d1Run("UPDATE donations SET status = ? WHERE track_id = ?", [normalized, trackId]);

  res.json({ ok: true, status: normalized, rawStatus, oxaData: oxa.data });
});

// ─── Premium subscription (Stars) ─────────────────────────────────────────────

/** GET /premium/status — returns active premium info for the current user */
router.get("/premium/status", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const row = await d1First<{ expires_at: string; stars_paid: number; created_at: string }>(
      `SELECT expires_at, stars_paid, created_at FROM premium_subscriptions
       WHERE telegram_id = ? AND status = 'active' AND expires_at > datetime('now')
       ORDER BY expires_at DESC LIMIT 1`,
      [auth.telegramId],
    );
    res.json({ ok: true, active: !!row, subscription: row ?? null });
  } catch {
    res.status(500).json({ error: "Failed to check premium" });
  }
});

/** POST /premium/create — creates a Stars invoice link for 250 Stars ($5, 30 days) */
router.post("/premium/create", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const stars = 250;
    const link = await createInvoiceLink({
      title: "⭐ Premium — 30-Day Pass",
      description: "Unlock group management: Tag All members, and more. Active for 30 days.",
      payload: `premium-${auth.telegramId}-30`,
      currency: "XTR",
      prices: [{ label: "Premium Access (30 days)", amount: stars }],
    });
    res.json({ ok: true, invoice_link: link, stars });
  } catch (err) {
    console.error("[premium/create]", err);
    res.status(500).json({ error: "Failed to create premium invoice" });
  }
});

// ─── Premium group actions (no command needed — triggered from mini app) ───────

/** GET /premium/groups — list all groups/channels where bot is admin */
router.get("/premium/groups", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    const chats = await d1All<{ chat_id: string; title: string; chat_type: string; member_count: number }>(
      `SELECT gc.chat_id, gc.title, gc.chat_type,
              COUNT(gm.telegram_id) AS member_count
         FROM group_chats gc
         LEFT JOIN group_members gm ON gm.chat_id = gc.chat_id AND gm.status NOT IN ('left','kicked')
        WHERE gc.bot_is_admin = 1
        GROUP BY gc.chat_id
        ORDER BY member_count DESC`,
      [],
    );
    res.json({ ok: true, chats });
  } catch (err) {
    console.error("[premium/groups]", err);
    res.status(500).json({ error: "Failed to load groups" });
  }
});

/** POST /premium/tag-all — premium user triggers tag-all for a given chat */
router.post("/premium/tag-all", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const uid = String(auth.telegramId);
  const isAdmin = uid === process.env.ADMIN_ID;
  const active = isAdmin || await (async () => {
    const row = await d1First<{ id: number }>(
      `SELECT id FROM premium_subscriptions WHERE telegram_id = ? AND status = 'active' AND expires_at > datetime('now') LIMIT 1`,
      [uid],
    );
    return !!row;
  })();
  if (!active) { res.status(403).json({ error: "Premium required" }); return; }

  const { chat_id } = req.body as { chat_id?: string };
  if (!chat_id) { res.status(400).json({ error: "chat_id required" }); return; }

  try {
    const { buildTagAllChunks } = await import("../lib/group.js");
    const chunks = await buildTagAllChunks(chat_id);
    let sent = 0;
    for (const chunk of chunks) {
      await tgCall("sendMessage", {
        chat_id: parseInt(chat_id, 10),
        text: chunk.text || "📢",
        entities: chunk.entities.length ? chunk.entities : undefined,
      }).catch(() => {});
      sent++;
    }
    res.json({ ok: true, chunks_sent: sent });
  } catch (err) {
    console.error("[premium/tag-all]", err);
    res.status(500).json({ error: "Failed to tag members" });
  }
});

/** POST /premium/ban-all — premium user triggers ban-all for a given chat */
router.post("/premium/ban-all", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const uid = String(auth.telegramId);
  const isAdmin = uid === process.env.ADMIN_ID;
  const active = isAdmin || await (async () => {
    const row = await d1First<{ id: number }>(
      `SELECT id FROM premium_subscriptions WHERE telegram_id = ? AND status = 'active' AND expires_at > datetime('now') LIMIT 1`,
      [uid],
    );
    return !!row;
  })();
  if (!active) { res.status(403).json({ error: "Premium required" }); return; }

  const { chat_id, revoke_messages = false } = req.body as { chat_id?: string; revoke_messages?: boolean };
  if (!chat_id) { res.status(400).json({ error: "chat_id required" }); return; }

  try {
    const { banChatMember } = await import("../lib/telegram.js");
    const seen = new Set<string>();
    const candidates: number[] = [];

    const addId = (id: string) => {
      if (id === uid || seen.has(id)) return;
      seen.add(id);
      const n = parseInt(id, 10);
      if (!isNaN(n)) candidates.push(n);
    };

    const mtparticipants = await getGroupParticipants(chat_id);
    for (const p of mtparticipants) addId(p.id);

    const [chatMembers, allUsers] = await Promise.all([
      d1All<{ telegram_id: string }>(
        `SELECT telegram_id FROM group_members WHERE chat_id = ? AND status NOT IN ('left','kicked')`,
        [chat_id],
      ).catch(() => [] as { telegram_id: string }[]),
      d1All<{ telegram_id: string }>(`SELECT telegram_id FROM users`).catch(() => [] as { telegram_id: string }[]),
    ]);
    for (const m of [...chatMembers, ...allUsers]) addId(m.telegram_id);

    let banned = 0;
    for (const memberId of candidates) {
      const ok = await banChatMember(parseInt(chat_id, 10), memberId, revoke_messages).catch(() => false);
      if (ok) {
        banned++;
        await d1Run(
          `UPDATE group_members SET status = 'kicked' WHERE chat_id = ? AND telegram_id = ?`,
          [chat_id, String(memberId)],
        ).catch(() => {});
      }
    }
    res.json({ ok: true, banned, total: candidates.length });
  } catch (err) {
    console.error("[premium/ban-all]", err);
    res.status(500).json({ error: "Failed to ban members" });
  }
});

export default router;

// ─── Exported helper for poller ───────────────────────────────────────────────

export async function pollPendingDonations(): Promise<void> {
  const pending = await d1All<{ track_id: string }>(
    `SELECT track_id FROM donations
     WHERE status IN ('pending', 'confirming')
       AND track_id IS NOT NULL
       AND created_at < datetime('now', '-2 minutes')
     LIMIT 50`
  );

  if (!pending.length) return;
  console.log(`[poller] Checking ${pending.length} pending donation(s)`);

  for (const row of pending) {
    try {
      const oxa = await oxaGet(`/payment/${row.track_id}`);
      if (oxa.status === 200 && oxa.data?.status) {
        const normalized = normalizeStatus(oxa.data.status as string);
        await d1Run("UPDATE donations SET status = ? WHERE track_id = ?", [normalized, row.track_id]);
        console.log(`[poller] Updated ${row.track_id} → ${normalized}`);
      }
    } catch (err) {
      console.error(`[poller] Failed to poll trackId=${row.track_id}:`, err);
    }
  }
}
