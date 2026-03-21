import { d1All } from "./d1.js";

export async function buildTagAllChunks(
  chatId: string,
): Promise<Array<{ text: string; entities: unknown[] }>> {
  const members = await d1All<{ telegram_id: string; first_name: string; username: string | null }>(
    `SELECT u.telegram_id, u.first_name, u.username
     FROM group_members gm
     JOIN users u ON u.telegram_id = gm.telegram_id
     WHERE gm.chat_id = ? AND gm.status NOT IN ('left','kicked')`,
    [chatId],
  );

  if (!members.length) return [{ text: "(no members tracked yet)", entities: [] }];

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
