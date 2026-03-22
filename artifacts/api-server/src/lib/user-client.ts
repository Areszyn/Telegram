import { d1All, d1First } from "./d1.ts";

export interface Participant {
  id: string;
  username?: string;
  firstName?: string;
}

export async function getGroupParticipants(
  db: D1Database,
  chatId: string | number,
  env?: { MTPROTO_BACKEND_URL?: string; MTPROTO_API_KEY?: string; adminTelegramId?: string },
): Promise<Participant[]> {
  if (env?.MTPROTO_BACKEND_URL && env?.MTPROTO_API_KEY && env?.adminTelegramId) {
    const session = await d1First<{
      session_string: string;
      api_id: number;
      api_hash: string;
    }>(db,
      "SELECT session_string, api_id, api_hash FROM user_sessions WHERE telegram_id = ? AND status = 'active' ORDER BY last_used DESC LIMIT 1",
      [env.adminTelegramId],
    ).catch(() => null);

    if (session) {
      try {
        const res = await fetch(`${env.MTPROTO_BACKEND_URL}/mtproto/participants`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": env.MTPROTO_API_KEY,
          },
          body: JSON.stringify({
            session_string: session.session_string,
            api_id: session.api_id,
            api_hash: session.api_hash,
            chat_id: String(chatId),
          }),
        });
        const data = await res.json() as { ok?: boolean; participants?: Participant[]; updated_session?: string };
        if (data.ok && data.participants) {
          if (data.updated_session) {
            await db.prepare("UPDATE user_sessions SET session_string = ?, last_used = datetime('now') WHERE session_string = ?")
              .bind(data.updated_session, session.session_string).run().catch(() => {});
          }
          return data.participants;
        }
      } catch {
      }
    }
  }

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
