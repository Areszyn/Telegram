import { Router }               from "express";
import type { Request, Response } from "express";
import { Readable }              from "stream";
import { createReadStream, statSync, existsSync } from "fs";
import { join, extname }         from "path";
import { verifyToken }           from "../lib/video-token.js";
import { isRevoked, revokeVideo, listVideos, getVideo } from "../lib/video-store.js";
import { requireAdmin }          from "../lib/auth.js";
import { getMtClient, fileIdToLocation, MTPROTO_CHUNK } from "../lib/mtproto.js";
import { isHlsReady, hlsDir, HLS_BASE } from "../lib/hls.js";

const router = Router();
const BOT_TOKEN  = () => process.env.BOT_TOKEN!;
const VIDEO_BASE = "https://mini.susagar.sbs/api";

// ── Disk-based range streaming (converted MP4 files) ─────────────────────────

function streamFromDisk(
  req:         Request,
  res:         Response,
  localPath:   string,
  localSize:   number,
  mime:        string,
  name:        string,
  disposition: "inline" | "attachment",
): void {
  const rangeHdr = req.headers.range;
  let start = 0;
  let end   = localSize - 1;

  if (rangeHdr) {
    const m = /bytes=(\d*)-(\d*)/.exec(rangeHdr);
    if (m) {
      start = m[1] ? parseInt(m[1], 10) : 0;
      end   = m[2] ? parseInt(m[2], 10) : localSize - 1;
    }
  }

  if (start >= localSize) {
    res.setHeader("Content-Range", `bytes */${localSize}`);
    res.status(416).end();
    return;
  }

  // Cap chunk size for fast buffering
  const isInitial = !rangeHdr || /bytes=0-\d*$/.test(rangeHdr);
  const maxChunk  = isInitial ? CHUNK_INITIAL : CHUNK_SEEK;
  end = Math.min(end, start + maxChunk - 1, localSize - 1);

  const chunkLen = end - start + 1;
  console.log(`[video/disk] start=${start} end=${end} chunk=${chunkLen} size=${localSize}`);

  res.setHeader("Accept-Ranges",  "bytes");
  res.setHeader("Content-Type",   mime);
  res.setHeader("Content-Length", String(chunkLen));
  res.setHeader("Content-Range",  `bytes ${start}-${end}/${localSize}`);
  res.setHeader("Cache-Control",  "no-store");
  res.setHeader("Content-Disposition",
    disposition === "attachment" ? `attachment; filename="${name}"` : "inline",
  );
  res.status(206);

  createReadStream(localPath, { start, end }).pipe(res);
}

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

// Smart chunk caps — avoids holding large buffers; keeps first-frame fast
const CHUNK_INITIAL = 2 * 1024 * 1024;  // 2 MB  — first request / bytes=0-
const CHUNK_SEEK    = 5 * 1024 * 1024;  // 5 MB  — mid-file seeks

// ── MTProto streaming (no size limit — uses file_id decoding) ─────────────────

async function streamFileMtProto(
  req:         Request,
  res:         Response,
  token:       string,
  disposition: "inline" | "attachment",
): Promise<void> {
  const payload = validateVideoToken(token);
  if (!payload) {
    res.status(410).type("text").send("Link expired or revoked.");
    return;
  }

  const entry = getVideo(payload.uid);

  // ── Fast path: serve converted local MP4 from disk ────────────────────────
  if (entry?.localPath && existsSync(entry.localPath)) {
    const sz = entry.localSize ?? (() => {
      try { return statSync(entry.localPath!).size; } catch { return 0; }
    })();
    const name = entry.fileName ?? payload.name ?? "video.mp4";
    console.log(`[video/disk] serving local file: ${entry.localPath}`);
    return streamFromDisk(req, res, entry.localPath, sz, "video/mp4", name, disposition);
  }

  const mime      = payload.mime ?? "video/mp4";
  const totalSize = payload.size ?? 0;
  const name      = payload.name ?? "video.mp4";
  const fileId    = payload.fid;

  // ── Decode file_id → MTProto InputDocumentFileLocation ────────────────────
  let location: ReturnType<typeof fileIdToLocation> | null = null;
  try {
    location = fileIdToLocation(fileId);
  } catch (e) {
    console.error("[video] file_id decode failed, falling back to Bot API:", e);
    return streamFile(req, res, token, disposition);
  }

  // ── Parse Range header ─────────────────────────────────────────────────────
  const rangeHdr = req.headers.range;
  let start = 0;
  let end   = totalSize > 0 ? totalSize - 1 : -1;

  if (rangeHdr) {
    const m = /bytes=(\d*)-(\d*)/.exec(rangeHdr);
    if (m) {
      start = m[1] ? parseInt(m[1], 10) : 0;
      end   = m[2] ? parseInt(m[2], 10) : (totalSize > 0 ? totalSize - 1 : -1);
    }
  }

  if (totalSize > 0 && start >= totalSize) {
    res.setHeader("Content-Range", `bytes */${totalSize}`);
    res.status(416).end();
    return;
  }

  // ── Apply smart chunk cap ─────────────────────────────────────────────────
  if (totalSize > 0) {
    const isInitial = !rangeHdr || /bytes=0-\d*$/.test(rangeHdr);
    const maxChunk  = isInitial ? CHUNK_INITIAL : CHUNK_SEEK;
    end = Math.min(end < 0 ? totalSize - 1 : end, start + maxChunk - 1, totalSize - 1);
  }

  const chunkLength = totalSize > 0 ? end - start + 1 : 0;

  console.log(`[video] MTProto stream: start=${start} end=${end} chunk=${chunkLength} size=${totalSize} mime=${mime}`);

  // ── Set response headers ───────────────────────────────────────────────────
  res.setHeader("Accept-Ranges",  "bytes");
  res.setHeader("Content-Type",   mime);
  res.setHeader("Cache-Control",  "no-store");
  res.setHeader("Content-Disposition",
    disposition === "attachment" ? `attachment; filename="${name}"` : "inline",
  );

  if (totalSize > 0) {
    res.setHeader("Content-Length", String(chunkLength));
    res.setHeader("Content-Range",  `bytes ${start}-${end}/${totalSize}`);
  }
  res.status(206);

  // ── Connect bot MTProto client ─────────────────────────────────────────────
  let client: Awaited<ReturnType<typeof getMtClient>>;
  try {
    client = await getMtClient();
  } catch (e) {
    console.error("[video] MTProto init failed, falling back:", e);
    return streamFile(req, res, token, disposition);
  }

  console.log(`[video] MTProto stream OK: uid=${payload.uid} dcId=${location.dcId}`);

  // ── Stream via iterDownload (chunk-by-chunk, no full-file load) ────────────
  let aborted = false;
  req.on("close", () => { aborted = true; });

  try {
    for await (const chunk of client.iterDownload({
      file:        location.location,
      offset:      BigInt(start),
      limit:       chunkLength > 0 ? chunkLength : undefined,
      requestSize: MTPROTO_CHUNK,
      dcId:        location.dcId,
    })) {
      if (aborted) break;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
      if (!res.write(buf)) {
        await new Promise<void>(resolve => res.once("drain", resolve));
      }
    }
  } catch (e) {
    if (!aborted) console.error("[video] MTProto iterDownload error:", e);
  } finally {
    res.end();
  }
}

// ── /stream/:token ────────────────────────────────────────────────────────────

router.get("/stream/:token", (req, res) => {
  streamFileMtProto(req, res, req.params.token, "inline").catch(e => {
    console.error("[video] stream error:", e);
    if (!res.headersSent) res.status(500).end();
  });
});

// ── /download/:token ──────────────────────────────────────────────────────────

router.get("/download/:token", (req, res) => {
  streamFileMtProto(req, res, req.params.token, "attachment").catch(e => {
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
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Link Expired</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;color:#fff;display:flex;flex-direction:column;align-items:center;
  justify-content:center;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  gap:0;padding:24px;text-align:center}
.icon{font-size:3.5rem;margin-bottom:16px;opacity:.7}
h2{font-size:1.1rem;font-weight:600;margin-bottom:8px;color:#f0f0f0}
p{font-size:.85rem;color:#555;line-height:1.6;max-width:280px}
</style></head>
<body><div class="icon">⏰</div><h2>This link has expired</h2><p>Video links are valid for 24 hours. Ask the sender for a new link.</p></body></html>`);
    return;
  }

  const downloadUrl = `${VIDEO_BASE}/download/${token}`;
  const title       = payload.name ?? "Video";
  const uid         = payload.uid;
  const statusUrl   = `${VIDEO_BASE}/hls/status/${uid}?t=${encodeURIComponent(token)}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#000">
<title>${title}</title>
<style>
/* ── Reset ─────────────────────────────────────────────────────────────────── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;min-height:100%;background:#000;color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  overscroll-behavior:none;-webkit-tap-highlight-color:transparent}
.page{display:flex;flex-direction:column;min-height:100vh;min-height:100svh;background:#000}

/* ── Processing / spinner state ─────────────────────────────────────────── */
#processing{display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:18px;padding:48px 24px;text-align:center;min-height:200px}
.spin-ring{width:52px;height:52px;border:3px solid rgba(255,255,255,.12);
  border-top-color:#3b82f6;border-radius:50%;animation:rot .75s linear infinite}
@keyframes rot{to{transform:rotate(360deg)}}
#proc-title{font-size:15px;font-weight:600;color:#ddd}
#proc-sub{font-size:12px;color:#444;max-width:280px;line-height:1.6}

/* ── Player wrapper ─────────────────────────────────────────────────────── */
#player-wrap{display:none;position:relative;width:100%;background:#000;flex-shrink:0}
video#v{width:100%;max-height:calc(100svh - 130px);display:block;object-fit:contain;background:#000}

/* ── HLS custom controls bar ────────────────────────────────────────────── */
#ctrl{display:flex;flex-direction:column;background:rgba(0,0,0,.7);
  padding:8px 12px 10px;gap:6px}
#pbar-wrap{position:relative;height:18px;display:flex;align-items:center;cursor:pointer}
#pbar-bg{position:absolute;inset:0;margin:auto 0;height:3px;background:rgba(255,255,255,.2);
  border-radius:2px;transition:height .1s}
#pbar-buf{position:absolute;top:50%;transform:translateY(-50%);left:0;height:3px;
  background:rgba(255,255,255,.2);border-radius:2px;width:0;pointer-events:none}
#pbar-fill{position:absolute;top:50%;transform:translateY(-50%);left:0;height:3px;
  background:#3b82f6;border-radius:2px;width:0;pointer-events:none}
#pbar-wrap:hover #pbar-bg{height:5px}
#pbar-thumb{position:absolute;top:50%;transform:translate(-50%,-50%);
  width:14px;height:14px;border-radius:50%;background:#3b82f6;
  opacity:0;transition:opacity .2s;pointer-events:none}
#pbar-wrap:hover #pbar-thumb,#pbar-wrap.drag #pbar-thumb{opacity:1}
#btn-row{display:flex;align-items:center;gap:4px}
.ibtn{background:none;border:none;color:#fff;cursor:pointer;padding:6px 7px;
  border-radius:8px;font-size:18px;line-height:1;opacity:.85;transition:opacity .15s,background .15s;flex-shrink:0}
.ibtn:hover{opacity:1;background:rgba(255,255,255,.1)}
.ibtn.sm{font-size:13px;padding:5px 9px;background:rgba(255,255,255,.08);
  border-radius:7px;font-weight:500}
.ibtn.sm.active{background:rgba(59,130,246,.3);color:#93c5fd}
#tdisp{font-size:11px;color:rgba(255,255,255,.5);white-space:nowrap;flex-shrink:0}
#gap{flex:1}
#qlabel{font-size:11px;color:#888;padding:0 4px;flex-shrink:0}
select#qsel{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);
  color:#fff;padding:4px 6px;border-radius:7px;font-size:11px;cursor:pointer;flex-shrink:0}
select#qsel option{background:#111}
.vol-wrap{display:flex;align-items:center;gap:4px}
input[type=range]#vol{-webkit-appearance:none;appearance:none;
  width:60px;height:3px;border-radius:2px;background:rgba(255,255,255,.25);
  outline:none;cursor:pointer}
input[type=range]#vol::-webkit-slider-thumb{-webkit-appearance:none;
  width:12px;height:12px;border-radius:50%;background:#fff}
select#spd{background:rgba(255,255,255,.08);border:none;color:#fff;
  padding:4px 6px;border-radius:7px;font-size:11px;cursor:pointer;flex-shrink:0}
select#spd option{background:#111}

/* ── Error overlay ──────────────────────────────────────────────────────── */
#err-ov{display:none;position:absolute;inset:0;background:rgba(0,0,0,.9);
  flex-direction:column;align-items:center;justify-content:center;
  gap:14px;padding:32px;text-align:center;z-index:20;backdrop-filter:blur(8px)}
#err-ov.on{display:flex}
.err-icon{font-size:3rem}
.err-ttl{font-size:1rem;font-weight:600}
.err-sub{font-size:.8rem;color:#555;max-width:300px;line-height:1.6}
.err-dl{color:#3b82f6;text-decoration:none;font-size:.82rem;font-weight:500;
  border:1px solid rgba(59,130,246,.4);padding:9px 22px;border-radius:10px;
  margin-top:4px;transition:background .15s}

/* ── Info / download ────────────────────────────────────────────────────── */
.info{padding:14px 16px 0;display:flex;flex-direction:column;gap:4px}
.info-title{font-size:15px;font-weight:600;color:#efefef;line-height:1.35;word-break:break-word}
.info-meta{font-size:11px;color:#444;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.dot{color:#2a2a2a}
.dlcard{margin:14px 16px 24px;background:rgba(255,255,255,.03);
  border:1px solid rgba(255,255,255,.07);border-radius:14px;
  padding:13px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.dlcard-label{display:flex;flex-direction:column;gap:2px}
.dlcard-label strong{font-size:13px;color:#ddd;font-weight:500}
.dlcard-label span{font-size:11px;color:#444}
.dlbtn{color:#3b82f6;text-decoration:none;font-size:12px;font-weight:600;
  background:rgba(59,130,246,.12);border:1px solid rgba(59,130,246,.3);
  padding:8px 18px;border-radius:10px;white-space:nowrap;transition:background .15s}
.dlbtn:hover{background:rgba(59,130,246,.24)}

/* ── Cookie banner ──────────────────────────────────────────────────────── */
#ckbanner{position:fixed;bottom:0;left:0;right:0;z-index:999;padding:12px 16px 20px;
  background:linear-gradient(to top,#0a0a0a 80%,transparent);
  transform:translateY(100%);transition:transform .35s cubic-bezier(.4,0,.2,1)}
#ckbanner.show{transform:translateY(0)}
.ck-card{background:#141414;border:1px solid #222;border-radius:16px;padding:14px 16px;
  max-width:500px;margin:0 auto;display:flex;flex-direction:column;gap:10px}
.ck-row{display:flex;align-items:flex-start;gap:10px}
.ck-icon{width:34px;height:34px;border-radius:50%;background:rgba(245,158,11,.1);
  display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.ck-text{flex:1}
.ck-title{font-size:12px;font-weight:600;color:#eee;margin-bottom:3px}
.ck-body{font-size:11px;color:#555;line-height:1.5}
.ck-body a{color:#3b82f6;text-decoration:none}
.ck-btns{display:flex;gap:8px}
.ck-btn{flex:1;height:32px;border-radius:9px;border:none;font-size:11px;font-weight:600;cursor:pointer;transition:background .15s}
.ck-accept{background:#3b82f6;color:#fff}
.ck-decline{background:#1e1e1e;color:#888;border:1px solid #2a2a2a}

@media(max-width:480px){
  video#v{max-height:50svh}
  .info-title{font-size:14px}
}
</style>
</head>
<body>
<div class="page">

  <!-- Processing spinner (shown while HLS segments are being generated) -->
  <div id="processing">
    <div class="spin-ring"></div>
    <div id="proc-title">Processing video…</div>
    <div id="proc-sub">Generating adaptive stream — this usually takes 1–3 minutes.<br>You'll get a Telegram notification when it's ready.</div>
  </div>

  <!-- Player (hidden until HLS is ready) -->
  <div id="player-wrap">
    <video id="v" playsinline preload="auto" crossorigin="anonymous"></video>

    <!-- Controls -->
    <div id="ctrl">
      <!-- Progress bar -->
      <div id="pbar-wrap">
        <div id="pbar-bg"></div>
        <div id="pbar-buf"></div>
        <div id="pbar-fill"></div>
        <div id="pbar-thumb"></div>
      </div>
      <!-- Button row -->
      <div id="btn-row">
        <button class="ibtn" id="playbtn" title="Play/Pause">&#9654;</button>
        <div class="vol-wrap">
          <button class="ibtn" id="mutebtn" title="Mute">🔊</button>
          <input type="range" id="vol" min="0" max="1" step="0.05" value="1">
        </div>
        <span id="tdisp">0:00 / 0:00</span>
        <div id="gap"></div>
        <span id="qlabel">Quality</span>
        <select id="qsel"><option value="-1">Auto</option></select>
        <select id="spd">
          <option value="0.5">0.5×</option><option value="0.75">0.75×</option>
          <option value="1" selected>1×</option><option value="1.25">1.25×</option>
          <option value="1.5">1.5×</option><option value="2">2×</option>
        </select>
        <button class="ibtn" id="fullbtn" title="Fullscreen">⛶</button>
      </div>
    </div>

    <!-- Error overlay -->
    <div id="err-ov">
      <div class="err-icon">⚠️</div>
      <p class="err-ttl" id="errMsg">Could not load video</p>
      <p class="err-sub" id="errDet">The link may have expired or the stream is unreachable.</p>
      <a class="err-dl" href="${downloadUrl}" download>⬇ Download Instead</a>
    </div>
  </div>

  <!-- Info -->
  <div class="info">
    <div class="info-title">${title}</div>
    <div class="info-meta">
      <span>HLS adaptive stream · 24 h link</span>
      <span class="dot">·</span>
      <span id="qual-badge">Processing…</span>
    </div>
  </div>

  <!-- Download -->
  <div class="dlcard">
    <div class="dlcard-label">
      <strong>Save to device</strong>
      <span>Download the original file</span>
    </div>
    <a class="dlbtn" href="${downloadUrl}" download>⬇ Download</a>
  </div>
</div>

<!-- Cookie consent banner -->
<div id="ckbanner">
  <div class="ck-card">
    <div class="ck-row">
      <div class="ck-icon">🍪</div>
      <div class="ck-text">
        <p class="ck-title">Cookies &amp; data collection</p>
        <p class="ck-body">This video player collects your IP address and device info to operate the streaming service.
          <a href="https://mini.susagar.sbs/api/privacy" target="_blank">Privacy Policy</a></p>
      </div>
    </div>
    <div class="ck-btns">
      <button class="ck-btn ck-accept"  onclick="ckSet('accepted')">Accept</button>
      <button class="ck-btn ck-decline" onclick="ckSet('declined')">Decline</button>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js"></script>
<script>
(function(){
  /* ── Cookie consent ────────────────────────────────────────────────────── */
  var CK = 'ck_player_v2';
  function ckSet(v){ localStorage.setItem(CK,v); document.getElementById('ckbanner').classList.remove('show'); }
  window.ckSet = ckSet;
  if (!localStorage.getItem(CK)) setTimeout(function(){ document.getElementById('ckbanner').classList.add('show'); }, 900);

  /* ── Elements ───────────────────────────────────────────────────────────── */
  var proc     = document.getElementById('processing');
  var procSub  = document.getElementById('proc-sub');
  var wrap     = document.getElementById('player-wrap');
  var v        = document.getElementById('v');
  var errOv    = document.getElementById('err-ov');
  var errMsg   = document.getElementById('errMsg');
  var errDet   = document.getElementById('errDet');
  var playbtn  = document.getElementById('playbtn');
  var mutebtn  = document.getElementById('mutebtn');
  var volEl    = document.getElementById('vol');
  var tdisp    = document.getElementById('tdisp');
  var pbarWrap = document.getElementById('pbar-wrap');
  var pbarFill = document.getElementById('pbar-fill');
  var pbarBuf  = document.getElementById('pbar-buf');
  var pbarThumb= document.getElementById('pbar-thumb');
  var fullbtn  = document.getElementById('fullbtn');
  var spdSel   = document.getElementById('spd');
  var qSel     = document.getElementById('qsel');
  var qualBadge= document.getElementById('qual-badge');

  /* ── Error helper ───────────────────────────────────────────────────────── */
  function showErr(msg, det) {
    if (errMsg) errMsg.textContent = msg || 'Could not load video';
    if (errDet) errDet.textContent = det || '';
    if (errOv)  errOv.classList.add('on');
  }

  /* ── Poll until HLS is ready ────────────────────────────────────────────── */
  var STATUS_URL = '${statusUrl}';
  var pollTimer  = null;
  var pollCount  = 0;

  function poll() {
    fetch(STATUS_URL)
      .then(function(r){ return r.json(); })
      .then(function(data){
        if (data.revoked) { showErr('Link revoked', 'This video link has been revoked.'); return; }
        if (!data.ok)     { showErr('Error', data.error || 'Unknown error'); return; }
        if (data.ready) {
          clearTimeout(pollTimer);
          startPlayer(data.masterUrl);
        } else {
          pollCount++;
          var wait = Math.min(3000 + pollCount * 500, 8000); // back-off
          pollTimer = setTimeout(poll, wait);
        }
      })
      .catch(function(){
        pollCount++;
        pollTimer = setTimeout(poll, 5000);
      });
  }

  poll();

  /* ── Initialise hls.js ──────────────────────────────────────────────────── */
  var hls = null;

  function startPlayer(masterUrl) {
    proc.style.display = 'none';
    wrap.style.display = 'block';

    if (Hls.isSupported()) {
      hls = new Hls({
        maxBufferLength:        30,
        maxMaxBufferLength:     60,
        startLevel:             -1,   // auto
        capLevelToPlayerSize:   true,
        enableWorker:           true,
      });
      hls.loadSource(masterUrl);
      hls.attachMedia(v);

      hls.on(Hls.Events.MANIFEST_PARSED, function(_, data){
        buildQualityMenu(data.levels);
        qualBadge.textContent = 'Auto · ' + data.levels.length + ' quality levels';
        v.play().catch(function(){});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, function(_, data){
        var l = hls.levels[data.level];
        var label = l ? (l.height + 'p') : 'Auto';
        qualBadge.textContent = label;
        // Sync quality selector
        for (var i = 0; i < qSel.options.length; i++) {
          if (parseInt(qSel.options[i].value) === data.level) { qSel.selectedIndex = i; break; }
        }
      });

      hls.on(Hls.Events.ERROR, function(_, data){
        if (data.fatal) {
          switch(data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad(); break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError(); break;
            default:
              showErr('Playback error', data.details || 'Fatal error — try reloading.');
          }
        }
      });

    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      v.src = masterUrl;
      v.addEventListener('loadedmetadata', function(){ v.play().catch(function(){}); });
    } else {
      showErr('Browser not supported', 'Your browser does not support HLS streaming. Try Chrome or Safari.');
    }

    v.addEventListener('error', function(){
      showErr('Video error', 'Could not play the stream. Try downloading instead.');
    });
  }

  /* ── Quality menu ───────────────────────────────────────────────────────── */
  function buildQualityMenu(levels) {
    // Clear existing options except Auto
    while (qSel.options.length > 1) qSel.remove(1);
    levels.forEach(function(l, i){
      var opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = (l.height || i) + 'p';
      qSel.appendChild(opt);
    });
    qSel.addEventListener('change', function(){
      if (!hls) return;
      var val = parseInt(qSel.value);
      hls.currentLevel = val; // -1 = auto, ≥0 = lock to level
    });
  }

  /* ── Controls ───────────────────────────────────────────────────────────── */
  var fmt = function(t){ if(!isFinite(t))return'0:00'; var m=Math.floor(t/60),s=Math.floor(t%60); return m+':'+String(s).padStart(2,'0'); };

  playbtn.addEventListener('click', function(){ v.paused ? v.play() : v.pause(); });
  v.addEventListener('play',  function(){ playbtn.innerHTML = '&#9646;&#9646;'; });
  v.addEventListener('pause', function(){ playbtn.innerHTML = '&#9654;'; });
  v.addEventListener('ended', function(){ playbtn.innerHTML = '&#9654;'; });

  v.addEventListener('timeupdate', function(){
    if (!v.duration) return;
    var pct = v.currentTime / v.duration;
    pbarFill.style.width  = (pct * 100) + '%';
    pbarThumb.style.left  = (pct * 100) + '%';
    tdisp.textContent = fmt(v.currentTime) + ' / ' + fmt(v.duration);
  });
  v.addEventListener('progress', function(){
    if (!v.duration || !v.buffered.length) return;
    pbarBuf.style.width = (v.buffered.end(v.buffered.length - 1) / v.duration * 100) + '%';
  });

  /* Seek bar */
  var seeking = false;
  function seekPct(e){
    var r = pbarWrap.getBoundingClientRect();
    var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    return Math.max(0, Math.min(1, x / r.width));
  }
  pbarWrap.addEventListener('mousedown', function(e){
    seeking = true; pbarWrap.classList.add('drag');
    v.currentTime = seekPct(e) * (v.duration || 0);
  });
  document.addEventListener('mousemove', function(e){
    if (seeking) v.currentTime = seekPct(e) * (v.duration || 0);
  });
  document.addEventListener('mouseup',   function(){ seeking = false; pbarWrap.classList.remove('drag'); });
  pbarWrap.addEventListener('touchstart', function(e){
    seeking = true; pbarWrap.classList.add('drag');
    v.currentTime = seekPct(e) * (v.duration || 0);
  }, { passive: true });
  document.addEventListener('touchmove', function(e){
    if (seeking) v.currentTime = seekPct(e) * (v.duration || 0);
  }, { passive: true });
  document.addEventListener('touchend', function(){ seeking = false; pbarWrap.classList.remove('drag'); });

  /* Volume */
  mutebtn.addEventListener('click', function(){ v.muted = !v.muted; });
  volEl.addEventListener('input', function(){ v.volume = parseFloat(volEl.value); v.muted = v.volume === 0; });
  v.addEventListener('volumechange', function(){ volEl.value = v.muted ? 0 : v.volume; mutebtn.textContent = v.muted ? '🔇' : '🔊'; });

  /* Speed */
  spdSel.addEventListener('change', function(){ v.playbackRate = parseFloat(spdSel.value); });

  /* Fullscreen */
  fullbtn.addEventListener('click', function(){
    if (document.fullscreenElement) document.exitFullscreen();
    else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
    else (wrap || v).requestFullscreen && (wrap || v).requestFullscreen();
  });
  document.addEventListener('fullscreenchange', function(){
    fullbtn.textContent = document.fullscreenElement ? '✕' : '⛶';
  });

  /* Keyboard */
  document.addEventListener('keydown', function(e){
    if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
    if (e.code === 'Space')      { e.preventDefault(); v.paused ? v.play() : v.pause(); }
    if (e.code === 'ArrowRight') v.currentTime += 5;
    if (e.code === 'ArrowLeft')  v.currentTime -= 5;
    if (e.code === 'ArrowUp')    v.volume = Math.min(1, v.volume + .1);
    if (e.code === 'ArrowDown')  v.volume = Math.max(0, v.volume - .1);
    if (e.code === 'KeyF')       fullbtn.click();
    if (e.code === 'KeyM')       mutebtn.click();
  });
})();
</script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// ── HLS: status check (requires ?t= token for auth) ──────────────────────────

router.get("/hls/status/:uid", (req, res) => {
  const { uid } = req.params;
  const token   = req.query.t as string | undefined;

  if (!token) { res.status(401).json({ ok: false, error: "Missing token" }); return; }

  const payload = verifyToken(token);
  if (!payload || payload.uid !== uid) {
    res.status(403).json({ ok: false, error: "Invalid or expired token" });
    return;
  }

  if (isRevoked(uid)) {
    res.json({ ok: true, ready: false, revoked: true });
    return;
  }

  const ready = isHlsReady(uid);
  res.json({
    ok: true,
    ready,
    masterUrl: ready ? `${VIDEO_BASE}/hls/${uid}/master.m3u8` : null,
  });
});

// ── HLS: serve segments and playlists ─────────────────────────────────────────
//
// The UID acts as the access token — it's derived from Telegram's file_unique_id
// and is long enough (12+ chars) to be unguessable. No additional auth needed.

router.get("/hls/:uid/:file", (req, res) => {
  const { uid, file } = req.params;

  // Sanitise: only allow alphanumeric, underscores, hyphens, dots
  if (!/^[\w\-.]+$/.test(uid) || !/^[\w\-.]+$/.test(file)) {
    res.status(400).end();
    return;
  }

  const dir      = hlsDir(uid);
  const filePath = join(dir, file);

  // Must be inside the expected directory
  if (!filePath.startsWith(HLS_BASE + "/")) {
    res.status(403).end();
    return;
  }

  if (!existsSync(filePath)) {
    res.status(404).end();
    return;
  }

  const ext = extname(file).toLowerCase();
  const contentType =
    ext === ".m3u8" ? "application/vnd.apple.mpegurl" :
    ext === ".ts"   ? "video/mp2t" :
    "application/octet-stream";

  res.setHeader("Content-Type",  contentType);
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Access-Control-Allow-Origin", "*");

  createReadStream(filePath).pipe(res);
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
