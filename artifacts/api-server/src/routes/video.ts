import { Hono } from "hono";
import type { Env } from "../types.ts";
import { verifyToken } from "../lib/video-token.ts";
import { isRevoked, revokeVideo, listVideos, getVideoByUid } from "../lib/video-store.ts";
import { requireAdmin } from "../lib/auth.ts";

const video = new Hono<{ Bindings: Env }>();

const VIDEO_BASE = "https://mini.susagar.sbs/api";

async function getTgFile(token: string, fileId: string): Promise<
  | { ok: true; url: string; size: number }
  | { ok: false; error: string; tooBig?: boolean }
> {
  const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const json = await res.json() as {
    ok: boolean;
    result?: { file_path?: string; file_size?: number };
    description?: string;
  };
  if (!json.ok) {
    const tooBig = (json.description ?? "").toLowerCase().includes("too big");
    return { ok: false, error: json.description ?? "Telegram API error", tooBig };
  }
  if (!json.result?.file_path) {
    return { ok: false, error: "No file_path in Telegram response" };
  }
  const url = `https://api.telegram.org/file/bot${token}/${json.result.file_path}`;
  return { ok: true, url, size: json.result.file_size ?? 0 };
}

async function streamFile(
  botToken: string,
  db: D1Database,
  jwtSecret: string,
  tokenStr: string,
  disposition: "inline" | "attachment",
): Promise<Response> {
  const payload = await verifyToken(tokenStr, jwtSecret);
  if (!payload) {
    return new Response("Link expired or revoked.", { status: 410, headers: { "Content-Type": "text/plain" } });
  }

  const revoked = await isRevoked(db, payload.uid);
  if (revoked) {
    return new Response("Link has been revoked.", { status: 410, headers: { "Content-Type": "text/plain" } });
  }

  const info = await getTgFile(botToken, payload.fid);
  if (!info.ok) {
    if (info.tooBig) {
      return new Response(
        "File too large: Telegram Bot API only supports streaming files up to 20 MB. Use the Download button to save it directly from Telegram.",
        { status: 413, headers: { "Content-Type": "text/plain" } },
      );
    }
    return new Response(`Could not fetch file from Telegram: ${info.error}`, {
      status: 502, headers: { "Content-Type": "text/plain" },
    });
  }

  const tgRes = await fetch(info.url, {
    headers: {},
  });

  const mime          = payload.mime ?? tgRes.headers.get("content-type") ?? "video/mp4";
  const contentLength = tgRes.headers.get("content-length");
  const contentRange  = tgRes.headers.get("content-range");

  const headers = new Headers({
    "Accept-Ranges":       "bytes",
    "Content-Type":        mime,
    "Cache-Control":       "no-store",
    "Content-Disposition": disposition === "attachment"
      ? `attachment; filename="${payload.name ?? "video.mp4"}"`
      : "inline",
  });
  if (contentLength) headers.set("Content-Length", contentLength);
  if (contentRange)  headers.set("Content-Range", contentRange);

  return new Response(tgRes.body, {
    status: tgRes.status === 206 ? 206 : 200,
    headers,
  });
}

video.get("/stream/:token", async (c) => {
  return streamFile(c.env.BOT_TOKEN, c.env.DB, c.env.BOT_TOKEN, c.req.param("token"), "inline");
});

video.get("/download/:token", async (c) => {
  return streamFile(c.env.BOT_TOKEN, c.env.DB, c.env.BOT_TOKEN, c.req.param("token"), "attachment");
});

video.get("/watch/:token", async (c) => {
  const tokenStr = c.req.param("token");
  const payload  = await verifyToken(tokenStr, c.env.BOT_TOKEN);

  if (!payload) {
    return c.html(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Link Expired</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a0a;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;gap:0;padding:24px;text-align:center}.icon{font-size:3.5rem;margin-bottom:16px;opacity:.7}h2{font-size:1.1rem;font-weight:600;margin-bottom:8px;color:#f0f0f0}p{font-size:.85rem;color:#555;line-height:1.6;max-width:280px}</style>
</head><body><div class="icon">⏰</div><h2>This link has expired</h2><p>Video links are valid for 24 hours. Ask the sender for a new link.</p></body></html>`, 410);
  }

  const downloadUrl = `${VIDEO_BASE}/download/${tokenStr}`;
  const streamUrl   = `${VIDEO_BASE}/stream/${tokenStr}`;
  const rawTitle    = payload.name ?? "Video";
  const title       = rawTitle.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");

  return c.html(`<!DOCTYPE html>
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
#player{position:relative;width:100%;flex:1;background:#000;overflow:hidden;cursor:pointer}
video#v{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}
#info-bar{padding:10px 16px;display:flex;align-items:center;justify-content:space-between;
  background:#0a0a0a;border-top:1px solid rgba(255,255,255,.06);flex-shrink:0}
#info-bar .title{font-size:13px;font-weight:500;color:#bbb;flex:1;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-right:12px}
.dl-btn{color:#e50914;text-decoration:none;font-size:12px;font-weight:600;
  background:rgba(229,9,20,.1);border:1px solid rgba(229,9,20,.3);
  padding:7px 16px;border-radius:8px;white-space:nowrap;transition:background .15s;flex-shrink:0}
.dl-btn:hover{background:rgba(229,9,20,.2)}
</style>
</head>
<body>
<div class="page">
  <div id="player">
    <video id="v" src="${streamUrl}" controls playsinline preload="metadata"></video>
  </div>
  <div id="info-bar">
    <span class="title">${title}</span>
    <a class="dl-btn" href="${downloadUrl}" download>⬇ Download</a>
  </div>
</div>
</body>
</html>`);
});

video.get("/videos", requireAdmin(), async (c) => {
  const videos = await listVideos(c.env.DB);
  return c.json({ ok: true, videos });
});

video.delete("/videos/:uid", requireAdmin(), async (c) => {
  const { uid } = c.req.param();
  const revoked = await revokeVideo(c.env.DB, uid);
  return c.json({ ok: revoked });
});

export default video;
