import { Router } from "express";
import type { Request, Response } from "express";
import { Readable } from "stream";
import { verifyToken } from "../lib/video-token.js";
import { isRevoked, revokeVideo, listVideos, getVideo } from "../lib/video-store.js";
import { requireAdmin } from "../lib/auth.js";

const router = Router();
const BOT_TOKEN  = () => process.env.BOT_TOKEN!;
const VIDEO_BASE = "https://mini.susagar.sbs/api";

// ── Telegram file resolution ──────────────────────────────────────────────────

interface TgFileInfo { url: string; size: number }

async function getTgFile(fileId: string): Promise<TgFileInfo | null> {
  try {
    const res  = await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/getFile?file_id=${fileId}`);
    const json = await res.json() as { ok: boolean; result?: { file_path?: string; file_size?: number } };
    if (!json.ok || !json.result?.file_path) return null;
    return {
      url:  `https://api.telegram.org/file/bot${BOT_TOKEN()}/${json.result.file_path}`,
      size: json.result.file_size ?? 0,
    };
  } catch { return null; }
}

// ── Validate token + revocation ───────────────────────────────────────────────

function validateVideoToken(token: string) {
  const payload = verifyToken(token);
  if (!payload) return null;
  if (isRevoked(payload.uid)) return null;
  return payload;
}

// ── Core stream helper ────────────────────────────────────────────────────────

async function streamFile(
  req:  Request,
  res:  Response,
  token: string,
  disposition: "inline" | "attachment",
): Promise<void> {
  const payload = validateVideoToken(token);
  if (!payload) {
    res.status(410).type("text").send("Link expired or revoked.");
    return;
  }

  const info = await getTgFile(payload.fid);
  if (!info) {
    res.status(502).type("text").send("Could not fetch file from Telegram.");
    return;
  }

  const range = req.headers.range;
  const upstreamHeaders: Record<string, string> = {};
  if (range) upstreamHeaders["Range"] = range;

  const tgRes = await fetch(info.url, { headers: upstreamHeaders });

  const mime          = payload.mime ?? tgRes.headers.get("content-type") ?? "video/mp4";
  const contentLength = tgRes.headers.get("content-length");
  const contentRange  = tgRes.headers.get("content-range");

  res.setHeader("Accept-Ranges",  "bytes");
  res.setHeader("Content-Type",   mime);
  res.setHeader("Cache-Control",  "no-store");
  res.setHeader("Content-Disposition",
    disposition === "attachment"
      ? `attachment; filename="${payload.name ?? "video.mp4"}"`
      : "inline",
  );

  if (contentLength) res.setHeader("Content-Length", contentLength);
  if (contentRange)  res.setHeader("Content-Range",  contentRange);

  res.status(range && tgRes.status === 206 ? 206 : 200);

  if (!tgRes.body) { res.end(); return; }
  // @ts-ignore — Readable.fromWeb available in Node 18+
  Readable.fromWeb(tgRes.body).pipe(res);
}

// ── /stream/:token ────────────────────────────────────────────────────────────

router.get("/stream/:token", (req, res) => {
  streamFile(req, res, req.params.token, "inline").catch(e => {
    console.error("[video] stream error:", e);
    if (!res.headersSent) res.status(500).end();
  });
});

// ── /download/:token ──────────────────────────────────────────────────────────

router.get("/download/:token", (req, res) => {
  streamFile(req, res, req.params.token, "attachment").catch(e => {
    console.error("[video] download error:", e);
    if (!res.headersSent) res.status(500).end();
  });
});

// ── /subtitle/:fileId — subtitle proxy (SRT → VTT passthrough) ───────────────

router.get("/subtitle/:fileId", async (req, res) => {
  try {
    const info = await getTgFile(req.params.fileId);
    if (!info) { res.status(404).end(); return; }

    const tgRes = await fetch(info.url);
    if (!tgRes.body) { res.status(502).end(); return; }

    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-store");

    // Prepend WEBVTT header so browsers accept SRT files as VTT
    res.write("WEBVTT\n\n");

    // @ts-ignore
    Readable.fromWeb(tgRes.body).pipe(res);
  } catch (e) {
    console.error("[video] subtitle error:", e);
    if (!res.headersSent) res.status(500).end();
  }
});

// ── /watch/:token — HTML5 video player page ───────────────────────────────────

router.get("/watch/:token", (req, res) => {
  const token   = req.params.token;
  const payload = validateVideoToken(token);

  if (!payload) {
    res.status(410).send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Expired</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;gap:12px}p{font-size:1.1rem}small{color:#666}</style>
</head><body><p>⏰ This link has expired or been revoked</p><small>Video links are valid for 24 hours.</small></body></html>`);
    return;
  }

  const streamUrl   = `${VIDEO_BASE}/stream/${token}`;
  const downloadUrl = `${VIDEO_BASE}/download/${token}`;
  const subTrack    = payload.sub
    ? `<track kind="subtitles" src="${VIDEO_BASE}/subtitle/${payload.sub}" default label="Subtitles">`
    : "";
  const title = payload.name ?? "Video";
  const mime  = payload.mime ?? "video/mp4";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#000000">
<title>${title}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;min-height:100vh;background:#000;color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  overscroll-behavior:none}
body{display:flex;flex-direction:column;align-items:center}
.wrap{width:100%;max-width:900px;display:flex;flex-direction:column}
.video-box{position:relative;width:100%;background:#0a0a0a}
video{width:100%;height:auto;display:block;max-height:80svh;object-fit:contain}
.controls{background:linear-gradient(to top,rgba(0,0,0,.85) 0%,transparent 100%);padding:10px 14px 6px}
.progress-track{height:4px;background:rgba(255,255,255,.18);border-radius:2px;cursor:pointer;position:relative;margin-bottom:10px;transition:height .15s}
.progress-track:hover{height:6px}
.progress-track:hover .thumb{opacity:1}
.buf-bar{position:absolute;inset:0;background:rgba(255,255,255,.15);border-radius:2px;width:0;pointer-events:none}
.play-bar{position:absolute;inset:0;background:#3b82f6;border-radius:2px;width:0;pointer-events:none}
.thumb{position:absolute;top:50%;right:-6px;transform:translateY(-50%);width:12px;height:12px;border-radius:50%;background:#3b82f6;opacity:0;transition:opacity .2s;pointer-events:none}
.row{display:flex;align-items:center;gap:8px;flex-wrap:nowrap}
.btn{background:none;border:none;color:#fff;cursor:pointer;padding:4px 5px;opacity:.8;font-size:18px;line-height:1;display:flex;align-items:center;flex-shrink:0}
.btn:hover{opacity:1}
.time{font-size:11px;color:#aaa;white-space:nowrap;flex-shrink:0}
.spacer{flex:1}
select.speed{background:rgba(255,255,255,.1);border:none;color:#fff;padding:3px 6px;border-radius:6px;font-size:12px;cursor:pointer;flex-shrink:0}
select.speed option{background:#1a1a1a}
.titlebar{padding:8px 14px 6px;font-size:13px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dlbar{display:flex;align-items:center;justify-content:center;padding:10px;border-top:1px solid rgba(255,255,255,.07)}
a.dlbtn{color:#3b82f6;text-decoration:none;font-size:13px;padding:6px 16px;border:1px solid rgba(59,130,246,.4);border-radius:8px;transition:background .15s}
a.dlbtn:hover{background:rgba(59,130,246,.12)}
@media(max-width:600px){video{max-height:55svh}.titlebar{font-size:12px;padding:6px 10px 4px}.controls{padding:8px 10px 4px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="video-box">
    <video id="v" playsinline preload="metadata" crossorigin="anonymous">
      <source src="${streamUrl}" type="${mime}">
      ${subTrack}
    </video>
    <div class="controls">
      <div class="progress-track" id="track">
        <div class="buf-bar"  id="buf"></div>
        <div class="play-bar" id="prog">
          <div class="thumb"></div>
        </div>
      </div>
      <div class="row">
        <button class="btn" id="playbtn">&#9654;</button>
        <span   class="time" id="time">0:00 / 0:00</span>
        <div class="spacer"></div>
        <select class="speed" id="speed" title="Speed">
          <option value="0.5">0.5×</option>
          <option value="0.75">0.75×</option>
          <option value="1" selected>1×</option>
          <option value="1.25">1.25×</option>
          <option value="1.5">1.5×</option>
          <option value="2">2×</option>
        </select>
        <button class="btn" id="fullbtn" title="Fullscreen">&#x26F6;</button>
      </div>
    </div>
  </div>
  <div class="titlebar" title="${title}">${title}</div>
  <div class="dlbar">
    <a href="${downloadUrl}" class="dlbtn" download>&#8595; Download</a>
  </div>
</div>
<script>
(function(){
  const v=document.getElementById('v'),playbtn=document.getElementById('playbtn'),
        prog=document.getElementById('prog'),buf=document.getElementById('buf'),
        track=document.getElementById('track'),timeEl=document.getElementById('time'),
        speedSel=document.getElementById('speed'),fullbtn=document.getElementById('fullbtn');
  const fmt=t=>{if(!isFinite(t))return'0:00';const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+String(s).padStart(2,'0')};
  playbtn.addEventListener('click',()=>v.paused?v.play():v.pause());
  v.addEventListener('play',()=>{playbtn.innerHTML='&#9646;&#9646;'});
  v.addEventListener('pause',()=>{playbtn.innerHTML='&#9654;'});
  v.addEventListener('ended',()=>{playbtn.innerHTML='&#9654;'});
  v.addEventListener('timeupdate',()=>{
    if(!v.duration)return;
    const pct=v.currentTime/v.duration*100;
    prog.style.width=pct+'%';
    timeEl.textContent=fmt(v.currentTime)+' / '+fmt(v.duration);
  });
  v.addEventListener('progress',()=>{
    if(!v.duration||!v.buffered.length)return;
    buf.style.width=(v.buffered.end(v.buffered.length-1)/v.duration*100)+'%';
  });
  let seeking=false;
  function seekTo(e){const r=track.getBoundingClientRect(),x=(e.touches?e.touches[0].clientX:e.clientX)-r.left;v.currentTime=Math.max(0,Math.min(1,x/r.width))*v.duration}
  track.addEventListener('mousedown',e=>{seeking=true;seekTo(e)});
  track.addEventListener('touchstart',e=>{seeking=true;seekTo(e)},{passive:true});
  document.addEventListener('mousemove',e=>seeking&&seekTo(e));
  document.addEventListener('touchmove',e=>seeking&&seekTo(e),{passive:true});
  document.addEventListener('mouseup',()=>{seeking=false});
  document.addEventListener('touchend',()=>{seeking=false});
  speedSel.addEventListener('change',()=>v.playbackRate=parseFloat(speedSel.value));
  fullbtn.addEventListener('click',()=>{
    if(document.fullscreenElement){document.exitFullscreen()}
    else if(v.webkitEnterFullscreen){v.webkitEnterFullscreen()}
    else{(document.querySelector('.wrap')||v).requestFullscreen&&(document.querySelector('.wrap')||v).requestFullscreen()}
  });
  document.addEventListener('fullscreenchange',()=>{fullbtn.innerHTML=document.fullscreenElement?'&#x22C5;':'&#x26F6;'});
  document.addEventListener('keydown',e=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    if(e.code==='Space'){e.preventDefault();v.paused?v.play():v.pause()}
    if(e.code==='ArrowRight')v.currentTime+=5;
    if(e.code==='ArrowLeft')v.currentTime-=5;
    if(e.code==='ArrowUp')v.volume=Math.min(1,v.volume+0.1);
    if(e.code==='ArrowDown')v.volume=Math.max(0,v.volume-0.1);
    if(e.code==='KeyF')fullbtn.click();
    if(e.code==='KeyM')v.muted=!v.muted;
  });
})();
</script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// ── Admin: list active video links ────────────────────────────────────────────

router.get("/admin/videos", requireAdmin, (_req, res) => {
  const videos = listVideos().map(e => ({
    uid:         e.uid,
    fileName:    e.fileName,
    fromName:    e.fromName,
    fromId:      e.fromId,
    fileSize:    e.fileSize,
    exp:         e.exp,
    addedAt:     e.addedAt,
    watchUrl:    e.watchUrl,
    downloadUrl: e.downloadUrl,
  }));
  res.json({ ok: true, videos });
});

// ── Admin: revoke a video link ────────────────────────────────────────────────

router.delete("/admin/videos/:uid", requireAdmin, (req, res) => {
  const { uid } = req.params;
  const entry = getVideo(uid);
  const revoked = revokeVideo(uid);
  res.json({ ok: true, revoked, had_entry: !!entry });
});

export default router;
