/**
 * Telegram MTProto user client helpers (GramJS).
 * Uses env session + all active DB sessions to enumerate group participants.
 *
 * Env vars (optional — DB sessions are used when present):
 *   TELEGRAM_API_ID    — numeric App ID from https://my.telegram.org
 *   TELEGRAM_API_HASH  — App hash from https://my.telegram.org
 *   TELEGRAM_SESSION   — legacy single session string
 */

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import type { Api } from "telegram";
import { d1All } from "./d1.js";

const API_ID   = () => parseInt(process.env.TELEGRAM_API_ID  ?? "0", 10);
const API_HASH = () => process.env.TELEGRAM_API_HASH ?? "";

export interface Participant {
  id: string;
  username?: string;
  firstName?: string;
}

function makeClient(sessionStr = "") {
  return new TelegramClient(
    new StringSession(sessionStr),
    API_ID(), API_HASH(),
    { connectionRetries: 2, useWSS: false },
  );
}

/** Fetch participants from a single session string for a given chat. */
async function fetchParticipants(
  sessionStr: string, chatId: string | number,
  apiId = API_ID(), apiHash = API_HASH(),
): Promise<Participant[]> {
  const client = new TelegramClient(
    new StringSession(sessionStr), apiId, apiHash,
    { connectionRetries: 2, useWSS: false },
  );
  try {
    await client.connect();
    const list = await client.getParticipants(chatId, { limit: 0 }) as Api.User[];
    return list
      .filter(p => !p.bot)
      .map(p => ({ id: String(p.id), username: p.username ?? undefined, firstName: p.firstName ?? undefined }));
  } catch (err) {
    console.warn("[user-client] fetchParticipants error:", (err as Error).message);
    return [];
  } finally {
    await client.disconnect().catch(() => {});
  }
}

/**
 * Returns deduplicated participants from all configured sessions
 * (env TELEGRAM_SESSION + all active DB sessions).
 * Returns an empty array when no sessions or API credentials are configured.
 */
export async function getGroupParticipants(chatId: string | number): Promise<Participant[]> {
  if (!API_ID() || !API_HASH()) {
    console.warn("[user-client] TELEGRAM_API_ID/HASH not set — skipping participant fetch");
    return [];
  }

  const seen = new Set<string>();
  const result: Participant[] = [];

  const merge = (list: Participant[]) => {
    for (const p of list) {
      if (!seen.has(p.id)) { seen.add(p.id); result.push(p); }
    }
  };

  // 1. Env session (backward compat)
  if (process.env.TELEGRAM_SESSION) {
    merge(await fetchParticipants(process.env.TELEGRAM_SESSION, chatId));
  }

  // 2. All active DB sessions (each may have its own api_id/hash)
  const dbRows = await d1All<{ id: number; session_string: string; api_id: number | null; api_hash: string | null }>(
    `SELECT id, session_string, api_id, api_hash FROM user_sessions WHERE status = 'active'`,
  ).catch(() => [] as { id: number; session_string: string; api_id: number | null; api_hash: string | null }[]);

  for (const row of dbRows) {
    if (result.length >= 10000) break; // safety cap
    const rowApiId = row.api_id ?? API_ID();
    const rowApiHash = row.api_hash ?? API_HASH();
    if (!rowApiId || !rowApiHash) continue;
    merge(await fetchParticipants(row.session_string, chatId, rowApiId, rowApiHash));
    d1All(`UPDATE user_sessions SET last_used = datetime('now') WHERE id = ?`, [row.id]).catch(() => {});
  }

  console.log(`[user-client] getGroupParticipants(${chatId}): ${result.length} participants from ${1 + dbRows.length} session(s)`);
  return result;
}

/**
 * Returns true when at least env session or API credentials are configured.
 * Actual DB sessions are checked asynchronously inside getGroupParticipants.
 */
export async function hasAnySessions(): Promise<boolean> {
  if (!API_ID() || !API_HASH()) return false;
  if (process.env.TELEGRAM_SESSION) return true;
  const row = await d1First<{ id: number }>(
    `SELECT id FROM user_sessions WHERE status = 'active' LIMIT 1`,
  ).catch(() => null);
  return !!row;
}

// Keep backward-compat sync export (checks env only — DB checked at runtime)
export function hasUserSession(): boolean {
  return !!(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH &&
    (process.env.TELEGRAM_SESSION));
}

async function d1First<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await d1All<T>(sql, params);
  return rows[0] ?? null;
}
