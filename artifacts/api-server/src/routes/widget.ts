import { Hono } from "hono";
import type { Env } from "../types.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import { parseAuth } from "../lib/auth.ts";

const widget = new Hono<{ Bindings: Env }>();

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

async function requireWidgetAccess(c: { env: Env }, auth: { telegramId: string; isAdmin: boolean }): Promise<string | null> {
  if (auth.isAdmin) return null;
  const premium = await isPremium(c.env.DB, auth.telegramId);
  if (!premium) return "Premium subscription required";
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

widget.post("/widget/create", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const isAdmin = auth.isAdmin;
  const premium = await isPremium(c.env.DB, auth.telegramId);
  if (!isAdmin && !premium) return c.json({ error: "Premium required" }, 403);

  const { site_name, color, greeting } = await c.req.json<{
    site_name?: string; color?: string; greeting?: string;
  }>();

  const existing = await d1All(
    c.env.DB,
    "SELECT id FROM widget_configs WHERE owner_telegram_id = ?",
    [auth.telegramId],
  );
  if (existing.length >= 5) return c.json({ error: "Max 5 widgets per account" }, 400);

  const widgetKey = "wk_" + generateKey(20);

  await d1Run(c.env.DB,
    `INSERT INTO widget_configs (widget_key, owner_telegram_id, site_name, color, greeting) VALUES (?, ?, ?, ?, ?)`,
    [widgetKey, auth.telegramId, site_name || "", color || "#6366f1", greeting || "Hi there! How can we help you?"],
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

  const { site_name, color, greeting, active } = await c.req.json<{
    site_name?: string; color?: string; greeting?: string; active?: boolean;
  }>();

  const updates: string[] = [];
  const params: unknown[] = [];
  if (site_name !== undefined) { updates.push("site_name = ?"); params.push(site_name); }
  if (color !== undefined) { updates.push("color = ?"); params.push(color); }
  if (greeting !== undefined) { updates.push("greeting = ?"); params.push(greeting); }
  if (active !== undefined) { updates.push("active = ?"); params.push(active ? 1 : 0); }

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

  const session = await d1First<{ id: number; widget_key: string; status: string }>(
    c.env.DB, "SELECT id, widget_key, status FROM widget_sessions WHERE session_key = ?", [session_key],
  );
  if (!session) return c.json({ error: "Session not found" }, 404);
  if (session.status !== "active") return c.json({ error: "Session ended" }, 400);

  await d1Run(c.env.DB,
    "INSERT INTO widget_messages (session_id, sender_type, text) VALUES (?, 'visitor', ?)",
    [session.id, text.trim()],
  );

  await d1Run(c.env.DB, "UPDATE widget_sessions SET last_active = datetime('now') WHERE id = ?", [session.id]);

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
  }>(c.env.DB, "SELECT color, greeting, site_name, active FROM widget_configs WHERE widget_key = ?", [widgetKey]);

  if (!config || !config.active) return c.json({ error: "Widget not found" }, 404);

  return c.json({ color: config.color, greeting: config.greeting, site_name: config.site_name });
});

widget.get("/w/embed.js", async (c) => {
  const widgetKey = c.req.query("key") || "WIDGET_KEY";
  const apiBase = new URL(c.req.url).origin + "/api";

  const js = getEmbedScript(apiBase, widgetKey);

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
});

function getEmbedScript(apiBase: string, defaultKey: string): string {
  return `(function(){
"use strict";
if(window.__lifegram_widget) return;
window.__lifegram_widget = true;

var API = "${apiBase}";
var KEY = document.currentScript?.getAttribute("data-key") || "${defaultKey}";
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
  started: false,
  session_key: null,
  session_id: null,
  name: "",
  email: "",
  messages: [],
  color: "#6366f1",
  greeting: "Hi! How can we help?",
  site_name: "",
  sending: false,
  lastId: 0,
  unreadCount: 0,
  typing: false,
  online: true,
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
  if(d.color) state.color = d.color;
  if(d.greeting) state.greeting = d.greeting;
  if(d.site_name) state.site_name = d.site_name;
  applyColor();
  if(state.started) resumeSession();
}).catch(function(){});

var root = document.createElement("div");
root.id = "lg-chat-widget";
document.body.appendChild(root);

var style = document.createElement("style");
style.textContent = \`
#lg-chat-widget { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.5; }
#lg-chat-widget * { box-sizing: border-box; margin: 0; padding: 0; }
.lg-bubble { position: fixed; bottom: 20px; right: 20px; z-index: 99998; width: 60px; height: 60px; border-radius: 50%; background: var(--lg-color, #6366f1); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(0,0,0,0.25); transition: transform 0.2s, box-shadow 0.2s; }
.lg-bubble:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(0,0,0,0.3); }
.lg-bubble svg { width: 28px; height: 28px; }
.lg-badge { position: absolute; top: -4px; right: -4px; background: #ef4444; color: white; font-size: 11px; font-weight: 700; min-width: 20px; height: 20px; border-radius: 10px; display: flex; align-items: center; justify-content: center; padding: 0 5px; }
.lg-panel { position: fixed; bottom: 90px; right: 20px; z-index: 99999; width: 380px; max-width: calc(100vw - 24px); height: 520px; max-height: calc(100vh - 120px); background: #fff; border-radius: 16px; box-shadow: 0 8px 40px rgba(0,0,0,0.2); display: flex; flex-direction: column; overflow: hidden; opacity: 0; transform: translateY(12px) scale(0.95); transition: opacity 0.2s, transform 0.2s; pointer-events: none; }
.lg-panel.lg-open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
.lg-header { background: var(--lg-color, #6366f1); color: white; padding: 16px 18px; display: flex; align-items: center; gap: 12px; }
.lg-header-avatar { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.lg-header-avatar svg { width: 22px; height: 22px; }
.lg-header-info { flex: 1; min-width: 0; }
.lg-header-title { font-weight: 700; font-size: 15px; }
.lg-header-status { font-size: 12px; opacity: 0.85; display: flex; align-items: center; gap: 5px; }
.lg-online-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; display: inline-block; }
.lg-close { background: rgba(255,255,255,0.15); border: none; color: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: background 0.15s; }
.lg-close:hover { background: rgba(255,255,255,0.25); }
.lg-close svg { width: 18px; height: 18px; }
.lg-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 8px; background: #f8f9fb; }
.lg-msg { max-width: 82%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.45; word-break: break-word; white-space: pre-wrap; position: relative; animation: lgFadeIn 0.15s ease; }
@keyframes lgFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.lg-msg-visitor { background: var(--lg-color, #6366f1); color: white; align-self: flex-end; border-bottom-right-radius: 4px; }
.lg-msg-owner, .lg-msg-system { background: white; color: #1a1a2e; align-self: flex-start; border-bottom-left-radius: 4px; border: 1px solid #e5e7eb; }
.lg-msg-system { font-style: italic; opacity: 0.8; background: #f0f0f5; border: none; }
.lg-msg-time { font-size: 10px; opacity: 0.6; margin-top: 3px; text-align: right; }
.lg-footer { padding: 12px; border-top: 1px solid #e5e7eb; background: white; }
.lg-input-row { display: flex; gap: 8px; align-items: flex-end; }
.lg-input { flex: 1; resize: none; border: 1px solid #e0e0e0; border-radius: 12px; padding: 10px 14px; font-size: 14px; font-family: inherit; outline: none; min-height: 42px; max-height: 100px; transition: border-color 0.15s; background: #f8f9fb; }
.lg-input:focus { border-color: var(--lg-color, #6366f1); background: white; }
.lg-send { width: 42px; height: 42px; border-radius: 12px; background: var(--lg-color, #6366f1); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.15s; }
.lg-send:disabled { opacity: 0.4; cursor: not-allowed; }
.lg-send:not(:disabled):hover { opacity: 0.85; }
.lg-send svg { width: 18px; height: 18px; }
.lg-watermark { text-align: center; padding: 8px; font-size: 11px; color: #9ca3af; background: white; }
.lg-watermark a { color: #6366f1; text-decoration: none; font-weight: 600; }
.lg-watermark a:hover { text-decoration: underline; }
.lg-form { padding: 24px; display: flex; flex-direction: column; gap: 14px; flex: 1; justify-content: center; background: white; }
.lg-form h3 { font-size: 17px; font-weight: 700; color: #1a1a2e; text-align: center; }
.lg-form p { font-size: 13px; color: #6b7280; text-align: center; margin-top: -6px; }
.lg-form-input { width: 100%; padding: 12px 14px; border: 1px solid #e0e0e0; border-radius: 10px; font-size: 14px; font-family: inherit; outline: none; transition: border-color 0.15s; background: #f8f9fb; }
.lg-form-input:focus { border-color: var(--lg-color, #6366f1); background: white; }
.lg-form-btn { width: 100%; padding: 12px; border: none; border-radius: 10px; background: var(--lg-color, #6366f1); color: white; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
.lg-form-btn:hover { opacity: 0.9; }
.lg-form-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.lg-typing { align-self: flex-start; background: white; border: 1px solid #e5e7eb; border-radius: 16px; border-bottom-left-radius: 4px; padding: 10px 16px; display: flex; gap: 4px; }
.lg-typing span { width: 6px; height: 6px; border-radius: 50%; background: #9ca3af; animation: lgBounce 1.2s infinite; }
.lg-typing span:nth-child(2) { animation-delay: 0.2s; }
.lg-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes lgBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
@media(max-width:480px) {
  .lg-panel { bottom: 0; right: 0; left: 0; width: 100%; max-width: 100%; height: 100vh; max-height: 100vh; border-radius: 0; }
  .lg-bubble { bottom: 16px; right: 16px; width: 56px; height: 56px; }
}
\`;
document.head.appendChild(style);

function applyColor() {
  root.style.setProperty("--lg-color", state.color);
}

function chatIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'; }
function closeIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'; }
function sendIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'; }
function supportIcon() { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'; }

function fmtTime(iso) {
  var d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
  return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
}

function render() {
  applyColor();
  var html = '';

  html += '<button class="lg-bubble" onclick="window.__lgToggle()">';
  html += state.open ? closeIcon() : chatIcon();
  if (!state.open && state.unreadCount > 0) {
    html += '<span class="lg-badge">' + state.unreadCount + '</span>';
  }
  html += '</button>';

  html += '<div class="lg-panel ' + (state.open ? 'lg-open' : '') + '">';
  html += '<div class="lg-header">';
  html += '<div class="lg-header-avatar">' + supportIcon() + '</div>';
  html += '<div class="lg-header-info">';
  html += '<div class="lg-header-title">' + esc(state.site_name || "Support") + '</div>';
  html += '<div class="lg-header-status"><span class="lg-online-dot"></span> We typically reply in minutes</div>';
  html += '</div>';
  html += '<button class="lg-close" onclick="window.__lgToggle()">' + closeIcon() + '</button>';
  html += '</div>';

  if (!state.started) {
    html += '<div class="lg-form">';
    html += '<h3>Start a conversation</h3>';
    html += '<p>' + esc(state.greeting) + '</p>';
    html += '<input class="lg-form-input" id="lg-name" placeholder="Your name" value="' + esc(state.name) + '" />';
    html += '<input class="lg-form-input" id="lg-email" type="email" placeholder="Your email" value="' + esc(state.email) + '" />';
    html += '<button class="lg-form-btn" id="lg-start-btn" ' + (state.sending ? 'disabled' : '') + '>' + (state.sending ? 'Starting...' : 'Start Chat') + '</button>';
    html += '</div>';
  } else {
    html += '<div class="lg-body" id="lg-msgs">';
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

    html += '<div class="lg-footer"><div class="lg-input-row">';
    html += '<textarea class="lg-input" id="lg-text" placeholder="Type your message..." rows="1"></textarea>';
    html += '<button class="lg-send" id="lg-send-btn" ' + (state.sending ? 'disabled' : '') + '>' + sendIcon() + '</button>';
    html += '</div></div>';
  }

  html += '<div class="lg-watermark">Powered by <a href="https://mini.susagar.sbs/miniapp/" target="_blank">Lifegram</a></div>';
  html += '</div>';

  root.innerHTML = html;

  if (state.open && state.started) {
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

  if (state.open && !state.started) {
    var startBtn = document.getElementById("lg-start-btn");
    if (startBtn) startBtn.addEventListener("click", startChat);
    var nameInput = document.getElementById("lg-name");
    var emailInput = document.getElementById("lg-email");
    if (nameInput) nameInput.addEventListener("input", function() { state.name = this.value; });
    if (emailInput) emailInput.addEventListener("input", function() { state.email = this.value; });
    if (emailInput) emailInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") { e.preventDefault(); startChat(); }
    });
  }
}

function esc(s) {
  var d = document.createElement("div");
  d.textContent = s || "";
  return d.innerHTML;
}

window.__lgToggle = function() {
  state.open = !state.open;
  if (state.open) state.unreadCount = 0;
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
          if (!state.open) state.unreadCount += newMsgs.filter(function(m){return m.sender_type !== "visitor"}).length;
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
render();
startPolling();

if (state.started && state.session_key) {
  setTimeout(function(){ pollMessages(true); }, 500);
}

})();`;
}

export default widget;
