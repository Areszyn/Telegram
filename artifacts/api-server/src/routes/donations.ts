import { Router } from "express";
import { d1All, d1First, d1Run } from "../lib/d1.js";
import { validateTelegramInitData, requireAdmin } from "../lib/auth.js";

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
    return { telegramId, isAdmin: requireAdmin(telegramId) };
  } catch {
    return null;
  }
}

// Fixed production URLs — custom domains
const CALLBACK_URL = "https://areszyn.com/api/donate/callback";
const APP_BASE_URL = "https://mini.susagar.sbs";

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
