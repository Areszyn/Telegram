import { Router } from "express";
import type { Request, Response } from "express";
import { Readable } from "stream";
import { verifyToken } from "../lib/video-token.js";
import { isRevoked, revokeVideo, listVideos, getVideo } from "../lib/video-store.js";
import { requireAdmin } from "../lib/auth.js";
import { getMtClient, Api, MTPROTO_CHUNK } from "../lib/mtproto.js";
// @ts-ignore — big-integer is a dependency of the 'telegram' package
import bigInt from "big-integer";

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

  // Prefer amsgId/acid baked into the token (server-restart-safe).
  // Fall back to in-memory store for legacy tokens that predate this change.
  const entry     = getVideo(payload.uid);
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
  let start = 0;
  let end   = totalSize > 0 ? totalSize - 1 : Number.MAX_SAFE_INTEGER;
  const rangeHdr = req.headers.range;

  if (rangeHdr && totalSize > 0) {
    const m = /bytes=(\d*)-(\d*)/.exec(rangeHdr);
    if (m) {
      start = m[1] ? parseInt(m[1], 10) : 0;
      end   = m[2] ? parseInt(m[2], 10) : totalSize - 1;
    }
  }

  const chunkLength = end - start + 1;

  // ── Set response headers ───────────────────────────────────────────────────
  res.setHeader("Accept-Ranges",       "bytes");
  res.setHeader("Content-Type",        mime);
  res.setHeader("Cache-Control",       "no-store");
  res.setHeader("Content-Disposition",
    disposition === "attachment"
      ? `attachment; filename="${name}"`
      : "inline",
  );

  if (totalSize > 0) {
    res.setHeader("Content-Length", String(chunkLength));
    res.setHeader("Content-Range",  `bytes ${start}-${end}/${totalSize}`);
  }
  res.status(rangeHdr && totalSize > 0 ? 206 : 200);

  // ── Connect bot MTProto client ─────────────────────────────────────────────
  let client: Awaited<ReturnType<typeof getMtClient>>;
  try {
    client = await getMtClient();
  } catch (e) {
    console.error("[video] MTProto init failed, falling back:", e);
    return streamFile(req, res, token, disposition);
  }

  // ── Fetch message via low-level invoke (bypasses GramJS entity cache) ───────
  // For bots, Telegram accepts accessHash=0 for users who have messaged the bot.
  // We use messages.GetHistory instead of getMessages() so GramJS never tries
  // to resolve the peer through its (empty) entity cache.
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

  console.log(`[video] MTProto stream: uid=${payload.uid} peer=${adminChatId} msgId=${adminMsgId} start=${start} end=${end} size=${totalSize}`);

  // ── Stream via iterDownload ────────────────────────────────────────────────
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
      limit:       totalSize > 0 ? chunkLength : undefined,
      requestSize: MTPROTO_CHUNK,
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
  const title = payload.name ?? "Video";
  const mime  = payload.mime ?? "video/mp4";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#000">
<title>${title}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:100%;height:100%;background:#000;color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
  overscroll-behavior:none;-webkit-tap-highlight-color:transparent}

/* ── Page layout ─────────────────────────────────────────────────────────── */
.page{display:flex;flex-direction:column;min-height:100vh;min-height:100svh;background:#000}

/* ── Player ──────────────────────────────────────────────────────────────── */
.player{position:relative;width:100%;background:#000;flex-shrink:0;cursor:pointer;user-select:none}
video{width:100%;height:auto;display:block;max-height:calc(100svh - 130px);object-fit:contain;background:#000}

/* Gradient overlays */
.grad-top{position:absolute;top:0;left:0;right:0;height:90px;
  background:linear-gradient(to bottom,rgba(0,0,0,.65),transparent);
  pointer-events:none;z-index:5;transition:opacity .3s}
.grad-bot{position:absolute;bottom:0;left:0;right:0;height:160px;
  background:linear-gradient(to top,rgba(0,0,0,.92),transparent);
  pointer-events:none;z-index:5;transition:opacity .3s}

/* ── Controls ────────────────────────────────────────────────────────────── */
.ctrl{position:absolute;inset:0;display:flex;flex-direction:column;
  justify-content:flex-end;z-index:10;transition:opacity .3s;
  padding-bottom:env(safe-area-inset-bottom,0px)}
.ctrl.hidden{opacity:0;pointer-events:none}

/* Buffering spinner */
.spin{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:46px;height:46px;border:3px solid rgba(255,255,255,.12);
  border-top-color:rgba(255,255,255,.8);border-radius:50%;
  animation:spin .75s linear infinite;display:none;z-index:8;pointer-events:none}
.spin.on{display:block}
@keyframes spin{to{transform:translate(-50%,-50%) rotate(360deg)}}

/* Center flash icon */
.cflash{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  pointer-events:none;z-index:6}
.cicon{width:72px;height:72px;border-radius:50%;background:rgba(0,0,0,.45);
  border:1.5px solid rgba(255,255,255,.3);backdrop-filter:blur(6px);
  display:flex;align-items:center;justify-content:center;font-size:26px;
  opacity:0;transition:opacity .18s;pointer-events:none}
.cicon.show{opacity:1}

/* Double-tap seek ripples */
.seek-side{position:absolute;top:0;bottom:0;width:32%;display:flex;
  align-items:center;justify-content:center;pointer-events:none;opacity:0;
  transition:opacity .2s;z-index:7}
.seek-side.lft{left:0}.seek-side.rgt{right:0}
.seek-side.on{opacity:1}
.seek-pill{display:flex;flex-direction:column;align-items:center;gap:3px;
  background:rgba(255,255,255,.12);backdrop-filter:blur(4px);
  border-radius:12px;padding:10px 14px;font-size:12px;font-weight:600;color:#fff}

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

/* ── Progress ────────────────────────────────────────────────────────────── */
.prog-wrap{padding:0 14px 6px;position:relative}
.prog-row{display:flex;align-items:center;gap:10px}
.time-tip{position:absolute;bottom:calc(100% + 10px);background:#111;color:#eee;
  font-size:11px;padding:3px 8px;border-radius:6px;white-space:nowrap;
  pointer-events:none;opacity:0;transition:opacity .15s;transform:translateX(-50%);
  border:1px solid rgba(255,255,255,.1)}
.pbar{flex:1;height:3px;background:rgba(255,255,255,.18);border-radius:2px;
  cursor:pointer;position:relative;transition:height .15s;touch-action:none}
.pbar:hover,.pbar.drag{height:5px}
.pbar:hover .pthumb,.pbar.drag .pthumb{opacity:1;transform:translateY(-50%) scale(1)}
.buf{position:absolute;inset:0;background:rgba(255,255,255,.18);border-radius:2px;width:0;pointer-events:none}
.fill{position:absolute;inset:0;background:#3b82f6;border-radius:2px;width:0;pointer-events:none}
.pthumb{position:absolute;top:50%;right:-6px;transform:translateY(-50%) scale(0);
  width:14px;height:14px;border-radius:50%;background:#3b82f6;
  opacity:0;transition:opacity .2s,transform .2s;pointer-events:none;
  box-shadow:0 0 0 3px rgba(59,130,246,.25)}
.tdisplay{font-size:11px;color:rgba(255,255,255,.55);white-space:nowrap;flex-shrink:0}

/* ── Button row ──────────────────────────────────────────────────────────── */
.brow{display:flex;align-items:center;gap:2px;padding:4px 10px 10px}
.ibtn{background:none;border:none;color:#fff;cursor:pointer;padding:7px;
  border-radius:9px;font-size:20px;line-height:1;display:flex;align-items:center;
  flex-shrink:0;opacity:.85;transition:opacity .15s,background .15s}
.ibtn:hover{opacity:1;background:rgba(255,255,255,.1)}
.ibtn.pill{font-size:11px;padding:5px 9px;background:rgba(255,255,255,.1);
  border-radius:7px;font-weight:500;letter-spacing:.01em}
.ibtn.pill.active{background:rgba(59,130,246,.3);color:#93c5fd}
.gap{flex:1}
.vol-row{display:flex;align-items:center;gap:4px}
input[type=range].vol{-webkit-appearance:none;appearance:none;
  width:64px;height:3px;border-radius:2px;background:rgba(255,255,255,.25);
  outline:none;cursor:pointer}
input[type=range].vol::-webkit-slider-thumb{-webkit-appearance:none;
  width:12px;height:12px;border-radius:50%;background:#fff}
select.spd{background:rgba(255,255,255,.1);border:none;color:#fff;
  padding:5px 6px;border-radius:7px;font-size:11px;cursor:pointer;flex-shrink:0}
select.spd option{background:#111}

/* ── Track popups ────────────────────────────────────────────────────────── */
.trk{position:relative;display:inline-flex;flex-shrink:0}
.popup{position:absolute;bottom:calc(100% + 10px);right:0;background:#141414;
  border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:5px;
  min-width:158px;z-index:60;display:none;box-shadow:0 16px 40px rgba(0,0,0,.8);
  backdrop-filter:blur(10px)}
.popup.open{display:block}
.ptitle{font-size:10px;color:#444;padding:5px 12px 3px;text-transform:uppercase;
  letter-spacing:.08em;pointer-events:none}
.pitem{display:block;width:100%;text-align:left;background:none;border:none;
  color:#bbb;padding:8px 12px;font-size:12px;border-radius:9px;cursor:pointer;white-space:nowrap}
.pitem:hover{background:rgba(255,255,255,.07);color:#fff}
.pitem.sel{color:#3b82f6;font-weight:600}
.pitem.sel::after{content:"✓";float:right;opacity:.6}

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

@media(max-width:480px){
  video{max-height:50svh}
  .info-title{font-size:14px}
  input[type=range].vol{width:52px}
  .brow{padding:4px 8px 10px}
}
</style>
</head>
<body>
<div class="page">

  <!-- Player -->
  <div class="player" id="player">
    <video id="v" playsinline preload="metadata" crossorigin="anonymous">
      <source src="${streamUrl}" type="${mime}">
      ${subTrack}
    </video>
    <div class="grad-top"></div>
    <div class="grad-bot"></div>
    <div class="spin" id="spin"></div>

    <!-- Error overlay -->
    <div class="err" id="errOverlay">
      <div class="err-icon">⚠️</div>
      <p class="err-title"  id="errMsg">Could not load video</p>
      <p class="err-body" id="errDetail">The link may have expired or the stream is unreachable.</p>
      <a class="err-dl" href="${downloadUrl}" download>⬇ Try Download Instead</a>
    </div>

    <!-- Seek ripples -->
    <div class="seek-side lft" id="seekL"><div class="seek-pill">⏪<span>10s</span></div></div>
    <div class="seek-side rgt" id="seekR"><div class="seek-pill">⏩<span>10s</span></div></div>

    <!-- Center flash -->
    <div class="cflash"><div class="cicon" id="cicon"></div></div>

    <!-- Controls overlay -->
    <div class="ctrl" id="ctrl">
      <div class="prog-wrap">
        <div style="position:relative">
          <div class="time-tip" id="ttip"></div>
          <div class="prog-row">
            <div class="pbar" id="pbar">
              <div class="buf"  id="buf"></div>
              <div class="fill" id="fill">
                <div class="pthumb"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="brow">
        <button class="ibtn" id="playbtn">&#9654;</button>
        <div class="vol-row">
          <button class="ibtn" id="mutebtn" title="Mute">🔊</button>
          <input type="range" class="vol" id="vol" min="0" max="1" step="0.05" value="1">
        </div>
        <span class="tdisplay" id="tdisp">0:00 / 0:00</span>
        <div class="gap"></div>
        <select class="spd" id="speed">
          <option value="0.5">0.5×</option><option value="0.75">0.75×</option>
          <option value="1" selected>1×</option><option value="1.25">1.25×</option>
          <option value="1.5">1.5×</option><option value="2">2×</option>
        </select>
        <div class="trk" id="audioWrap" style="display:none">
          <button class="ibtn pill" id="audioBtn">🎵 Audio</button>
          <div class="popup" id="audioMenu"></div>
        </div>
        <div class="trk" id="subWrap" style="display:none">
          <button class="ibtn pill" id="subBtn">CC</button>
          <div class="popup" id="subMenu"></div>
        </div>
        <button class="ibtn" id="fullbtn" title="Fullscreen">⛶</button>
      </div>
    </div>
  </div>

  <!-- Info -->
  <div class="info">
    <div class="info-title">${title}</div>
    <div class="info-meta">
      <span>24 h stream link</span>
      <span class="dot">·</span>
      <span>Tap to play · Double-tap edges to seek 10 s</span>
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

<script>
(function(){
  const v        = document.getElementById('v');
  const player   = document.getElementById('player');
  const ctrl     = document.getElementById('ctrl');
  const playbtn  = document.getElementById('playbtn');
  const mutebtn  = document.getElementById('mutebtn');
  const volEl    = document.getElementById('vol');
  const fill     = document.getElementById('fill');
  const buf      = document.getElementById('buf');
  const pbar     = document.getElementById('pbar');
  const tdisp    = document.getElementById('tdisp');
  const ttip     = document.getElementById('ttip');
  const speedSel = document.getElementById('speed');
  const fullbtn  = document.getElementById('fullbtn');
  const spinEl   = document.getElementById('spin');
  const cicon    = document.getElementById('cicon');
  const seekL    = document.getElementById('seekL');
  const seekR    = document.getElementById('seekR');
  const errOv    = document.getElementById('errOverlay');
  const errMsg   = document.getElementById('errMsg');
  const errDet   = document.getElementById('errDetail');
  const audioWrap= document.getElementById('audioWrap');
  const audioBtn = document.getElementById('audioBtn');
  const audioMenu= document.getElementById('audioMenu');
  const subWrap  = document.getElementById('subWrap');
  const subBtn   = document.getElementById('subBtn');
  const subMenu  = document.getElementById('subMenu');

  // ── Error ─────────────────────────────────────────────────────────────────
  function showErr(msg,det){
    if(errMsg) errMsg.textContent=msg||'Could not load video';
    if(errDet) errDet.textContent=det||'';
    if(errOv)  errOv.classList.add('on');
  }
  fetch('${streamUrl}',{method:'HEAD',headers:{Range:'bytes=0-0'}})
    .then(r=>{
      if(r.status===410)showErr('Link expired or revoked','Video links are valid for 24 hours.');
      else if(!r.ok)showErr('Stream unavailable ('+r.status+')','');
    }).catch(()=>{});
  v.addEventListener('error',()=>{
    const c=v.error?v.error.code:0;
    if(!errOv.classList.contains('on'))
      showErr('Could not play video',c===4?'Unsupported format or stream unreachable.':'Check your connection.');
  });

  // ── Spinner ───────────────────────────────────────────────────────────────
  v.addEventListener('waiting', ()=>spinEl.classList.add('on'));
  v.addEventListener('playing', ()=>spinEl.classList.remove('on'));
  v.addEventListener('canplay', ()=>spinEl.classList.remove('on'));

  // ── Auto-hide controls ────────────────────────────────────────────────────
  let hideT;
  function showCtrl(){
    ctrl.classList.remove('hidden');
    clearTimeout(hideT);
    if(!v.paused) hideT=setTimeout(()=>ctrl.classList.add('hidden'),3200);
  }
  player.addEventListener('mousemove',showCtrl);

  // ── Center flash ──────────────────────────────────────────────────────────
  function flash(icon){
    cicon.textContent=icon;cicon.classList.add('show');
    clearTimeout(cicon._t);
    cicon._t=setTimeout(()=>cicon.classList.remove('show'),520);
  }

  // ── Double-tap seek / single-tap play-pause ───────────────────────────────
  let tapC=0,tapT=null;
  function onTap(e){
    const r=player.getBoundingClientRect();
    const cx=(e.touches?e.touches[0].clientX:e.clientX)-r.left;
    const side=cx<r.width*.33?'L':cx>r.width*.67?'R':'C';
    tapC++;
    clearTimeout(tapT);
    tapT=setTimeout(()=>{
      if(tapC>=2&&side!=='C'){
        const d=side==='R'?10:-10;
        v.currentTime=Math.max(0,Math.min(v.duration||0,v.currentTime+d));
        const el=side==='R'?seekR:seekL;
        el.classList.add('on');setTimeout(()=>el.classList.remove('on'),480);
        flash(side==='R'?'⏩':'⏪');
      } else {
        v.paused?v.play():v.pause();
        flash(v.paused?'▶':'⏸');
      }
      tapC=0;showCtrl();
    },240);
  }
  v.addEventListener('click',onTap);

  // ── Playback state ────────────────────────────────────────────────────────
  playbtn.addEventListener('click',e=>{e.stopPropagation();v.paused?v.play():v.pause();});
  v.addEventListener('play', ()=>{playbtn.innerHTML='&#9646;&#9646;';showCtrl();});
  v.addEventListener('pause',()=>{playbtn.innerHTML='&#9654;';showCtrl();});
  v.addEventListener('ended',()=>{playbtn.innerHTML='&#9654;';showCtrl();});

  // ── Time ──────────────────────────────────────────────────────────────────
  const fmt=t=>{if(!isFinite(t))return'0:00';const m=Math.floor(t/60),s=Math.floor(t%60);return m+':'+String(s).padStart(2,'0');};
  v.addEventListener('timeupdate',()=>{
    if(!v.duration)return;
    fill.style.width=(v.currentTime/v.duration*100)+'%';
    tdisp.textContent=fmt(v.currentTime)+' / '+fmt(v.duration);
  });
  v.addEventListener('progress',()=>{
    if(!v.duration||!v.buffered.length)return;
    buf.style.width=(v.buffered.end(v.buffered.length-1)/v.duration*100)+'%';
  });

  // ── Seek bar ──────────────────────────────────────────────────────────────
  let dragging=false;
  function pct(e){const r=pbar.getBoundingClientRect();return Math.max(0,Math.min(1,((e.touches?e.touches[0].clientX:e.clientX)-r.left)/r.width));}
  function applyTip(p){if(!v.duration)return;ttip.textContent=fmt(p*v.duration);ttip.style.left=Math.min(Math.max(p*100,4),96)+'%';ttip.style.opacity='1';}
  pbar.addEventListener('mousedown',e=>{dragging=true;pbar.classList.add('drag');const p=pct(e);v.currentTime=p*(v.duration||0);applyTip(p);});
  pbar.addEventListener('mousemove',e=>{applyTip(pct(e));if(dragging){v.currentTime=pct(e)*(v.duration||0);}});
  pbar.addEventListener('mouseleave',()=>{ttip.style.opacity='0';});
  pbar.addEventListener('touchstart',e=>{dragging=true;pbar.classList.add('drag');v.currentTime=pct(e)*(v.duration||0);},{passive:true});
  document.addEventListener('mousemove',e=>{if(dragging)v.currentTime=pct(e)*(v.duration||0);});
  document.addEventListener('touchmove',e=>{if(dragging)v.currentTime=pct(e)*(v.duration||0);},{passive:true});
  document.addEventListener('mouseup',()=>{dragging=false;pbar.classList.remove('drag');ttip.style.opacity='0';});
  document.addEventListener('touchend',()=>{dragging=false;pbar.classList.remove('drag');});

  // ── Volume ────────────────────────────────────────────────────────────────
  mutebtn.addEventListener('click',e=>{e.stopPropagation();v.muted=!v.muted;});
  volEl.addEventListener('input',e=>{e.stopPropagation();v.volume=parseFloat(volEl.value);v.muted=v.volume===0;});
  v.addEventListener('volumechange',()=>{volEl.value=v.muted?0:v.volume;mutebtn.textContent=v.muted?'🔇':'🔊';});

  // ── Speed ─────────────────────────────────────────────────────────────────
  speedSel.addEventListener('change',e=>{e.stopPropagation();v.playbackRate=parseFloat(speedSel.value);});

  // ── Fullscreen ────────────────────────────────────────────────────────────
  fullbtn.addEventListener('click',e=>{
    e.stopPropagation();
    if(document.fullscreenElement)       document.exitFullscreen();
    else if(v.webkitEnterFullscreen)     v.webkitEnterFullscreen();
    else{(player||v).requestFullscreen&&(player||v).requestFullscreen();}
  });
  document.addEventListener('fullscreenchange',()=>{fullbtn.textContent=document.fullscreenElement?'✕':'⛶';});

  // ── Keyboard ──────────────────────────────────────────────────────────────
  document.addEventListener('keydown',e=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    if(e.code==='Space'){e.preventDefault();v.paused?v.play():v.pause();}
    if(e.code==='ArrowRight'){v.currentTime+=5;flash('⏩');showCtrl();}
    if(e.code==='ArrowLeft'){v.currentTime-=5;flash('⏪');showCtrl();}
    if(e.code==='ArrowUp')  v.volume=Math.min(1,v.volume+.1);
    if(e.code==='ArrowDown')v.volume=Math.max(0,v.volume-.1);
    if(e.code==='KeyF')fullbtn.click();
    if(e.code==='KeyM')mutebtn.click();
  });

  // ── Track popup helpers ───────────────────────────────────────────────────
  function mkItem(lbl,sel){const b=document.createElement('button');b.className='pitem'+(sel?' sel':'');b.textContent=lbl;return b;}
  function mkTitle(t){const d=document.createElement('div');d.className='ptitle';d.textContent=t;return d;}
  document.addEventListener('click',e=>{
    if(!audioWrap.contains(e.target))audioMenu.classList.remove('open');
    if(!subWrap.contains(e.target))  subMenu.classList.remove('open');
  });
  audioBtn.addEventListener('click',e=>{e.stopPropagation();audioMenu.classList.toggle('open');subMenu.classList.remove('open');});
  subBtn.addEventListener('click',  e=>{e.stopPropagation();subMenu.classList.toggle('open');audioMenu.classList.remove('open');});

  // ── Audio tracks ──────────────────────────────────────────────────────────
  function buildAudio(){
    const tr=v.audioTracks;if(!tr){console.log('[p] audioTracks N/A');return;}
    console.log('[p] audioTracks:',tr.length);if(tr.length<=1)return;
    audioWrap.style.display='';audioMenu.innerHTML='';audioMenu.appendChild(mkTitle('Audio'));
    for(let i=0;i<tr.length;i++){
      const t=tr[i],lbl=t.label||t.language||('Track '+(i+1));
      const b=mkItem(lbl,t.enabled);
      b.addEventListener('click',()=>{
        for(let j=0;j<tr.length;j++)tr[j].enabled=(j===i);
        audioMenu.querySelectorAll('.pitem').forEach((x,j)=>x.classList.toggle('sel',j===i));
        audioBtn.classList.add('active');audioMenu.classList.remove('open');
      });
      audioMenu.appendChild(b);
    }
  }

  // ── Subtitle tracks ───────────────────────────────────────────────────────
  function buildSub(){
    const tr=v.textTracks;if(!tr){console.log('[p] textTracks N/A');return;}
    const valid=[];for(let i=0;i<tr.length;i++)if(tr[i].kind==='subtitles'||tr[i].kind==='captions')valid.push(tr[i]);
    console.log('[p] textTracks:',tr.length,'valid:',valid.length);if(!valid.length)return;
    subWrap.style.display='';subMenu.innerHTML='';subMenu.appendChild(mkTitle('Subtitles'));
    const off=mkItem('Off',true);
    off.addEventListener('click',()=>{valid.forEach(t=>t.mode='disabled');subMenu.querySelectorAll('.pitem').forEach(b=>b.classList.remove('sel'));off.classList.add('sel');subBtn.classList.remove('active');subMenu.classList.remove('open');});
    subMenu.appendChild(off);
    valid.forEach((t,i)=>{
      const lbl=t.label||t.language||('Track '+(i+1));
      const b=mkItem(lbl,false);
      b.addEventListener('click',()=>{
        valid.forEach(x=>x.mode='disabled');t.mode='showing';
        subMenu.querySelectorAll('.pitem').forEach(x=>x.classList.remove('sel'));
        b.classList.add('sel');off.classList.remove('sel');
        subBtn.classList.add('active');subMenu.classList.remove('open');
      });
      subMenu.appendChild(b);
    });
  }

  v.addEventListener('loadedmetadata',()=>{
    try{buildAudio();}catch(e){console.error(e);}
    try{buildSub();}catch(e){console.error(e);}
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
