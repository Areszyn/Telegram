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
 * Feature: sendChatAction — show a typing / upload status bubble before sending.
 * action: "typing" | "upload_photo" | "upload_document" | "record_voice" | etc.
 */
export async function sendChatAction(
  chatId: number | string,
  action = "typing",
  messageThreadId?: number,
): Promise<unknown> {
  const body: Record<string, unknown> = { chat_id: chatId, action };
  if (messageThreadId) body.message_thread_id = messageThreadId;
  return tgCall("sendChatAction", body);
}

/**
 * Feature: sendMessageDraft (Bot API 9.5) — stream partial text in real-time.
 * Repeated calls with the same draftId animate the text; ideal for AI responses.
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

/**
 * Feature: sendPoll — send a native Telegram poll or quiz to any chat.
 */
export async function sendPoll(
  chatId: number | string,
  question: string,
  options: string[],
  extra: Record<string, unknown> = {},
): Promise<unknown> {
  return tgCall("sendPoll", {
    chat_id: chatId,
    question,
    options: options.map(text => ({ text })),
    ...extra,
  });
}

// ── Reactions ────────────────────────────────────────────────────────────────

/**
 * Feature: setMessageReaction — react to a message with emoji.
 * reactions: array of { type: "emoji", emoji: "👀" }
 *            or { type: "custom_emoji", custom_emoji_id: "..." }
 *            or { type: "paid" } for paid Star reactions.
 */
export async function setMessageReaction(
  chatId: number | string,
  messageId: number,
  reactions: Array<{ type: string; emoji?: string; custom_emoji_id?: string }>,
  isBig = false,
): Promise<unknown> {
  return tgCall("setMessageReaction", {
    chat_id: chatId,
    message_id: messageId,
    reaction: reactions,
    is_big: isBig,
  });
}

// ── Pin / Unpin ───────────────────────────────────────────────────────────────

/**
 * Feature: pinChatMessage — pin a message in any chat.
 */
export async function pinChatMessage(
  chatId: number | string,
  messageId: number,
  disableNotification = false,
): Promise<unknown> {
  return tgCall("pinChatMessage", {
    chat_id: chatId,
    message_id: messageId,
    disable_notification: disableNotification,
  });
}

export async function unpinChatMessage(
  chatId: number | string,
  messageId?: number,
): Promise<unknown> {
  const body: Record<string, unknown> = { chat_id: chatId };
  if (messageId) body.message_id = messageId;
  return tgCall("unpinChatMessage", body);
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
    allowed_updates: ["message", "callback_query", "pre_checkout_query"],
  });
}

export async function deleteWebhook(): Promise<unknown> {
  return tgCall("deleteWebhook", {});
}

// ── Bot info & profile ────────────────────────────────────────────────────────

/**
 * Feature (Bot API 9.5): Change the bot's profile photo.
 */
export async function setMyProfilePhoto(photo: string): Promise<unknown> {
  return tgCall("setMyProfilePhoto", { photo });
}

export async function removeMyProfilePhoto(): Promise<unknown> {
  return tgCall("removeMyProfilePhoto", {});
}

/**
 * Feature: setMyDescription / setMyShortDescription — update bot bio text.
 */
export async function setMyDescription(description: string, languageCode?: string): Promise<unknown> {
  const body: Record<string, unknown> = { description };
  if (languageCode) body.language_code = languageCode;
  return tgCall("setMyDescription", body);
}

export async function setMyShortDescription(shortDescription: string, languageCode?: string): Promise<unknown> {
  const body: Record<string, unknown> = { short_description: shortDescription };
  if (languageCode) body.language_code = languageCode;
  return tgCall("setMyShortDescription", body);
}

/**
 * Feature: setMyCommands — set the bot's visible command menu.
 */
export async function setMyCommands(
  commands: Array<{ command: string; description: string }>,
  scope?: Record<string, unknown>,
  languageCode?: string,
): Promise<unknown> {
  const body: Record<string, unknown> = { commands };
  if (scope)        body.scope = scope;
  if (languageCode) body.language_code = languageCode;
  return tgCall("setMyCommands", body);
}

// ── Member management (Bot API 9.5) ─────────────────────────────────────────

export async function setChatMemberTag(
  chatId: number | string,
  userId: number,
  tag?: string,
): Promise<unknown> {
  const body: Record<string, unknown> = { chat_id: chatId, user_id: userId };
  if (tag !== undefined) body.tag = tag;
  return tgCall("setChatMemberTag", body);
}

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

// ── User profile (Bot API 9.5) ────────────────────────────────────────────────

export async function getUserProfileAudios(
  userId: number,
  offset = 0,
  limit = 100,
): Promise<unknown> {
  return tgCall("getUserProfileAudios", { user_id: userId, offset, limit });
}

// ── Stars / Payments ─────────────────────────────────────────────────────────

/**
 * Feature: createInvoiceLink — generate a Stars (XTR) payment link.
 * Omit provider_token for native Telegram Stars payments.
 */
export async function createInvoiceLink(params: {
  title: string;
  description: string;
  payload: string;
  currency: string;
  prices: Array<{ label: string; amount: number }>;
  provider_token?: string;
  photo_url?: string;
  need_name?: boolean;
}): Promise<string> {
  const result = await tgCall("createInvoiceLink", params as unknown as Record<string, unknown>);
  return result as string;
}

/**
 * Feature: refundStarPayment — refund a Stars charge to the user.
 */
export async function refundStarPayment(
  userId: number,
  telegramPaymentChargeId: string,
): Promise<unknown> {
  return tgCall("refundStarPayment", {
    user_id: userId,
    telegram_payment_charge_id: telegramPaymentChargeId,
  });
}

/**
 * Feature: getStarTransactions — list incoming Stars transactions.
 */
export async function getStarTransactions(
  offset = 0,
  limit = 100,
): Promise<unknown> {
  return tgCall("getStarTransactions", { offset, limit });
}

/**
 * Required for Stars payments: answer a pre_checkout_query before the user pays.
 */
export async function answerPreCheckoutQuery(
  preCheckoutQueryId: string,
  ok: boolean,
  errorMessage?: string,
): Promise<unknown> {
  const body: Record<string, unknown> = {
    pre_checkout_query_id: preCheckoutQueryId,
    ok,
  };
  if (!ok && errorMessage) body.error_message = errorMessage;
  return tgCall("answerPreCheckoutQuery", body);
}

// ── Message entity builder ───────────────────────────────────────────────────

/**
 * Builds Telegram messages with rich entity arrays (no parse_mode needed).
 * Supports bold, italic, code, and the new date_time entity (Bot API 9.5).
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
   * Bot API 9.5 date_time entity — Telegram renders this in the user's local timezone.
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

  toSendParams(): { text: string; entities: Record<string, unknown>[] } {
    return { text: this._text, entities: this._entities };
  }
}

// ── Known message effect IDs ─────────────────────────────────────────────────

/** Visual effect IDs for use in message_effect_id on sendMessage calls. */
export const EFFECTS = {
  fire:      "5104858069142078462",
  heart:     "5044134455711629726",
  thumbsUp:  "5046509860389126442",
  hundred:   "5104841245755180586",
  confetti:  "5107584321108051014",
  party:     "5159385139981059251",
} as const;

/** getChatAdministrators — returns list of admin users in a chat. */
export async function getChatAdministrators(chatId: number | string): Promise<unknown[]> {
  const result = await tgCall("getChatAdministrators", { chat_id: chatId });
  return Array.isArray(result) ? result : [];
}

/** getChatMembersCount — returns approximate member count. */
export async function getChatMembersCount(chatId: number | string): Promise<number> {
  const result = await tgCall("getChatMembersCount", { chat_id: chatId });
  return typeof result === "number" ? result : 0;
}

/**
 * banChatMember — permanently ban a user from a chat.
 * until_date=0 means permanent. Pass revoke_messages=true to delete their history.
 */
export async function banChatMember(
  chatId: number | string,
  userId: number,
  revokeMessages = false,
): Promise<unknown> {
  return tgCall("banChatMember", {
    chat_id: chatId,
    user_id: userId,
    until_date: 0,
    revoke_messages: revokeMessages,
  });
}

/** Custom emoji IDs from @Trystickers pack for inline buttons. */
export const BTN_EMOJI = {
  openApp:      "6055587425579699627", // 🤩 excited
  checkPay:     "6055389517781666963", // 👀 watching
  copyAddr:     "6055520097672367470", // ❤️ heart
  thinkAgain:   "6055247036536589536", // 🤔 thinking
  paid:         "6055548160988679801", // 🥰 love-struck
  expired:      "6055113295549959687", // 💀 skull
  stars:        "6055255085305302792", // 🤣 -> we'll use ⭐ text instead
  poll:         "6055389517781666963", // 👀
  broadcast:    "6055326000000000000", // fallback
} as const;
