const BOT_TOKEN = process.env.BOT_TOKEN!;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

export async function tgCall(method: string, body: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result: unknown; description?: string };
  if (!data.ok) {
    console.error(`Telegram ${method} error:`, data.description);
  }
  return data.result;
}

export async function sendMessage(chatId: number | string, text: string, extra: Record<string, unknown> = {}): Promise<unknown> {
  return tgCall("sendMessage", { chat_id: chatId, text, ...extra });
}

export async function forwardMessage(fromChatId: number | string, toChatId: number | string, messageId: number): Promise<unknown> {
  return tgCall("forwardMessage", {
    from_chat_id: fromChatId,
    chat_id: toChatId,
    message_id: messageId,
  });
}

export async function copyMessage(fromChatId: number | string, toChatId: number | string, messageId: number): Promise<unknown> {
  return tgCall("copyMessage", {
    from_chat_id: fromChatId,
    chat_id: toChatId,
    message_id: messageId,
  });
}

export async function getFileUrl(fileId: string): Promise<string> {
  const result = (await tgCall("getFile", { file_id: fileId })) as { file_path: string };
  return `${FILE_API}/${result.file_path}`;
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const url = await getFileUrl(fileId);
  const res = await fetch(url);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export async function setWebhook(url: string): Promise<unknown> {
  return tgCall("setWebhook", { url, allowed_updates: ["message", "callback_query"] });
}

export async function deleteWebhook(): Promise<unknown> {
  return tgCall("deleteWebhook", {});
}
