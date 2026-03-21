import { Router } from "express";
import { d1All, d1First, d1Run } from "../lib/d1.js";
import { validateTelegramInitData, requireAdmin } from "../lib/auth.js";

const router = Router();

const OXAPAY_BASE = "https://api.oxapay.com";
const MERCHANT_KEY = process.env.OXAPAY_MERCHANT_KEY!;

// ─── Domain helpers ──────────────────────────────────────────────────────────

function getApiBase(): string {
  const allDomains = (process.env.REPLIT_DOMAINS ?? "").split(",").map(d => d.trim()).filter(Boolean);
  const prodDomain = allDomains.find(d => d.endsWith(".replit.app"));
  const domain = prodDomain ?? process.env.REPLIT_DEV_DOMAIN ?? "";
  return `https://${domain}/api`;
}

function getAppBase(): string {
  const allDomains = (process.env.REPLIT_DOMAINS ?? "").split(",").map(d => d.trim()).filter(Boolean);
  const prodDomain = allDomains.find(d => d.endsWith(".replit.app"));
  const domain = prodDomain ?? process.env.REPLIT_DEV_DOMAIN ?? "";
  return `https://${domain}/miniapp`;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

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

// ─── OxaPay client ───────────────────────────────────────────────────────────

/**
 * Maps OxaPay PascalCase status → our DB lowercase status
 * OxaPay statuses: Waiting | Paid | Confirming | Expired | Failed | Refunded
 */
function normalizeStatus(raw: string): string {
  const map: Record<string, string> = {
    waiting:    "pending",
    paid:       "paid",
    confirming: "confirming",
    expired:    "expired",
    failed:     "failed",
    refunded:   "failed",
  };
  return map[raw.toLowerCase()] ?? raw.toLowerCase();
}

type OxaResponse = Record<string, unknown>;

async function oxaPost(path: string, body: Record<string, unknown>): Promise<OxaResponse> {
  const payload = { merchant: MERCHANT_KEY, ...body };
  console.log(`[OxaPay] POST ${path}`, JSON.stringify({ ...payload, merchant: "***" }));
  try {
    const res = await fetch(`${OXAPAY_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as OxaResponse;
    console.log(`[OxaPay] Response ${path}:`, JSON.stringify(data));
    return data;
  } catch (err) {
    console.error(`[OxaPay] Network error ${path}:`, err);
    throw err;
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /donations/currencies
router.get("/donations/currencies", async (_req, res) => {
  try {
    const data = await oxaPost("/merchants/allowedCoins", {});
    res.json(data);
  } catch {
    res.status(500).json({ error: "Failed to fetch currencies" });
  }
});

// POST /donations/create
router.post("/donations/create", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { amount, currency = "USDT", description = "" } = req.body as {
    amount: number; currency?: string; description?: string;
  };

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  const userRow = await d1First<{ id: number }>(
    "SELECT id FROM users WHERE telegram_id = ?",
    [auth.telegramId]
  );
  if (!userRow) { res.status(404).json({ error: "User not found. Please send a message to the bot first." }); return; }

  const orderId = `${auth.telegramId}-${Date.now()}`;

  // Prevent duplicate in-flight orders (unlikely but safe)
  const existing = await d1First(
    "SELECT id, track_id, pay_link, status FROM donations WHERE order_id = ?",
    [orderId]
  );
  if (existing) {
    console.log(`[donations/create] Returning existing order ${orderId}`);
    res.json({ ok: true, trackId: existing.track_id, payLink: existing.pay_link, status: existing.status });
    return;
  }

  const apiBase = getApiBase();
  const appBase = getAppBase();

  let oxaData: OxaResponse;
  try {
    oxaData = await oxaPost("/merchants/request/whitelabel", {
      amount: Number(amount),
      currency,
      lifeTime: 30,            // 30 minutes
      feePaidByPayer: 0,
      underPaidCover: 2,
      description: description || `Donation from ${auth.telegramId}`,
      orderId,
      callbackUrl: `${apiBase}/donations/callback`,
      returnUrl: `${appBase}/donate`,
      thanksUrl: `${appBase}/donate?paid=1`,
    });
  } catch (err: any) {
    console.error("[donations/create] OxaPay request failed:", err);
    res.status(502).json({ error: "Payment provider unreachable. Try again." });
    return;
  }

  const result = oxaData.result as number;
  const trackId = oxaData.trackId as string | undefined;
  const payLink = oxaData.payLink as string | undefined;
  const message = oxaData.message as string | undefined;

  if (result !== 100 || !payLink) {
    console.error("[donations/create] OxaPay rejected:", oxaData);
    res.status(400).json({ error: message ?? `OxaPay error (code ${result})` });
    return;
  }

  // Save to DB — order_id is unique so no double-saves
  await d1Run(
    `INSERT INTO donations (user_id, order_id, amount, currency, status, track_id, pay_link)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    [userRow.id, orderId, Number(amount), currency, trackId ?? null, payLink]
  );

  console.log(`[donations/create] Created: orderId=${orderId} trackId=${trackId} amount=${amount} ${currency}`);
  res.json({ ok: true, trackId, payLink, orderId });
});

// POST /donations/callback — OxaPay webhook
router.post("/donations/callback", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  console.log("[donations/callback] Webhook received:", JSON.stringify(body));

  const trackId  = body.trackId  as string | undefined;
  const orderId  = body.orderId  as string | undefined;
  const status   = body.status   as string | undefined;
  const txId     = body.txId     as string | undefined;
  const type     = body.type     as string | undefined;

  // OxaPay sends "Payment" for payment events
  if (type && type !== "Payment") {
    console.log(`[donations/callback] Ignoring type=${type}`);
    res.json({ ok: true });
    return;
  }

  if (!status) {
    console.warn("[donations/callback] Missing status in webhook body");
    res.json({ ok: true });
    return;
  }

  const normalized = normalizeStatus(status);
  console.log(`[donations/callback] trackId=${trackId} orderId=${orderId} raw=${status} normalized=${normalized} txId=${txId}`);

  // Try to match by trackId first, then orderId
  let updated = false;
  if (trackId) {
    const r = await d1Run(
      "UPDATE donations SET status = ?, tx_id = ? WHERE track_id = ?",
      [normalized, txId ?? null, trackId]
    );
    updated = (r.meta?.changes as number ?? 0) > 0;
  }
  if (!updated && orderId) {
    const r = await d1Run(
      "UPDATE donations SET status = ?, tx_id = ? WHERE order_id = ?",
      [normalized, txId ?? null, orderId]
    );
    updated = (r.meta?.changes as number ?? 0) > 0;
  }

  if (!updated) {
    console.warn(`[donations/callback] No matching donation found for trackId=${trackId} orderId=${orderId}`);
  } else {
    console.log(`[donations/callback] Updated donation status to '${normalized}'`);
  }

  res.json({ ok: true });
});

// GET /donations/verify/:trackId — manual status poll
router.get("/donations/verify/:trackId", async (req, res) => {
  const { trackId } = req.params;
  console.log(`[donations/verify] Polling status for trackId=${trackId}`);

  let oxaData: OxaResponse;
  try {
    oxaData = await oxaPost("/merchants/inquiry", { trackId });
  } catch (err) {
    console.error("[donations/verify] OxaPay inquiry failed:", err);
    res.status(502).json({ error: "Payment provider unreachable" });
    return;
  }

  const result  = oxaData.result  as number;
  const rawStatus = oxaData.status as string | undefined;
  const txId    = oxaData.txId    as string | undefined;

  if (result === 100 && rawStatus) {
    const normalized = normalizeStatus(rawStatus);
    await d1Run(
      "UPDATE donations SET status = ?, tx_id = ? WHERE track_id = ?",
      [normalized, txId ?? null, trackId]
    );
    console.log(`[donations/verify] Updated trackId=${trackId} → status=${normalized}`);
  } else {
    console.warn(`[donations/verify] Inquiry returned result=${result}`, oxaData);
  }

  const donation = await d1First("SELECT * FROM donations WHERE track_id = ?", [trackId]);
  res.json({ ok: true, oxaResult: result, oxaStatus: rawStatus, donation });
});

// GET /donations/history — user's own donations
router.get("/donations/history", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userRow = await d1First<{ id: number }>(
    "SELECT id FROM users WHERE telegram_id = ?",
    [auth.telegramId]
  );
  if (!userRow) { res.json([]); return; }
  const donations = await d1All(
    "SELECT * FROM donations WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    [userRow.id]
  );
  res.json(donations);
});

// GET /donations/admin/all — all donations with user info
router.get("/donations/admin/all", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const donations = await d1All(`
    SELECT d.*, u.first_name, u.username, u.telegram_id
    FROM donations d
    JOIN users u ON u.id = d.user_id
    ORDER BY d.created_at DESC
    LIMIT 200
  `);
  res.json(donations);
});

// GET /donations/debug — admin: last 10 payments with raw detail
router.get("/donations/debug", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const donations = await d1All(`
    SELECT d.*, u.first_name, u.username, u.telegram_id
    FROM donations d
    LEFT JOIN users u ON u.id = d.user_id
    ORDER BY d.created_at DESC
    LIMIT 10
  `);
  // Also live-poll OxaPay status for each
  const enriched = await Promise.all(donations.map(async (d: any) => {
    if (!d.track_id) return { ...d, oxaLive: null };
    try {
      const ox = await oxaPost("/merchants/inquiry", { trackId: d.track_id });
      return { ...d, oxaLive: { result: ox.result, status: ox.status, txId: ox.txId } };
    } catch {
      return { ...d, oxaLive: { error: "inquiry failed" } };
    }
  }));
  res.json({ apiBase: getApiBase(), appBase: getAppBase(), payments: enriched });
});

// POST /donations/static-address — generate static address
router.post("/donations/static-address", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { currency, network } = req.body as { currency: string; network: string };
  if (!currency || !network) { res.status(400).json({ error: "currency and network required" }); return; }

  const userRow = await d1First<{ id: number }>(
    "SELECT id FROM users WHERE telegram_id = ?",
    [auth.telegramId]
  );
  if (!userRow) { res.status(404).json({ error: "User not found" }); return; }

  const existing = await d1First(
    "SELECT * FROM static_addresses WHERE user_id = ? AND currency = ? AND network = ?",
    [userRow.id, currency, network]
  );
  if (existing) {
    res.json({ ok: true, address: existing });
    return;
  }

  const apiBase = getApiBase();
  let oxaData: OxaResponse;
  try {
    oxaData = await oxaPost("/merchants/request/staticaddress", {
      currency,
      network,
      callbackUrl: `${apiBase}/donations/callback`,
    });
  } catch {
    res.status(502).json({ error: "Payment provider unreachable" });
    return;
  }

  const result  = oxaData.result  as number;
  const address = oxaData.address as string | undefined;
  const message = oxaData.message as string | undefined;

  if (result !== 100 || !address) {
    res.status(400).json({ error: message ?? "Failed to generate address" });
    return;
  }

  await d1Run(
    "INSERT OR IGNORE INTO static_addresses (user_id, address, currency, network) VALUES (?, ?, ?, ?)",
    [userRow.id, address, (oxaData.currency as string) ?? currency, (oxaData.network as string) ?? network]
  );

  const saved = await d1First("SELECT * FROM static_addresses WHERE address = ?", [address]);
  res.json({ ok: true, address: saved });
});

// GET /donations/static-addresses
router.get("/donations/static-addresses", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userRow = await d1First<{ id: number }>(
    "SELECT id FROM users WHERE telegram_id = ?",
    [auth.telegramId]
  );
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

  const userRow = await d1First<{ id: number }>(
    "SELECT id FROM users WHERE telegram_id = ?",
    [auth.telegramId]
  );
  const addrRow = await d1First(
    "SELECT * FROM static_addresses WHERE address = ? AND user_id = ?",
    [address, userRow?.id]
  );
  if (!addrRow) { res.status(404).json({ error: "Address not found" }); return; }

  let oxaData: OxaResponse;
  try {
    oxaData = await oxaPost("/merchants/revoke/staticaddress", { address });
  } catch {
    res.status(502).json({ error: "Payment provider unreachable" });
    return;
  }

  if ((oxaData.result as number) !== 100) {
    res.status(400).json({ error: (oxaData.message as string) ?? "Failed to revoke" });
    return;
  }

  await d1Run("DELETE FROM static_addresses WHERE address = ?", [address]);
  res.json({ ok: true });
});

// GET /donations/static-addresses/admin
router.get("/donations/static-addresses/admin", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Forbidden" }); return; }
  const addrs = await d1All(`
    SELECT sa.*, u.first_name, u.username, u.telegram_id
    FROM static_addresses sa
    JOIN users u ON u.id = sa.user_id
    ORDER BY sa.created_at DESC
  `);
  res.json(addrs);
});

export default router;
