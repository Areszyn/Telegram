import { d1All } from "./d1.ts";
import { getGroupParticipants } from "./user-client.ts";

export type GroupEnv = {
  MTPROTO_BACKEND_URL?: string;
  MTPROTO_API_KEY?: string;
  adminTelegramId?: string;
};

export async function buildTagAllChunks(
  db: D1Database,
  chatId: string,
  env?: GroupEnv,
): Promise<Array<{ text: string; entities: unknown[] }>> {
  let members: Array<{ telegram_id: string; first_name: string | null; username: string | null }> = [];

  if (env?.MTPROTO_BACKEND_URL && env?.MTPROTO_API_KEY && env?.adminTelegramId) {
    const participants = await getGroupParticipants(db, chatId, env).catch(() => []);
    if (participants.length > 0) {
      members = participants.map(p => ({
        telegram_id: p.id,
        first_name: p.firstName ?? null,
        username: p.username ?? null,
      }));
    }
  }

  if (!members.length) {
    members = await d1All<{ telegram_id: string; first_name: string | null; username: string | null }>(db,
      `SELECT u.telegram_id, u.first_name, u.username
       FROM group_members gm
       JOIN users u ON u.telegram_id = gm.telegram_id
       WHERE gm.chat_id = ? AND gm.status NOT IN ('left','kicked')`,
      [chatId],
    );
  }

  if (!members.length) return [];

  const chunks: Array<{ text: string; entities: unknown[] }> = [];
  let text = "";
  let entities: unknown[] = [];

  for (const m of members) {
    const displayName = m.first_name || "User";
    const part = m.username ? `@${m.username} ` : `${displayName} `;
    if (text.length + part.length > 4000) {
      chunks.push({ text, entities });
      text = "";
      entities = [];
    }
    if (!m.username) {
      entities.push({
        type: "text_mention",
        offset: text.length,
        length: displayName.length,
        user: { id: parseInt(m.telegram_id, 10), is_bot: false, first_name: displayName },
      });
    }
    text += part;
  }
  if (text.trim()) chunks.push({ text, entities });
  return chunks;
}

export async function buildBanCandidates(
  db: D1Database,
  chatId: string,
  excludeId: string,
  adminId: string,
  env?: GroupEnv,
): Promise<number[]> {
  const seen = new Set<string>([excludeId, adminId].filter(Boolean));
  const candidates: number[] = [];

  const addId = (id: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const n = parseInt(id, 10);
    if (!isNaN(n) && n > 0) candidates.push(n);
  };

  if (env?.MTPROTO_BACKEND_URL && env?.MTPROTO_API_KEY && env?.adminTelegramId) {
    const participants = await getGroupParticipants(db, chatId, env).catch(() => []);
    for (const p of participants) addId(p.id);
  }

  if (!candidates.length) {
    const dbMembers = await d1All<{ telegram_id: string }>(db,
      `SELECT telegram_id FROM group_members WHERE chat_id = ? AND status NOT IN ('left','kicked')`,
      [chatId],
    ).catch(() => []);
    for (const m of dbMembers) addId(m.telegram_id);
  }

  return candidates;
}
