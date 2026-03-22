import { d1All } from "./d1.ts";

export interface Participant {
  id: string;
  username?: string;
  firstName?: string;
}

/**
 * GramJS / MTProto removed — returns DB-only participants.
 * Real MTProto support requires the Node.js backend.
 */
export async function getGroupParticipants(
  db: D1Database,
  chatId: string | number,
): Promise<Participant[]> {
  const rows = await d1All<{ telegram_id: string; first_name: string | null; username: string | null }>(db,
    `SELECT gm.telegram_id, u.first_name, u.username
     FROM group_members gm
     LEFT JOIN users u ON u.telegram_id = gm.telegram_id
     WHERE gm.chat_id = ? AND gm.status NOT IN ('left', 'kicked')`,
    [String(chatId)],
  ).catch(() => [] as { telegram_id: string; first_name: string | null; username: string | null }[]);

  return rows.map(r => ({
    id: r.telegram_id,
    username: r.username ?? undefined,
    firstName: r.first_name ?? undefined,
  }));
}

export function hasUserSession(): boolean {
  return false;
}

export async function hasAnySessions(db: D1Database): Promise<boolean> {
  const row = await d1All(db,
    "SELECT id FROM user_sessions WHERE status = 'active' LIMIT 1",
  ).catch(() => []);
  return row.length > 0;
}
