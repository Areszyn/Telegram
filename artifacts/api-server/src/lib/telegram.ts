const BOT_TOKEN = process.env.BOT_TOKEN!;
const API      = `https://api.telegram.org/bot${BOT_TOKEN}`;
const FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

// ── Core caller ──────────────────────────────────────────────────────────────

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

// ── Messaging ────────────────────────────────────────────────────────────────

export async function sendMessage(
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<unknown> {
  return tgCall("sendMessage", { chat_id: chatId, text, ...extra });
}

/**
 * Bot API 9.5 — Feature 4
 * Stream partial text to a user in real-time (AI typing effect).
 * Calls with the same draftId animate/update the same draft bubble.
 * Set finalize=true on the last chunk to convert it into a real message.
 */
export async function sendMessageDraft(
  chatId: number | string,
  draftId: number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<unknown> {
  return tgCall("sendMessageDraft", { chat_id: chatId, draft_id: draftId, text, ...extra });
}

export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<unknown> {
  return tgCall("editMessageText", { chat_id: chatId, message_id: messageId, text, ...extra });
}

export async function forwardMessage(
  fromChatId: number | string,
  toChatId: number | string,
  messageId: number,
): Promise<unknown> {
  return tgCall("forwardMessage", {
    from_chat_id: fromChatId,
    chat_id: toChatId,
    message_id: messageId,
  });
}

export async function copyMessage(
  fromChatId: number | string,
  toChatId: number | string,
  messageId: number,
): Promise<unknown> {
  return tgCall("copyMessage", {
    from_chat_id: fromChatId,
    chat_id: toChatId,
    message_id: messageId,
  });
}

// ── File helpers ─────────────────────────────────────────────────────────────

export async function getFileUrl(fileId: string): Promise<string> {
  const result = (await tgCall("getFile", { file_id: fileId })) as { file_path: string };
  return `${FILE_API}/${result.file_path}`;
}

export async function downloadFile(fileId: string): Promise<Buffer> {
  const url = await getFileUrl(fileId);
  const res = await fetch(url);
  const ab  = await res.arrayBuffer();
  return Buffer.from(ab);
}

// ── Webhook ──────────────────────────────────────────────────────────────────

export async function setWebhook(url: string): Promise<unknown> {
  return tgCall("setWebhook", {
    url,
    allowed_updates: ["message", "callback_query"],
  });
}

export async function deleteWebhook(): Promise<unknown> {
  return tgCall("deleteWebhook", {});
}

// ── Bot profile — Bot API 9.5 Features 6 & 7 ────────────────────────────────

/**
 * Feature 6 — Set the bot's profile photo using a file_id or URL.
 */
export async function setMyProfilePhoto(photo: string): Promise<unknown> {
  return tgCall("setMyProfilePhoto", { photo });
}

/**
 * Feature 7 — Remove the bot's current profile photo.
 */
export async function removeMyProfilePhoto(): Promise<unknown> {
  return tgCall("removeMyProfilePhoto", {});
}

// ── Member management — Bot API 9.5 Features 8, 9 ───────────────────────────

/**
 * Feature 8 — Assign a visible tag to a chat member.
 * Pass tag=undefined to remove an existing tag.
 */
export async function setChatMemberTag(
  chatId: number | string,
  userId: number,
  tag?: string,
): Promise<unknown> {
  const body: Record<string, unknown> = { chat_id: chatId, user_id: userId };
  if (tag !== undefined) body.tag = tag;
  return tgCall("setChatMemberTag", body);
}

/**
 * Feature 9 — Promote a chat member with new can_manage_tags right (Bot API 9.5).
 */
export async function promoteChatMember(
  chatId: number | string,
  userId: number,
  rights: Partial<{
    can_change_info: boolean;
    can_post_messages: boolean;
    can_edit_messages: boolean;
    can_delete_messages: boolean;
    can_invite_users: boolean;
    can_restrict_members: boolean;
    can_pin_messages: boolean;
    can_promote_members: boolean;
    can_manage_chat: boolean;
    can_manage_video_chats: boolean;
    can_manage_topics: boolean;
    can_manage_tags: boolean;
  }>,
): Promise<unknown> {
  return tgCall("promoteChatMember", { chat_id: chatId, user_id: userId, ...rights });
}

// ── User profile — Bot API 9.5 Feature 10 ────────────────────────────────────

/**
 * Feature 10 — Fetch audio files added to a user's Telegram profile.
 */
export async function getUserProfileAudios(
  userId: number,
  offset = 0,
  limit = 100,
): Promise<unknown> {
  return tgCall("getUserProfileAudios", { user_id: userId, offset, limit });
}

// ── Message entity builder ───────────────────────────────────────────────────

/**
 * Helper for constructing Telegram messages with rich entities
 * without using parse_mode HTML/Markdown.
 * Enables mixing bold, code, and the new date_time entity (Feature 5) in one message.
 */
export class MessageBuilder {
  private _text = "";
  private _entities: Record<string, unknown>[] = [];

  get length(): number { return Buffer.byteLength(this._text, "utf8"); }
  get text(): string   { return this._text; }
  get entities(): Record<string, unknown>[] { return this._entities; }

  add(s: string): this {
    this._text += s;
    return this;
  }

  bold(s: string): this {
    const offset = this.length;
    this._text += s;
    this._entities.push({ type: "bold", offset, length: Buffer.byteLength(s, "utf8") });
    return this;
  }

  italic(s: string): this {
    const offset = this.length;
    this._text += s;
    this._entities.push({ type: "italic", offset, length: Buffer.byteLength(s, "utf8") });
    return this;
  }

  code(s: string): this {
    const offset = this.length;
    this._text += s;
    this._entities.push({ type: "code", offset, length: Buffer.byteLength(s, "utf8") });
    return this;
  }

  /**
   * Feature 5 — date_time entity (Bot API 9.5).
   * Telegram renders `displayText` in the user's local timezone / date format.
   * `timestamp` is the Unix timestamp (seconds) for the point in time to display.
   */
  dateTime(displayText: string, timestamp: number): this {
    const offset = this.length;
    this._text += displayText;
    this._entities.push({
      type: "date_time",
      offset,
      length: Buffer.byteLength(displayText, "utf8"),
      timestamp,
    });
    return this;
  }

  /** Build ready-to-spread extra params for sendMessage / editMessageText. */
  toSendParams(): { text: string; entities: Record<string, unknown>[] } {
    return { text: this._text, entities: this._entities };
  }
}
