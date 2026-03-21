import { Router } from "express";
import { d1All, d1First, d1Run } from "../lib/d1.js";
import { forwardMessage, sendMessage, tgCall, copyMessage, downloadFile } from "../lib/telegram.js";
import { uploadToR2, getMediaContentType } from "../lib/r2.js";
import { checkUserAccess, parseModerationMessage, applyModAction } from "../lib/moderation.js";

const router = Router();

const ADMIN_ID = process.env.ADMIN_ID!;

const MINI_APP_URL = "https://mini.susagar.sbs/";

function openAppMarkup() {
  return {
    inline_keyboard: [[
      { text: "📱 Open App", web_app: { url: MINI_APP_URL } }
    ]]
  };
}

type TgUser = { id: number; first_name: string; username?: string };
type TgMessage = {
  message_id: number;
  from: TgUser;
  text?: string;
  photo?: Array<{ file_id: string; file_size: number }>;
  video?: { file_id: string };
  document?: { file_id: string; file_name?: string };
  voice?: { file_id: string };
  audio?: { file_id: string };
  caption?: string;
  reply_to_message?: {
    forward_from?: TgUser;
    from?: TgUser;
    forward_origin?: { sender_user?: TgUser };
    message_id?: number;
  };
  sticker?: { file_id: string };
};

async function upsertUser(tgUser: TgUser): Promise<number> {
  await d1Run(
    `INSERT INTO users (telegram_id, first_name, username) VALUES (?, ?, ?)
     ON CONFLICT(telegram_id) DO UPDATE SET first_name=excluded.first_name, username=excluded.username`,
    [String(tgUser.id), tgUser.first_name, tgUser.username ?? null]
  );
  const row = await d1First<{ id: number }>(
    "SELECT id FROM users WHERE telegram_id = ?",
    [String(tgUser.id)]
  );
  return row!.id;
}

function detectMediaType(msg: TgMessage): { type: string; fileId: string | null } {
  if (msg.photo) return { type: "photo", fileId: msg.photo[msg.photo.length - 1].file_id };
  if (msg.video) return { type: "video", fileId: msg.video.file_id };
  if (msg.document) return { type: "document", fileId: msg.document.file_id };
  if (msg.voice) return { type: "voice", fileId: msg.voice.file_id };
  if (msg.audio) return { type: "audio", fileId: msg.audio.file_id };
  return { type: "text", fileId: null };
}

async function handleMedia(fileId: string, mediaType: string, userId: number): Promise<string | null> {
  try {
    const buf = await downloadFile(fileId);
    const ext: Record<string, string> = { photo: "jpg", video: "mp4", document: "bin", voice: "ogg", audio: "mp3" };
    const key = `media/${userId}/${Date.now()}-${fileId.slice(-8)}.${ext[mediaType] ?? "bin"}`;
    const contentType = getMediaContentType(mediaType);
    const url = await uploadToR2(key, buf, contentType);
    return url;
  } catch (err) {
    console.error("R2 upload error:", err);
    return null;
  }
}

async function saveMessage(
  userId: number,
  senderType: "user" | "admin",
  text: string | null,
  mediaType: string,
  mediaUrl: string | null,
  fileId: string | null,
  telegramMessageId: number | null
): Promise<void> {
  await d1Run(
    `INSERT INTO messages (user_id, sender_type, text, media_type, media_url, telegram_file_id, telegram_message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, senderType, text ?? null, mediaType, mediaUrl ?? null, fileId ?? null, telegramMessageId ?? null]
  );
}

router.post("/webhook", async (req, res) => {
  try {
    const body = req.body as { message?: TgMessage; callback_query?: unknown };
    const msg = body.message;
    if (!msg || !msg.from) {
      res.json({ ok: true });
      return;
    }

    const fromId = String(msg.from.id);
    const isAdmin = fromId === ADMIN_ID;
    console.log(`[webhook] from=${fromId} isAdmin=${isAdmin} text="${msg.text ?? "[media]"}" ADMIN_ID=${ADMIN_ID}`);

    // /start — handle for EVERYONE (admin and users) before any other guard
    if (msg.text === "/start") {
      console.log(`[webhook] /start from ${fromId} isAdmin=${isAdmin}`);
      await upsertUser(msg.from);

      if (isAdmin) {
        await sendMessage(
          msg.from.id,
          `✅ Admin panel active!\n\nYou will receive forwarded messages from users here.\n\nTo reply: swipe on a forwarded message and type your reply.\nTo broadcast: /broadcast Your message here`,
          { reply_markup: openAppMarkup() }
        );
      } else {
        await sendMessage(
          msg.from.id,
          "👋 Hello! Send any message and the admin will reply to you.\n\nYou can also open the app using the button below:",
          { reply_markup: openAppMarkup() }
        );
      }
      console.log(`[webhook] /start response sent to ${fromId}`);
      res.json({ ok: true });
      return;
    }

    if (isAdmin && msg.reply_to_message) {
      const replyTarget = msg.reply_to_message;
      let targetTelegramId: string | null = null;

      if (replyTarget.forward_from) {
        targetTelegramId = String(replyTarget.forward_from.id);
      } else if (replyTarget.forward_origin?.sender_user) {
        targetTelegramId = String(replyTarget.forward_origin.sender_user.id);
      }

      if (targetTelegramId) {
        // Check if admin is sending a moderation command (reply-based)
        if (msg.text) {
          const modAction = parseModerationMessage(msg.text);
          if (modAction) {
            const summary = await applyModAction(targetTelegramId, ADMIN_ID, modAction);
            await sendMessage(ADMIN_ID, `✅ Moderation applied: ${summary}\nUser: ${targetTelegramId}`);
            res.json({ ok: true });
            return;
          }
        }

        // Normal reply → forward to user
        const userRow = await d1First<{ id: number }>(
          "SELECT id FROM users WHERE telegram_id = ?",
          [targetTelegramId]
        );
        if (userRow) {
          const { type: mediaType, fileId } = detectMediaType(msg);
          let mediaUrl: string | null = null;
          if (fileId) mediaUrl = await handleMedia(fileId, mediaType, userRow.id);
          await saveMessage(userRow.id, "admin", msg.text ?? msg.caption ?? null, mediaType, mediaUrl, fileId, msg.message_id);
          await copyMessage(ADMIN_ID, targetTelegramId, msg.message_id);
        }
        res.json({ ok: true });
        return;
      }
    }

    if (isAdmin && msg.text?.startsWith("/broadcast")) {
      const broadcastText = msg.text.replace("/broadcast", "").trim();
      if (broadcastText) {
        const users = await d1All<{ telegram_id: string }>("SELECT telegram_id FROM users WHERE telegram_id != ?", [ADMIN_ID]);
        for (const u of users) {
          await sendMessage(u.telegram_id, broadcastText).catch(() => {});
        }
      }
      res.json({ ok: true });
      return;
    }

    if (isAdmin) {
      res.json({ ok: true });
      return;
    }

    // Check if user is banned from the bot
    const access = await checkUserAccess(fromId, "bot");
    if (!access.allowed) {
      await sendMessage(msg.from.id, `🚫 You are banned.\nReason: ${access.reason ?? "No reason provided."}`);
      res.json({ ok: true });
      return;
    }

    const userId = await upsertUser(msg.from);
    console.log(`[webhook] user upserted id=${userId}, forwarding to admin`);
    const { type: mediaType, fileId } = detectMediaType(msg);
    let mediaUrl: string | null = null;
    if (fileId) mediaUrl = await handleMedia(fileId, mediaType, userId);
    await saveMessage(userId, "user", msg.text ?? msg.caption ?? null, mediaType, mediaUrl, fileId, msg.message_id);
    await forwardMessage(msg.from.id, ADMIN_ID, msg.message_id);
    await sendMessage(
      msg.from.id,
      "✅ Message received! The admin will reply soon.",
      { reply_markup: openAppMarkup() }
    );
    console.log(`[webhook] forwarded to admin, confirmation sent to user`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[webhook] Unhandled error:", err);
    res.json({ ok: true });
  }
});

router.post("/setup-webhook", async (req, res) => {
  // Prefer the production .replit.app domain; fall back to dev domain
  const allDomains = (process.env.REPLIT_DOMAINS ?? "").split(",").map(d => d.trim()).filter(Boolean);
  const prodDomain = allDomains.find(d => d.endsWith(".replit.app"));
  const domain = prodDomain ?? process.env.REPLIT_DEV_DOMAIN;
  if (!domain) {
    res.status(400).json({ error: "No domain available" });
    return;
  }
  const webhookUrl = `https://${domain}/api/webhook`;
  const result = await tgCall("setWebhook", {
    url: webhookUrl,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
  res.json({ ok: true, webhookUrl, domain, result });
});

router.post("/init-db", async (_req, res) => {
  const { initSchema } = await import("../lib/d1.js");
  await initSchema();
  res.json({ ok: true, message: "D1 schema initialized" });
});

export default router;
