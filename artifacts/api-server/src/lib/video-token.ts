import { createHmac } from "crypto";

// Use BOT_TOKEN as the signing secret (never exposed to clients)
const SECRET = () => process.env.BOT_TOKEN!;

export interface VideoTokenPayload {
  fid:    string;          // file_id
  uid:    string;          // file_unique_id
  exp:    number;          // expiry timestamp (ms)
  mime?:  string;          // content type e.g. "video/mp4"
  name?:  string;          // original filename
  size?:  number;          // file size in bytes
  amsgId?: number;         // admin DM message_id (for MTProto streaming)
  acid?:  number;          // admin chat_id (for MTProto streaming)
}

export const VIDEO_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function signToken(payload: VideoTokenPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig  = createHmac("sha256", SECRET()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): VideoTokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;
  const data = token.slice(0, dot);
  const sig  = token.slice(dot + 1);
  const expected = createHmac("sha256", SECRET()).update(data).digest("base64url");
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as VideoTokenPayload;
    if (Date.now() > payload.exp) return null;   // expired
    return payload;
  } catch { return null; }
}
