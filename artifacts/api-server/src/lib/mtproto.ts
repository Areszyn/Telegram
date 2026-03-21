/**
 * GramJS (MTProto) bot client — streams files beyond the 20 MB Bot API limit.
 * Lazy-initialised on first use; subsequent calls reuse the existing connection.
 */
import { TelegramClient } from "telegram";
import { StringSession }  from "telegram/sessions/index.js";
import { Api }            from "telegram";
import { Logger }         from "telegram/extensions/index.js";

export { Api };

const silentLogger = new Logger("none" as never);

let _client:  TelegramClient | null = null;
let _pending: Promise<TelegramClient> | null = null;

export async function getMtClient(): Promise<TelegramClient> {
  if (_client?.connected) return _client;
  if (_pending) return _pending;

  _pending = (async (): Promise<TelegramClient> => {
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
    console.log("[mtproto] bot client ready");
    _client  = c;
    _pending = null;
    return c;
  })();

  return _pending;
}

/** Bytes-precise chunk size for upload.GetFile (must be a multiple of 4 096). */
export const MTPROTO_CHUNK = 512 * 1024; // 512 KB
