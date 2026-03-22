import { d1Run, d1First, d1All } from "./d1.ts";

export interface VideoEntry {
  uid:            string;
  token:          string;
  watch_url:      string;
  download_url:   string;
  from_id:        string;
  from_name:      string | null;
  file_name:      string | null;
  file_size:      number;
  exp:            number;
  added_at:       number;
  chat_id:        string | null;
  video_chat_msg_id: number | null;
  bot_reply_msg_id:  number | null;
  admin_msg_id:   number | null;
  admin_chat_id:  number | null;
  revoked:        number;
}

export async function addVideo(
  db: D1Database,
  entry: {
    uid: string; token: string; watchUrl: string; downloadUrl: string;
    fromId: string; fromName: string; fileName: string; fileSize: number;
    exp: number; addedAt: number; chatId: string; videoChatMsgId: number;
    botReplyMsgId?: number; adminMsgId?: number; adminChatId?: number;
  },
): Promise<void> {
  await d1Run(db,
    `INSERT INTO video_tokens
       (uid, token, watch_url, download_url, from_id, from_name, file_name, file_size, exp, added_at,
        chat_id, video_chat_msg_id, bot_reply_msg_id, admin_msg_id, admin_chat_id, revoked)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(uid) DO UPDATE SET
       token=excluded.token, watch_url=excluded.watch_url, download_url=excluded.download_url,
       exp=excluded.exp, revoked=0`,
    [
      entry.uid, entry.token, entry.watchUrl, entry.downloadUrl,
      entry.fromId, entry.fromName, entry.fileName, entry.fileSize,
      entry.exp, entry.addedAt, entry.chatId, entry.videoChatMsgId,
      entry.botReplyMsgId ?? null, entry.adminMsgId ?? null, entry.adminChatId ?? null,
    ],
  );
}

export async function revokeVideo(db: D1Database, uid: string): Promise<boolean> {
  const r = await d1Run(db, "UPDATE video_tokens SET revoked = 1 WHERE uid = ?", [uid]);
  return ((r.meta as { changes?: number })?.changes ?? 0) > 0;
}

export async function isRevoked(db: D1Database, uid: string): Promise<boolean> {
  const row = await d1First<{ revoked: number }>(db, "SELECT revoked FROM video_tokens WHERE uid = ?", [uid]);
  return row?.revoked === 1;
}

export async function listVideos(db: D1Database): Promise<VideoEntry[]> {
  const now = Date.now();
  return d1All<VideoEntry>(db,
    "SELECT * FROM video_tokens WHERE revoked = 0 AND exp > ? ORDER BY added_at DESC",
    [now],
  );
}

export async function getVideoByUid(db: D1Database, uid: string): Promise<VideoEntry | null> {
  return d1First<VideoEntry>(db, "SELECT * FROM video_tokens WHERE uid = ?", [uid]);
}

export async function setVideoAdminMsg(
  db: D1Database,
  uid: string,
  botReplyMsgId: number,
  adminChatId: number,
): Promise<void> {
  await d1Run(db,
    "UPDATE video_tokens SET bot_reply_msg_id = ?, admin_chat_id = ? WHERE uid = ?",
    [botReplyMsgId, adminChatId, uid],
  );
}
