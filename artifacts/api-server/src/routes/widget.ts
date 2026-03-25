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

  const { site_name, color, greeting, position, logo_text, bubble_icon } = await c.req.json<{
    site_name?: string; color?: string; greeting?: string; position?: string; logo_text?: string; bubble_icon?: string;
  }>();

  const existing = await d1All(
    c.env.DB,
    "SELECT id FROM widget_configs WHERE owner_telegram_id = ?",
    [auth.telegramId],
  );
  if (existing.length >= 5) return c.json({ error: "Max 5 widgets per account" }, 400);

  const widgetKey = "wk_" + generateKey(20);
  const pos = (position === "left") ? "left" : "right";
  const icon = ["chat", "help", "wave", "headset"].includes(bubble_icon || "") ? bubble_icon! : "chat";

  await d1Run(c.env.DB,
    `INSERT INTO widget_configs (widget_key, owner_telegram_id, site_name, color, greeting, position, logo_text, bubble_icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [widgetKey, auth.telegramId, site_name || "", color || "#6366f1", greeting || "Hi there! How can we help you?", pos, logo_text || "", icon],
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

  const { site_name, color, greeting, active, position, logo_text, bubble_icon } = await c.req.json<{
    site_name?: string; color?: string; greeting?: string; active?: boolean;
    position?: string; logo_text?: string; bubble_icon?: string;
  }>();

  const updates: string[] = [];
  const params: unknown[] = [];
  if (site_name !== undefined) { updates.push("site_name = ?"); params.push(site_name); }
  if (color !== undefined) { updates.push("color = ?"); params.push(color); }
  if (greeting !== undefined) { updates.push("greeting = ?"); params.push(greeting); }
  if (active !== undefined) { updates.push("active = ?"); params.push(active ? 1 : 0); }
  if (position !== undefined) { updates.push("position = ?"); params.push(position === "left" ? "left" : "right"); }
  if (logo_text !== undefined) { updates.push("logo_text = ?"); params.push(logo_text); }
  if (bubble_icon !== undefined) { updates.push("bubble_icon = ?"); params.push(["chat", "help", "wave", "headset"].includes(bubble_icon) ? bubble_icon : "chat"); }

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
    position: string; logo_text: string; bubble_icon: string;
  }>(c.env.DB, "SELECT color, greeting, site_name, active, position, logo_text, bubble_icon FROM widget_configs WHERE widget_key = ?", [widgetKey]);

  if (!config || !config.active) return c.json({ error: "Widget not found" }, 404);

  return c.json({
    color: config.color, greeting: config.greeting, site_name: config.site_name,
    position: config.position || "right", logo_text: config.logo_text || "",
    bubble_icon: config.bubble_icon || "chat",
  });
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

widget.get("/w/docs", (c) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Lifegram Live Chat Widget — Setup Guide</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8f9fb;color:#1a1a2e;line-height:1.65}
.hero{background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#a78bfa 100%);color:white;padding:60px 24px 50px;text-align:center}
.hero h1{font-size:clamp(28px,5vw,42px);font-weight:800;margin-bottom:12px;letter-spacing:-0.5px}
.hero p{font-size:clamp(15px,2.5vw,18px);opacity:0.9;max-width:600px;margin:0 auto}
.container{max-width:720px;margin:0 auto;padding:32px 20px 60px}
.card{background:white;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.06);padding:28px;margin-bottom:24px;border:1px solid #e8e8ee}
.card h2{font-size:20px;font-weight:700;margin-bottom:14px;display:flex;align-items:center;gap:10px}
.card h2 .num{background:#6366f1;color:white;width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0}
.card p,.card li{font-size:15px;color:#4b5563}
.card ul{padding-left:20px;margin:12px 0}
.card li{margin-bottom:8px}
pre{background:#1e1e2e;color:#a6e3a1;border-radius:12px;padding:18px 20px;overflow-x:auto;font-size:13px;line-height:1.6;margin:14px 0;position:relative}
pre code{font-family:'SF Mono',Monaco,Consolas,monospace}
.tag{display:inline-block;background:#ede9fe;color:#6366f1;font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;margin-right:8px}
.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:20px 0}
.feat{background:#f8f7ff;border-radius:12px;padding:18px;border:1px solid #e8e4f8}
.feat h3{font-size:14px;font-weight:700;color:#6366f1;margin-bottom:6px}
.feat p{font-size:13px;color:#6b7280}
.custom-table{width:100%;border-collapse:collapse;margin:14px 0;font-size:14px}
.custom-table th{text-align:left;padding:10px 12px;background:#f3f4f6;font-weight:600;color:#374151;border-bottom:2px solid #e5e7eb}
.custom-table td{padding:10px 12px;border-bottom:1px solid #f0f0f5;color:#4b5563}
.custom-table code{background:#f0f0f5;padding:2px 6px;border-radius:4px;font-size:12px;font-family:'SF Mono',Monaco,Consolas,monospace}
.footer{text-align:center;padding:30px 20px;color:#9ca3af;font-size:13px}
.footer a{color:#6366f1;text-decoration:none;font-weight:600}
.copy-btn{position:absolute;top:8px;right:8px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:white;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;transition:background 0.15s}
.copy-btn:hover{background:rgba(255,255,255,0.2)}
.badge-row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.icon-preview{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:50%;background:#6366f1;color:white;margin:0 6px}
.icon-preview svg{width:22px;height:22px}
@media(max-width:600px){.hero{padding:40px 20px 36px}.container{padding:20px 16px 40px}.card{padding:20px}}
</style>
</head>
<body>
<div class="hero">
<h1>Lifegram Live Chat Widget</h1>
<p>Add a beautiful live chat to any website in under 60 seconds. No coding required.</p>
</div>
<div class="container">

<div class="card">
<h2>What is Lifegram Widget?</h2>
<p>Lifegram Widget is an embeddable live chat bubble — like Zendesk or Intercom — that you add to your website with a single line of code. Visitors can start real-time conversations with you, and you respond directly from the Lifegram Mini App on Telegram.</p>
<div class="features">
<div class="feat"><h3>Real-time Chat</h3><p>Visitors get instant replies via polling. No page refresh needed.</p></div>
<div class="feat"><h3>Custom Branding</h3><p>Choose colors, icons, greeting, position, and logo text.</p></div>
<div class="feat"><h3>Mobile Ready</h3><p>Full-screen on mobile, floating bubble on desktop.</p></div>
<div class="feat"><h3>Persistent Sessions</h3><p>Chat history saved in localStorage with 7-day auto-expiry.</p></div>
</div>
</div>

<div class="card">
<h2><span class="num">1</span> Create a Widget</h2>
<p>Open the <strong>Lifegram Mini App</strong> in Telegram, go to the <strong>Setup</strong> tab, and click <strong>Create Widget</strong>. Customize:</p>
<table class="custom-table">
<thead><tr><th>Setting</th><th>Description</th></tr></thead>
<tbody>
<tr><td><code>Site Name</code></td><td>Shown in the chat header (e.g. "My Store")</td></tr>
<tr><td><code>Color</code></td><td>Brand color for the bubble, header, and buttons</td></tr>
<tr><td><code>Greeting</code></td><td>Welcome message shown to visitors</td></tr>
<tr><td><code>Position</code></td><td>Left or right side of the screen</td></tr>
<tr><td><code>Bubble Icon</code></td><td>Chat bubble, question mark, headset, or wave</td></tr>
<tr><td><code>Logo Text</code></td><td>2-letter initials shown in the chat header circle</td></tr>
</tbody>
</table>
</div>

<div class="card">
<h2><span class="num">2</span> Copy the Embed Code</h2>
<p>After creating a widget, tap <strong>Embed Code</strong> to reveal the snippet. It looks like this:</p>
<pre><code>&lt;script
  src="https://mini.susagar.sbs/api/w/embed.js?key=YOUR_KEY"
  data-key="YOUR_KEY"
  async&gt;
&lt;/script&gt;</code><button class="copy-btn" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent.trim());this.textContent='Copied!'">Copy</button></pre>
<p>Replace <code>YOUR_KEY</code> with the widget key from the Setup page.</p>
</div>

<div class="card">
<h2><span class="num">3</span> Paste on Your Website</h2>
<p>Add the embed code <strong>before the closing <code>&lt;/body&gt;</code> tag</strong> on every page you want the chat widget to appear:</p>
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
<p>Works with any platform: WordPress, Shopify, Wix, Squarespace, static HTML, React, Next.js, etc.</p>
</div>

<div class="card">
<h2><span class="num">4</span> Respond to Messages</h2>
<p>When a visitor sends a message, it appears in your <strong>Widget Inbox</strong> tab inside the Lifegram Mini App on Telegram. Reply in real-time — visitors see your responses within seconds.</p>
<div class="badge-row">
<span class="tag">Pre-chat form</span>
<span class="tag">Name + Email capture</span>
<span class="tag">Unread badges</span>
<span class="tag">Typing indicator</span>
</div>
</div>

<div class="card">
<h2>Customization Options</h2>
<p>Make the widget match your brand:</p>
<div class="badge-row">
<span class="tag">10 color presets + custom hex</span>
<span class="tag">Left or right position</span>
<span class="tag">4 bubble icon styles</span>
<span class="tag">Custom logo initials</span>
<span class="tag">Custom greeting message</span>
<span class="tag">Pause / resume anytime</span>
</div>
</div>

<div class="card">
<h2>Need Help?</h2>
<p>Open the <strong>Lifegram Bot</strong> on Telegram (<a href="https://t.me/LifegramRobot" style="color:#6366f1">@LifegramRobot</a>) and send a message. Our team will help you get set up.</p>
</div>
</div>

<div class="footer">
<p>&copy; ${new Date().getFullYear()} <a href="https://mini.susagar.sbs/miniapp/">Lifegram</a> — Live Chat for Everyone</p>
</div>
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
  tab: "home",
  started: false,
  session_key: null,
  session_id: null,
  name: "",
  email: "",
  messages: [],
  color: "#6366f1",
  greeting: "Hello, nice to see you here \\u{1F44B}",
  site_name: "",
  position: "right",
  logo_text: "",
  bubble_icon: "chat",
  sending: false,
  lastId: 0,
  unreadCount: 0,
  typing: false,
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
  if(d.position) state.position = d.position;
  if(d.logo_text) state.logo_text = d.logo_text;
  if(d.bubble_icon) state.bubble_icon = d.bubble_icon;
  applyColor();
  applyPosition();
  render();
  if(state.started) resumeSession();
}).catch(function(){});

var root = document.createElement("div");
root.id = "lg-chat-widget";
document.body.appendChild(root);

var style = document.createElement("style");
style.textContent = \`
#lg-chat-widget { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.5; --lg-color: #6366f1; }
#lg-chat-widget * { box-sizing: border-box; margin: 0; padding: 0; }

.lg-bubble { position: fixed; bottom: 20px; z-index: 99998; width: 62px; height: 62px; border-radius: 50%; background: var(--lg-color); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 24px rgba(0,0,0,0.3); transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s; }
.lg-pos-right .lg-bubble { right: 20px; }
.lg-pos-left .lg-bubble { left: 20px; }
.lg-bubble:hover { transform: scale(1.1); box-shadow: 0 6px 30px rgba(0,0,0,0.35); }
.lg-bubble svg { width: 26px; height: 26px; }
.lg-badge { position: absolute; top: -4px; right: -4px; background: #ef4444; color: white; font-size: 11px; font-weight: 700; min-width: 20px; height: 20px; border-radius: 10px; display: flex; align-items: center; justify-content: center; padding: 0 5px; border: 2px solid white; }

.lg-panel { position: fixed; bottom: 92px; z-index: 99999; width: 400px; max-width: calc(100vw - 20px); height: 560px; max-height: calc(100vh - 110px); background: #1a1b1e; border-radius: 20px; box-shadow: 0 12px 48px rgba(0,0,0,0.35); display: flex; flex-direction: column; overflow: hidden; opacity: 0; transform: translateY(16px) scale(0.92); transition: opacity 0.25s cubic-bezier(.4,0,.2,1), transform 0.25s cubic-bezier(.4,0,.2,1); pointer-events: none; }
.lg-pos-right .lg-panel { right: 20px; }
.lg-pos-left .lg-panel { left: 20px; }
.lg-panel.lg-open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }

.lg-home { flex: 1; display: flex; flex-direction: column; overflow-y: auto; }
.lg-home-hero { padding: 32px 24px 24px; }
.lg-home-greeting { font-size: 26px; font-weight: 800; color: white; line-height: 1.25; letter-spacing: -0.3px; }
.lg-home-sub { font-size: 14px; color: #9ca3af; margin-top: 8px; }
.lg-home-body { flex: 1; padding: 0 16px 16px; }

.lg-support-card { background: #2a2b2f; border-radius: 16px; padding: 16px; margin-bottom: 12px; }
.lg-support-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.lg-support-avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--lg-color); display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; overflow: hidden; }
.lg-support-avatar svg { width: 22px; height: 22px; }
.lg-support-avatar span { font-weight: 700; font-size: 16px; color: white; }
.lg-support-info { flex: 1; min-width: 0; }
.lg-support-label { font-size: 12px; color: #9ca3af; font-weight: 500; }
.lg-support-name { font-size: 15px; font-weight: 700; color: white; }

.lg-cta-btn { width: 100%; padding: 14px; border: none; border-radius: 12px; background: var(--lg-color); color: white; font-size: 15px; font-weight: 700; cursor: pointer; transition: opacity 0.15s, transform 0.1s; letter-spacing: 0.2px; }
.lg-cta-btn:hover { opacity: 0.92; }
.lg-cta-btn:active { transform: scale(0.98); }

.lg-contact-form { padding: 0 16px 16px; flex: 1; display: flex; flex-direction: column; }
.lg-contact-form h3 { font-size: 18px; font-weight: 700; color: white; margin-bottom: 4px; text-align: center; padding-top: 12px; }
.lg-contact-form p { font-size: 13px; color: #9ca3af; text-align: center; margin-bottom: 18px; }
.lg-cf-input { width: 100%; padding: 13px 16px; border: 1px solid #3a3b40; border-radius: 12px; font-size: 14px; font-family: inherit; outline: none; background: #2a2b2f; color: white; margin-bottom: 10px; transition: border-color 0.15s; }
.lg-cf-input::placeholder { color: #6b7280; }
.lg-cf-input:focus { border-color: var(--lg-color); }
.lg-cf-btn { width: 100%; padding: 14px; border: none; border-radius: 12px; background: var(--lg-color); color: white; font-size: 15px; font-weight: 700; cursor: pointer; transition: opacity 0.15s; margin-top: 4px; }
.lg-cf-btn:hover { opacity: 0.92; }
.lg-cf-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.lg-chat-header { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid #2a2b2f; }
.lg-chat-header-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--lg-color); display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
.lg-chat-header-avatar svg { width: 18px; height: 18px; }
.lg-chat-header-avatar span { font-weight: 700; font-size: 14px; }
.lg-chat-header-info { flex: 1; }
.lg-chat-header-name { font-size: 14px; font-weight: 700; color: white; }
.lg-chat-header-status { font-size: 11px; color: #4ade80; display: flex; align-items: center; gap: 4px; }
.lg-online-dot { width: 6px; height: 6px; border-radius: 50%; background: #4ade80; display: inline-block; }

.lg-chat-body { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 6px; }
.lg-msg { max-width: 80%; padding: 10px 14px; border-radius: 18px; font-size: 14px; line-height: 1.45; word-break: break-word; white-space: pre-wrap; animation: lgFadeIn 0.2s ease; }
@keyframes lgFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
.lg-msg-visitor { background: var(--lg-color); color: white; align-self: flex-end; border-bottom-right-radius: 6px; }
.lg-msg-owner { background: #2a2b2f; color: #e5e7eb; align-self: flex-start; border-bottom-left-radius: 6px; }
.lg-msg-system { background: #2a2b2f; color: #9ca3af; align-self: flex-start; border-bottom-left-radius: 6px; font-style: italic; font-size: 13px; }
.lg-msg-time { font-size: 10px; opacity: 0.5; margin-top: 3px; text-align: right; }

.lg-chat-footer { padding: 10px 14px; border-top: 1px solid #2a2b2f; }
.lg-chat-input-row { display: flex; gap: 8px; align-items: flex-end; }
.lg-chat-input { flex: 1; resize: none; border: 1px solid #3a3b40; border-radius: 14px; padding: 11px 14px; font-size: 14px; font-family: inherit; outline: none; min-height: 42px; max-height: 100px; background: #2a2b2f; color: white; transition: border-color 0.15s; }
.lg-chat-input::placeholder { color: #6b7280; }
.lg-chat-input:focus { border-color: var(--lg-color); }
.lg-send-btn { width: 42px; height: 42px; border-radius: 50%; background: var(--lg-color); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.15s, transform 0.1s; }
.lg-send-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.lg-send-btn:not(:disabled):hover { opacity: 0.88; }
.lg-send-btn:not(:disabled):active { transform: scale(0.92); }
.lg-send-btn svg { width: 18px; height: 18px; }

.lg-typing { align-self: flex-start; background: #2a2b2f; border-radius: 18px; border-bottom-left-radius: 6px; padding: 10px 16px; display: flex; gap: 4px; }
.lg-typing span { width: 6px; height: 6px; border-radius: 50%; background: #6b7280; animation: lgBounce 1.2s infinite; }
.lg-typing span:nth-child(2) { animation-delay: 0.2s; }
.lg-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes lgBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }

.lg-tab-bar { display: flex; border-top: 1px solid #2a2b2f; background: #1a1b1e; flex-shrink: 0; }
.lg-tab { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 10px 0 8px; border: none; background: none; color: #6b7280; cursor: pointer; font-size: 11px; font-weight: 600; transition: color 0.15s; font-family: inherit; }
.lg-tab svg { width: 20px; height: 20px; }
.lg-tab.lg-tab-active { color: var(--lg-color); }
.lg-tab:hover { color: #d1d5db; }
.lg-tab.lg-tab-active:hover { color: var(--lg-color); }
.lg-tab-badge { position: relative; }
.lg-tab-badge-dot { position: absolute; top: -2px; right: -6px; width: 8px; height: 8px; border-radius: 50%; background: #ef4444; }

.lg-watermark { text-align: center; padding: 6px; font-size: 10px; color: #4b5563; background: #1a1b1e; letter-spacing: 0.2px; }
.lg-watermark a { color: #6b7280; text-decoration: none; font-weight: 600; transition: color 0.15s; }
.lg-watermark a:hover { color: var(--lg-color); }

@media(max-width:480px) {
  .lg-panel { bottom: 0; right: 0; left: 0; width: 100%; max-width: 100%; height: 100vh; max-height: 100vh; border-radius: 0; }
  .lg-pos-right .lg-bubble { bottom: 16px; right: 16px; }
  .lg-pos-left .lg-bubble { bottom: 16px; left: 16px; }
}
\`;
document.head.appendChild(style);

function applyColor() { root.style.setProperty("--lg-color", state.color); }
function applyPosition() { root.classList.remove("lg-pos-left","lg-pos-right"); root.classList.add("lg-pos-" + state.position); }

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
};

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
  applyColor();
  applyPosition();
  var html = '';

  html += '<button class="lg-bubble" onclick="window.__lgToggle()">';
  html += state.open ? icons.close : getBubbleIcon();
  if (!state.open && state.unreadCount > 0) {
    html += '<span class="lg-badge">' + state.unreadCount + '</span>';
  }
  html += '</button>';

  html += '<div class="lg-panel ' + (state.open ? 'lg-open' : '') + '">';

  if (state.tab === "home") {
    html += '<div class="lg-home">';
    html += '<div class="lg-home-hero">';
    html += '<div class="lg-home-greeting">' + esc(state.greeting) + '</div>';
    html += '<div class="lg-home-sub"><span class="lg-online-dot"></span> We typically reply in minutes</div>';
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
      html += '<div class="lg-support-name" style="font-size:13px;font-weight:500;color:#d1d5db;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(last.text).substring(0,50) + '</div>';
      html += '</div>';
      html += '</div>';
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';

  } else if (state.tab === "contact") {
    html += '<div class="lg-home" style="background:#1a1b1e">';
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
      html += '<div style="text-align:center;color:#6b7280;padding:40px 0;font-size:13px">Send a message to start the conversation</div>';
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
  html += '<button class="lg-tab ' + (state.tab === "home" ? "lg-tab-active" : "") + '" onclick="window.__lgTab(\'home\')">' + icons.home + '<span>Home</span></button>';
  html += '<button class="lg-tab ' + (state.tab === "chat" || state.tab === "contact" ? "lg-tab-active" : "") + '" onclick="window.__lgTab(\'chat\')">';
  if (state.unreadCount > 0 && state.tab !== "chat") {
    html += '<span class="lg-tab-badge">' + icons.chat + '<span class="lg-tab-badge-dot"></span></span>';
  } else {
    html += icons.chat;
  }
  html += '<span>Contact us</span></button>';
  html += '</div>';

  html += '<div class="lg-watermark">Powered by <a href="https://mini.susagar.sbs/api/w/docs" target="_blank">Lifegram</a></div>';
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

export default widget;
