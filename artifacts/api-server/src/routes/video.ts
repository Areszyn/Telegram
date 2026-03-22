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
  const streamUrl   = `${VIDEO_BASE}/stream/${token}`;
  const rawTitle    = payload.name ?? "Video";
  const title       = rawTitle.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  const subFileId   = payload.sub ?? null;
  const subUrl      = subFileId ? `${VIDEO_BASE}/subtitle/${subFileId}` : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="theme-color" content="#000">
<title>${title}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;background:#000;color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  overscroll-behavior:none;-webkit-tap-highlight-color:transparent;overflow:hidden}

.page{display:flex;flex-direction:column;height:100vh;height:100svh;background:#000}

/* ── Player ──────────────────────────────────────────────────────────── */
#player{position:relative;width:100%;flex:1;background:#000;overflow:hidden;cursor:pointer}
video#v{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}
video#v::cue{background:rgba(0,0,0,.7);color:#fff;font-size:16px;line-height:1.4;font-family:inherit}

/* ── Overlay (controls + gradient) ───────────────────────────────────── */
#overlay{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;
  transition:opacity .3s;pointer-events:none}
#overlay.hidden{opacity:0}
#overlay>*{pointer-events:auto}

#top-grad{background:linear-gradient(to bottom,rgba(0,0,0,.7) 0%,transparent 100%);
  padding:14px 16px 30px;display:flex;align-items:center;gap:10px}
#top-title{font-size:13px;font-weight:600;color:#fff;flex:1;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.top-btn{background:none;border:none;color:#fff;font-size:20px;cursor:pointer;
  padding:4px 6px;opacity:.85;transition:opacity .15s}
.top-btn:hover{opacity:1}

#mid-area{flex:1;display:flex;align-items:center;justify-content:center;gap:48px}
.mid-btn{background:none;border:none;color:#fff;cursor:pointer;opacity:.9;
  transition:opacity .15s,transform .1s;filter:drop-shadow(0 2px 8px rgba(0,0,0,.5))}
.mid-btn:hover{opacity:1}
.mid-btn:active{transform:scale(.9)}
.mid-btn svg{width:28px;height:28px;fill:#fff}
#midPlay svg{width:52px;height:52px}

#bot-grad{background:linear-gradient(to top,rgba(0,0,0,.8) 0%,transparent 100%);
  padding:24px 16px 16px;display:flex;flex-direction:column;gap:8px}

/* ── Seek bar ────────────────────────────────────────────────────────── */
#seek-row{display:flex;align-items:center;gap:10px}
#time-cur{font-size:11px;color:rgba(255,255,255,.7);min-width:36px;text-align:right}
#time-dur{font-size:11px;color:rgba(255,255,255,.5);min-width:36px}
#seek-wrap{flex:1;position:relative;height:20px;display:flex;align-items:center;cursor:pointer}
#seek-bg{position:absolute;left:0;right:0;height:3px;background:rgba(255,255,255,.2);border-radius:2px;
  transition:height .15s}
#seek-buf{position:absolute;left:0;height:3px;background:rgba(255,255,255,.25);border-radius:2px;
  top:50%;transform:translateY(-50%);pointer-events:none;transition:height .15s}
#seek-fill{position:absolute;left:0;height:3px;background:#e50914;border-radius:2px;
  top:50%;transform:translateY(-50%);pointer-events:none;transition:height .15s}
#seek-thumb{position:absolute;top:50%;transform:translate(-50%,-50%);
  width:14px;height:14px;border-radius:50%;background:#e50914;
  opacity:0;transition:opacity .2s;pointer-events:none;box-shadow:0 0 6px rgba(229,9,20,.5)}
#seek-wrap:hover #seek-bg,#seek-wrap:hover #seek-buf,#seek-wrap:hover #seek-fill{height:5px}
#seek-wrap:hover #seek-thumb,#seek-wrap.drag #seek-thumb{opacity:1}
#seek-preview{position:absolute;bottom:24px;transform:translateX(-50%);
  background:rgba(0,0,0,.85);color:#fff;font-size:11px;padding:3px 8px;border-radius:5px;
  pointer-events:none;opacity:0;transition:opacity .15s;white-space:nowrap}
#seek-wrap:hover #seek-preview,#seek-wrap.drag #seek-preview{opacity:1}

/* ── Bottom controls row ─────────────────────────────────────────────── */
#ctrl-row{display:flex;align-items:center;gap:2px}
.cb{background:none;border:none;color:#fff;cursor:pointer;padding:6px 8px;
  border-radius:8px;font-size:18px;line-height:1;opacity:.85;
  transition:opacity .15s,background .15s;flex-shrink:0;position:relative}
.cb:hover{opacity:1;background:rgba(255,255,255,.1)}
.cb.active{color:#e50914}
#cgap{flex:1}
.vol-wrap{display:flex;align-items:center;gap:4px}
input[type=range]#vol{-webkit-appearance:none;appearance:none;
  width:0;height:3px;border-radius:2px;background:rgba(255,255,255,.25);
  outline:none;cursor:pointer;transition:width .2s;overflow:hidden}
.vol-wrap:hover input[type=range]#vol{width:60px}
input[type=range]#vol::-webkit-slider-thumb{-webkit-appearance:none;
  width:12px;height:12px;border-radius:50%;background:#fff}

/* ── Subtitle & Speed menus ──────────────────────────────────────────── */
.menu-popup{position:absolute;bottom:40px;right:0;background:rgba(20,20,20,.95);
  border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:8px 0;
  min-width:180px;max-height:280px;overflow-y:auto;z-index:50;
  opacity:0;pointer-events:none;transform:translateY(8px);
  transition:opacity .2s,transform .2s;backdrop-filter:blur(12px)}
.menu-popup.open{opacity:1;pointer-events:auto;transform:translateY(0)}
.menu-title{font-size:11px;color:rgba(255,255,255,.4);padding:6px 16px 4px;
  text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.menu-item{display:flex;align-items:center;gap:10px;padding:9px 16px;cursor:pointer;
  font-size:13px;color:#ccc;transition:background .15s}
.menu-item:hover{background:rgba(255,255,255,.08)}
.menu-item.sel{color:#fff;font-weight:600}
.menu-item .check{width:16px;text-align:center;font-size:14px;flex-shrink:0}
.menu-divider{height:1px;background:rgba(255,255,255,.08);margin:4px 0}

/* ── Double-tap ripple ───────────────────────────────────────────────── */
.tap-zone{position:absolute;top:0;bottom:0;width:35%;z-index:5}
#tap-left{left:0}
#tap-right{right:0}
.tap-ripple{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  display:flex;flex-direction:column;align-items:center;gap:4px;
  opacity:0;pointer-events:none;transition:opacity .2s}
.tap-ripple.show{opacity:1}
.tap-ripple svg{width:36px;height:36px;fill:#fff}
.tap-ripple span{font-size:12px;color:#fff;font-weight:600}

/* ── Seek indicator ──────────────────────────────────────────────────── */
#seek-indicator{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  background:rgba(0,0,0,.75);border-radius:12px;padding:10px 20px;
  font-size:14px;font-weight:600;color:#fff;opacity:0;pointer-events:none;
  transition:opacity .2s;z-index:15;white-space:nowrap}
#seek-indicator.show{opacity:1}

/* ── Lock overlay ────────────────────────────────────────────────────── */
#lock-overlay{position:absolute;inset:0;z-index:100;display:none;
  align-items:flex-start;justify-content:center;padding-top:60px}
#lock-overlay.on{display:flex}
#unlock-btn{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);
  color:#fff;padding:10px 24px;border-radius:24px;font-size:13px;font-weight:600;
  cursor:pointer;backdrop-filter:blur(8px);transition:background .15s}
#unlock-btn:hover{background:rgba(255,255,255,.2)}

/* ── Error overlay ───────────────────────────────────────────────────── */
#err-ov{display:none;position:absolute;inset:0;background:rgba(0,0,0,.9);
  flex-direction:column;align-items:center;justify-content:center;
  gap:14px;padding:32px;text-align:center;z-index:20;backdrop-filter:blur(8px)}
#err-ov.on{display:flex}
.err-icon{font-size:3rem}
.err-ttl{font-size:1rem;font-weight:600}
.err-sub{font-size:.8rem;color:#555;max-width:300px;line-height:1.6}
.err-dl{color:#e50914;text-decoration:none;font-size:.82rem;font-weight:500;
  border:1px solid rgba(229,9,20,.4);padding:9px 22px;border-radius:10px;
  margin-top:4px;transition:background .15s}

/* ── Info bar ────────────────────────────────────────────────────────── */
#info-bar{padding:10px 16px;display:flex;align-items:center;justify-content:space-between;
  background:#0a0a0a;border-top:1px solid rgba(255,255,255,.06);flex-shrink:0}
#info-bar .title{font-size:13px;font-weight:500;color:#bbb;flex:1;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:12px}
.dl-btn{color:#e50914;text-decoration:none;font-size:12px;font-weight:600;
  background:rgba(229,9,20,.1);border:1px solid rgba(229,9,20,.3);
  padding:7px 16px;border-radius:8px;white-space:nowrap;transition:background .15s;flex-shrink:0}
.dl-btn:hover{background:rgba(229,9,20,.2)}

/* ── Cookie banner ───────────────────────────────────────────────────── */
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
.ck-body a{color:#e50914;text-decoration:none}
.ck-btns{display:flex;gap:8px}
.ck-btn{flex:1;height:32px;border-radius:9px;border:none;font-size:11px;font-weight:600;cursor:pointer;transition:background .15s}
.ck-accept{background:#e50914;color:#fff}
.ck-decline{background:#1e1e1e;color:#888;border:1px solid #2a2a2a}
</style>
</head>
<body>
<div class="page">

<div id="player">
  <video id="v" playsinline preload="auto" crossorigin="anonymous" src="${streamUrl}"></video>

  <!-- Double-tap zones (mobile seek) -->
  <div class="tap-zone" id="tap-left">
    <div class="tap-ripple" id="ripple-left">
      <svg viewBox="0 0 24 24"><path d="M12.5 3C7.25 3 3 7.25 3 12.5S7.25 22 12.5 22c1.1 0 2-.9 2-2s-.9-2-2-2c-3.31 0-6-2.69-6-6s2.69-6 6-6c3.31 0 6 2.69 6 6h-3l4 4 4-4h-3c0-4.97-4.03-9-9-9z" transform="scale(-1,1) translate(-24,0)"/></svg>
      <span>10s</span>
    </div>
  </div>
  <div class="tap-zone" id="tap-right">
    <div class="tap-ripple" id="ripple-right">
      <svg viewBox="0 0 24 24"><path d="M12.5 3C7.25 3 3 7.25 3 12.5S7.25 22 12.5 22c1.1 0 2-.9 2-2s-.9-2-2-2c-3.31 0-6-2.69-6-6s2.69-6 6-6c3.31 0 6 2.69 6 6h-3l4 4 4-4h-3c0-4.97-4.03-9-9-9z"/></svg>
      <span>10s</span>
    </div>
  </div>

  <!-- Seek indicator (shows when seeking via keyboard/gesture) -->
  <div id="seek-indicator"></div>

  <!-- Controls overlay -->
  <div id="overlay">
    <!-- Top bar -->
    <div id="top-grad">
      <span id="top-title">${title}</span>
      <button class="top-btn" id="pipBtn" title="Picture-in-Picture">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><rect x="11" y="9" width="9" height="6" rx="1" fill="currentColor" opacity=".3"/></svg>
      </button>
      <button class="top-btn" id="lockBtn" title="Lock screen">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </button>
    </div>

    <!-- Center controls (skip back / play / skip forward) -->
    <div id="mid-area">
      <button class="mid-btn" id="midBack" title="Back 10s">
        <svg viewBox="0 0 24 24"><path d="M12.5 3C7.25 3 3 7.25 3 12.5S7.25 22 12.5 22c1.1 0 2-.9 2-2s-.9-2-2-2c-3.31 0-6-2.69-6-6s2.69-6 6-6c3.31 0 6 2.69 6 6h-3l4 4 4-4h-3c0-4.97-4.03-9-9-9z" transform="scale(-1,1) translate(-24,0)"/></svg>
      </button>
      <button class="mid-btn" id="midPlay" title="Play/Pause">
        <svg viewBox="0 0 24 24" id="playIcon"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <button class="mid-btn" id="midFwd" title="Forward 10s">
        <svg viewBox="0 0 24 24"><path d="M12.5 3C7.25 3 3 7.25 3 12.5S7.25 22 12.5 22c1.1 0 2-.9 2-2s-.9-2-2-2c-3.31 0-6-2.69-6-6s2.69-6 6-6c3.31 0 6 2.69 6 6h-3l4 4 4-4h-3c0-4.97-4.03-9-9-9z"/></svg>
      </button>
    </div>

    <!-- Bottom bar -->
    <div id="bot-grad">
      <div id="seek-row">
        <span id="time-cur">0:00</span>
        <div id="seek-wrap">
          <div id="seek-bg"></div>
          <div id="seek-buf"></div>
          <div id="seek-fill"></div>
          <div id="seek-thumb"></div>
          <div id="seek-preview">0:00</div>
        </div>
        <span id="time-dur">0:00</span>
      </div>
      <div id="ctrl-row">
        <button class="cb" id="playBtn2" title="Play/Pause">&#9654;</button>
        <div class="vol-wrap">
          <button class="cb" id="muteBtn" title="Mute">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path id="volWaves" d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
          </button>
          <input type="range" id="vol" min="0" max="1" step="0.05" value="1">
        </div>
        <div id="cgap"></div>
        <button class="cb" id="subBtn" title="Subtitles">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="18" y2="12"/><line x1="6" y1="16" x2="14" y2="16"/></svg>
          <div class="menu-popup" id="subMenu">
            <div class="menu-title">Subtitles</div>
            <div id="subList"></div>
          </div>
        </button>
        <button class="cb" id="spdBtn" title="Speed">
          <span style="font-size:13px;font-weight:600" id="spdLabel">1x</span>
          <div class="menu-popup" id="spdMenu">
            <div class="menu-title">Playback Speed</div>
            <div id="spdList"></div>
          </div>
        </button>
        <button class="cb" id="fullBtn" title="Fullscreen">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
        </button>
      </div>
    </div>
  </div>

  <!-- Lock overlay -->
  <div id="lock-overlay">
    <button id="unlock-btn">Tap to unlock</button>
  </div>

  <!-- Error overlay -->
  <div id="err-ov">
    <div class="err-icon">&#x26a0;&#xfe0f;</div>
    <p class="err-ttl" id="errMsg">Could not load video</p>
    <p class="err-sub" id="errDet">The link may have expired or the stream is unreachable.</p>
    <a class="err-dl" href="${downloadUrl}" download>&#x2b07; Download Instead</a>
  </div>
</div>

<!-- Info bar -->
<div id="info-bar">
  <span class="title">${title}</span>
  <a class="dl-btn" href="${downloadUrl}" download>&#x2b07; Download</a>
</div>

</div>

<!-- Cookie consent -->
<div id="ckbanner">
  <div class="ck-card">
    <div class="ck-row">
      <div class="ck-icon">&#x1f36a;</div>
      <div class="ck-text">
        <p class="ck-title">Cookies &amp; data collection</p>
        <p class="ck-body">This video player collects your IP address and device info to operate the streaming service.
          <a href="https://mini.susagar.sbs/api/privacy" target="_blank">Privacy Policy</a></p>
      </div>
    </div>
    <div class="ck-btns">
      <button class="ck-btn ck-accept" onclick="ckSet('accepted')">Accept</button>
      <button class="ck-btn ck-decline" onclick="ckSet('declined')">Decline</button>
    </div>
  </div>
</div>

<script>
(function(){
  /* ── Cookie consent ────────────────────────────────────────────────── */
  var CK='ck_player_v3';
  function ckSet(v){localStorage.setItem(CK,v);document.getElementById('ckbanner').classList.remove('show')}
  window.ckSet=ckSet;
  if(!localStorage.getItem(CK)) setTimeout(function(){document.getElementById('ckbanner').classList.add('show')},900);

  /* ── Elements ──────────────────────────────────────────────────────── */
  var v=document.getElementById('v');
  var player=document.getElementById('player');
  var overlay=document.getElementById('overlay');
  var playIcon=document.getElementById('playIcon');
  var midPlay=document.getElementById('midPlay');
  var midBack=document.getElementById('midBack');
  var midFwd=document.getElementById('midFwd');
  var playBtn2=document.getElementById('playBtn2');
  var muteBtn=document.getElementById('muteBtn');
  var volWaves=document.getElementById('volWaves');
  var volEl=document.getElementById('vol');
  var timeCur=document.getElementById('time-cur');
  var timeDur=document.getElementById('time-dur');
  var seekWrap=document.getElementById('seek-wrap');
  var seekFill=document.getElementById('seek-fill');
  var seekBuf=document.getElementById('seek-buf');
  var seekThumb=document.getElementById('seek-thumb');
  var seekPreview=document.getElementById('seek-preview');
  var fullBtn=document.getElementById('fullBtn');
  var subBtn=document.getElementById('subBtn');
  var subMenu=document.getElementById('subMenu');
  var subList=document.getElementById('subList');
  var spdBtn=document.getElementById('spdBtn');
  var spdMenu=document.getElementById('spdMenu');
  var spdList=document.getElementById('spdList');
  var spdLabel=document.getElementById('spdLabel');
  var pipBtn=document.getElementById('pipBtn');
  var lockBtn=document.getElementById('lockBtn');
  var lockOverlay=document.getElementById('lock-overlay');
  var unlockBtn=document.getElementById('unlock-btn');
  var seekIndicator=document.getElementById('seek-indicator');
  var errOv=document.getElementById('err-ov');
  var errMsg=document.getElementById('errMsg');
  var errDet=document.getElementById('errDet');
  var tapLeft=document.getElementById('tap-left');
  var tapRight=document.getElementById('tap-right');
  var rippleLeft=document.getElementById('ripple-left');
  var rippleRight=document.getElementById('ripple-right');

  function showErr(m,d){if(errMsg)errMsg.textContent=m||'Could not load video';if(errDet)errDet.textContent=d||'';if(errOv)errOv.classList.add('on')}
  var fmt=function(t){if(!isFinite(t)||t<0)return'0:00';var h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=Math.floor(t%60);
    return h>0?(h+':'+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')):(m+':'+String(s).padStart(2,'0'))};

  /* ── Subtitle loading ──────────────────────────────────────────────── */
  var SUB_URL='${subUrl}';
  if(SUB_URL){
    var track=document.createElement('track');
    track.kind='subtitles';track.src=SUB_URL;track.srclang='en';track.label='English';
    track.default=true;
    v.appendChild(track);
    track.addEventListener('load',function(){track.track.mode='showing';buildSubMenu()});
  }
  v.addEventListener('loadedmetadata',function(){
    buildSubMenu();
    v.play().catch(function(){});
  });
  v.addEventListener('error',function(){showErr('Video error','Could not play the video. Try downloading instead.')});

  /* ── Auto-hide overlay ─────────────────────────────────────────────── */
  var hideTimer=null;
  var locked=false;
  function showOverlay(){overlay.classList.remove('hidden');resetHide()}
  function hideOverlay(){if(!v.paused&&!locked)overlay.classList.add('hidden')}
  function resetHide(){clearTimeout(hideTimer);hideTimer=setTimeout(hideOverlay,3500)}
  showOverlay();

  player.addEventListener('mousemove',function(){if(!locked)showOverlay()});
  player.addEventListener('click',function(e){
    if(locked||e.target.closest('.cb,.mid-btn,.top-btn,#seek-wrap,.menu-popup,.tap-zone'))return;
    if(overlay.classList.contains('hidden'))showOverlay();
    else hideOverlay();
  });
  v.addEventListener('play',function(){resetHide()});
  v.addEventListener('pause',function(){showOverlay();clearTimeout(hideTimer)});

  /* ── Play / Pause ──────────────────────────────────────────────────── */
  var PLAY_SVG='<path d="M8 5v14l11-7z"/>';
  var PAUSE_SVG='<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>';
  function syncPlayIcon(){
    var p=v.paused;
    playIcon.innerHTML=p?PLAY_SVG:PAUSE_SVG;
    playBtn2.innerHTML=p?'&#9654;':'&#9646;&#9646;';
  }
  function togglePlay(){v.paused?v.play():v.pause()}
  midPlay.addEventListener('click',togglePlay);
  playBtn2.addEventListener('click',togglePlay);
  v.addEventListener('play',syncPlayIcon);
  v.addEventListener('pause',syncPlayIcon);
  v.addEventListener('ended',function(){syncPlayIcon();showOverlay();clearTimeout(hideTimer)});

  /* ── Skip buttons ──────────────────────────────────────────────────── */
  midBack.addEventListener('click',function(){v.currentTime=Math.max(0,v.currentTime-10);showSeekIndicator(-10)});
  midFwd.addEventListener('click',function(){v.currentTime=Math.min(v.duration||0,v.currentTime+10);showSeekIndicator(10)});

  function showSeekIndicator(sec){
    seekIndicator.textContent=(sec>0?'+':'')+sec+'s';
    seekIndicator.classList.add('show');
    clearTimeout(seekIndicator._t);
    seekIndicator._t=setTimeout(function(){seekIndicator.classList.remove('show')},600);
  }

  /* ── Seek bar ──────────────────────────────────────────────────────── */
  v.addEventListener('timeupdate',function(){
    if(!v.duration)return;
    var pct=v.currentTime/v.duration*100;
    seekFill.style.width=pct+'%';seekThumb.style.left=pct+'%';
    timeCur.textContent=fmt(v.currentTime);
  });
  v.addEventListener('loadedmetadata',function(){timeDur.textContent=fmt(v.duration)});
  v.addEventListener('durationchange',function(){timeDur.textContent=fmt(v.duration)});
  v.addEventListener('progress',function(){
    if(!v.duration||!v.buffered.length)return;
    seekBuf.style.width=(v.buffered.end(v.buffered.length-1)/v.duration*100)+'%';
  });

  var dragging=false;
  function seekPct(e){
    var r=seekWrap.getBoundingClientRect();
    var x=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
    return Math.max(0,Math.min(1,x/r.width));
  }
  function seekTo(e){
    var p=seekPct(e);
    v.currentTime=p*(v.duration||0);
    seekFill.style.width=(p*100)+'%';seekThumb.style.left=(p*100)+'%';
    timeCur.textContent=fmt(v.currentTime);
  }
  function updatePreview(e){
    var r=seekWrap.getBoundingClientRect();
    var x=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
    var p=Math.max(0,Math.min(1,x/r.width));
    seekPreview.textContent=fmt(p*(v.duration||0));
    seekPreview.style.left=Math.max(20,Math.min(r.width-20,x))+'px';
  }
  seekWrap.addEventListener('mousedown',function(e){dragging=true;seekWrap.classList.add('drag');seekTo(e);updatePreview(e)});
  seekWrap.addEventListener('mousemove',function(e){if(!dragging)updatePreview(e)});
  document.addEventListener('mousemove',function(e){if(dragging){seekTo(e);updatePreview(e)}});
  document.addEventListener('mouseup',function(){dragging=false;seekWrap.classList.remove('drag')});
  seekWrap.addEventListener('touchstart',function(e){dragging=true;seekWrap.classList.add('drag');seekTo(e);updatePreview(e)},{passive:true});
  document.addEventListener('touchmove',function(e){if(dragging){seekTo(e);updatePreview(e)}},{passive:true});
  document.addEventListener('touchend',function(){dragging=false;seekWrap.classList.remove('drag')});

  /* ── Volume ────────────────────────────────────────────────────────── */
  muteBtn.addEventListener('click',function(e){e.stopPropagation();v.muted=!v.muted});
  volEl.addEventListener('input',function(){v.volume=parseFloat(volEl.value);v.muted=v.volume===0});
  v.addEventListener('volumechange',function(){
    volEl.value=v.muted?0:v.volume;
    if(v.muted||v.volume===0){volWaves.style.display='none'}else{volWaves.style.display=''}
  });

  /* ── Subtitles ─────────────────────────────────────────────────────── */
  var activeSubIdx=-1;
  function buildSubMenu(){
    subList.innerHTML='';
    var tracks=v.textTracks;
    var offItem=document.createElement('div');
    offItem.className='menu-item'+(activeSubIdx===-1?' sel':'');
    offItem.innerHTML='<span class="check">'+(activeSubIdx===-1?'&#10003;':'')+'</span><span>Off</span>';
    offItem.addEventListener('click',function(e){e.stopPropagation();setSubTrack(-1);closeMenus()});
    subList.appendChild(offItem);

    for(var i=0;i<tracks.length;i++){
      (function(idx){
        var t=tracks[idx];
        if(t.kind!=='subtitles'&&t.kind!=='captions')return;
        var item=document.createElement('div');
        item.className='menu-item'+(activeSubIdx===idx?' sel':'');
        var label=t.label||(t.language?t.language.toUpperCase():'Track '+(idx+1));
        item.innerHTML='<span class="check">'+(activeSubIdx===idx?'&#10003;':'')+'</span><span>'+label+'</span>';
        item.addEventListener('click',function(e){e.stopPropagation();setSubTrack(idx);closeMenus()});
        subList.appendChild(item);
      })(i);
    }
    subBtn.classList.toggle('active',activeSubIdx>=0);
  }
  function setSubTrack(idx){
    var tracks=v.textTracks;
    for(var i=0;i<tracks.length;i++){
      tracks[i].mode=(i===idx)?'showing':'disabled';
    }
    activeSubIdx=idx;
    buildSubMenu();
  }
  subBtn.addEventListener('click',function(e){
    e.stopPropagation();
    spdMenu.classList.remove('open');
    subMenu.classList.toggle('open');
  });

  /* ── Speed ─────────────────────────────────────────────────────────── */
  var speeds=[0.25,0.5,0.75,1,1.25,1.5,1.75,2];
  var curSpeed=1;
  function buildSpdMenu(){
    spdList.innerHTML='';
    speeds.forEach(function(s){
      var item=document.createElement('div');
      item.className='menu-item'+(curSpeed===s?' sel':'');
      item.innerHTML='<span class="check">'+(curSpeed===s?'&#10003;':'')+'</span><span>'+s+'x'+(s===1?' (Normal)':'')+'</span>';
      item.addEventListener('click',function(e){e.stopPropagation();curSpeed=s;v.playbackRate=s;
        spdLabel.textContent=s+'x';buildSpdMenu();closeMenus()});
      spdList.appendChild(item);
    });
  }
  buildSpdMenu();
  spdBtn.addEventListener('click',function(e){
    e.stopPropagation();
    subMenu.classList.remove('open');
    spdMenu.classList.toggle('open');
  });

  function closeMenus(){subMenu.classList.remove('open');spdMenu.classList.remove('open')}
  document.addEventListener('click',function(e){
    if(!e.target.closest('#subBtn')&&!e.target.closest('#spdBtn'))closeMenus();
  });

  /* ── Fullscreen ────────────────────────────────────────────────────── */
  fullBtn.addEventListener('click',function(){
    if(document.fullscreenElement)document.exitFullscreen();
    else if(v.webkitEnterFullscreen)v.webkitEnterFullscreen();
    else if(player.requestFullscreen)player.requestFullscreen();
  });

  /* ── Picture-in-Picture ────────────────────────────────────────────── */
  if(!document.pictureInPictureEnabled)pipBtn.style.display='none';
  pipBtn.addEventListener('click',function(){
    if(document.pictureInPictureElement)document.exitPictureInPicture().catch(function(){});
    else v.requestPictureInPicture().catch(function(){});
  });

  /* ── Lock screen ───────────────────────────────────────────────────── */
  lockBtn.addEventListener('click',function(){
    locked=true;lockOverlay.classList.add('on');overlay.classList.add('hidden');
  });
  unlockBtn.addEventListener('click',function(){
    locked=false;lockOverlay.classList.remove('on');showOverlay();
  });

  /* ── Double-tap to seek (mobile) ───────────────────────────────────── */
  var tapTimers={};
  function setupDoubleTap(zone,ripple,delta){
    var lastTap=0;
    zone.addEventListener('touchend',function(e){
      if(locked)return;
      var now=Date.now();
      if(now-lastTap<300){
        e.preventDefault();e.stopPropagation();
        v.currentTime=Math.max(0,Math.min(v.duration||0,v.currentTime+delta));
        ripple.classList.add('show');
        clearTimeout(tapTimers[zone.id]);
        tapTimers[zone.id]=setTimeout(function(){ripple.classList.remove('show')},500);
      }
      lastTap=now;
    });
  }
  setupDoubleTap(tapLeft,rippleLeft,-10);
  setupDoubleTap(tapRight,rippleRight,10);

  /* ── Keyboard shortcuts ────────────────────────────────────────────── */
  document.addEventListener('keydown',function(e){
    if(locked)return;
    if(['INPUT','SELECT','TEXTAREA'].indexOf(e.target.tagName)>=0)return;
    switch(e.code){
      case'Space':e.preventDefault();togglePlay();break;
      case'ArrowRight':v.currentTime+=10;showSeekIndicator(10);break;
      case'ArrowLeft':v.currentTime=Math.max(0,v.currentTime-10);showSeekIndicator(-10);break;
      case'ArrowUp':e.preventDefault();v.volume=Math.min(1,v.volume+.1);break;
      case'ArrowDown':e.preventDefault();v.volume=Math.max(0,v.volume-.1);break;
      case'KeyF':fullBtn.click();break;
      case'KeyM':muteBtn.click();break;
      case'KeyC':
        if(activeSubIdx>=0)setSubTrack(-1);
        else{var t=v.textTracks;if(t.length>0)setSubTrack(0);}
        break;
      case'KeyP':pipBtn.click();break;
      case'KeyL':lockBtn.click();break;
      case'Comma':if(e.shiftKey){var i=speeds.indexOf(curSpeed);if(i>0){curSpeed=speeds[i-1];v.playbackRate=curSpeed;spdLabel.textContent=curSpeed+'x';buildSpdMenu()}}break;
      case'Period':if(e.shiftKey){var j=speeds.indexOf(curSpeed);if(j<speeds.length-1){curSpeed=speeds[j+1];v.playbackRate=curSpeed;spdLabel.textContent=curSpeed+'x';buildSpdMenu()}}break;
    }
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
