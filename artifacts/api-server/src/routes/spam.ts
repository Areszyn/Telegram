import { Hono } from "hono";
import type { Env } from "../types.ts";
import { d1All, d1Run } from "../lib/d1.ts";
import { getGlobalStats, getInactiveUsers } from "../lib/spam.ts";
import { requireAdmin } from "../lib/auth.ts";
import { sendMessage } from "../lib/telegram.ts";

const spam = new Hono<{ Bindings: Env }>();
function getMiniAppUrl(env: Env) { return env.MINIAPP_URL; }

function openAppMarkup(env: Env, label = "Open App") {
  return { inline_keyboard: [[{ text: label, web_app: { url: getMiniAppUrl(env) } }]] };
}

spam.get("/admin/spam/stats", requireAdmin(), async (c) => {
  try {
    const stats = await getGlobalStats(c.env.DB);
    return c.json({ ok: true, stats });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

spam.get("/admin/spam/keywords", requireAdmin(), async (c) => {
  try {
    const rows = await d1All<{ keyword: string; added_at: string }>(c.env.DB,
      "SELECT keyword, added_at FROM blocked_keywords ORDER BY keyword",
    );
    return c.json({ ok: true, keywords: rows });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

spam.post("/admin/spam/keywords", requireAdmin(), async (c) => {
  const { keyword } = await c.req.json<{ keyword?: string }>();
  if (!keyword?.trim()) return c.json({ error: "keyword required" }, 400);
  try {
    await d1Run(c.env.DB,
      "INSERT OR IGNORE INTO blocked_keywords (keyword) VALUES (?)",
      [keyword.trim().toLowerCase()],
    );
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

spam.delete("/admin/spam/keywords/:keyword", requireAdmin(), async (c) => {
  try {
    await d1Run(c.env.DB, "DELETE FROM blocked_keywords WHERE keyword = ?", [c.req.param("keyword")]);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

spam.get("/admin/spam/whitelist", requireAdmin(), async (c) => {
  try {
    const rows = await d1All<{ telegram_id: string; added_at: string }>(c.env.DB,
      "SELECT lw.telegram_id, lw.added_at, u.first_name, u.username FROM link_whitelist lw LEFT JOIN users u ON u.telegram_id = lw.telegram_id ORDER BY lw.added_at DESC",
    );
    return c.json({ ok: true, whitelist: rows });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

spam.post("/admin/spam/whitelist", requireAdmin(), async (c) => {
  const { telegram_id } = await c.req.json<{ telegram_id?: string }>();
  if (!telegram_id?.trim()) return c.json({ error: "telegram_id required" }, 400);
  try {
    await d1Run(c.env.DB, "INSERT OR IGNORE INTO link_whitelist (telegram_id) VALUES (?)", [telegram_id.trim()]);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

spam.delete("/admin/spam/whitelist/:id", requireAdmin(), async (c) => {
  try {
    await d1Run(c.env.DB, "DELETE FROM link_whitelist WHERE telegram_id = ?", [c.req.param("id")]);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

spam.get("/admin/spam/scheduled", requireAdmin(), async (c) => {
  try {
    const rows = await d1All<{
      id: number; message: string; scheduled_at: string; sent: number; created_at: string;
    }>(c.env.DB,
      "SELECT id, message, scheduled_at, sent, created_at FROM scheduled_broadcasts ORDER BY scheduled_at DESC LIMIT 50",
    );
    return c.json({ ok: true, scheduled: rows });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

spam.post("/admin/spam/scheduled", requireAdmin(), async (c) => {
  const { message, scheduled_at } = await c.req.json<{ message?: string; scheduled_at?: string }>();
  if (!message?.trim())      return c.json({ error: "message required" }, 400);
  if (!scheduled_at?.trim()) return c.json({ error: "scheduled_at required" }, 400);
  try {
    const result = await d1Run(c.env.DB,
      "INSERT INTO scheduled_broadcasts (message, scheduled_at) VALUES (?, ?)",
      [message.trim(), scheduled_at.trim()],
    );
    return c.json({ ok: true, id: (result.meta as { last_row_id?: number })?.last_row_id ?? null });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

spam.delete("/admin/spam/scheduled/:id", requireAdmin(), async (c) => {
  try {
    await d1Run(c.env.DB, "DELETE FROM scheduled_broadcasts WHERE id = ? AND sent = 0", [c.req.param("id")]);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

spam.post("/admin/spam/notify-inactive", requireAdmin(), async (c) => {
  const { days = 3 } = await c.req.json<{ days?: number }>();
  try {
    const users = await getInactiveUsers(c.env.DB, days);
    let sent = 0;
    for (const u of users) {
      const name = u.first_name ?? "there";
      const ok = await sendMessage(
        c.env.BOT_TOKEN,
        u.telegram_id,
        `Hey ${name}! 👋 We haven't heard from you in a while.\n\nFeel free to send a message or open the app — we're here!`,
        { reply_markup: openAppMarkup(c.env, "Open App") },
      ).then(() => true).catch(() => false);
      if (ok) sent++;
    }
    return c.json({ ok: true, sent, total: users.length });
  } catch (e) {
    return c.json({ error: String(e) }, 500);
  }
});

export default spam;
