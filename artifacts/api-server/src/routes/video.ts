import { Router }               from "express";
import type { Request, Response } from "express";
import { Readable }              from "stream";
import { createReadStream, statSync, existsSync } from "fs";
import { verifyToken }           from "../lib/video-token.js";
import { isRevoked, revokeVideo, listVideos, getVideo } from "../lib/video-store.js";
import { requireAdmin }          from "../lib/auth.js";
import { getMtClient, Api, MTPROTO_CHUNK } from "../lib/mtproto.js";
// @ts-ignore — big-integer is a dependency of the 'telegram' package
import bigInt from "big-integer";

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

function isMkvOrHevc(mime: string): boolean {
  return mime === "video/x-matroska" || mime === "video/webm";
}

// ── MTProto streaming (no 20 MB limit) ────────────────────────────────────────

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

  // Prefer amsgId/acid baked into the token (server-restart-safe).
  const adminMsgId  = payload.amsgId ?? entry?.adminMsgId;
  const adminChatId = payload.acid   ?? entry?.adminChatId;

  if (!adminMsgId || !adminChatId) {
    console.log(`[video] no MTProto info for uid=${payload.uid}, falling back to Bot API`);
    return streamFile(req, res, token, disposition);
  }

  const mime      = payload.mime ?? "video/mp4";
  const totalSize = payload.size ?? 0;
  const name      = payload.name ?? "video.mp4";

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

  // 416 — requested range not satisfiable
  if (totalSize > 0 && start >= totalSize) {
    res.setHeader("Content-Range", `bytes */${totalSize}`);
    res.status(416).end();
    return;
  }

  // ── Apply smart chunk cap ─────────────────────────────────────────────────
  // Initial request (no range or bytes=0-) → small cap for fast first frame.
  // Mid-file seek → larger cap.
  if (totalSize > 0) {
    const isInitial = !rangeHdr || /bytes=0-\d*$/.test(rangeHdr);
    const maxChunk  = isInitial ? CHUNK_INITIAL : CHUNK_SEEK;
    end = Math.min(end < 0 ? totalSize - 1 : end, start + maxChunk - 1, totalSize - 1);
  }

  const chunkLength = totalSize > 0 ? end - start + 1 : 0;

  console.log(`[video] range: "${rangeHdr ?? "none"}" → start=${start} end=${end} chunk=${chunkLength} size=${totalSize} mime=${mime}`);

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

  // ── Fetch message via low-level invoke (bypasses GramJS entity cache) ───────
  // For bot accounts Telegram accepts accessHash=0 for users who messaged the bot.
  let doc: InstanceType<typeof Api.Document> | null = null;
  try {
    const peer = new Api.InputPeerUser({
      userId:     bigInt(String(adminChatId)),
      accessHash: bigInt(0),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await client.invoke(new Api.messages.GetHistory({
      peer,
      offsetId:   adminMsgId + 1,
      addOffset:  0,
      limit:      1,
      maxId:      adminMsgId + 1,
      minId:      0,
      hash:       bigInt(0),
      offsetDate: 0,
    }));

    const tgMsg = (result?.messages as Api.TypeMessage[] | undefined)
      ?.find((m): m is Api.Message => m instanceof Api.Message && m.id === adminMsgId);

    if (tgMsg?.media instanceof Api.MessageMediaDocument) {
      const candidate = tgMsg.media.document;
      if (candidate instanceof Api.Document) doc = candidate;
    }
  } catch (e) {
    console.error("[video] invoke GetHistory failed, falling back:", e);
    return streamFile(req, res, token, disposition);
  }

  if (!doc) {
    console.warn("[video] document not found via MTProto, falling back to Bot API");
    return streamFile(req, res, token, disposition);
  }

  console.log(`[video] MTProto stream OK: uid=${payload.uid} peer=${adminChatId} msgId=${adminMsgId}`);

  // ── Stream via iterDownload (chunk-by-chunk, no full-file load) ────────────
  const location = new Api.InputDocumentFileLocation({
    id:            doc.id,
    accessHash:    doc.accessHash,
    fileReference: doc.fileReference,
    thumbSize:     "",
  });

  let aborted = false;
  req.on("close", () => { aborted = true; });

  try {
    for await (const chunk of client.iterDownload({
      file:        location,
      offset:      BigInt(start),
      limit:       chunkLength > 0 ? chunkLength : undefined,
      requestSize: MTPROTO_CHUNK,   // 512 KB internal MTProto reads
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

  const streamUrl   = `${VIDEO_BASE}/stream/${token}`;
  const downloadUrl = `${VIDEO_BASE}/download/${token}`;
  const subTrack    = payload.sub
    ? `<track kind="subtitles" src="${VIDEO_BASE}/subtitle/${payload.sub}" default label="Subtitles">`
    : "";
  const title  = payload.name ?? "Video";
  const mime   = payload.mime ?? "video/mp4";
  const isMkv  = isMkvOrHevc(mime);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#000">
<title>${title}</title>
<link rel="stylesheet" href="https://cdn.plyr.io/3.7.8/plyr.css">
<style>
/* ── Reset & base ─────────────────────────────────────────────────────────── */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;min-height:100%;background:#000;color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  overscroll-behavior:none;-webkit-tap-highlight-color:transparent}

/* ── Page layout ─────────────────────────────────────────────────────────── */
.page{display:flex;flex-direction:column;min-height:100vh;min-height:100svh;background:#000}

/* ── Plyr CSS variable overrides ─────────────────────────────────────────── */
:root{
  --plyr-color-main:#3b82f6;
  --plyr-video-background:#000;
  --plyr-menu-background:rgba(20,20,20,.98);
  --plyr-menu-color:#ddd;
  --plyr-menu-border-color:rgba(255,255,255,.1);
  --plyr-control-spacing:10px;
  --plyr-range-track-height:3px;
  --plyr-range-thumb-height:14px;
  --plyr-range-thumb-width:14px;
}

/* ── Player wrapper ──────────────────────────────────────────────────────── */
.player{position:relative;width:100%;background:#000;flex-shrink:0}
.plyr{--plyr-video-controls-background:linear-gradient(transparent,rgba(0,0,0,.85))}
.plyr video{max-height:calc(100svh - 130px);object-fit:contain}

/* ── Error overlay ───────────────────────────────────────────────────────── */
.err{display:none;position:absolute;inset:0;background:rgba(0,0,0,.88);
  flex-direction:column;align-items:center;justify-content:center;
  gap:14px;padding:32px;text-align:center;z-index:30;backdrop-filter:blur(8px)}
.err.on{display:flex}
.err-icon{font-size:3rem}
.err-title{font-size:1rem;font-weight:600}
.err-body{font-size:.8rem;color:#666;max-width:300px;line-height:1.6}
.err-dl{color:#3b82f6;text-decoration:none;font-size:.82rem;font-weight:500;
  border:1px solid rgba(59,130,246,.4);padding:9px 22px;border-radius:10px;
  margin-top:4px;transition:background .15s}
.err-dl:hover{background:rgba(59,130,246,.14)}

/* ── Info section ────────────────────────────────────────────────────────── */
.info{padding:14px 16px 0;display:flex;flex-direction:column;gap:5px}
.info-title{font-size:15px;font-weight:600;color:#efefef;line-height:1.35;word-break:break-word}
.info-meta{font-size:11px;color:#444;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.dot{color:#2a2a2a}

/* ── Download card ───────────────────────────────────────────────────────── */
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

/* ── Compat warning banner ───────────────────────────────────────────────── */
.compat{display:flex;align-items:flex-start;gap:10px;
  background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.25);
  border-radius:12px;padding:11px 14px;margin:10px 14px 0;font-size:12px;
  color:rgba(251,191,36,.9);line-height:1.5}
.compat-icon{font-size:16px;flex-shrink:0;margin-top:1px}
.compat a{color:#fbbf24;font-weight:600;text-decoration:none}
.compat a:hover{text-decoration:underline}

@media(max-width:480px){
  .plyr video{max-height:50svh}
  .info-title{font-size:14px}
}
</style>
</head>
<body>
<div class="page">

  ${isMkv ? `<!-- MKV / HEVC compat warning -->
  <div class="compat">
    <span class="compat-icon">⚠️</span>
    <span>
      <strong>MKV / HEVC format</strong> — may not play on iOS or Telegram WebView.
      If the player shows an error, use <a href="${downloadUrl}" download>Download</a> instead.
    </span>
  </div>` : ""}

  <!-- Player -->
  <div class="player" id="player">
    <video id="v" playsinline preload="metadata" crossorigin="anonymous">
      <source src="${streamUrl}" type="${mime}">
      ${subTrack}
    </video>

    <!-- Error overlay (shown on media error) -->
    <div class="err" id="errOverlay">
      <div class="err-icon">⚠️</div>
      <p class="err-title"  id="errMsg">Could not load video</p>
      <p class="err-body" id="errDetail">The link may have expired or the stream is unreachable.</p>
      <a class="err-dl" href="${downloadUrl}" download>⬇ Try Download Instead</a>
    </div>
  </div>

  <!-- Info -->
  <div class="info">
    <div class="info-title">${title}</div>
    <div class="info-meta">
      <span>24 h stream link</span>
      <span class="dot">·</span>
      <span>Tap to play · Use controls to seek &amp; adjust speed</span>
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

<script src="https://cdn.plyr.io/3.7.8/plyr.polyfilled.js"></script>
<script>
(function(){
  // ── Plyr init ─────────────────────────────────────────────────────────────
  const errOv  = document.getElementById('errOverlay');
  const errMsg = document.getElementById('errMsg');
  const errDet = document.getElementById('errDetail');
  const IS_MKV = ${isMkv ? 'true' : 'false'};

  function showErr(msg, det) {
    if (errMsg) errMsg.textContent = msg || 'Could not load video';
    if (errDet) errDet.textContent = det || '';
    if (errOv)  errOv.classList.add('on');
  }

  // Pre-flight HEAD check for expired links
  fetch('${streamUrl}', { method:'HEAD', headers:{ Range:'bytes=0-0' } })
    .then(r => {
      if (r.status === 410) showErr('Link expired or revoked', 'Video links are valid for 24 hours.');
      else if (!r.ok)       showErr('Stream unavailable (' + r.status + ')', '');
    }).catch(() => {});

  const player = new Plyr('#v', {
    controls: [
      'play-large','play','rewind','fast-forward','progress',
      'current-time','duration','mute','volume','captions',
      'settings','pip','airplay','fullscreen',
    ],
    settings: ['captions','quality','speed','loop'],
    speed:    { selected:1, options:[0.5,0.75,1,1.25,1.5,2] },
    ratio:    null,
    invertTime: false,
    toggleInvert: false,
  });

  player.on('error', () => {
    if (!errOv.classList.contains('on')) {
      if (IS_MKV) {
        showErr('Format not supported in this browser',
          'MKV / HEVC files cannot play on iOS or Telegram WebView. Use Download instead.');
      } else {
        showErr('Could not play video', 'Unsupported format or stream unreachable.');
      }
    }
  });

  // Native video error fallback
  const nativeV = document.getElementById('v');
  if (nativeV) nativeV.addEventListener('error', () => {
    if (!errOv.classList.contains('on')) {
      const c = nativeV.error ? nativeV.error.code : 0;
      if (IS_MKV) {
        showErr('Format not supported in this browser',
          'MKV / HEVC files cannot play on iOS or Telegram WebView. Use the Download button to save and play locally.');
      } else {
        showErr('Could not play video', c === 4 ? 'Unsupported format.' : 'Check your connection.');
      }
    }
  });
})();
</script>

<!-- ── Cookie consent banner ──────────────────────────────────────────────── -->
<style>
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
.ck-accept{background:#3b82f6;color:#fff}.ck-accept:hover{background:#2563eb}
.ck-decline{background:#1e1e1e;color:#888;border:1px solid #2a2a2a}.ck-decline:hover{background:#252525;color:#aaa}
</style>
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
<script>
(function(){
  var CK='ck_player_v1';
  function ckSet(v){localStorage.setItem(CK,v);document.getElementById('ckbanner').classList.remove('show');}
  if(!localStorage.getItem(CK)){
    setTimeout(function(){document.getElementById('ckbanner').classList.add('show');},900);
  }
  window.ckSet=ckSet;
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
