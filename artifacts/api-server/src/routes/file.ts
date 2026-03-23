import { Hono } from "hono";
import type { Env } from "../types.ts";

const file = new Hono<{ Bindings: Env }>();

file.get("/file/:fileId", async (c) => {
  const fileId = c.req.param("fileId");
  if (!fileId) return c.json({ error: "fileId required" }, 400);

  const token = c.env.BOT_TOKEN;

  const infoRes = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`,
  );
  const info = await infoRes.json<{ ok: boolean; result?: { file_path: string; file_size?: number } }>();

  if (!info.ok || !info.result?.file_path) {
    return c.json({ error: "File not found or expired" }, 404);
  }

  const filePath = info.result.file_path;
  const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);

  if (!fileRes.ok || !fileRes.body) {
    return c.json({ error: "Failed to fetch file from Telegram" }, 502);
  }

  const headers = new Headers();
  const ct = fileRes.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const cl = fileRes.headers.get("content-length");
  if (cl) headers.set("content-length", cl);

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const dispositionType = ["jpg", "jpeg", "png", "gif", "webp", "mp4", "mov", "mpeg", "ogg", "oga", "mp3"].includes(ext) ? "inline" : "attachment";
  const filename = filePath.split("/").pop() ?? `file.${ext}`;
  headers.set("content-disposition", `${dispositionType}; filename="${filename}"`);
  headers.set("cache-control", "public, max-age=86400");
  headers.set("access-control-allow-origin", "*");

  return new Response(fileRes.body, { status: 200, headers });
});

export default file;
