import { Router } from "express";
import { d1All, d1First, d1Run } from "../lib/d1.js";
import { validateTelegramInitData } from "../lib/auth.js";

const router = Router();

const OXAPAY_BASE = "https://api.oxapay.com";
const MERCHANT_KEY = process.env.OXAPAY_MERCHANT_KEY!;

function parseInitData(req: Parameters<Router>[0]): { telegramId: string } | null {
  const initData = req.headers["x-init-data"] as string | undefined;
  if (!initData) return null;
  const validated = validateTelegramInitData(initData);
  if (!validated) return null;
  const userStr = validated["user"];
  if (!userStr) return null;
  try {
    const user = JSON.parse(userStr) as { id: number };
    return { telegramId: String(user.id) };
  } catch {
    return null;
  }
}

router.post("/donations/create", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { amount, currency = "USDT" } = req.body as { amount: number; currency?: string };

  const domain = process.env.REPLIT_DEV_DOMAIN;
  const callbackUrl = domain ? `https://${domain}/api/donations/callback` : "";

  const oxaRes = await fetch(`${OXAPAY_BASE}/merchants/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchant: MERCHANT_KEY,
      amount,
      currency,
      lifeTime: 60,
      callbackUrl,
      description: `Donation from ${auth.telegramId}`,
    }),
  });
  const oxaData = (await oxaRes.json()) as { result: number; message: string; trackId?: string; payLink?: string; qrImage?: string };

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
    "INSERT INTO donations (user_id, amount, status, track_id) VALUES (?, ?, 'pending', ?)",
    [userRow.id, amount, oxaData.trackId ?? null]
  );

  res.json({
    ok: true,
    trackId: oxaData.trackId,
    payLink: oxaData.payLink,
    qrImage: oxaData.qrImage,
  });
});

router.post("/donations/callback", async (req, res) => {
  const { trackId, status, txId } = req.body as { trackId: string; status: string; txId?: string };
  if (status === "Paid" || status === "Confirming") {
    await d1Run(
      "UPDATE donations SET status = ?, tx_id = ? WHERE track_id = ?",
      [status === "Paid" ? "paid" : "confirming", txId ?? null, trackId]
    );
  }
  res.json({ ok: true });
});

router.get("/donations/verify/:trackId", async (req, res) => {
  const { trackId } = req.params;
  const oxaRes = await fetch(`${OXAPAY_BASE}/merchants/inquiry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ merchant: MERCHANT_KEY, trackId }),
  });
  const oxaData = (await oxaRes.json()) as { result: number; status: string; txId?: string };
  if (oxaData.result === 100) {
    await d1Run(
      "UPDATE donations SET status = ?, tx_id = ? WHERE track_id = ?",
      [oxaData.status.toLowerCase(), oxaData.txId ?? null, trackId]
    );
  }
  const donation = await d1First("SELECT * FROM donations WHERE track_id = ?", [trackId]);
  res.json({ ok: true, oxaStatus: oxaData.status, donation });
});

router.get("/donations/history", async (req, res) => {
  const auth = parseInitData(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userRow = await d1First<{ id: number }>(
    "SELECT id FROM users WHERE telegram_id = ?",
    [auth.telegramId]
  );
  if (!userRow) { res.json([]); return; }
  const donations = await d1All(
    "SELECT * FROM donations WHERE user_id = ? ORDER BY created_at DESC",
    [userRow.id]
  );
  res.json(donations);
});

export default router;
