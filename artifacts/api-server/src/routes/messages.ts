import { Hono } from "hono";
import type { Env } from "../types.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import { parseAuth } from "../lib/auth.ts";
import { sendMessage, sendMediaFile } from "../lib/telegram.ts";
import { checkUserAccess, getModerationRecord } from "../lib/moderation.ts";

const messages = new Hono<{ Bindings: Env }>();

messages.get("/users", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Forbidden" }, 403);
  const users = await d1All<{
    id: number; telegram_id: string; first_name: string; username: string;
    last_msg: string; last_msg_at: string;
  }>(c.env.DB, `
    SELECT u.id, u.telegram_id, u.first_name, u.username, u.avatar,
           m.text AS last_msg, m.created_at AS last_msg_at, m.media_type AS last_media_type
    FROM users u
    INNER JOIN messages m ON m.id = (
      SELECT id FROM messages WHERE user_id = u.id ORDER BY created_at DESC LIMIT 1
    )
    WHERE u.telegram_id != ?
    ORDER BY last_msg_at DESC
  `, [c.env.ADMIN_ID]);
  return c.json(users);
});

messages.get("/messages/:userId", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { userId } = c.req.param();

  if (auth.isAdmin) {
    const msgs = await d1All(c.env.DB,
      "SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC",
      [userId],
    );
    return c.json(msgs);
  }

  const userRow = await d1First<{ id: number }>(c.env.DB,
    "SELECT id FROM users WHERE telegram_id = ?",
    [auth.telegramId],
  );
  if (!userRow || String(userRow.id) !== userId) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const msgs = await d1All(c.env.DB,
    "SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC",
    [userId],
  );
  return c.json(msgs);
});

messages.get("/my-messages", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const userRow = await d1First<{ id: number }>(c.env.DB,
    "SELECT id FROM users WHERE telegram_id = ?",
    [auth.telegramId],
  );
  if (!userRow) return c.json([]);
  const msgs = await d1All(c.env.DB,
    "SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC",
    [userRow.id],
  );
  return c.json(msgs);
});

messages.get("/my-profile", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const userRow = await d1First<{
    id: number; telegram_id: string; first_name: string; username: string;
  }>(c.env.DB, "SELECT * FROM users WHERE telegram_id = ?", [auth.telegramId]);

  const access = await checkUserAccess(c.env.DB, auth.telegramId, "app");
  const modRecord = (!access.allowed || access.restricted)
    ? await getModerationRecord(c.env.DB, auth.telegramId) : null;
  const modInfo = {
    is_banned:       !access.allowed,
    is_restricted:   access.restricted,
    ban_reason:      access.reason ?? null,
    ban_until:       modRecord?.ban_until ?? null,
    warnings_count:  modRecord?.warnings_count ?? 0,
  };

  if (!userRow) {
    return c.json({ id: null, telegram_id: auth.telegramId, is_admin: auth.isAdmin, ...modInfo });
  }
  return c.json({ ...userRow, is_admin: auth.isAdmin, ...modInfo });
});

messages.post("/user/avatar", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { avatar_id } = await c.req.json<{ avatar_id: number }>();
  if (!avatar_id || typeof avatar_id !== "number" || avatar_id < 1 || avatar_id > 50) {
    return c.json({ error: "Invalid avatar_id (1-50)" }, 400);
  }
  await d1Run(c.env.DB, "UPDATE users SET avatar = ? WHERE telegram_id = ?", [String(avatar_id), auth.telegramId]);
  return c.json({ ok: true, avatar: avatar_id });
});

messages.post("/send-message", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const body = await c.req.json<{ text: string; targetUserId?: number }>();

  if (auth.isAdmin && body.targetUserId) {
    const userRow = await d1First<{ id: number; telegram_id: string }>(c.env.DB,
      "SELECT id, telegram_id FROM users WHERE id = ?",
      [body.targetUserId],
    );
    if (!userRow) return c.json({ error: "User not found" }, 404);
    await sendMessage(c.env.BOT_TOKEN, userRow.telegram_id, body.text);
    await d1Run(c.env.DB,
      "INSERT INTO messages (user_id, sender_type, text, media_type) VALUES (?, 'admin', ?, 'text')",
      [userRow.id, body.text],
    );
    return c.json({ ok: true });
  }

  if (!auth.isAdmin) {
    const access = await checkUserAccess(c.env.DB, auth.telegramId, "app");
    if (!access.allowed) {
      return c.json({ error: "banned", reason: access.reason ?? "You are banned from this service." }, 403);
    }
    if (access.muted) {
      return c.json({ error: "muted", reason: "You are currently muted and cannot send messages." }, 403);
    }
    const userRow = await d1First<{ id: number }>(c.env.DB,
      "SELECT id FROM users WHERE telegram_id = ?",
      [auth.telegramId],
    );
    if (!userRow) return c.json({ error: "User not registered" }, 404);
    await d1Run(c.env.DB,
      "INSERT INTO messages (user_id, sender_type, text, media_type) VALUES (?, 'user', ?, 'text')",
      [userRow.id, body.text],
    );
    await sendMessage(c.env.BOT_TOKEN, c.env.ADMIN_ID, `📨 [MiniApp] ${auth.telegramId}:\n${body.text}`);
    return c.json({ ok: true });
  }

  return c.json({ error: "Bad request" }, 400);
});

messages.post("/send-media", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const mediaType = (formData.get("media_type") as string) || "document";
  const caption = (formData.get("caption") as string) || undefined;
  const targetUserId = formData.get("target_user_id") as string | null;

  if (!file || typeof file === "string") return c.json({ error: "No file provided" }, 400);
  if (file.size > 20 * 1024 * 1024) return c.json({ error: "File too large. Max 20 MB." }, 413);

  const validTypes = ["photo", "video", "audio", "voice", "document"];
  const serverDetected = file.type.startsWith("image/") ? "photo"
    : file.type.startsWith("video/") ? "video"
    : file.type.startsWith("audio/") ? (mediaType === "voice" ? "voice" : "audio")
    : "document";
  const mt = (validTypes.includes(mediaType) ? mediaType : serverDetected) as "photo" | "video" | "audio" | "voice" | "document";
  if (mt !== serverDetected && mt !== "voice" && serverDetected !== "document") {
    return c.json({ error: "media_type mismatch with file content" }, 400);
  }

  if (auth.isAdmin && targetUserId) {
    const userRow = await d1First<{ id: number; telegram_id: string }>(c.env.DB,
      "SELECT id, telegram_id FROM users WHERE id = ?", [targetUserId]);
    if (!userRow) return c.json({ error: "User not found" }, 404);

    const result = await sendMediaFile(c.env.BOT_TOKEN, userRow.telegram_id, mt, file, caption) as Record<string, unknown>;
    const fileId = extractFileId(result, mt);
    await d1Run(c.env.DB,
      "INSERT INTO messages (user_id, sender_type, text, media_type, telegram_file_id) VALUES (?, 'admin', ?, ?, ?)",
      [userRow.id, caption ?? null, mt, fileId ?? null]);
    return c.json({ ok: true });
  }

  if (!auth.isAdmin) {
    const access = await checkUserAccess(c.env.DB, auth.telegramId, "app");
    if (!access.allowed) {
      return c.json({ error: "banned", reason: access.reason ?? "You are banned." }, 403);
    }
    if (access.muted) {
      return c.json({ error: "muted", reason: "You are currently muted and cannot send messages." }, 403);
    }
    const userRow = await d1First<{ id: number }>(c.env.DB,
      "SELECT id FROM users WHERE telegram_id = ?", [auth.telegramId]);
    if (!userRow) return c.json({ error: "User not registered" }, 404);

    const result = await sendMediaFile(c.env.BOT_TOKEN, c.env.ADMIN_ID, mt, file,
      `📨 [MiniApp] ${auth.telegramId}:\n${caption ?? ""}`.trim()) as Record<string, unknown>;
    const fileId = extractFileId(result, mt);
    await d1Run(c.env.DB,
      "INSERT INTO messages (user_id, sender_type, text, media_type, telegram_file_id) VALUES (?, 'user', ?, ?, ?)",
      [userRow.id, caption ?? null, mt, fileId ?? null]);
    return c.json({ ok: true });
  }

  return c.json({ error: "Bad request" }, 400);
});

function extractFileId(result: Record<string, unknown>, mediaType: string): string | null {
  if (!result) return null;
  const fieldMap: Record<string, string> = {
    photo: "photo", video: "video", audio: "audio", voice: "voice", document: "document",
  };
  const field = fieldMap[mediaType];
  if (field === "photo" && Array.isArray(result.photo)) {
    const last = result.photo[result.photo.length - 1] as { file_id?: string } | undefined;
    return last?.file_id ?? null;
  }
  const mediaObj = result[field] as { file_id?: string } | undefined;
  return mediaObj?.file_id ?? null;
}

messages.post("/broadcast", async (c) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Forbidden" }, 403);
  const { text } = await c.req.json<{ text: string }>();
  const users = await d1All<{ telegram_id: string }>(c.env.DB,
    `SELECT u.telegram_id FROM users u
     WHERE u.telegram_id != ?
       AND EXISTS (SELECT 1 FROM messages WHERE user_id = u.id)`,
    [c.env.ADMIN_ID],
  );
  let sent = 0;
  for (const u of users) {
    const ok = await sendMessage(c.env.BOT_TOKEN, u.telegram_id, text).then(() => true).catch(() => false);
    if (ok) sent++;
  }
  return c.json({ ok: true, sent, total: users.length });
});

export default messages;
