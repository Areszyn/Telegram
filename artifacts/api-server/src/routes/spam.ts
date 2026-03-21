import { Router } from "express";
import { d1All, d1First, d1Run } from "../lib/d1.js";
import { getGlobalStats, getInactiveUsers } from "../lib/spam.js";
import { requireAdmin } from "../lib/auth.js";
import { sendMessage } from "../lib/telegram.js";

const router = Router();
const ADMIN_ID = process.env.ADMIN_ID!;
const MINI_APP_URL = "https://mini.susagar.sbs/miniapp/";

function openAppMarkup(label = "Open App") {
  return { inline_keyboard: [[{ text: label, web_app: { url: MINI_APP_URL } }]] };
}

// ── Analytics stats ───────────────────────────────────────────────────────────

router.get("/admin/spam/stats", requireAdmin, async (_req, res) => {
  try {
    const stats = await getGlobalStats();
    res.json({ ok: true, stats });
  } catch (e: unknown) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Blocked keywords ──────────────────────────────────────────────────────────

router.get("/admin/spam/keywords", requireAdmin, async (_req, res) => {
  try {
    const rows = await d1All<{ keyword: string; added_at: string }>(
      "SELECT keyword, added_at FROM blocked_keywords ORDER BY keyword",
    );
    res.json({ ok: true, keywords: rows });
  } catch (e: unknown) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/admin/spam/keywords", requireAdmin, async (req, res) => {
  const { keyword } = req.body as { keyword?: string };
  if (!keyword?.trim()) { res.status(400).json({ error: "keyword required" }); return; }
  try {
    await d1Run("INSERT OR IGNORE INTO blocked_keywords (keyword) VALUES (?)", [keyword.trim().toLowerCase()]);
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/admin/spam/keywords/:keyword", requireAdmin, async (req, res) => {
  try {
    await d1Run("DELETE FROM blocked_keywords WHERE keyword = ?", [req.params.keyword]);
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Link whitelist ────────────────────────────────────────────────────────────

router.get("/admin/spam/whitelist", requireAdmin, async (_req, res) => {
  try {
    const rows = await d1All<{ telegram_id: string; added_at: string }>(
      "SELECT lw.telegram_id, lw.added_at, u.first_name, u.username FROM link_whitelist lw LEFT JOIN users u ON u.telegram_id = lw.telegram_id ORDER BY lw.added_at DESC",
    );
    res.json({ ok: true, whitelist: rows });
  } catch (e: unknown) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/admin/spam/whitelist", requireAdmin, async (req, res) => {
  const { telegram_id } = req.body as { telegram_id?: string };
  if (!telegram_id?.trim()) { res.status(400).json({ error: "telegram_id required" }); return; }
  try {
    await d1Run("INSERT OR IGNORE INTO link_whitelist (telegram_id) VALUES (?)", [telegram_id.trim()]);
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/admin/spam/whitelist/:id", requireAdmin, async (req, res) => {
  try {
    await d1Run("DELETE FROM link_whitelist WHERE telegram_id = ?", [req.params.id]);
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Scheduled broadcasts ──────────────────────────────────────────────────────

router.get("/admin/spam/scheduled", requireAdmin, async (_req, res) => {
  try {
    const rows = await d1All<{
      id: number; message: string; scheduled_at: string; sent: number; created_at: string;
    }>("SELECT id, message, scheduled_at, sent, created_at FROM scheduled_broadcasts ORDER BY scheduled_at DESC LIMIT 50");
    res.json({ ok: true, scheduled: rows });
  } catch (e: unknown) {
    res.status(500).json({ error: String(e) });
  }
});

router.post("/admin/spam/scheduled", requireAdmin, async (req, res) => {
  const { message, scheduled_at } = req.body as { message?: string; scheduled_at?: string };
  if (!message?.trim())    { res.status(400).json({ error: "message required" }); return; }
  if (!scheduled_at?.trim()) { res.status(400).json({ error: "scheduled_at required" }); return; }
  try {
    const result = await d1Run(
      "INSERT INTO scheduled_broadcasts (message, scheduled_at) VALUES (?, ?)",
      [message.trim(), scheduled_at.trim()],
    );
    res.json({ ok: true, id: result.meta?.last_row_id ?? null });
  } catch (e: unknown) {
    res.status(500).json({ error: String(e) });
  }
});

router.delete("/admin/spam/scheduled/:id", requireAdmin, async (req, res) => {
  try {
    await d1Run("DELETE FROM scheduled_broadcasts WHERE id = ? AND sent = 0", [req.params.id]);
    res.json({ ok: true });
  } catch (e: unknown) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Notify inactive users ─────────────────────────────────────────────────────

router.post("/admin/spam/notify-inactive", requireAdmin, async (req, res) => {
  const days = parseInt(String((req.body as { days?: number }).days ?? 3), 10) || 3;
  try {
    const users = await getInactiveUsers(days);
    let sent = 0;
    for (const u of users) {
      const name = u.first_name ?? "there";
      const ok = await sendMessage(
        u.telegram_id,
        `Hey ${name}! 👋 We haven't heard from you in a while.\n\nFeel free to send a message or open the app — we're here!`,
        { reply_markup: openAppMarkup("Open App") },
      ).then(() => true).catch(() => false);
      if (ok) sent++;
    }
    res.json({ ok: true, sent, total: users.length });
  } catch (e: unknown) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
