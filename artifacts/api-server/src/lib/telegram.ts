function apiUrl(token: string) {
  return `https://api.telegram.org/bot${token}`;
}

function fileApiUrl(token: string) {
  return `https://api.telegram.org/file/bot${token}`;
}

export async function tgCall(
  token: string,
  method: string,
  body: Record<string, unknown> = {},
): Promise<unknown> {
  const res = await fetch(`${apiUrl(token)}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result: unknown; description?: string };
  if (!data.ok) {
    console.error(`Telegram ${method} error:`, data.description);
    throw new Error(data.description ?? `Telegram ${method} failed`);
  }
  return data.result;
}

export async function sendMessage(
  token: string,
  chatId: number | string,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<unknown> {
  return tgCall(token, "sendMessage", { chat_id: chatId, text, ...extra });
}

export async function sendChatAction(
  token: string,
  chatId: number | string,
  action = "typing",
  messageThreadId?: number,
): Promise<unknown> {
  const body: Record<string, unknown> = { chat_id: chatId, action };
  if (messageThreadId) body.message_thread_id = messageThreadId;
  return tgCall(token, "sendChatAction", body);
}

export async function sendMessageDraft(
  token: string,
  chatId: number | string,
  draftId: number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<unknown> {
  const res = await fetch(`${apiUrl(token)}/sendMessageDraft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, draft_id: draftId, text, ...extra }),
  });
  const data = (await res.json()) as { ok: boolean; result: unknown; description?: string };
  if (!data.ok) throw new Error(`sendMessageDraft failed: ${data.description ?? "unknown"}`);
  return data.result;
}

export async function editMessageText(
  token: string,
  chatId: number | string,
  messageId: number,
  text: string,
  extra: Record<string, unknown> = {},
): Promise<unknown> {
  return tgCall(token, "editMessageText", { chat_id: chatId, message_id: messageId, text, ...extra });
}

export async function deleteMessage(
  token: string,
  chatId: number | string,
  messageId: number,
): Promise<unknown> {
  return tgCall(token, "deleteMessage", { chat_id: chatId, message_id: messageId });
}

export async function forwardMessage(
  token: string,
  fromChatId: number | string,
  toChatId: number | string,
  messageId: number,
): Promise<unknown> {
  return tgCall(token, "forwardMessage", {
    from_chat_id: fromChatId,
    chat_id: toChatId,
    message_id: messageId,
  });
}

export async function copyMessage(
  token: string,
  fromChatId: number | string,
  toChatId: number | string,
  messageId: number,
): Promise<unknown> {
  return tgCall(token, "copyMessage", {
    from_chat_id: fromChatId,
    chat_id: toChatId,
    message_id: messageId,
  });
}

export async function sendPoll(
  token: string,
  chatId: number | string,
  question: string,
  options: string[],
  extra: Record<string, unknown> = {},
): Promise<unknown> {
  return tgCall(token, "sendPoll", {
    chat_id: chatId,
    question,
    options: options.map(text => ({ text })),
    ...extra,
  });
}

export async function setMessageReaction(
  token: string,
  chatId: number | string,
  messageId: number,
  reactions: Array<{ type: string; emoji?: string; custom_emoji_id?: string }>,
  isBig = false,
): Promise<unknown> {
  return tgCall(token, "setMessageReaction", {
    chat_id: chatId,
    message_id: messageId,
    reaction: reactions,
    is_big: isBig,
  });
}

export async function pinChatMessage(
  token: string,
  chatId: number | string,
  messageId: number,
  disableNotification = false,
): Promise<unknown> {
  return tgCall(token, "pinChatMessage", {
    chat_id: chatId,
    message_id: messageId,
    disable_notification: disableNotification,
  });
}

export async function unpinChatMessage(
  token: string,
  chatId: number | string,
  messageId?: number,
): Promise<unknown> {
  const body: Record<string, unknown> = { chat_id: chatId };
  if (messageId) body.message_id = messageId;
  return tgCall(token, "unpinChatMessage", body);
}

export async function tgCallFormData(
  token: string,
  method: string,
  form: FormData,
): Promise<unknown> {
  const res = await fetch(`${apiUrl(token)}/${method}`, {
    method: "POST",
    body: form,
  });
  const data = (await res.json()) as { ok: boolean; result: unknown; description?: string };
  if (!data.ok) {
    console.error(`Telegram ${method} form error:`, data.description);
    throw new Error(data.description ?? `Telegram ${method} failed`);
  }
  return data.result;
}

export async function sendMediaFile(
  token: string,
  chatId: number | string,
  mediaType: "photo" | "video" | "audio" | "voice" | "document",
  file: File | Blob,
  caption?: string,
): Promise<unknown> {
  const methodMap: Record<string, string> = {
    photo: "sendPhoto",
    video: "sendVideo",
    audio: "sendAudio",
    voice: "sendVoice",
    document: "sendDocument",
  };
  const fieldMap: Record<string, string> = {
    photo: "photo",
    video: "video",
    audio: "audio",
    voice: "voice",
    document: "document",
  };
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append(fieldMap[mediaType], file);
  if (caption) form.append("caption", caption);
  return tgCallFormData(token, methodMap[mediaType], form);
}

export async function getFileUrl(token: string, fileId: string): Promise<string> {
  const result = (await tgCall(token, "getFile", { file_id: fileId })) as { file_path: string };
  return `${fileApiUrl(token)}/${result.file_path}`;
}

export async function downloadFile(token: string, fileId: string): Promise<ArrayBuffer> {
  const url = await getFileUrl(token, fileId);
  const res = await fetch(url);
  return res.arrayBuffer();
}

export async function setMyProfilePhoto(token: string, photo: string): Promise<unknown> {
  return tgCall(token, "setMyProfilePhoto", { photo });
}

export async function removeMyProfilePhoto(token: string): Promise<unknown> {
  return tgCall(token, "removeMyProfilePhoto", {});
}

export async function setMyDescription(token: string, description: string, languageCode?: string): Promise<unknown> {
  const body: Record<string, unknown> = { description };
  if (languageCode) body.language_code = languageCode;
  return tgCall(token, "setMyDescription", body);
}

export async function setMyShortDescription(token: string, shortDescription: string, languageCode?: string): Promise<unknown> {
  const body: Record<string, unknown> = { short_description: shortDescription };
  if (languageCode) body.language_code = languageCode;
  return tgCall(token, "setMyShortDescription", body);
}

export async function setMyCommands(
  token: string,
  commands: Array<{ command: string; description: string }>,
  scope?: Record<string, unknown>,
  languageCode?: string,
): Promise<unknown> {
  const body: Record<string, unknown> = { commands };
  if (scope)        body.scope = scope;
  if (languageCode) body.language_code = languageCode;
  return tgCall(token, "setMyCommands", body);
}

export async function deleteMyCommands(
  token: string,
  scope?: Record<string, unknown>,
  languageCode?: string,
): Promise<unknown> {
  const body: Record<string, unknown> = {};
  if (scope)        body.scope = scope;
  if (languageCode) body.language_code = languageCode;
  return tgCall(token, "deleteMyCommands", body);
}

export async function setChatMemberTag(
  token: string,
  chatId: number | string,
  userId: number,
  tag?: string,
): Promise<unknown> {
  const body: Record<string, unknown> = { chat_id: chatId, user_id: userId };
  if (tag !== undefined) body.tag = tag;
  return tgCall(token, "setChatMemberTag", body);
}

export async function promoteChatMember(
  token: string,
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
  return tgCall(token, "promoteChatMember", { chat_id: chatId, user_id: userId, ...rights });
}


export async function createInvoiceLink(
  token: string,
  params: {
    title: string;
    description: string;
    payload: string;
    currency: string;
    prices: Array<{ label: string; amount: number }>;
    provider_token?: string;
    photo_url?: string;
    need_name?: boolean;
    subscription_period?: number;
  },
): Promise<string> {
  const result = await tgCall(token, "createInvoiceLink", params as unknown as Record<string, unknown>);
  return result as string;
}

export async function refundStarPayment(
  token: string,
  userId: number,
  telegramPaymentChargeId: string,
): Promise<unknown> {
  return tgCall(token, "refundStarPayment", {
    user_id: userId,
    telegram_payment_charge_id: telegramPaymentChargeId,
  });
}

export async function getStarTransactions(
  token: string,
  offset = 0,
  limit = 100,
): Promise<unknown> {
  return tgCall(token, "getStarTransactions", { offset, limit });
}

export async function answerPreCheckoutQuery(
  token: string,
  preCheckoutQueryId: string,
  ok: boolean,
  errorMessage?: string,
): Promise<unknown> {
  const body: Record<string, unknown> = { pre_checkout_query_id: preCheckoutQueryId, ok };
  if (!ok && errorMessage) body.error_message = errorMessage;
  return tgCall(token, "answerPreCheckoutQuery", body);
}

export async function getChatAdministrators(token: string, chatId: number | string): Promise<unknown[]> {
  const result = await tgCall(token, "getChatAdministrators", { chat_id: chatId });
  return Array.isArray(result) ? result : [];
}

export async function isBotAdminInChat(token: string, chatId: number | string): Promise<boolean> {
  try {
    const me = await tgCall(token, "getMe", {}) as { id: number };
    const member = await tgCall(token, "getChatMember", { chat_id: chatId, user_id: me.id }) as { status: string };
    return member.status === "administrator" || member.status === "creator";
  } catch {
    return false;
  }
}

export async function getChatMembersCount(token: string, chatId: number | string): Promise<number> {
  const result = await tgCall(token, "getChatMembersCount", { chat_id: chatId });
  return typeof result === "number" ? result : 0;
}

export async function banChatMember(
  token: string,
  chatId: number | string,
  userId: number,
  revokeMessages = false,
): Promise<unknown> {
  return tgCall(token, "banChatMember", {
    chat_id: chatId,
    user_id: userId,
    until_date: 0,
    revoke_messages: revokeMessages,
  });
}

function utf8Len(s: string): number {
  return new TextEncoder().encode(s).length;
}

export class MessageBuilder {
  private _text = "";
  private _entities: Record<string, unknown>[] = [];

  get length(): number { return utf8Len(this._text); }
  get text(): string   { return this._text; }
  get entities(): Record<string, unknown>[] { return this._entities; }

  add(s: string): this {
    this._text += s;
    return this;
  }

  bold(s: string): this {
    const offset = this.length;
    this._text += s;
    this._entities.push({ type: "bold", offset, length: utf8Len(s) });
    return this;
  }

  italic(s: string): this {
    const offset = this.length;
    this._text += s;
    this._entities.push({ type: "italic", offset, length: utf8Len(s) });
    return this;
  }

  code(s: string): this {
    const offset = this.length;
    this._text += s;
    this._entities.push({ type: "code", offset, length: utf8Len(s) });
    return this;
  }

  dateTime(displayText: string, timestamp: number): this {
    const offset = this.length;
    this._text += displayText;
    this._entities.push({ type: "date_time", offset, length: utf8Len(displayText), timestamp });
    return this;
  }

  toSendParams(): { text: string; entities: Record<string, unknown>[] } {
    return { text: this._text, entities: this._entities };
  }
}

export const EFFECTS = {
  fire:      "5104858069142078462",
  heart:     "5044134455711629726",
  thumbsUp:  "5046509860389126442",
  hundred:   "5104841245755180586",
  confetti:  "5107584321108051014",
  party:     "5159385139981059251",
} as const;

export const BTN_EMOJI = {
  openApp:      "6055587425579699627",
  checkPay:     "6055389517781666963",
  copyAddr:     "6055520097672367470",
  thinkAgain:   "6055247036536589536",
  paid:         "6055548160988679801",
  expired:      "6055113295549959687",
  stars:        "6055255085305302792",
  poll:         "6055389517781666963",
  broadcast:    "6055326000000000000",
} as const;
