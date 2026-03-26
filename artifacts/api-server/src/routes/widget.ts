import { Hono } from "hono";
import type { Env } from "../types.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import { parseAuth } from "../lib/auth.ts";
import { sendMessage as tgSendMessage, createInvoiceLink } from "../lib/telegram.ts";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

const widget = new Hono<{ Bindings: Env }>();

async function decryptApiKey(ciphertext: string, secret: string): Promise<string> {
  const raw = new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32));
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
  const data = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = data.slice(0, 12);
  const enc = data.slice(12);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, enc);
  return new TextDecoder().decode(dec);
}

function getAiProvider(model: string): "openai" | "anthropic" | "gemini" {
  if (model.startsWith("gpt")) return "openai";
  if (model.startsWith("gemini")) return "gemini";
  return "anthropic";
}

async function generateAiReply(
  apiKey: string, model: string, systemPrompt: string,
  messages: { role: string; content: string }[]
): Promise<string | null> {
  const provider = getAiProvider(model);
  try {
    if (provider === "openai") {
      const client = new OpenAI({ apiKey });
      const resp = await client.chat.completions.create({
        model, max_tokens: 500,
        messages: [{ role: "system", content: systemPrompt }, ...messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content }))],
      });
      return resp.choices[0]?.message?.content ?? null;
    } else if (provider === "anthropic") {
      const client = new Anthropic({ apiKey });
      const resp = await client.messages.create({
        model, max_tokens: 500, system: systemPrompt,
        messages: messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
      });
      return resp.content[0]?.type === "text" ? resp.content[0].text : null;
    } else {
      const client = new GoogleGenAI({ apiKey });
      const contents = messages.map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
      const resp = await client.models.generateContent({
        model, contents,
        config: { systemInstruction: systemPrompt, maxOutputTokens: 500 },
      });
      return resp.text ?? null;
    }
  } catch (e) {
    console.error("[Widget AI] Error:", e);
    return null;
  }
}

function generateKey(len = 24): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join("");
}

async function isPremium(db: D1Database, telegramId: string): Promise<boolean> {
  const row = await d1First<{ id: number }>(
    db,
    `SELECT id FROM premium_subscriptions WHERE telegram_id = ? AND status = 'active' AND expires_at > datetime('now') LIMIT 1`,
    [telegramId],
  );
  return !!row;
}

const WIDGET_PLANS = {
  free:     { label: "Free",     price: 0,   widgets: 1, msgsPerDay: 100,  ai: false, trainUrls: 0, watermark: true,  faq: 3,  social: 2  },
  standard: { label: "Standard", price: 100, widgets: 3, msgsPerDay: 1000, ai: true,  trainUrls: 2, watermark: false, faq: 6,  social: 5  },
  pro:      { label: "Pro",      price: 250, widgets: 5, msgsPerDay: -1,   ai: true,  trainUrls: 5, watermark: false, faq: 10, social: 8  },
} as const;

type WidgetPlan = keyof typeof WIDGET_PLANS;

async function getUserWidgetPlan(db: D1Database, telegramId: string): Promise<WidgetPlan> {
  const row = await d1First<{ plan: string }>(
    db,
    `SELECT plan FROM widget_subscriptions WHERE telegram_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now')) ORDER BY id DESC LIMIT 1`,
    [telegramId],
  );
  return (row?.plan as WidgetPlan) || "free";
}

async function getDailyWidgetMsgCount(db: D1Database, telegramId: string): Promise<number> {
  const row = await d1First<{ c: number }>(
    db,
    `SELECT COUNT(*) as c FROM widget_messages wm
     INNER JOIN widget_sessions ws ON ws.id = wm.session_id
     INNER JOIN widget_configs wc ON wc.widget_key = ws.widget_key
     WHERE wc.owner_telegram_id = ? AND wm.sender_type = 'visitor'
       AND wm.created_at > datetime('now', '-1 day')`,
    [telegramId],
  );
  return row?.c ?? 0;
}

async function requireWidgetAccess(_c: { env: Env }, auth: { telegramId: string; isAdmin: boolean }): Promise<string | null> {
  if (auth.isAdmin) return null;
  return null;
}

const publicRateLimit = new Map<string, { count: number; reset: number }>();
function checkPublicRate(ip: string, maxPerMin = 30): boolean {
  const now = Date.now();
  const entry = publicRateLimit.get(ip);
  if (!entry || now > entry.reset) {
    publicRateLimit.set(ip, { count: 1, reset: now + 60000 });
    return true;
  }
  entry.count++;
  if (entry.count > maxPerMin) return false;
  return true;
}

function getClientIp(c: any): string {
  return c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

const ALLOWED_PLATFORMS = ["whatsapp","instagram","facebook","twitter","telegram","linkedin","youtube","tiktok","email","website","discord","snapchat","pinterest"];
const COLOR_RE = /^#[0-9a-fA-F]{3,8}$/;

function sanitizeInputs(opts: { btn_color?: string; faq_items?: any; social_links?: any }) {
  const safeFaq = (Array.isArray(opts.faq_items) ? opts.faq_items : [])
    .slice(0, 10)
    .filter((f: any) => typeof f?.q === "string" && typeof f?.a === "string")
    .map((f: any) => ({ q: String(f.q).slice(0, 200), a: String(f.a).slice(0, 500) }));
  const safeSocial = (Array.isArray(opts.social_links) ? opts.social_links : [])
    .slice(0, 8)
    .filter((s: any) => ALLOWED_PLATFORMS.includes(s?.platform) && typeof s?.url === "string" && /^https?:\/\/|^mailto:/i.test(s.url))
    .map((s: any) => ({ platform: s.platform, url: String(s.url).slice(0, 500) }));
  const btnColor = (opts.btn_color && COLOR_RE.test(opts.btn_color)) ? opts.btn_color : "";
  return { btnColor, faqJson: JSON.stringify(safeFaq), socialJson: JSON.stringify(safeSocial) };
}

function parseDomains(raw?: string): string {
  if (!raw) return "";
  return raw.split(",").map(d => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""))
    .filter(d => d.length > 0 && d.includes(".")).slice(0, 5).join(",");
}

widget.post("/widget/create", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const isAdmin = auth.isAdmin;
  const plan = isAdmin ? "pro" as WidgetPlan : await getUserWidgetPlan(c.env.DB, auth.telegramId);
  const limits = WIDGET_PLANS[plan];

  const { site_name, color, greeting, position, logo_text, bubble_icon, btn_color, faq_items, social_links, allowed_domains } = await c.req.json<{
    site_name?: string; color?: string; greeting?: string; position?: string; logo_text?: string; bubble_icon?: string;
    btn_color?: string; faq_items?: { q: string; a: string }[]; social_links?: { platform: string; url: string }[];
    allowed_domains?: string;
  }>();

  if (!isAdmin && !allowed_domains?.trim()) return c.json({ error: "Domain is required (e.g. example.com)" }, 400);

  const existing = await d1All(
    c.env.DB,
    "SELECT id FROM widget_configs WHERE owner_telegram_id = ?",
    [auth.telegramId],
  );
  if (existing.length >= limits.widgets) return c.json({ error: `Your ${limits.label} plan allows max ${limits.widgets} widget(s). Upgrade for more.` }, 400);

  const widgetKey = "wk_" + generateKey(20);
  const pos = (position === "left") ? "left" : "right";
  const icon = ["chat", "help", "wave", "headset"].includes(bubble_icon || "") ? bubble_icon! : "chat";
  const sanitized = sanitizeInputs({ btn_color, faq_items, social_links });
  const safeDomains = allowed_domains?.trim() ? parseDomains(allowed_domains) : "";
  if (!isAdmin && !safeDomains) return c.json({ error: "At least one valid domain is required (e.g. example.com)" }, 400);

  await d1Run(c.env.DB,
    `INSERT INTO widget_configs (widget_key, owner_telegram_id, site_name, color, greeting, position, logo_text, bubble_icon, btn_color, faq_items, social_links, allowed_domains) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [widgetKey, auth.telegramId, site_name || "", color || "#6366f1", greeting || "Hi there! How can we help you?", pos, logo_text || "", icon, sanitized.btnColor, sanitized.faqJson, sanitized.socialJson, safeDomains],
  );

  return c.json({ ok: true, widget_key: widgetKey });
});

widget.get("/widget/my-widgets", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const err = await requireWidgetAccess(c, auth);
  if (err) return c.json({ error: err }, 403);

  const widgets = await d1All(
    c.env.DB,
    "SELECT * FROM widget_configs WHERE owner_telegram_id = ? ORDER BY created_at DESC",
    [auth.telegramId],
  );
  return c.json(widgets);
});

widget.put("/widget/:widgetKey/update", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const widgetKey = c.req.param("widgetKey");
  const config = await d1First<{ owner_telegram_id: string }>(
    c.env.DB, "SELECT owner_telegram_id FROM widget_configs WHERE widget_key = ?", [widgetKey],
  );
  if (!config) return c.json({ error: "Widget not found" }, 404);
  if (config.owner_telegram_id !== auth.telegramId && !auth.isAdmin)
    return c.json({ error: "Forbidden" }, 403);

  const { site_name, color, greeting, active, position, logo_text, bubble_icon, btn_color, faq_items, social_links, allowed_domains, hide_watermark, ai_enabled, ai_model, ai_system_prompt } = await c.req.json<{
    site_name?: string; color?: string; greeting?: string; active?: boolean;
    position?: string; logo_text?: string; bubble_icon?: string;
    btn_color?: string; faq_items?: { q: string; a: string }[]; social_links?: { platform: string; url: string }[];
    allowed_domains?: string; hide_watermark?: boolean;
    ai_enabled?: boolean; ai_model?: string; ai_system_prompt?: string;
  }>();

  const updates: string[] = [];
  const params: unknown[] = [];
  if (site_name !== undefined) { updates.push("site_name = ?"); params.push(site_name); }
  if (color !== undefined) { updates.push("color = ?"); params.push(COLOR_RE.test(color) ? color : "#6366f1"); }
  if (greeting !== undefined) { updates.push("greeting = ?"); params.push(greeting); }
  if (active !== undefined) { updates.push("active = ?"); params.push(active ? 1 : 0); }
  if (position !== undefined) { updates.push("position = ?"); params.push(position === "left" ? "left" : "right"); }
  if (logo_text !== undefined) { updates.push("logo_text = ?"); params.push(String(logo_text).slice(0, 2)); }
  if (bubble_icon !== undefined) { updates.push("bubble_icon = ?"); params.push(["chat", "help", "wave", "headset"].includes(bubble_icon) ? bubble_icon : "chat"); }
  if (allowed_domains !== undefined) {
    if (auth.isAdmin && !allowed_domains?.trim()) {
      updates.push("allowed_domains = ?"); params.push("");
    } else {
      const safeDoms = parseDomains(allowed_domains);
      if (!safeDoms) return c.json({ error: "At least one valid domain is required" }, 400);
      updates.push("allowed_domains = ?"); params.push(safeDoms);
    }
  }
  if (btn_color !== undefined || faq_items !== undefined || social_links !== undefined) {
    const sanitized = sanitizeInputs({ btn_color, faq_items, social_links });
    if (btn_color !== undefined) { updates.push("btn_color = ?"); params.push(sanitized.btnColor); }
    if (faq_items !== undefined) { updates.push("faq_items = ?"); params.push(sanitized.faqJson); }
    if (social_links !== undefined) { updates.push("social_links = ?"); params.push(sanitized.socialJson); }
  }

  const userPlan = auth.isAdmin ? "pro" as WidgetPlan : await getUserWidgetPlan(c.env.DB, auth.telegramId);
  const planLimits = WIDGET_PLANS[userPlan];

  if (hide_watermark !== undefined) {
    if (hide_watermark && planLimits.watermark && !auth.isAdmin) {
      updates.push("hide_watermark = ?"); params.push(0);
    } else {
      updates.push("hide_watermark = ?"); params.push(hide_watermark ? 1 : 0);
    }
  }

  if (ai_enabled !== undefined) {
    if (ai_enabled && !planLimits.ai && !auth.isAdmin) {
      updates.push("ai_enabled = ?"); params.push(0);
    } else {
      updates.push("ai_enabled = ?"); params.push(ai_enabled ? 1 : 0);
    }
  }
  if (ai_model !== undefined) { updates.push("ai_model = ?"); params.push(ai_model); }
  if (ai_system_prompt !== undefined) { updates.push("ai_system_prompt = ?"); params.push(ai_system_prompt.slice(0, 2000)); }

  if (updates.length === 0) return c.json({ error: "Nothing to update" }, 400);
  params.push(widgetKey);
  await d1Run(c.env.DB, `UPDATE widget_configs SET ${updates.join(", ")} WHERE widget_key = ?`, params);
  return c.json({ ok: true });
});

widget.delete("/widget/:widgetKey", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const widgetKey = c.req.param("widgetKey");
  const config = await d1First<{ owner_telegram_id: string }>(
    c.env.DB, "SELECT owner_telegram_id FROM widget_configs WHERE widget_key = ?", [widgetKey],
  );
  if (!config) return c.json({ error: "Widget not found" }, 404);
  if (config.owner_telegram_id !== auth.telegramId && !auth.isAdmin)
    return c.json({ error: "Forbidden" }, 403);

  await d1Run(c.env.DB, "DELETE FROM widget_messages WHERE session_id IN (SELECT id FROM widget_sessions WHERE widget_key = ?)", [widgetKey]);
  await d1Run(c.env.DB, "DELETE FROM widget_sessions WHERE widget_key = ?", [widgetKey]);
  await d1Run(c.env.DB, "DELETE FROM widget_configs WHERE widget_key = ?", [widgetKey]);
  return c.json({ ok: true });
});

widget.post("/widget/:widgetKey/train", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const widgetKey = c.req.param("widgetKey");
  const config = await d1First<{ owner_telegram_id: string }>(
    c.env.DB, "SELECT owner_telegram_id FROM widget_configs WHERE widget_key = ?", [widgetKey],
  );
  if (!config) return c.json({ error: "Widget not found" }, 404);
  if (config.owner_telegram_id !== auth.telegramId && !auth.isAdmin)
    return c.json({ error: "Forbidden" }, 403);

  const trainPlan = auth.isAdmin ? "pro" as WidgetPlan : await getUserWidgetPlan(c.env.DB, auth.telegramId);
  const trainLimits = WIDGET_PLANS[trainPlan];
  if (trainLimits.trainUrls === 0) return c.json({ error: `Training URLs require a Standard or Pro plan.` }, 403);

  const { urls } = await c.req.json<{ urls: string[] }>();
  if (!urls || !Array.isArray(urls) || urls.length === 0)
    return c.json({ error: "At least one URL required" }, 400);

  const validUrls = urls
    .map(u => u.trim())
    .filter(u => /^https?:\/\/.+/.test(u))
    .slice(0, trainLimits.trainUrls);

  if (validUrls.length === 0) return c.json({ error: "No valid URLs provided" }, 400);

  const BLOCKED_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]", "metadata.google.internal", "169.254.169.254"];
  const isBlockedHost = (hostname: string) => {
    const h = hostname.toLowerCase();
    if (BLOCKED_HOSTS.includes(h)) return true;
    if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".localhost")) return true;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(h)) return true;
    if (h.startsWith("0.") || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
    return false;
  };

  const results: { url: string; chars: number; error?: string }[] = [];
  const scraped: string[] = [];
  const succeededUrls: string[] = [];

  for (const url of validUrls) {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) { results.push({ url, chars: 0, error: "Invalid protocol" }); continue; }
      if (isBlockedHost(parsed.hostname)) { results.push({ url, chars: 0, error: "Blocked host" }); continue; }

      const resp = await fetch(url, {
        headers: { "User-Agent": "Lifegram-Bot/1.0 (Training Scraper)", "Accept": "text/html" },
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) { results.push({ url, chars: 0, error: `HTTP ${resp.status}` }); continue; }
      const ct = resp.headers.get("content-type") || "";
      if (!ct.includes("text/html") && !ct.includes("text/plain")) { results.push({ url, chars: 0, error: "Not HTML" }); continue; }
      const raw = await resp.text();
      const html = raw.slice(0, 200000);
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);
      scraped.push(`[Source: ${url}]\n${text}`);
      succeededUrls.push(url);
      results.push({ url, chars: text.length });
    } catch (e) {
      results.push({ url, chars: 0, error: String(e).slice(0, 100) });
    }
  }

  const trainingData = scraped.join("\n\n---\n\n").slice(0, 30000);

  await d1Run(c.env.DB,
    "UPDATE widget_configs SET ai_training_urls = ?, ai_training_data = ? WHERE widget_key = ?",
    [JSON.stringify(succeededUrls), trainingData, widgetKey],
  );

  return c.json({ ok: true, results, totalChars: trainingData.length });
});

widget.delete("/widget/:widgetKey/train", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const widgetKey = c.req.param("widgetKey");
  const config = await d1First<{ owner_telegram_id: string }>(
    c.env.DB, "SELECT owner_telegram_id FROM widget_configs WHERE widget_key = ?", [widgetKey],
  );
  if (!config) return c.json({ error: "Widget not found" }, 404);
  if (config.owner_telegram_id !== auth.telegramId && !auth.isAdmin)
    return c.json({ error: "Forbidden" }, 403);

  await d1Run(c.env.DB,
    "UPDATE widget_configs SET ai_training_urls = '[]', ai_training_data = '' WHERE widget_key = ?",
    [widgetKey],
  );
  return c.json({ ok: true });
});

widget.get("/widget/conversations/:widgetKey", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const widgetKey = c.req.param("widgetKey");
  const config = await d1First<{ owner_telegram_id: string }>(
    c.env.DB, "SELECT owner_telegram_id FROM widget_configs WHERE widget_key = ?", [widgetKey],
  );
  if (!config) return c.json({ error: "Widget not found" }, 404);
  if (config.owner_telegram_id !== auth.telegramId && !auth.isAdmin)
    return c.json({ error: "Forbidden" }, 403);

  const sessions = await d1All(c.env.DB, `
    SELECT ws.*,
      (SELECT text FROM widget_messages wm WHERE wm.session_id = ws.id ORDER BY wm.created_at DESC LIMIT 1) AS last_text,
      (SELECT created_at FROM widget_messages wm2 WHERE wm2.session_id = ws.id ORDER BY wm2.created_at DESC LIMIT 1) AS last_msg_at,
      (SELECT COUNT(*) FROM widget_messages wm3 WHERE wm3.session_id = ws.id AND wm3.sender_type = 'visitor' AND wm3.read = 0) AS unread
    FROM widget_sessions ws
    WHERE ws.widget_key = ?
    ORDER BY COALESCE(
      (SELECT created_at FROM widget_messages wm4 WHERE wm4.session_id = ws.id ORDER BY wm4.created_at DESC LIMIT 1),
      ws.created_at
    ) DESC
  `, [widgetKey]);

  return c.json(sessions);
});

widget.get("/widget/chat-messages/:sessionId", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const sessionId = parseInt(c.req.param("sessionId"), 10);
  const session = await d1First<{ widget_key: string }>(
    c.env.DB, "SELECT widget_key FROM widget_sessions WHERE id = ?", [sessionId],
  );
  if (!session) return c.json({ error: "Session not found" }, 404);

  const config = await d1First<{ owner_telegram_id: string }>(
    c.env.DB, "SELECT owner_telegram_id FROM widget_configs WHERE widget_key = ?", [session.widget_key],
  );
  if (!config) return c.json({ error: "Widget not found" }, 404);
  if (config.owner_telegram_id !== auth.telegramId && !auth.isAdmin)
    return c.json({ error: "Forbidden" }, 403);

  const after = parseInt(c.req.query("after") ?? "0", 10);
  let msgs;
  if (after > 0) {
    msgs = await d1All(c.env.DB,
      "SELECT * FROM widget_messages WHERE session_id = ? AND id > ? ORDER BY created_at ASC LIMIT 200",
      [sessionId, after],
    );
  } else {
    msgs = await d1All(c.env.DB,
      "SELECT * FROM widget_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 100",
      [sessionId],
    );
    msgs.reverse();
  }

  await d1Run(c.env.DB,
    "UPDATE widget_messages SET read = 1 WHERE session_id = ? AND sender_type = 'visitor' AND read = 0",
    [sessionId],
  );

  return c.json(msgs);
});

widget.post("/widget/reply/:sessionId", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const sessionId = parseInt(c.req.param("sessionId"), 10);
  const session = await d1First<{ widget_key: string }>(
    c.env.DB, "SELECT widget_key FROM widget_sessions WHERE id = ?", [sessionId],
  );
  if (!session) return c.json({ error: "Session not found" }, 404);

  const config = await d1First<{ owner_telegram_id: string }>(
    c.env.DB, "SELECT owner_telegram_id FROM widget_configs WHERE widget_key = ?", [session.widget_key],
  );
  if (!config) return c.json({ error: "Widget not found" }, 404);
  if (config.owner_telegram_id !== auth.telegramId && !auth.isAdmin)
    return c.json({ error: "Forbidden" }, 403);

  const { text } = await c.req.json<{ text: string }>();
  if (!text?.trim()) return c.json({ error: "Text required" }, 400);
  if (text.length > 4000) return c.json({ error: "Message too long" }, 400);

  await d1Run(c.env.DB,
    "INSERT INTO widget_messages (session_id, sender_type, text) VALUES (?, 'owner', ?)",
    [sessionId, text.trim()],
  );

  await d1Run(c.env.DB, "UPDATE widget_sessions SET last_active = datetime('now') WHERE id = ?", [sessionId]);

  return c.json({ ok: true });
});

widget.get("/widget/all-conversations", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const isAdmin = auth.isAdmin;
  const premium = await isPremium(c.env.DB, auth.telegramId);
  if (!isAdmin && !premium) return c.json({ error: "Premium required" }, 403);

  const widgetFilter = isAdmin ? "" : "AND wc.owner_telegram_id = ?";
  const params: unknown[] = isAdmin ? [] : [auth.telegramId];

  const sessions = await d1All(c.env.DB, `
    SELECT ws.*, wc.site_name, wc.widget_key,
      (SELECT text FROM widget_messages wm WHERE wm.session_id = ws.id ORDER BY wm.created_at DESC LIMIT 1) AS last_text,
      (SELECT created_at FROM widget_messages wm2 WHERE wm2.session_id = ws.id ORDER BY wm2.created_at DESC LIMIT 1) AS last_msg_at,
      (SELECT COUNT(*) FROM widget_messages wm3 WHERE wm3.session_id = ws.id AND wm3.sender_type = 'visitor' AND wm3.read = 0) AS unread
    FROM widget_sessions ws
    JOIN widget_configs wc ON wc.widget_key = ws.widget_key
    WHERE 1=1 ${widgetFilter}
    ORDER BY COALESCE(
      (SELECT created_at FROM widget_messages wm4 WHERE wm4.session_id = ws.id ORDER BY wm4.created_at DESC LIMIT 1),
      ws.created_at
    ) DESC
    LIMIT 100
  `, params);

  return c.json(sessions);
});

widget.get("/widget/admin/all-widgets", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Admin only" }, 403);

  const widgets = await d1All(c.env.DB, `
    SELECT wc.*,
      (SELECT COUNT(*) FROM widget_sessions ws WHERE ws.widget_key = wc.widget_key) AS session_count,
      (SELECT COUNT(*) FROM widget_messages wm WHERE wm.session_id IN (SELECT ws2.id FROM widget_sessions ws2 WHERE ws2.widget_key = wc.widget_key) AND wm.sender_type = 'visitor' AND wm.read = 0) AS unread_count,
      u.first_name AS owner_name, u.username AS owner_username
    FROM widget_configs wc
    LEFT JOIN users u ON u.telegram_id = CAST(wc.owner_telegram_id AS TEXT)
    ORDER BY wc.created_at DESC
  `, []);

  return c.json(widgets);
});

widget.put("/widget/admin/:widgetKey/toggle", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Admin only" }, 403);

  const widgetKey = c.req.param("widgetKey");
  const config = await d1First<{ active: number }>(
    c.env.DB, "SELECT active FROM widget_configs WHERE widget_key = ?", [widgetKey],
  );
  if (!config) return c.json({ error: "Not found" }, 404);

  await d1Run(c.env.DB, "UPDATE widget_configs SET active = ? WHERE widget_key = ?", [config.active ? 0 : 1, widgetKey]);
  return c.json({ ok: true, active: config.active ? 0 : 1 });
});

widget.delete("/widget/admin/:widgetKey", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Admin only" }, 403);

  const widgetKey = c.req.param("widgetKey");
  await d1Run(c.env.DB, "DELETE FROM widget_messages WHERE session_id IN (SELECT id FROM widget_sessions WHERE widget_key = ?)", [widgetKey]);
  await d1Run(c.env.DB, "DELETE FROM widget_sessions WHERE widget_key = ?", [widgetKey]);
  await d1Run(c.env.DB, "DELETE FROM widget_configs WHERE widget_key = ?", [widgetKey]);
  return c.json({ ok: true });
});

widget.get("/widget/admin/stats", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Admin only" }, 403);

  const totalWidgets = await d1First<{ c: number }>(c.env.DB, "SELECT COUNT(*) as c FROM widget_configs", []);
  const activeWidgets = await d1First<{ c: number }>(c.env.DB, "SELECT COUNT(*) as c FROM widget_configs WHERE active = 1", []);
  const totalSessions = await d1First<{ c: number }>(c.env.DB, "SELECT COUNT(*) as c FROM widget_sessions", []);
  const totalMessages = await d1First<{ c: number }>(c.env.DB, "SELECT COUNT(*) as c FROM widget_messages", []);
  const uniqueOwners = await d1First<{ c: number }>(c.env.DB, "SELECT COUNT(DISTINCT owner_telegram_id) as c FROM widget_configs", []);

  return c.json({
    total_widgets: totalWidgets?.c || 0,
    active_widgets: activeWidgets?.c || 0,
    total_sessions: totalSessions?.c || 0,
    total_messages: totalMessages?.c || 0,
    unique_owners: uniqueOwners?.c || 0,
  });
});

widget.post("/w/start", async (c) => {
  if (!checkPublicRate(getClientIp(c), 20)) return c.json({ error: "Too many requests" }, 429);
  const { widget_key, name, email, session_key: existingKey } = await c.req.json<{
    widget_key: string; name: string; email: string; session_key?: string;
  }>();

  if (!widget_key) return c.json({ error: "widget_key required" }, 400);

  const config = await d1First<{ id: number; active: number; greeting: string; color: string; site_name: string }>(
    c.env.DB, "SELECT * FROM widget_configs WHERE widget_key = ? AND active = 1", [widget_key],
  );
  if (!config) return c.json({ error: "Widget not found or inactive" }, 404);

  if (existingKey) {
    const existing = await d1First<{ id: number; visitor_name: string; visitor_email: string }>(
      c.env.DB, "SELECT id, visitor_name, visitor_email FROM widget_sessions WHERE session_key = ? AND widget_key = ?", [existingKey, widget_key],
    );
    if (existing) {
      await d1Run(c.env.DB, "UPDATE widget_sessions SET last_active = datetime('now') WHERE id = ?", [existing.id]);
      return c.json({
        ok: true, session_key: existingKey, session_id: existing.id, resumed: true,
        greeting: config.greeting, color: config.color, site_name: config.site_name,
        visitor_name: existing.visitor_name, visitor_email: existing.visitor_email,
      });
    }
  }

  if (!name?.trim() || !email?.trim()) return c.json({ error: "Name and email required" }, 400);
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email.trim())) return c.json({ error: "Invalid email" }, 400);

  const sessionKey = "ws_" + generateKey(24);

  await d1Run(c.env.DB,
    "INSERT INTO widget_sessions (session_key, widget_key, visitor_name, visitor_email) VALUES (?, ?, ?, ?)",
    [sessionKey, widget_key, name.trim(), email.trim()],
  );

  const session = await d1First<{ id: number }>(
    c.env.DB, "SELECT id FROM widget_sessions WHERE session_key = ?", [sessionKey],
  );

  await d1Run(c.env.DB,
    "INSERT INTO widget_messages (session_id, sender_type, text) VALUES (?, 'system', ?)",
    [session!.id, config.greeting],
  );

  return c.json({
    ok: true, session_key: sessionKey, session_id: session!.id, resumed: false,
    greeting: config.greeting, color: config.color, site_name: config.site_name,
  });
});

widget.post("/w/send", async (c) => {
  if (!checkPublicRate(getClientIp(c), 30)) return c.json({ error: "Too many requests" }, 429);
  const { session_key, text } = await c.req.json<{ session_key: string; text: string }>();
  if (!session_key || !text?.trim()) return c.json({ error: "Missing fields" }, 400);
  if (text.length > 4000) return c.json({ error: "Message too long" }, 400);

  const session = await d1First<{ id: number; widget_key: string; status: string; visitor_name: string }>(
    c.env.DB, "SELECT id, widget_key, status, visitor_name FROM widget_sessions WHERE session_key = ?", [session_key],
  );
  if (!session) return c.json({ error: "Session not found" }, 404);
  if (session.status !== "active") return c.json({ error: "Session ended" }, 400);

  const widgetCfg = await d1First<{
    ai_enabled: number; ai_provider: string; ai_model: string;
    ai_system_prompt: string; ai_training_data: string; owner_telegram_id: string;
    site_name: string;
  }>(c.env.DB, "SELECT ai_enabled, ai_provider, ai_model, ai_system_prompt, ai_training_data, owner_telegram_id, site_name FROM widget_configs WHERE widget_key = ?", [session.widget_key]);

  if (widgetCfg) {
    const ownerIsAdmin = widgetCfg.owner_telegram_id === (c.env as any).ADMIN_ID;
    if (!ownerIsAdmin) {
      const ownerPlan = await getUserWidgetPlan(c.env.DB, widgetCfg.owner_telegram_id);
      const planLimits = WIDGET_PLANS[ownerPlan];
      if (planLimits.msgsPerDay > 0) {
        const todayCount = await getDailyWidgetMsgCount(c.env.DB, widgetCfg.owner_telegram_id);
        if (todayCount >= planLimits.msgsPerDay) {
          return c.json({ error: "This widget has reached its daily message limit. Please try again later." }, 429);
        }
      }
    }
  }

  await d1Run(c.env.DB,
    "INSERT INTO widget_messages (session_id, sender_type, text) VALUES (?, 'visitor', ?)",
    [session.id, text.trim()],
  );

  await d1Run(c.env.DB, "UPDATE widget_sessions SET last_active = datetime('now') WHERE id = ?", [session.id]);

  if (widgetCfg?.ai_enabled) {
    try {
      const provider = getAiProvider(widgetCfg.ai_model);
      const keyRow = await d1First<{ encrypted_key: string }>(
        c.env.DB, "SELECT encrypted_key FROM ai_api_keys WHERE owner_telegram_id = ? AND provider = ?",
        [widgetCfg.owner_telegram_id, provider],
      );
      if (keyRow) {
        const apiKey = await decryptApiKey(keyRow.encrypted_key, c.env.BOT_TOKEN);
        const history = await d1All<{ sender_type: string; text: string }>(
          c.env.DB, "SELECT sender_type, text FROM widget_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 20", [session.id],
        );
        const chatMsgs = history
          .filter(m => m.sender_type !== "system")
          .map(m => ({ role: m.sender_type === "visitor" ? "user" : "assistant", content: m.text }));

        let fullPrompt = widgetCfg.ai_system_prompt;
        if (widgetCfg.ai_training_data) {
          fullPrompt += "\n\nBelow is knowledge from the website. Use it to answer visitor questions accurately:\n\n" + widgetCfg.ai_training_data.slice(0, 12000);
        }

        const reply = await generateAiReply(apiKey, widgetCfg.ai_model, fullPrompt, chatMsgs);
        if (reply) {
          await d1Run(c.env.DB,
            "INSERT INTO widget_messages (session_id, sender_type, text) VALUES (?, 'owner', ?)",
            [session.id, reply],
          );
        }
      }
    } catch (e) {
      console.error("[Widget AI] Auto-reply failed:", e);
    }
  }

  if (widgetCfg?.owner_telegram_id) {
    const siteName = widgetCfg.site_name || "Widget";
    const preview = text.trim().length > 100 ? text.trim().slice(0, 100) + "…" : text.trim();
    tgSendMessage(c.env.BOT_TOKEN, widgetCfg.owner_telegram_id,
      `🌐 Widget message from ${session.visitor_name} (${siteName}):\n\n${preview}`,
    ).catch(() => {});
  }

  return c.json({ ok: true });
});

widget.get("/w/messages", async (c) => {
  if (!checkPublicRate(getClientIp(c), 60)) return c.json({ error: "Too many requests" }, 429);
  const sessionKey = c.req.query("session_key");
  if (!sessionKey) return c.json({ error: "session_key required" }, 400);

  const session = await d1First<{ id: number }>(
    c.env.DB, "SELECT id FROM widget_sessions WHERE session_key = ?", [sessionKey],
  );
  if (!session) return c.json({ error: "Session not found" }, 404);

  const after = parseInt(c.req.query("after") ?? "0", 10);
  let msgs;
  if (after > 0) {
    msgs = await d1All(c.env.DB,
      "SELECT * FROM widget_messages WHERE session_id = ? AND id > ? ORDER BY created_at ASC LIMIT 200",
      [session.id, after],
    );
  } else {
    msgs = await d1All(c.env.DB,
      "SELECT * FROM widget_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 200",
      [session.id],
    );
  }

  await d1Run(c.env.DB,
    "UPDATE widget_messages SET read = 1 WHERE session_id = ? AND sender_type = 'owner' AND read = 0",
    [session.id],
  );

  return c.json(msgs);
});

widget.get("/w/config", async (c) => {
  const widgetKey = c.req.query("key");
  if (!widgetKey) return c.json({ error: "key required" }, 400);

  const config = await d1First<{
    color: string; greeting: string; site_name: string; active: number;
    position: string; logo_text: string; bubble_icon: string;
    btn_color: string; faq_items: string; social_links: string; allowed_domains: string;
    hide_watermark: number; owner_telegram_id: string;
  }>(c.env.DB, "SELECT color, greeting, site_name, active, position, logo_text, bubble_icon, btn_color, faq_items, social_links, allowed_domains, hide_watermark, owner_telegram_id FROM widget_configs WHERE widget_key = ?", [widgetKey]);

  if (!config || !config.active) return c.json({ error: "Widget not found" }, 404);

  let faq: unknown[] = [];
  let social: unknown[] = [];
  try { faq = JSON.parse(config.faq_items || "[]"); } catch {}
  try { social = JSON.parse(config.social_links || "[]"); } catch {}

  const isAdminOwned = config.owner_telegram_id === (c.env as any).ADMIN_ID;
  const ownerPlan = isAdminOwned ? "pro" as WidgetPlan : await getUserWidgetPlan(c.env.DB, config.owner_telegram_id);
  const ownerPlanLimits = WIDGET_PLANS[ownerPlan];
  const watermarkHidden = (config.hide_watermark === 1 && !ownerPlanLimits.watermark) || isAdminOwned;

  return c.json({
    color: config.color, greeting: config.greeting, site_name: config.site_name,
    position: config.position || "right", logo_text: config.logo_text || "",
    bubble_icon: config.bubble_icon || "chat", btn_color: config.btn_color || "",
    faq_items: faq, social_links: social,
    allowed_domains: config.allowed_domains || "",
    hide_watermark: watermarkHidden,
  });
});

widget.get("/w/embed.js", async (c) => {
  const widgetKey = c.req.query("key") || "WIDGET_KEY";
  const apiBase = new URL(c.req.url).origin + "/api";

  const js = getEmbedScript(apiBase, widgetKey);

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

widget.get("/w/docs", (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0a0a0a">
<title>Lifegram Live Chat Widget — Setup Guide</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{
  background:#0d0d0d;color:#d0d0d0;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;
  font-size:15px;line-height:1.78;
}
article{max-width:740px;margin:0 auto;padding:44px 22px 90px}
header{margin-bottom:36px;padding-bottom:24px;border-bottom:1px solid #1e1e1e}
header h1{font-size:1.65rem;font-weight:700;color:#f0f0f0;line-height:1.3;margin-bottom:12px}
.meta{font-size:12px;color:#444;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.badge{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:6px;padding:3px 9px;font-size:11px;color:#555}
.badge.blue{border-color:#1d4ed8;color:#3b82f6}
h2{font-size:1.08rem;font-weight:600;color:#e8e8e8;margin:40px 0 12px;
   padding-left:13px;border-left:3px solid #3b82f6}
h3{font-size:.93rem;font-weight:600;color:#c8c8c8;margin:22px 0 8px}
p{margin-bottom:12px;color:#999}
p strong{color:#bbb}
ul,ol{padding-left:22px;margin-bottom:14px}
li{margin-bottom:7px;color:#999}
li strong{color:#bbb}
a{color:#3b82f6;text-decoration:none}
a:hover{text-decoration:underline}
code{background:#161616;border:1px solid #222;border-radius:4px;
     padding:1px 5px;font-size:.82em;font-family:'SF Mono','Fira Code',monospace;color:#7dd3fc}
pre{background:#111;border:1px solid #1e1e1e;border-radius:10px;
    padding:16px 20px;overflow-x:auto;font-size:13px;line-height:1.65;margin:14px 0;position:relative}
pre code{background:none;border:none;padding:0;color:#a6e3a1}
.card{
  background:#111;border:1px solid #1e1e1e;border-radius:12px;
  padding:18px 20px;margin:14px 0;
}
.card h3{margin-top:0;color:#ccc}
.card-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:14px 0}
@media(max-width:560px){.card-grid{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:.86rem}
th{background:#141414;color:#777;font-weight:500;text-align:left;
   padding:10px 13px;border-bottom:1px solid #1e1e1e}
td{padding:10px 13px;border-bottom:1px solid #181818;color:#888;vertical-align:top}
tr:last-child td{border-bottom:none}
td:first-child{color:#aaa;white-space:nowrap}
.step-num{display:inline-flex;align-items:center;justify-content:center;
  width:26px;height:26px;border-radius:50%;
  background:rgba(29,78,216,0.1);border:1px solid rgba(29,78,216,0.25);
  color:#3b82f6;font-size:13px;font-weight:700;margin-right:8px;flex-shrink:0}
.tag{display:inline-block;background:#1a1a1a;border:1px solid #2a2a2a;
  font-size:11px;font-weight:500;padding:3px 10px;border-radius:6px;color:#666;margin:3px 4px 3px 0}
.highlight{
  background:#0f172a;border:1px solid #1e3a5f;border-left:3px solid #3b82f6;
  border-radius:0 10px 10px 0;padding:14px 18px;margin:16px 0;
}
.highlight p{margin:0;font-size:.9rem;color:#6b8db5}
.copy-btn{position:absolute;top:8px;right:8px;background:rgba(255,255,255,0.06);
  border:1px solid rgba(255,255,255,0.1);color:#555;padding:4px 12px;border-radius:6px;
  cursor:pointer;font-size:11px;transition:all 0.15s}
.copy-btn:hover{background:rgba(255,255,255,0.1);color:#999}
footer{margin-top:56px;padding-top:24px;border-top:1px solid #1a1a1a;
       font-size:12px;color:#3a3a3a;text-align:center;line-height:2}
@media(max-width:520px){
  article{padding:28px 16px 64px}
  header h1{font-size:1.3rem}
  h2{font-size:1rem}
  table{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .card-grid{grid-template-columns:1fr}
}
</style>
</head>
<body>
<article>

<header>
  <h1>Lifegram Live Chat Widget — Setup Guide</h1>
  <div class="meta">
    <span>@lifegrambot</span>
    <span class="badge blue">Documentation</span>
    <span class="badge">v1.0</span>
  </div>
</header>

<h2>What is Lifegram Widget?</h2>
<p>Lifegram Widget is an embeddable live chat bubble — like Zendesk or Intercom — that you add to your website with a single line of code. Visitors start real-time conversations with you, and you respond from the Lifegram Mini App on Telegram.</p>

<div class="card-grid">
  <div class="card"><h3>&#128172; Real-time Chat</h3><p>Visitors get instant replies via polling. No page refresh needed.</p></div>
  <div class="card"><h3>&#127912; Custom Branding</h3><p>Choose colors, icons, greeting, position, and logo text.</p></div>
  <div class="card"><h3>&#128241; Mobile Ready</h3><p>Full-screen on mobile, floating bubble on desktop.</p></div>
  <div class="card"><h3>&#128190; Persistent Sessions</h3><p>Chat history saved in localStorage with 7-day auto-expiry.</p></div>
</div>

<h2><span class="step-num">1</span> Create a Widget</h2>
<p>Open the <strong>Lifegram Mini App</strong> in Telegram, go to the <strong>Setup</strong> tab, and tap <strong>Create Widget</strong>. Configure your settings:</p>

<table>
<thead><tr><th>Setting</th><th>Description</th></tr></thead>
<tbody>
<tr><td><code>Site Name</code></td><td>Shown in the chat header (e.g. "My Store")</td></tr>
<tr><td><code>Color</code></td><td>Brand color for the bubble, header, and buttons</td></tr>
<tr><td><code>Greeting</code></td><td>Welcome message shown to visitors</td></tr>
<tr><td><code>Position</code></td><td>Left or right side of the screen</td></tr>
<tr><td><code>Bubble Icon</code></td><td>Chat bubble, question mark, headset, or wave</td></tr>
<tr><td><code>Logo Text</code></td><td>2-letter initials in the chat header circle</td></tr>
</tbody>
</table>

<h2><span class="step-num">2</span> Copy the Embed Code</h2>
<p>After creating a widget, tap <strong>Embed Code</strong> to reveal the snippet:</p>
<pre><code>&lt;script
  src="https://mini.susagar.sbs/api/w/embed.js?key=YOUR_KEY"
  data-key="YOUR_KEY"
  async&gt;
&lt;/script&gt;</code><button class="copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent.trim());this.textContent='Copied!'">Copy</button></pre>
<p>Replace <code>YOUR_KEY</code> with your widget key from the Setup page.</p>

<h2><span class="step-num">3</span> Paste on Your Website</h2>
<p>Add the embed code <strong>before the closing <code>&lt;/body&gt;</code> tag</strong> on every page where you want the chat widget:</p>
<pre><code>&lt;!DOCTYPE html&gt;
&lt;html&gt;
&lt;head&gt;...&lt;/head&gt;
&lt;body&gt;
  &lt;!-- Your website content --&gt;

  &lt;!-- Lifegram Widget --&gt;
  &lt;script src="https://mini.susagar.sbs/api/w/embed.js?key=YOUR_KEY"
          data-key="YOUR_KEY" async&gt;&lt;/script&gt;
&lt;/body&gt;
&lt;/html&gt;</code></pre>
<div class="highlight">
  <p>Works with any platform: WordPress, Shopify, Wix, Squarespace, static HTML, React, Next.js, and more.</p>
</div>

<h2><span class="step-num">4</span> Respond to Messages</h2>
<p>When a visitor sends a message, it appears in your <strong>Widget Inbox</strong> tab inside the Lifegram Mini App. Reply in real-time — visitors see your responses within seconds.</p>
<div style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0">
<span class="tag">Pre-chat form</span>
<span class="tag">Name + Email capture</span>
<span class="tag">Unread badges</span>
<span class="tag">Typing indicator</span>
</div>

<h2>Customization Options</h2>
<p>Make the widget match your brand:</p>
<div style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0">
<span class="tag">10 color presets + custom hex</span>
<span class="tag">Left or right position</span>
<span class="tag">4 bubble icon styles</span>
<span class="tag">Custom logo initials</span>
<span class="tag">Custom greeting message</span>
<span class="tag">Pause / resume anytime</span>
<span class="tag">AI auto-reply</span>
<span class="tag">Train AI from website URLs</span>
</div>

<h2>Need Help?</h2>
<p>Open the <strong>Lifegram Bot</strong> on Telegram (<a href="https://t.me/lifegrambot">@lifegrambot</a>) and send a message. We'll help you get set up.</p>

<footer>
  <p>@lifegrambot &nbsp;·&nbsp; Lifegram Live Chat Widget</p>
  <p><a href="https://lifegram-miniapp.pages.dev/miniapp/">Open Mini App</a> &nbsp;·&nbsp; <a href="https://mini.susagar.sbs/api/privacy">Privacy Policy</a></p>
</footer>

</article>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});

function getEmbedScript(apiBase: string, defaultKey: string): string {
  return `(function(){
"use strict";
if(window.__lifegram_widget) return;
window.__lifegram_widget = true;

var API = "${apiBase}";
var scriptEl = document.currentScript;
var KEY = (scriptEl && scriptEl.getAttribute ? scriptEl.getAttribute("data-key") : null) || "${defaultKey}";
var STORAGE_KEY = "lg_widget_" + KEY;
var HISTORY_KEY = "lg_widget_hist_" + KEY;
var EXPIRY_DAYS = 7;

function getStored() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    var d = JSON.parse(raw);
    if (Date.now() - d.ts > EXPIRY_DAYS * 86400000) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(HISTORY_KEY);
      return null;
    }
    return d;
  } catch(e) { return null; }
}

function setStored(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({...data, ts: Date.now()})); } catch(e) {}
}

function getHistory() {
  try {
    var raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    var d = JSON.parse(raw);
    if (Date.now() - (d.ts || 0) > EXPIRY_DAYS * 86400000) {
      localStorage.removeItem(HISTORY_KEY);
      return [];
    }
    return d.msgs || [];
  } catch(e) { return []; }
}

function saveHistory(msgs) {
  try {
    var trimmed = msgs.slice(-200);
    localStorage.setItem(HISTORY_KEY, JSON.stringify({msgs: trimmed, ts: Date.now()}));
  } catch(e) {}
}

var state = {
  open: false,
  tab: "home",
  started: false,
  session_key: null,
  session_id: null,
  name: "",
  email: "",
  messages: [],
  color: "#0a0a0a",
  btn_color: "",
  greeting: "Hello, nice to see you here \\u{1F44B}",
  site_name: "",
  position: "right",
  logo_text: "",
  bubble_icon: "chat",
  faq_items: [],
  social_links: [],
  sending: false,
  lastId: 0,
  unreadCount: 0,
  typing: false,
  faqOpen: -1,
  domainError: false,
  hide_watermark: false,
};

var stored = getStored();
if (stored && stored.session_key) {
  state.session_key = stored.session_key;
  state.session_id = stored.session_id;
  state.name = stored.name || "";
  state.email = stored.email || "";
  state.started = true;
  state.messages = getHistory();
  if (state.messages.length > 0) {
    state.lastId = Math.max(...state.messages.map(function(m){return m.id || 0}));
  }
}

fetch(API + "/w/config?key=" + KEY).then(function(r){return r.json()}).then(function(d){
  if(d.error) { console.warn("[Lifegram Widget] " + d.error); return; }

  if(d.allowed_domains) {
    var domains = d.allowed_domains.split(",");
    var host = window.location.hostname.replace(/^www\\./, "").toLowerCase();
    var allowed = false;
    for (var di = 0; di < domains.length; di++) {
      var dm = domains[di].trim().toLowerCase();
      if (host === dm || host.endsWith("." + dm)) { allowed = true; break; }
    }
    if (!allowed) {
      console.error("[Lifegram Widget] Domain not authorized: " + host + ". Allowed: " + d.allowed_domains);
      state.domainError = true;
      render();
      return;
    }
  }

  if(d.color) state.color = d.color;
  if(d.btn_color) state.btn_color = d.btn_color;
  if(d.greeting) state.greeting = d.greeting;
  if(d.site_name) state.site_name = d.site_name;
  if(d.position) state.position = d.position;
  if(d.logo_text) state.logo_text = d.logo_text;
  if(d.bubble_icon) state.bubble_icon = d.bubble_icon;
  if(d.faq_items && Array.isArray(d.faq_items)) state.faq_items = d.faq_items;
  if(d.social_links && Array.isArray(d.social_links)) state.social_links = d.social_links;
  if(d.hide_watermark) state.hide_watermark = true;
  applyColor();
  applyPosition();
  render();
  if(state.started) resumeSession();
}).catch(function(e){ console.warn("[Lifegram Widget] Config fetch failed:", e); });

function initDOM() {
if (!document.body || document.getElementById("lg-chat-widget")) return;
var root = document.createElement("div");
root.id = "lg-chat-widget";
document.body.appendChild(root);
window.__lgRoot = root;

var style = document.createElement("style");
style.textContent = \`
#lg-chat-widget { font-family: 'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size: 14px; line-height: 1.5; --lg-color: #0a0a0a; --lg-bg: #0a0a0a; --lg-surface: #161616; --lg-card: #111; --lg-border: rgba(255,255,255,0.08); --lg-text: #f5f5f5; --lg-text-dim: #a1a1a1; --lg-text-light: #888; --lg-accent: #fff; --lg-radius: 16px; --lg-shadow: 0 25px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06); }
#lg-chat-widget * { box-sizing: border-box; margin: 0; padding: 0; }
#lg-chat-widget ::-webkit-scrollbar { width: 4px; }
#lg-chat-widget ::-webkit-scrollbar-track { background: transparent; }
#lg-chat-widget ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

.lg-bubble { position: fixed; bottom: 24px; z-index: 99998; width: 56px; height: 56px; border-radius: 50%; background: #0a0a0a; color: white; border: 1px solid rgba(255,255,255,0.12); cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 32px rgba(0,0,0,0.4); transition: all 0.25s cubic-bezier(.34,1.56,.64,1); }
.lg-pos-right .lg-bubble { right: 24px; }
.lg-pos-left .lg-bubble { left: 24px; }
.lg-bubble:hover { transform: scale(1.08); box-shadow: 0 12px 40px rgba(0,0,0,0.5); border-color: rgba(255,255,255,0.2); }
.lg-bubble:active { transform: scale(0.94); }
.lg-bubble svg { width: 22px; height: 22px; }
.lg-badge { position: absolute; top: -4px; right: -4px; background: #fff; color: #0a0a0a; font-size: 10px; font-weight: 800; min-width: 18px; height: 18px; border-radius: 9px; display: flex; align-items: center; justify-content: center; padding: 0 5px; }

.lg-panel { position: fixed; bottom: 92px; z-index: 99999; width: 370px; max-width: calc(100vw - 24px); height: 540px; max-height: calc(100vh - 108px); background: var(--lg-bg); border-radius: var(--lg-radius); border: 1px solid rgba(255,255,255,0.06); box-shadow: var(--lg-shadow); display: flex; flex-direction: column; overflow: hidden; opacity: 0; transform: translateY(12px) scale(0.97); transition: opacity 0.2s ease, transform 0.2s ease; pointer-events: none; }
.lg-pos-right .lg-panel { right: 24px; }
.lg-pos-left .lg-panel { left: 24px; }
.lg-panel.lg-open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

.lg-home { flex: 1; display: flex; flex-direction: column; overflow-y: auto; }
.lg-home-hero { padding: 28px 20px 22px; border-bottom: 1px solid var(--lg-border); }
.lg-home-greeting { font-size: 22px; font-weight: 700; color: var(--lg-text); line-height: 1.25; letter-spacing: -0.5px; }
.lg-home-sub { font-size: 12px; color: var(--lg-text-dim); margin-top: 8px; display: flex; align-items: center; gap: 6px; }
.lg-home-body { flex: 1; padding: 14px; }

.lg-support-card { background: var(--lg-surface); border: 1px solid var(--lg-border); border-radius: 12px; padding: 14px; margin-bottom: 8px; transition: all 0.15s; cursor: pointer; }
.lg-support-card:hover { border-color: rgba(255,255,255,0.15); background: #1a1a1a; }
.lg-support-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.lg-support-avatar { width: 38px; height: 38px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; color: #0a0a0a; flex-shrink: 0; overflow: hidden; }
.lg-support-avatar svg { width: 16px; height: 16px; color: #0a0a0a; }
.lg-support-avatar span { font-weight: 800; font-size: 13px; color: #0a0a0a; }
.lg-support-info { flex: 1; min-width: 0; }
.lg-support-label { font-size: 10px; color: var(--lg-text-light); font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; }
.lg-support-name { font-size: 14px; font-weight: 600; color: var(--lg-text); }

.lg-cta-btn { width: 100%; padding: 11px 16px; border: none; border-radius: 10px; background: #fff; color: #0a0a0a; font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.15s; letter-spacing: -0.2px; }
.lg-cta-btn:hover { opacity: 0.9; }
.lg-cta-btn:active { transform: scale(0.98); }

.lg-contact-form { padding: 0 20px 20px; flex: 1; display: flex; flex-direction: column; }
.lg-contact-form h3 { font-size: 18px; font-weight: 700; color: var(--lg-text); margin-bottom: 4px; text-align: center; padding-top: 24px; letter-spacing: -0.3px; }
.lg-contact-form p { font-size: 13px; color: var(--lg-text-dim); text-align: center; margin-bottom: 20px; }
.lg-cf-input { width: 100%; padding: 12px 14px; border: 1px solid var(--lg-border); border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; background: var(--lg-surface); color: var(--lg-text); margin-bottom: 8px; transition: border-color 0.15s; }
.lg-cf-input::placeholder { color: var(--lg-text-light); }
.lg-cf-input:focus { border-color: rgba(255,255,255,0.25); }
.lg-cf-btn { width: 100%; padding: 12px; border: none; border-radius: 10px; background: #fff; color: #0a0a0a; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.15s; margin-top: 4px; }
.lg-cf-btn:hover { opacity: 0.9; }
.lg-cf-btn:disabled { opacity: 0.3; cursor: not-allowed; }

.lg-chat-header { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: var(--lg-bg); border-bottom: 1px solid var(--lg-border); flex-shrink: 0; }
.lg-chat-header-avatar { width: 38px; height: 38px; border-radius: 50%; background: #fff; display: flex; align-items: center; justify-content: center; color: #0a0a0a; flex-shrink: 0; }
.lg-chat-header-avatar svg { width: 16px; height: 16px; color: #0a0a0a; }
.lg-chat-header-avatar span { font-weight: 800; font-size: 14px; color: #0a0a0a; }
.lg-chat-header-info { flex: 1; }
.lg-chat-header-name { font-size: 15px; font-weight: 600; color: var(--lg-text); letter-spacing: -0.2px; }
.lg-chat-header-status { font-size: 11px; color: var(--lg-text-dim); display: flex; align-items: center; gap: 5px; margin-top: 1px; }
.lg-online-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; display: inline-block; animation: lgPulse 2s infinite; }
@keyframes lgPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

.lg-chat-body { flex: 1; overflow-y: auto; padding: 16px 14px; display: flex; flex-direction: column; gap: 6px; background: var(--lg-bg); }
.lg-msg { max-width: 82%; padding: 10px 14px; font-size: 13px; line-height: 1.5; word-break: break-word; white-space: pre-wrap; animation: lgMsgIn 0.2s ease; }
@keyframes lgMsgIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.lg-msg-visitor { background: #fff; color: #0a0a0a; align-self: flex-end; border-radius: 16px 16px 4px 16px; }
.lg-msg-owner { background: var(--lg-surface); color: var(--lg-text); align-self: flex-start; border-radius: 16px 16px 16px 4px; border: 1px solid var(--lg-border); }
.lg-msg-system { background: var(--lg-surface); color: var(--lg-text-dim); align-self: flex-start; border-radius: 16px 16px 16px 4px; border: 1px solid var(--lg-border); font-style: italic; font-size: 12px; }
.lg-msg-time { font-size: 10px; margin-top: 3px; opacity: 0.5; }
.lg-msg-visitor .lg-msg-time { text-align: right; color: #666; }
.lg-msg-owner .lg-msg-time { color: var(--lg-text-light); }

.lg-chat-footer { padding: 10px 14px 12px; background: var(--lg-bg); border-top: 1px solid var(--lg-border); flex-shrink: 0; }
.lg-chat-input-row { display: flex; align-items: flex-end; gap: 8px; }
.lg-chat-input { flex: 1; resize: none; border: 1px solid var(--lg-border); border-radius: 10px; padding: 10px 14px; font-size: 14px; font-family: inherit; outline: none; min-height: 40px; max-height: 80px; background: var(--lg-surface); color: var(--lg-text); line-height: 1.4; transition: border-color 0.15s; }
.lg-chat-input::placeholder { color: var(--lg-text-light); }
.lg-chat-input:focus { border-color: rgba(255,255,255,0.2); }
.lg-send-btn { height: 40px; width: 40px; min-width: 40px; border-radius: 10px; background: #fff; color: #0a0a0a; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0; transition: all 0.15s; }
.lg-send-btn:disabled { opacity: 0.2; cursor: not-allowed; }
.lg-send-btn:not(:disabled):hover { opacity: 0.85; }
.lg-send-btn:not(:disabled):active { transform: scale(0.94); }
.lg-send-btn svg { width: 16px; height: 16px; }

.lg-typing { align-self: flex-start; background: var(--lg-surface); border: 1px solid var(--lg-border); border-radius: 16px 16px 16px 4px; padding: 10px 16px; display: flex; gap: 4px; align-items: center; }
.lg-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--lg-text-dim); animation: lgDots 1.4s infinite ease-in-out; }
.lg-typing span:nth-child(2) { animation-delay: 0.16s; }
.lg-typing span:nth-child(3) { animation-delay: 0.32s; }
@keyframes lgDots { 0%,80%,100%{transform:scale(0.6);opacity:0.3} 40%{transform:scale(1);opacity:1} }

.lg-tab-bar { display: flex; background: var(--lg-bg); flex-shrink: 0; border-top: 1px solid var(--lg-border); }
.lg-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 0 6px; border: none; background: none; color: var(--lg-text-light); cursor: pointer; font-size: 10px; font-weight: 600; transition: color 0.15s; font-family: inherit; letter-spacing: 0.2px; }
.lg-tab svg { width: 18px; height: 18px; }
.lg-tab.lg-tab-active { color: #fff; }
.lg-tab:hover { color: var(--lg-text-dim); }
.lg-tab.lg-tab-active:hover { color: #fff; }
.lg-tab-badge { position: relative; }
.lg-tab-badge-dot { position: absolute; top: -2px; right: -6px; width: 7px; height: 7px; border-radius: 50%; background: #fff; }

.lg-faq { margin-top: 6px; }
.lg-faq-title { font-size: 10px; font-weight: 700; color: var(--lg-text-light); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; padding: 0 2px; }
.lg-faq-item { background: var(--lg-surface); border: 1px solid var(--lg-border); border-radius: 10px; margin-bottom: 4px; overflow: hidden; transition: border-color 0.15s; }
.lg-faq-item:hover { border-color: rgba(255,255,255,0.12); }
.lg-faq-q { display: flex; align-items: center; justify-content: space-between; padding: 11px 12px; cursor: pointer; color: var(--lg-text-dim); font-size: 13px; font-weight: 500; border: none; background: none; width: 100%; text-align: left; font-family: inherit; transition: color 0.15s; }
.lg-faq-q:hover { color: var(--lg-text); }
.lg-faq-q svg { width: 14px; height: 14px; flex-shrink: 0; color: var(--lg-text-light); transition: transform 0.2s; }
.lg-faq-q.lg-faq-open svg { transform: rotate(180deg); color: var(--lg-text); }
.lg-faq-a { padding: 0 12px 11px; font-size: 13px; color: var(--lg-text-dim); line-height: 1.55; display: none; }
.lg-faq-a.lg-faq-show { display: block; animation: lgMsgIn 0.15s ease; }

.lg-social { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.lg-social-btn { display: flex; align-items: center; gap: 7px; padding: 9px 12px; background: var(--lg-surface); border: 1px solid var(--lg-border); border-radius: 10px; color: var(--lg-text-dim); font-size: 12px; font-weight: 500; cursor: pointer; text-decoration: none; transition: all 0.15s; flex: 1; min-width: calc(50% - 3px); font-family: inherit; }
.lg-social-btn:hover { border-color: rgba(255,255,255,0.15); color: var(--lg-text); background: #1a1a1a; }
.lg-social-btn svg { width: 16px; height: 16px; flex-shrink: 0; }

.lg-watermark { text-align: center; padding: 5px; font-size: 9px; color: var(--lg-text-light); letter-spacing: 0.2px; }
.lg-watermark a { color: var(--lg-text-dim); text-decoration: none; font-weight: 600; transition: color 0.15s; }
.lg-watermark a:hover { color: #fff; }

@media(max-width:480px) {
  .lg-panel { bottom: 0; right: 0; left: 0; width: 100%; max-width: 100%; height: 100vh; max-height: 100vh; border-radius: 0; box-shadow: none; border: none; }
  .lg-panel.lg-open { transform: translateY(0); }
  .lg-pos-right .lg-bubble { bottom: 20px; right: 20px; }
  .lg-pos-left .lg-bubble { bottom: 20px; left: 20px; }
}
\`;
document.head.appendChild(style);
}

var root;
function getRoot() { if (!root) root = document.getElementById("lg-chat-widget"); return root; }

function applyColor() { }
function applyPosition() { var r = getRoot(); if (r) { r.classList.remove("lg-pos-left","lg-pos-right"); r.classList.add("lg-pos-" + state.position); } }

var bubbleIcons = {
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/><path d="M7.5 7.5l9 9"/></svg>',
  headset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
};
function getBubbleIcon() { return bubbleIcons[state.bubble_icon] || bubbleIcons.chat; }

var icons = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
};

var socialIcons = {
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  telegram: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
  email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  website: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  discord: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>',
  snapchat: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.922-.214.04-.012.06-.012.08-.012.12 0 .24.045.36.105a.58.58 0 01.27.39c.03.135 0 .36-.21.525-.06.045-.27.18-.705.39-.195.09-.405.15-.6.21-.18.06-.36.12-.48.195-.15.09-.33.3-.345.51-.015.12 0 .255.06.39.18.42.51.81.87 1.17.195.21.42.42.66.615 1.02.825 2.19 1.77 2.475 2.895.075.24.09.48.015.72-.075.3-.27.525-.48.69-.39.33-.855.525-1.41.615-.27.045-.57.075-.87.09-.21.015-.42.015-.615.045-.135.015-.27.06-.42.12-.27.12-.54.36-.78.555a5.59 5.59 0 01-1.65 1.08c-.375.15-.78.225-1.29.225-.39 0-.81-.06-1.23-.195a3.36 3.36 0 00-.915-.18c-.255 0-.54.06-.81.135-.39.12-.78.225-1.17.225h-.12c-.51 0-.915-.075-1.29-.225a5.57 5.57 0 01-1.635-1.065c-.255-.21-.54-.45-.78-.57a2.11 2.11 0 00-.42-.12c-.195-.03-.405-.03-.615-.045a6.97 6.97 0 01-.87-.09c-.555-.09-1.02-.285-1.41-.615-.21-.165-.405-.39-.48-.69a1.07 1.07 0 01.015-.72c.285-1.125 1.455-2.07 2.475-2.895.24-.195.465-.405.66-.615.36-.36.69-.75.87-1.17.06-.135.075-.27.06-.39-.015-.21-.195-.42-.345-.51-.12-.075-.3-.135-.48-.195a3.63 3.63 0 01-.6-.21c-.435-.21-.645-.345-.705-.39-.21-.165-.24-.39-.21-.525a.58.58 0 01.27-.39c.12-.06.24-.105.36-.105.02 0 .04 0 .08.015.263.09.622.228.922.214.198 0 .326-.045.401-.09a11.74 11.74 0 01-.03-.51l-.003-.06c-.105-1.628-.23-3.654.3-4.847C7.86 1.069 11.216.793 12.206.793z"/></svg>',
  pinterest: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z"/></svg>',
};

var socialColors = {
  whatsapp: "#25D366", instagram: "#E4405F", facebook: "#1877F2", twitter: "#000000",
  telegram: "#26A5E4", linkedin: "#0A66C2", youtube: "#FF0000", tiktok: "#000000",
  email: "#6b7280", website: "#6b7280", discord: "#5865F2", snapchat: "#FFFC00",
  pinterest: "#BD081C",
};

var socialLabels = {
  whatsapp: "WhatsApp", instagram: "Instagram", facebook: "Facebook", twitter: "X (Twitter)",
  telegram: "Telegram", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok",
  email: "Email", website: "Website", discord: "Discord", snapchat: "Snapchat",
  pinterest: "Pinterest",
};

function getSocialIcon(p) { return socialIcons[p] || socialIcons.website; }
function getSocialColor(p) { return socialColors[p] || "#6b7280"; }
function getSocialLabel(p) { return socialLabels[p] || p; }

function fmtTime(iso) {
  var d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
  return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
}

function esc(s) {
  var d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

function avatarHtml(size) {
  var sz = size || "44";
  if (state.logo_text) {
    return '<span style="font-weight:700;font-size:' + (parseInt(sz) > 40 ? '16' : '14') + 'px">' + esc(state.logo_text.substring(0,2).toUpperCase()) + '</span>';
  }
  return icons.support;
}

function render() {
  initDOM();
  applyColor();
  applyPosition();
  var root = getRoot();
  if (!root) return;
  var html = '';

  html += '<button class="lg-bubble" onclick="window.__lgToggle()">';
  html += state.open ? icons.close : getBubbleIcon();
  if (!state.open && state.unreadCount > 0) {
    html += '<span class="lg-badge">' + state.unreadCount + '</span>';
  }
  html += '</button>';

  html += '<div class="lg-panel ' + (state.open ? 'lg-open' : '') + '">';

  if (state.domainError) {
    html += '<div class="lg-home" style="justify-content:center;align-items:center;text-align:center;padding:40px 24px">';
    html += '<div style="width:48px;height:48px;border-radius:50%;background:#ef4444;display:flex;align-items:center;justify-content:center;margin:0 auto 16px">';
    html += '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width:24px;height:24px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    html += '</div>';
    html += '<div style="font-size:16px;font-weight:700;color:#f5f5f5;margin-bottom:8px">Domain Not Authorized</div>';
    html += '<div style="font-size:13px;color:#a1a1a1;line-height:1.5">This widget is not configured to run on this domain. Please check your widget settings.</div>';
    html += '</div>';

  } else if (state.tab === "home") {
    html += '<div class="lg-home">';
    html += '<div class="lg-home-hero">';
    html += '<div class="lg-home-greeting">' + esc(state.greeting) + '</div>';
    html += '<div class="lg-home-sub"><span class="lg-online-dot"></span> We reply in minutes</div>';
    html += '</div>';
    html += '<div class="lg-home-body">';

    html += '<div class="lg-support-card">';
    html += '<div class="lg-support-row">';
    html += '<div class="lg-support-avatar">' + avatarHtml("44") + '</div>';
    html += '<div class="lg-support-info">';
    html += '<div class="lg-support-label">Support</div>';
    html += '<div class="lg-support-name">Write to us</div>';
    html += '</div>';
    html += '</div>';
    html += '<button class="lg-cta-btn" id="lg-contact-btn">Contact us</button>';
    html += '</div>';

    if (state.started && state.messages.length > 0) {
      var last = state.messages[state.messages.length - 1];
      html += '<div class="lg-support-card" style="cursor:pointer" id="lg-resume-chat">';
      html += '<div class="lg-support-row">';
      html += '<div class="lg-support-avatar" style="width:36px;height:36px">' + avatarHtml("36") + '</div>';
      html += '<div class="lg-support-info">';
      html += '<div class="lg-support-label">Recent conversation</div>';
      html += '<div class="lg-support-name" style="font-size:13px;font-weight:400;color:var(--lg-text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(last.text).substring(0,50) + '</div>';
      html += '</div>';
      html += '</div>';
      html += '</div>';
    }

    if (state.social_links.length > 0) {
      html += '<div class="lg-social">';
      for (var si = 0; si < state.social_links.length; si++) {
        var sl = state.social_links[si];
        var sColor = getSocialColor(sl.platform);
        html += '<a class="lg-social-btn" href="' + esc(sl.url) + '" target="_blank" rel="noopener">';
        html += '<span style="color:' + sColor + '">' + getSocialIcon(sl.platform) + '</span>';
        html += esc(getSocialLabel(sl.platform));
        html += '</a>';
      }
      html += '</div>';
    }

    if (state.faq_items.length > 0) {
      html += '<div class="lg-faq">';
      html += '<div class="lg-faq-title">FAQ</div>';
      for (var fi = 0; fi < state.faq_items.length; fi++) {
        var fItem = state.faq_items[fi];
        var isOpen = state.faqOpen === fi;
        html += '<div class="lg-faq-item">';
        html += '<button class="lg-faq-q' + (isOpen ? ' lg-faq-open' : '') + '" data-faq="' + fi + '">' + esc(fItem.q) + icons.chevron + '</button>';
        html += '<div class="lg-faq-a' + (isOpen ? ' lg-faq-show' : '') + '">' + esc(fItem.a) + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';

  } else if (state.tab === "contact") {
    html += '<div class="lg-home">';
    html += '<div class="lg-contact-form">';
    html += '<h3>Start a conversation</h3>';
    html += '<p>We\\u2019ll get back to you as soon as possible</p>';
    html += '<input class="lg-cf-input" id="lg-name" placeholder="Your name" value="' + esc(state.name) + '" />';
    html += '<input class="lg-cf-input" id="lg-email" type="email" placeholder="Email address" value="' + esc(state.email) + '" />';
    html += '<button class="lg-cf-btn" id="lg-start-btn" ' + (state.sending ? 'disabled' : '') + '>' + (state.sending ? 'Starting...' : 'Start Chat') + '</button>';
    html += '</div>';
    html += '</div>';

  } else if (state.tab === "chat") {
    html += '<div class="lg-chat-header">';
    html += '<div class="lg-chat-header-avatar">' + avatarHtml("36") + '</div>';
    html += '<div class="lg-chat-header-info">';
    html += '<div class="lg-chat-header-name">' + esc(state.site_name || "Support") + '</div>';
    html += '<div class="lg-chat-header-status"><span class="lg-online-dot"></span> Online</div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="lg-chat-body" id="lg-msgs">';
    if (state.messages.length === 0) {
      html += '<div style="text-align:center;color:var(--lg-text-dim);padding:40px 0;font-size:13px">Send a message to start the conversation</div>';
    }
    state.messages.forEach(function(m) {
      html += '<div class="lg-msg lg-msg-' + m.sender_type + '">';
      html += esc(m.text);
      if (m.created_at) html += '<div class="lg-msg-time">' + fmtTime(m.created_at) + '</div>';
      html += '</div>';
    });
    if (state.typing) {
      html += '<div class="lg-typing"><span></span><span></span><span></span></div>';
    }
    html += '</div>';

    html += '<div class="lg-chat-footer"><div class="lg-chat-input-row">';
    html += '<textarea class="lg-chat-input" id="lg-text" placeholder="Type a message..." rows="1"></textarea>';
    html += '<button class="lg-send-btn" id="lg-send-btn" ' + (state.sending ? 'disabled' : '') + '>' + icons.send + '</button>';
    html += '</div></div>';
  }

  html += '<div class="lg-tab-bar">';
  html += '<button class="lg-tab ' + (state.tab === "home" ? "lg-tab-active" : "") + '" onclick="window.__lgTab(\\'home\\')">' + icons.home + '<span>Home</span></button>';
  html += '<button class="lg-tab ' + (state.tab === "chat" || state.tab === "contact" ? "lg-tab-active" : "") + '" onclick="window.__lgTab(\\'chat\\')">';
  if (state.unreadCount > 0 && state.tab !== "chat") {
    html += '<span class="lg-tab-badge">' + icons.chat + '<span class="lg-tab-badge-dot"></span></span>';
  } else {
    html += icons.chat;
  }
  html += '<span>Contact us</span></button>';
  html += '</div>';

  if (!state.hide_watermark) {
    html += '<div class="lg-watermark">Powered by <a href="https://mini.susagar.sbs/api/w/docs" target="_blank">Lifegram</a></div>';
  }
  html += '</div>';

  root.innerHTML = html;

  if (state.tab === "chat" && state.open) {
    var body = document.getElementById("lg-msgs");
    if (body) body.scrollTop = body.scrollHeight;
    var textarea = document.getElementById("lg-text");
    if (textarea) {
      textarea.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
      });
      textarea.addEventListener("input", function() {
        this.style.height = "auto";
        this.style.height = Math.min(this.scrollHeight, 100) + "px";
      });
    }
    var sendBtn = document.getElementById("lg-send-btn");
    if (sendBtn) sendBtn.addEventListener("click", sendMsg);
  }

  if (state.tab === "contact" && state.open) {
    var startBtn = document.getElementById("lg-start-btn");
    if (startBtn) startBtn.addEventListener("click", startChat);
    var nameI = document.getElementById("lg-name");
    var emailI = document.getElementById("lg-email");
    if (nameI) nameI.addEventListener("input", function() { state.name = this.value; });
    if (emailI) emailI.addEventListener("input", function() { state.email = this.value; });
    if (emailI) emailI.addEventListener("keydown", function(e) {
      if (e.key === "Enter") { e.preventDefault(); startChat(); }
    });
  }

  if (state.tab === "home" && state.open) {
    var contactBtn = document.getElementById("lg-contact-btn");
    if (contactBtn) contactBtn.addEventListener("click", function() {
      if (state.started) { state.tab = "chat"; render(); }
      else { state.tab = "contact"; render(); }
    });
    var resumeBtn = document.getElementById("lg-resume-chat");
    if (resumeBtn) resumeBtn.addEventListener("click", function() {
      state.tab = "chat"; render();
    });
    var faqBtns = root.querySelectorAll(".lg-faq-q");
    for (var fb = 0; fb < faqBtns.length; fb++) {
      (function(idx) {
        faqBtns[idx].addEventListener("click", function() {
          state.faqOpen = state.faqOpen === idx ? -1 : idx;
          render();
        });
      })(fb);
    }
  }
}

window.__lgToggle = function() {
  state.open = !state.open;
  if (state.open) state.unreadCount = 0;
  render();
};

window.__lgTab = function(t) {
  if (t === "chat") {
    if (state.started) { state.tab = "chat"; state.unreadCount = 0; }
    else state.tab = "contact";
  } else {
    state.tab = t;
  }
  render();
};

function startChat() {
  if (!state.name.trim() || !state.email.trim()) return;
  state.sending = true;
  render();
  fetch(API + "/w/start", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({widget_key: KEY, name: state.name.trim(), email: state.email.trim()}),
  }).then(function(r){return r.json()}).then(function(d) {
    state.sending = false;
    if (d.ok) {
      state.session_key = d.session_key;
      state.session_id = d.session_id;
      state.started = true;
      state.tab = "chat";
      if (d.color) state.color = d.color;
      if (d.site_name) state.site_name = d.site_name;
      setStored({session_key: d.session_key, session_id: d.session_id, name: state.name, email: state.email});
      pollMessages(true);
    } else {
      alert(d.error || "Failed to start chat");
    }
    render();
  }).catch(function() { state.sending = false; render(); });
}

function resumeSession() {
  fetch(API + "/w/start", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({widget_key: KEY, session_key: state.session_key, name: "", email: ""}),
  }).then(function(r){return r.json()}).then(function(d) {
    if (d.ok && d.resumed) {
      if (d.color) state.color = d.color;
      if (d.site_name) state.site_name = d.site_name;
      state.name = d.visitor_name || state.name;
      state.email = d.visitor_email || state.email;
      pollMessages(true);
    } else if (d.ok && !d.resumed) {
      state.session_key = d.session_key;
      state.session_id = d.session_id;
      setStored({session_key: d.session_key, session_id: d.session_id, name: state.name, email: state.email});
      pollMessages(true);
    } else {
      state.started = false;
      state.session_key = null;
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(HISTORY_KEY);
    }
    render();
  }).catch(function(){});
}

function sendMsg() {
  var el = document.getElementById("lg-text");
  if (!el) return;
  var txt = el.value.trim();
  if (!txt || state.sending) return;
  state.sending = true;
  var optimistic = {id: Date.now(), sender_type: "visitor", text: txt, created_at: new Date().toISOString()};
  state.messages.push(optimistic);
  saveHistory(state.messages);
  render();
  fetch(API + "/w/send", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({session_key: state.session_key, text: txt}),
  }).then(function(r){return r.json()}).then(function(d) {
    state.sending = false;
    if (!d.ok) {
      state.messages = state.messages.filter(function(m){return m.id !== optimistic.id});
      saveHistory(state.messages);
    }
    render();
  }).catch(function() {
    state.sending = false;
    state.messages = state.messages.filter(function(m){return m.id !== optimistic.id});
    saveHistory(state.messages);
    render();
  });
}

function pollMessages(initial) {
  if (!state.session_key) return;
  var afterParam = initial ? "" : "&after=" + state.lastId;
  fetch(API + "/w/messages?session_key=" + state.session_key + afterParam)
    .then(function(r){return r.json()})
    .then(function(msgs) {
      if (!Array.isArray(msgs)) return;
      if (initial) {
        state.messages = msgs;
        state.lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : 0;
      } else if (msgs.length > 0) {
        var existIds = new Set(state.messages.map(function(m){return m.id}));
        var newMsgs = msgs.filter(function(m){return !existIds.has(m.id) && m.id < 1e12});
        if (newMsgs.length > 0) {
          state.messages = state.messages.filter(function(m){return m.id < 1e12});
          state.messages = state.messages.concat(newMsgs);
          state.lastId = state.messages[state.messages.length - 1].id;
          if (!state.open || state.tab !== "chat") state.unreadCount += newMsgs.filter(function(m){return m.sender_type !== "visitor"}).length;
          render();
        }
      }
      saveHistory(state.messages);
      render();
    }).catch(function(){});
}

var pollInterval = null;
function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(function() {
    if (state.started && state.session_key) pollMessages(false);
  }, 3000);
}

applyColor();
applyPosition();
render();
startPolling();

if (state.started && state.session_key) {
  setTimeout(function(){ pollMessages(true); }, 500);
}

})();`;
}

widget.get("/widget/plan/status", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const plan = auth.isAdmin ? "pro" as WidgetPlan : await getUserWidgetPlan(c.env.DB, auth.telegramId);
  const limits = WIDGET_PLANS[plan];
  const widgetCount = await d1First<{ c: number }>(c.env.DB, "SELECT COUNT(*) as c FROM widget_configs WHERE owner_telegram_id = ?", [auth.telegramId]);
  const dailyMsgs = await getDailyWidgetMsgCount(c.env.DB, auth.telegramId);

  const sub = await d1First<{ plan: string; expires_at: string; stars_paid: number }>(
    c.env.DB,
    `SELECT plan, expires_at, stars_paid FROM widget_subscriptions WHERE telegram_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > datetime('now')) ORDER BY id DESC LIMIT 1`,
    [auth.telegramId],
  );

  return c.json({
    ok: true,
    plan,
    limits,
    usage: {
      widgets: widgetCount?.c ?? 0,
      dailyMessages: dailyMsgs,
    },
    subscription: sub ?? null,
    plans: WIDGET_PLANS,
    isAdmin: auth.isAdmin,
  });
});

widget.post("/widget/plan/purchase", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const { plan } = await c.req.json<{ plan: string }>();
  if (plan !== "standard" && plan !== "pro") return c.json({ error: "Invalid plan" }, 400);

  const planInfo = WIDGET_PLANS[plan as WidgetPlan];
  try {
    const link = await createInvoiceLink(c.env.BOT_TOKEN, {
      subscription_period: 2592000,
      title: `Widget ${planInfo.label} Plan`,
      description: `${planInfo.label}: ${planInfo.widgets} widgets, ${planInfo.msgsPerDay === -1 ? "unlimited" : planInfo.msgsPerDay} msgs/day${planInfo.ai ? ", AI auto-reply" : ""}. 30 days.`,
      payload: `widgetplan-${auth.telegramId}-${plan}`,
      currency: "XTR",
      prices: [{ label: `Widget ${planInfo.label} (30 days)`, amount: planInfo.price }],
    });
    return c.json({ ok: true, invoice_link: link, stars: planInfo.price });
  } catch (err) {
    console.error("[widget/plan/purchase]", err);
    return c.json({ error: "Failed to create invoice" }, 500);
  }
});

export default widget;
