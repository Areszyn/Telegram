import { Router } from "express";
import { d1All, d1First, d1Run } from "../lib/d1.js";
import { validateTelegramInitData, requireAdmin } from "../lib/auth.js";

const router = Router();

const OXAPAY_BASE = "https://api.oxapay.com";
const MERCHANT_KEY = process.env.OXAPAY_MERCHANT_KEY!;

function getCallbackBase(): string {
  const allDomains = (process.env.REPLIT_DOMAINS ?? "").split(",").map(d => d.trim()).filter(Boolean);
  const prodDomain = allDomains.find(d => d.endsWith(".replit.app"));
  const domain = prodDomain ?? process.env.REPLIT_DEV_DOMAIN ?? "";
  return `https://${domain}/api`;
}

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

async function oxaPost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${OXAPAY_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merchant: MERCHANT_KEY, ...body }),
  });
  return res.json() as Promise<Record<string, unknown>>;
}

// GET /donations/currencies — fetch accepted currencies from OxaPay
router.get("/donations/currencies", async (_req, res) => {
  try {
    const data = await oxaPost("/merchants/allowedCoins", {});
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch currencies" });
  }
});

// POST /donations/create — create a white-label payment
router.post("/donations/create", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { amount, currency = "USDT", description = "" } = req.body as {
    amount: number; currency?: string; description?: string;
  };

  const base = getCallbackBase();
  const orderId = `${auth.telegramId}-${Date.now()}`;

  const oxaData = await oxaPost("/merchants/request/whitelabel", {
    amount,
    currency,
    lifeTime: 60,
    feePaidByPayer: 0,
    underPaidCover: 2,
    description: description || `Donation from ${auth.telegramId}`,
    orderId,
    callbackUrl: `${base}/donations/callback`,
    returnUrl: `${base.replace("/api", "/miniapp/")}/donate`,
    thanksUrl: `${base.replace("/api", "/miniapp/")}/donate?paid=1`,
  }) as { result: number; message: string; trackId?: string; payLink?: string };

  if (oxaData.result !== 100) {
    res.status(400).json({ error: oxaData.message });
    return;
  }

  const userRow = await d1First<{ id: number }>(
    "SELECT id FROM users WHERE telegram_id = ?",
    [auth.telegramId]
  );
  if (!userRow) { res.status(404).json({ error: "User not found" }); return; }

  await d1Run(
    "INSERT INTO donations (user_id, amount, currency, status, track_id, pay_link) VALUES (?, ?, ?, 'pending', ?, ?)",
    [userRow.id, amount, currency, oxaData.trackId ?? null, oxaData.payLink ?? null]
  );

  res.json({ ok: true, trackId: oxaData.trackId, payLink: oxaData.payLink });
});

// POST /donations/callback — OxaPay webhook
router.post("/donations/callback", async (req, res) => {
  const { trackId, status, txId } = req.body as { trackId: string; status: string; txId?: string };
  const normalized = status?.toLowerCase();
  if (["paid", "confirming", "expired", "failed"].includes(normalized)) {
    await d1Run(
      "UPDATE donations SET status = ?, tx_id = ? WHERE track_id = ?",
      [normalized, txId ?? null, trackId]
    );
  }
  res.json({ ok: true });
});

// GET /donations/verify/:trackId — manual status check
router.get("/donations/verify/:trackId", async (req, res) => {
  const { trackId } = req.params;
  const oxaData = await oxaPost("/merchants/inquiry", { trackId }) as {
    result: number; status: string; txId?: string;
  };
  if (oxaData.result === 100) {
    await d1Run(
      "UPDATE donations SET status = ?, tx_id = ? WHERE track_id = ?",
      [oxaData.status.toLowerCase(), oxaData.txId ?? null, trackId]
    );
  }
  const donation = await d1First("SELECT * FROM donations WHERE track_id = ?", [trackId]);
  res.json({ ok: true, oxaStatus: oxaData.status, donation });
});

// GET /donations/history — user's own donation history
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

// GET /donations/admin/all — admin: all donations with user info
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

// POST /donations/payment-info — get detailed OxaPay payment info
router.post("/donations/payment-info", async (req, res) => {
  const { trackId } = req.body as { trackId: string };
  if (!trackId) { res.status(400).json({ error: "trackId required" }); return; }
  try {
    const data = await oxaPost("/merchants/inquiry", { trackId });
    res.json(data);
  } catch {
    res.status(500).json({ error: "Failed to fetch payment info" });
  }
});

// POST /donations/static-address — generate a static crypto address for a user
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

  const base = getCallbackBase();
  const oxaData = await oxaPost("/merchants/request/staticaddress", {
    currency,
    network,
    callbackUrl: `${base}/donations/callback`,
  }) as { result: number; message?: string; address?: string; currency?: string; network?: string };

  if (oxaData.result !== 100 || !oxaData.address) {
    res.status(400).json({ error: oxaData.message ?? "Failed to generate address" });
    return;
  }

  await d1Run(
    "INSERT OR IGNORE INTO static_addresses (user_id, address, currency, network) VALUES (?, ?, ?, ?)",
    [userRow.id, oxaData.address, oxaData.currency ?? currency, oxaData.network ?? network]
  );

  const saved = await d1First("SELECT * FROM static_addresses WHERE address = ?", [oxaData.address]);
  res.json({ ok: true, address: saved });
});

// GET /donations/static-addresses — list user's static addresses
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

// DELETE /donations/static-address — revoke a static address
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

  const oxaData = await oxaPost("/merchants/revoke/staticaddress", { address }) as { result: number; message?: string };
  if (oxaData.result !== 100) {
    res.status(400).json({ error: oxaData.message ?? "Failed to revoke" });
    return;
  }

  await d1Run("DELETE FROM static_addresses WHERE address = ?", [address]);
  res.json({ ok: true });
});

// GET /donations/static-addresses/admin — admin: list all static addresses
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
