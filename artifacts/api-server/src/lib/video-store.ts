/**
 * In-memory registry of active video tokens.
 * No database — lives only for the lifetime of the process.
 */

export interface VideoEntry {
  uid:         string;          // file_unique_id — used as revocation key
  token:       string;          // full signed token
  watchUrl:    string;
  downloadUrl: string;
  fromId:      string;          // Telegram user ID who sent the video
  fromName:    string;          // display name
  fileName:    string;
  fileSize:    number;
  exp:         number;          // expiry (ms since epoch)
  addedAt:     number;
  chatId:      string;          // chat where the video was sent
  videoChatMsgId: number;       // message_id of the original video message
  botReplyMsgId?: number;       // message_id of the bot's reply
  // MTProto streaming info (set after forwarding to admin DM)
  adminMsgId?:  number;         // message_id of the video in the admin DM
  adminChatId?: number;         // Telegram ID of the admin chat (user ID)
}

// uid → VideoEntry
const store = new Map<string, VideoEntry>();

// uid of revoked videos
const revoked = new Set<string>();

export function addVideo(entry: VideoEntry): void {
  store.set(entry.uid, entry);
  // Auto-cleanup when expired
  const ttl = entry.exp - Date.now();
  if (ttl > 0) setTimeout(() => store.delete(entry.uid), ttl);
}

export function revokeVideo(uid: string): boolean {
  revoked.add(uid);
  const deleted = store.delete(uid);
  return deleted;
}

export function isRevoked(uid: string): boolean {
  return revoked.has(uid);
}

export function listVideos(): VideoEntry[] {
  const now = Date.now();
  return [...store.values()]
    .filter(e => e.exp > now)
    .sort((a, b) => b.addedAt - a.addedAt);
}

export function getVideo(uid: string): VideoEntry | undefined {
  return store.get(uid);
}

/** Set MTProto streaming info on an existing entry (called after forward completes). */
export function setVideoAdminMsg(uid: string, adminMsgId: number, adminChatId: number): void {
  const e = store.get(uid);
  if (e) {
    e.adminMsgId  = adminMsgId;
    e.adminChatId = adminChatId;
  }
}
