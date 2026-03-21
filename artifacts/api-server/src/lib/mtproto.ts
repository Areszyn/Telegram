/**
 * GramJS (MTProto) clients for video streaming.
 *
 * getStreamClient() — preferred: uses the admin's stored user session from D1.
 *                     Falls back to bot MTProto when no session is available.
 * getMtClient()     — bot-auth MTProto client (legacy / fallback).
 */
import { TelegramClient } from "telegram";
import { StringSession }  from "telegram/sessions/index.js";
import { Api }            from "telegram";
import { Logger }         from "telegram/extensions/index.js";
import { d1All }          from "./d1.js";

export { Api };

/** Silence GramJS internal logs. */
const silentLogger = new Logger("none" as never);

// ── Bot MTProto client (fallback) ─────────────────────────────────────────────

let _botClient:  TelegramClient | null = null;
let _botPending: Promise<TelegramClient> | null = null;

export async function getMtClient(): Promise<TelegramClient> {
  if (_botClient?.connected) return _botClient;
  if (_botPending) return _botPending;

  _botPending = (async (): Promise<TelegramClient> => {
    const apiId    = Number(process.env.TELEGRAM_API_ID!);
    const apiHash  = process.env.TELEGRAM_API_HASH!;
    const botToken = process.env.BOT_TOKEN!;

    const c = new TelegramClient(
      new StringSession(""),
      apiId,
      apiHash,
      { connectionRetries: 5, retryDelay: 1_500, autoReconnect: true, baseLogger: silentLogger },
    );

    await c.start({ botAuthToken: botToken });
    console.log("[mtproto] bot client ready (MTProto connected)");
    _botClient  = c;
    _botPending = null;
    return c;
  })();

  return _botPending;
}

// ── User string-session stream client (preferred) ─────────────────────────────

let _userClient:  TelegramClient | null = null;
let _userPending: Promise<TelegramClient | null> | null = null;

export interface StreamClient {
  client: TelegramClient;
  /** Peer to use when calling getMessages() to find the admin's DM video.
   *  - Bot client:  admin's user ID (the bot's chat partner)
   *  - User client: bot's numeric ID (the user's chat partner) */
  peer: number;
}

/**
 * Returns a connected TelegramClient using the admin's stored user session
 * from the D1 `user_sessions` table.  Falls back to the bot MTProto client
 * if no active admin session is found.
 */
/** Extract the bot's numeric ID from BOT_TOKEN ("12345:AABBcc…" → 12345). */
function botNumericId(): number {
  return Number(process.env.BOT_TOKEN?.split(":")[0] ?? "0");
}

export async function getStreamClient(): Promise<StreamClient> {
  // Return cached user client if still connected
  if (_userClient?.connected) {
    return { client: _userClient, peer: botNumericId() };
  }
  if (_userPending) {
    const c = await _userPending;
    if (c?.connected) return { client: c, peer: botNumericId() };
  }

  _userPending = (async (): Promise<TelegramClient | null> => {
    const adminId = process.env.ADMIN_ID;
    if (!adminId) return null;

    try {
      const rows = await d1All<{
        session_string: string;
        api_id: number | null;
        api_hash: string | null;
      }>(
        `SELECT session_string, api_id, api_hash
           FROM user_sessions
          WHERE status = 'active' AND telegram_id = ?
          ORDER BY last_used DESC
          LIMIT 1`,
        [adminId],
      );

      if (!rows.length) {
        console.log("[mtproto] no admin user session found, will use bot client");
        return null;
      }

      const row     = rows[0];
      const apiId   = row.api_id   ?? Number(process.env.TELEGRAM_API_ID!);
      const apiHash = row.api_hash ?? process.env.TELEGRAM_API_HASH!;

      const c = new TelegramClient(
        new StringSession(row.session_string),
        apiId,
        apiHash,
        { connectionRetries: 5, retryDelay: 1_500, autoReconnect: true, baseLogger: silentLogger },
      );

      await c.connect();
      console.log("[mtproto] user string-session stream client ready");
      _userClient  = c;
      _userPending = null;
      return c;
    } catch (e) {
      console.warn("[mtproto] user session connect failed, falling back to bot:", e);
      _userClient  = null;
      _userPending = null;
      return null;
    }
  })();

  const userClient = await _userPending;
  if (userClient?.connected) {
    // User session: peer is the bot (the other side of the admin's DM with the bot)
    return { client: userClient, peer: botNumericId() };
  }

  // Fallback: bot MTProto — peer is the admin (the other side of the bot's DM with admin)
  const botClient = await getMtClient();
  return { client: botClient, peer: Number(process.env.ADMIN_ID!) };
}

/** Bytes-precise chunk size for upload.GetFile calls (must be a multiple of 4 096). */
export const MTPROTO_CHUNK = 512 * 1024; // 512 KB
