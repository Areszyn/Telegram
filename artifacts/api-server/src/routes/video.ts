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

type TgFileResult =
  | { ok: true;  url: string; size: number }
  | { ok: false; error: string; tooBig?: boolean };

async function getTgFile(fileId: string): Promise<TgFileResult> {
  const token = process.env.BOT_TOKEN;
  if (!token) return { ok: false, error: "BOT_TOKEN not configured on server" };

  console.log(`[video] getFile → file_id=${fileId.slice(0, 30)}…`);

  let json: { ok: boolean; result?: { file_path?: string; file_size?: number }; description?: string };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    json = await res.json() as typeof json;
  } catch (e) {
    console.error("[video] getFile network error:", e);
    return { ok: false, error: `Network error: ${String(e)}` };
  }

  console.log(
    `[video] getFile ← ok=${json.ok}  desc="${json.description ?? "—"}"  ` +
    `path="${json.result?.file_path?.slice(0, 40) ?? "none"}"`,
  );

  if (!json.ok) {
    const tooBig = json.description?.toLowerCase().includes("too big") ?? false;
    return { ok: false, error: json.description ?? "Telegram API error", tooBig };
  }
  if (!json.result?.file_path) {
    console.error("[video] getFile: missing file_path in result:", JSON.stringify(json.result));
    return { ok: false, error: "No file_path in Telegram response" };
  }

  const url = `https://api.telegram.org/file/bot${token}/${json.result.file_path}`;
  console.log(`[video] file URL built (token hidden)`);
  return { ok: true, url, size: json.result.file_size ?? 0 };
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
  if (!info.ok) {
    if (info.tooBig) {
      res.status(413).type("text").send(
        "File too large: Telegram Bot API only supports streaming files up to 20 MB. " +
        "Use the Download button to save it directly from Telegram.",
      );
    } else {
      res.status(502).type("text").send(`Could not fetch file from Telegram: ${info.error}`);
    }
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
    if (!info.ok) { res.status(404).end(); return; }

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
.video-box{position:relative;width:100%;background:#0a0a0a;min-height:180px}
video{width:100%;height:auto;display:block;max-height:80svh;object-fit:contain}
.err-overlay{display:none;position:absolute;inset:0;background:rgba(0,0,0,.92);
  flex-direction:column;align-items:center;justify-content:center;gap:12px;
  padding:24px;text-align:center;z-index:20}
.err-overlay.show{display:flex}
.err-overlay .icon{font-size:2.5rem}
.err-overlay p{font-size:.95rem;line-height:1.5}
.err-overlay small{font-size:.78rem;color:#888;max-width:280px}
.err-overlay a{color:#3b82f6;text-decoration:none;font-size:.85rem;
  border:1px solid rgba(59,130,246,.5);padding:7px 18px;border-radius:8px;
  margin-top:4px;transition:background .15s}
.err-overlay a:hover{background:rgba(59,130,246,.12)}
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
/* — track selector menus — */
.trk-wrap{position:relative;display:inline-flex;flex-shrink:0}
.trk-btn{background:rgba(255,255,255,.1);border:none;color:#fff;padding:3px 8px;border-radius:6px;font-size:11px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:3px;line-height:1.4}
.trk-btn:hover{background:rgba(255,255,255,.18)}
.trk-btn.on{background:rgba(59,130,246,.35);color:#93c5fd}
.popup{position:absolute;bottom:calc(100% + 8px);right:0;background:#1c1c1e;border:1px solid rgba(255,255,255,.13);border-radius:10px;padding:4px;min-width:150px;z-index:60;display:none;box-shadow:0 8px 24px rgba(0,0,0,.6)}
.popup.open{display:block}
.ptitle{font-size:10px;color:#666;padding:4px 12px 2px;text-transform:uppercase;letter-spacing:.06em;pointer-events:none}
.pitem{display:block;width:100%;text-align:left;background:none;border:none;color:#ddd;padding:7px 12px;font-size:12px;border-radius:6px;cursor:pointer;white-space:nowrap}
.pitem:hover{background:rgba(255,255,255,.09)}
.pitem.sel{color:#3b82f6;font-weight:600}
@media(max-width:600px){video{max-height:55svh}.titlebar{font-size:12px;padding:6px 10px 4px}.controls{padding:8px 10px 4px}.popup{min-width:130px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="video-box">
    <video id="v" playsinline preload="metadata" crossorigin="anonymous">
      <source src="${streamUrl}" type="${mime}">
      ${subTrack}
    </video>

    <!-- Error overlay — shown when the stream fails to load -->
    <div class="err-overlay" id="errOverlay">
      <div class="icon">⚠️</div>
      <p id="errMsg">Could not load video</p>
      <small id="errDetail">The file may be too large for the Bot API (max 20 MB) or the link may have expired.</small>
      <a href="${downloadUrl}" download>⬇ Try Download Instead</a>
    </div>
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
        <!-- Audio track picker — shown only when >1 audio track detected -->
        <div class="trk-wrap" id="audioWrap" style="display:none">
          <button class="trk-btn" id="audioBtn" title="Audio track">🎵 Audio</button>
          <div class="popup" id="audioMenu"></div>
        </div>
        <!-- Subtitle / caption picker — shown only when tracks detected -->
        <div class="trk-wrap" id="subWrap" style="display:none">
          <button class="trk-btn" id="subBtn" title="Subtitles">CC</button>
          <div class="popup" id="subMenu"></div>
        </div>
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
  const v         = document.getElementById('v');
  const playbtn   = document.getElementById('playbtn');
  const prog      = document.getElementById('prog');
  const buf       = document.getElementById('buf');
  const trackBar  = document.getElementById('track');
  const timeEl    = document.getElementById('time');
  const speedSel  = document.getElementById('speed');
  const fullbtn   = document.getElementById('fullbtn');
  const errOverlay= document.getElementById('errOverlay');
  const errMsg    = document.getElementById('errMsg');
  const errDetail = document.getElementById('errDetail');
  // track pickers
  const audioWrap = document.getElementById('audioWrap');
  const audioBtn  = document.getElementById('audioBtn');
  const audioMenu = document.getElementById('audioMenu');
  const subWrap   = document.getElementById('subWrap');
  const subBtn    = document.getElementById('subBtn');
  const subMenu   = document.getElementById('subMenu');

  // ── Error overlay ──────────────────────────────────────────────────────────
  function showErr(msg, detail) {
    if(errMsg)     errMsg.textContent    = msg    || 'Could not load video';
    if(errDetail)  errDetail.textContent = detail || '';
    if(errOverlay) errOverlay.classList.add('show');
  }

  // Probe stream URL immediately to surface a clear reason before video stalls
  fetch('${streamUrl}', {method:'HEAD', headers:{Range:'bytes=0-0'}})
    .then(r => {
      if(r.status === 413) showErr('File too large for streaming','Bot API limit is 20 MB — use the download button below.');
      else if(r.status === 410) showErr('Link expired or revoked','Video links are valid for 24 hours.');
      else if(!r.ok)           showErr('Stream unavailable ('+r.status+')','');
    })
    .catch(() => {});

  v.addEventListener('error', () => {
    const code = v.error ? v.error.code : 0;
    if(!errOverlay.classList.contains('show'))
      showErr('Could not play video', code===4 ? 'Unsupported format or stream not reachable.' : 'Check your connection and try again.');
  });

  // ── Playback controls ──────────────────────────────────────────────────────
  const fmt = t => {
    if(!isFinite(t)) return '0:00';
    const m = Math.floor(t/60), s = Math.floor(t%60);
    return m+':'+String(s).padStart(2,'0');
  };
  playbtn.addEventListener('click', () => v.paused ? v.play() : v.pause());
  v.addEventListener('play',   () => { playbtn.innerHTML = '&#9646;&#9646;'; });
  v.addEventListener('pause',  () => { playbtn.innerHTML = '&#9654;'; });
  v.addEventListener('ended',  () => { playbtn.innerHTML = '&#9654;'; });
  v.addEventListener('timeupdate', () => {
    if(!v.duration) return;
    prog.style.width = (v.currentTime/v.duration*100)+'%';
    timeEl.textContent = fmt(v.currentTime)+' / '+fmt(v.duration);
  });
  v.addEventListener('progress', () => {
    if(!v.duration || !v.buffered.length) return;
    buf.style.width = (v.buffered.end(v.buffered.length-1)/v.duration*100)+'%';
  });

  // Seek bar (mouse + touch)
  let seeking = false;
  function seekTo(e) {
    const r = trackBar.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    v.currentTime = Math.max(0, Math.min(1, x/r.width)) * v.duration;
  }
  trackBar.addEventListener('mousedown',  e => { seeking=true; seekTo(e); });
  trackBar.addEventListener('touchstart', e => { seeking=true; seekTo(e); }, {passive:true});
  document.addEventListener('mousemove',  e => seeking && seekTo(e));
  document.addEventListener('touchmove',  e => seeking && seekTo(e), {passive:true});
  document.addEventListener('mouseup',    () => { seeking=false; });
  document.addEventListener('touchend',   () => { seeking=false; });

  speedSel.addEventListener('change', () => { v.playbackRate = parseFloat(speedSel.value); });

  fullbtn.addEventListener('click', () => {
    if(document.fullscreenElement)        document.exitFullscreen();
    else if(v.webkitEnterFullscreen)      v.webkitEnterFullscreen();
    else { const w=document.querySelector('.wrap')||v; w.requestFullscreen&&w.requestFullscreen(); }
  });
  document.addEventListener('fullscreenchange', () => {
    fullbtn.innerHTML = document.fullscreenElement ? '&#x22C5;' : '&#x26F6;';
  });

  document.addEventListener('keydown', e => {
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
    if(e.code==='Space')      { e.preventDefault(); v.paused ? v.play() : v.pause(); }
    if(e.code==='ArrowRight') v.currentTime += 5;
    if(e.code==='ArrowLeft')  v.currentTime -= 5;
    if(e.code==='ArrowUp')    v.volume = Math.min(1, v.volume+0.1);
    if(e.code==='ArrowDown')  v.volume = Math.max(0, v.volume-0.1);
    if(e.code==='KeyF')       fullbtn.click();
    if(e.code==='KeyM')       v.muted = !v.muted;
  });

  // ── Popup helpers ──────────────────────────────────────────────────────────
  function mkItem(label, sel) {
    const b = document.createElement('button');
    b.className = 'pitem' + (sel ? ' sel' : '');
    b.textContent = label;
    return b;
  }
  function mkTitle(txt) {
    const d = document.createElement('div');
    d.className = 'ptitle';
    d.textContent = txt;
    return d;
  }
  function togglePopup(menu, other) {
    menu.classList.toggle('open');
    other.classList.remove('open');
  }
  // Close all popups on outside click
  document.addEventListener('click', e => {
    if(!audioWrap.contains(e.target)) audioMenu.classList.remove('open');
    if(!subWrap.contains(e.target))   subMenu.classList.remove('open');
  });
  audioBtn.addEventListener('click', e => { e.stopPropagation(); togglePopup(audioMenu, subMenu); });
  subBtn.addEventListener('click',   e => { e.stopPropagation(); togglePopup(subMenu,   audioMenu); });

  // ── Audio track detection & switching ─────────────────────────────────────
  function buildAudioMenu() {
    const tracks = v.audioTracks;
    if(!tracks) {
      console.log('[player] audioTracks API not supported on this device');
      return;
    }
    console.log('[player] audioTracks detected:', tracks.length);
    if(tracks.length <= 1) return; // no UI needed for single track

    audioWrap.style.display = '';
    audioMenu.innerHTML = '';
    audioMenu.appendChild(mkTitle('Audio'));

    for(let i = 0; i < tracks.length; i++) {
      const t   = tracks[i];
      const lbl = t.label || t.language || ('Track '+(i+1));
      const btn = mkItem(lbl, t.enabled);
      btn.addEventListener('click', () => {
        // disable all, enable selected
        for(let j = 0; j < tracks.length; j++) tracks[j].enabled = (j === i);
        audioMenu.querySelectorAll('.pitem').forEach((b,j) => b.classList.toggle('sel', j===i));
        audioBtn.classList.add('on');
        audioMenu.classList.remove('open');
        console.log('[player] switched audio to track', i, lbl);
      });
      audioMenu.appendChild(btn);
    }
  }

  // ── Subtitle / caption track detection & switching ─────────────────────────
  function buildSubMenu() {
    const tracks = v.textTracks;
    if(!tracks) {
      console.log('[player] textTracks API not supported on this device');
      return;
    }
    // Collect subtitle/caption tracks only
    const valid = [];
    for(let i = 0; i < tracks.length; i++) {
      if(tracks[i].kind === 'subtitles' || tracks[i].kind === 'captions') valid.push(tracks[i]);
    }
    console.log('[player] textTracks total:', tracks.length, '| subtitle/caption:', valid.length);
    if(valid.length === 0) return;

    subWrap.style.display = '';
    subMenu.innerHTML = '';
    subMenu.appendChild(mkTitle('Subtitles'));

    // Off option
    const offBtn = mkItem('Off', true);
    offBtn.addEventListener('click', () => {
      valid.forEach(t => { t.mode = 'disabled'; });
      subMenu.querySelectorAll('.pitem').forEach(b => b.classList.remove('sel'));
      offBtn.classList.add('sel');
      subBtn.classList.remove('on');
      subMenu.classList.remove('open');
      console.log('[player] subtitles off');
    });
    subMenu.appendChild(offBtn);

    valid.forEach((t, i) => {
      const lbl = t.label || t.language || ('Track '+(i+1));
      const btn = mkItem(lbl, false);
      btn.addEventListener('click', () => {
        valid.forEach(x => { x.mode = 'disabled'; });
        t.mode = 'showing';
        subMenu.querySelectorAll('.pitem').forEach(b => b.classList.remove('sel'));
        btn.classList.add('sel');
        offBtn.classList.remove('sel');
        subBtn.classList.add('on');
        subMenu.classList.remove('open');
        console.log('[player] showing subtitle track:', lbl);
      });
      subMenu.appendChild(btn);
    });
  }

  // ── Initialise tracks after metadata is ready ──────────────────────────────
  v.addEventListener('loadedmetadata', () => {
    try { buildAudioMenu(); } catch(e) { console.error('[player] audio track init error:', e); }
    try { buildSubMenu();   } catch(e) { console.error('[player] subtitle init error:', e); }
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
