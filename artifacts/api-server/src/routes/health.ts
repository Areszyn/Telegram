import { Hono } from "hono";
import type { Env } from "../types.ts";
import { initSchema } from "../lib/d1.ts";
import { parseAuth } from "../lib/auth.ts";

const health = new Hono<{ Bindings: Env }>();

health.get("/health", (c) =>
  c.json({ ok: true, ts: Date.now(), runtime: "cloudflare-worker" }),
);

health.get("/healthz", (c) =>
  c.json({ status: "ok" }),
);

health.get("/health/db", async (c) => {
  try {
    const result = await c.env.DB.prepare("SELECT 1 as ok").first<{ ok: number }>();
    return c.json({ status: "ok", db: result?.ok === 1 ? "connected" : "error" });
  } catch (e) {
    return c.json({ status: "error", error: e instanceof Error ? e.message : "DB unreachable" }, 503);
  }
});

health.get("/health/bot", async (c) => {
  try {
    const res = await fetch(`https://api.telegram.org/bot${c.env.BOT_TOKEN}/getMe`);
    const data = await res.json() as { ok?: boolean; result?: { username?: string } };
    if (data.ok) {
      return c.json({ status: "ok", bot: data.result?.username || "connected" });
    }
    return c.json({ status: "error", error: "Bot API returned not ok" }, 502);
  } catch (e) {
    return c.json({ status: "error", error: e instanceof Error ? e.message : "Bot API unreachable" }, 503);
  }
});

health.get("/health/mtproto", async (c) => {
  const url = c.env.MTPROTO_BACKEND_URL;
  if (!url) return c.json({ status: "error", error: "MTPROTO_BACKEND_URL not configured" }, 503);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json() as Record<string, unknown>;
      return c.json({ status: "ok", details: data });
    }
    return c.json({ status: "error", error: `HTTP ${res.status}` }, 502);
  } catch (e) {
    return c.json({ status: "error", error: e instanceof Error ? e.message : "MTProto unreachable" }, 503);
  }
});

health.get("/init-db", async (c) => {
  const pkg = { web_version: "2.7.5" };
  const landingUrl = "https://areszyn.org";
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lifegram API — Init DB</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#0a0a0a;border:1px solid #222;border-radius:16px;padding:40px;max-width:440px;width:90%}
h1{font-size:22px;font-weight:700;margin-bottom:6px;color:#fff}
.sub{color:#666;font-size:13px;margin-bottom:28px}
.row{display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #1a1a1a}
.row:last-child{border-bottom:none}
.label{color:#888;font-size:13px}
.value{font-size:13px;font-weight:600;color:#fff}
.badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#1a1a1a;color:#fff;border:1px solid #333}
.actions{margin-top:28px;display:flex;gap:10px}
.btn{flex:1;display:flex;align-items:center;justify-content:center;padding:12px 0;text-decoration:none;border-radius:10px;font-size:13px;font-weight:600;transition:all .15s;border:none;cursor:pointer}
.btn-white{background:#fff;color:#000}
.btn-white:hover{background:#e0e0e0}
.btn-dark{background:#1a1a1a;color:#fff;border:1px solid #333}
.btn-dark:hover{background:#252525}
.btn-dark:disabled{opacity:.4;cursor:not-allowed}
.msg{margin-top:14px;font-size:12px;padding:10px 14px;border-radius:10px;display:none}
.msg-ok{background:#0a1a0a;color:#4ade80;border:1px solid #1a3a1a;display:block}
.msg-err{background:#1a0a0a;color:#f87171;border:1px solid #3a1a1a;display:block}
</style>
</head>
<body>
<div class="card">
<h1>Lifegram API</h1>
<p class="sub">Cloudflare Worker &middot; D1 &middot; R2</p>
<div class="row"><span class="label">Web Version</span><span class="badge">${pkg.web_version}</span></div>
<div class="row"><span class="label">Runtime</span><span class="value">Cloudflare Worker</span></div>
<div class="row"><span class="label">Database</span><span class="value">Cloudflare D1</span></div>
<div class="row"><span class="label">Storage</span><span class="value">Cloudflare R2</span></div>
<div class="actions">
<a href="${landingUrl}" class="btn btn-white">Landing Page &#8599;</a>
<button class="btn btn-dark" id="initBtn" onclick="initDb()">Initialize DB</button>
</div>
<div class="msg" id="msg"></div>
</div>
<script>
async function initDb(){
  var btn=document.getElementById('initBtn'),msg=document.getElementById('msg');
  btn.disabled=true;btn.textContent='Initializing...';
  msg.className='msg';msg.style.display='none';
  try{
    var r=await fetch(location.pathname,{method:'POST'});
    var d=await r.json();
    if(d.ok){msg.textContent='Database initialized successfully.';msg.className='msg msg-ok';}
    else{msg.textContent='Error: '+(d.error||'Unknown');msg.className='msg msg-err';}
  }catch(e){msg.textContent='Network error: '+e.message;msg.className='msg msg-err';}
  btn.disabled=false;btn.textContent='Initialize DB';
}
</script>
</body>
</html>`;
  return c.html(html);
});

health.post("/init-db", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Unauthorized" }, 401);
  await initSchema(c.env.DB);
  return c.json({ ok: true });
});

health.post("/setup-webhook", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Unauthorized" }, 401);
  const webhookUrl = `https://${c.env.APP_DOMAIN}/api/webhook`;
  const secretToken = c.env.BOT_TOKEN.replace(/:/g, "_");

  const result = await fetch(
    `https://api.telegram.org/bot${c.env.BOT_TOKEN}/setWebhook`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secretToken,
        allowed_updates: [
          "message", "callback_query", "pre_checkout_query",
          "my_chat_member", "chat_member",
        ],
        drop_pending_updates: false,
      }),
    },
  );
  const data = await result.json() as { ok?: boolean; description?: string };

  if (!result.ok || !data.ok) {
    return c.json({ ok: false, error: data.description ?? "Failed to set webhook", webhookUrl }, 502);
  }

  const infoRes = await fetch(
    `https://api.telegram.org/bot${c.env.BOT_TOKEN}/getWebhookInfo`,
  );
  const info = await infoRes.json() as { result?: { url?: string; pending_update_count?: number; last_error_message?: string } };

  return c.json({
    ok: true,
    webhookUrl,
    pending: info.result?.pending_update_count ?? 0,
    lastError: info.result?.last_error_message ?? null,
  });
});

export default health;
