import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Env } from "../types.ts";
import { parseAuth, type HonoCtx } from "../lib/auth.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

async function deriveKey(secret: string): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(secret.padEnd(32, "0").slice(0, 32));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptKey(plaintext: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  const combined = new Uint8Array(iv.length + new Uint8Array(enc).length);
  combined.set(iv);
  combined.set(new Uint8Array(enc), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptKey(ciphertext: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const data = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = data.slice(0, 12);
  const enc = data.slice(12);
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, enc);
  return new TextDecoder().decode(dec);
}

const VALID_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "claude-3-5-sonnet-latest",
  "claude-3-haiku-20240307",
] as const;
type ModelId = typeof VALID_MODELS[number];

function getProvider(model: string): "openai" | "anthropic" | "gemini" {
  if (model.startsWith("gpt")) return "openai";
  if (model.startsWith("gemini")) return "gemini";
  return "anthropic";
}

const MAX_CONVERSATIONS = 50;
const MAX_HISTORY = 50;

const app = new Hono<{ Bindings: Env }>();

app.get("/ai/models", async (c: HonoCtx) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const keys = await d1All<{ provider: string }>(c.env.DB,
    "SELECT provider FROM ai_api_keys WHERE owner_telegram_id = ?",
    [auth.telegramId],
  );
  const activeProviders = new Set(keys.map(k => k.provider));

  const allModels = [
    { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
    { id: "gpt-4-turbo", label: "GPT-4 Turbo", provider: "openai" },
    { id: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", provider: "openai" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini" },
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "gemini" },
    { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "gemini" },
    { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "anthropic" },
    { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", provider: "anthropic" },
    { id: "claude-3-haiku-20240307", label: "Claude 3 Haiku", provider: "anthropic" },
  ];

  const models = allModels.map(m => ({
    ...m,
    available: activeProviders.has(m.provider),
  }));

  return c.json({ models, activeProviders: Array.from(activeProviders) });
});

app.get("/ai/keys", async (c: HonoCtx) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const keys = await d1All<{ provider: string; created_at: string }>(c.env.DB,
    "SELECT provider, created_at FROM ai_api_keys WHERE owner_telegram_id = ?",
    [auth.telegramId],
  );
  return c.json({ keys });
});

app.post("/ai/keys", async (c: HonoCtx) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  let body: { provider?: string; api_key?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid request body" }, 400); }
  const { provider, api_key } = body;

  if (!provider || !["openai", "anthropic", "gemini"].includes(provider)) {
    return c.json({ error: "Invalid provider. Must be openai, anthropic, or gemini." }, 400);
  }
  if (!api_key || api_key.trim().length < 10) {
    return c.json({ error: "Invalid API key" }, 400);
  }

  const encSecret = c.env.AI_KEY_ENCRYPTION_SECRET;
  if (!encSecret) return c.json({ error: "Encryption not configured" }, 500);
  const encrypted = await encryptKey(api_key.trim(), encSecret);

  const existing = await d1First(c.env.DB,
    "SELECT id FROM ai_api_keys WHERE owner_telegram_id = ? AND provider = ?",
    [auth.telegramId, provider],
  );

  if (existing) {
    await d1Run(c.env.DB,
      "UPDATE ai_api_keys SET api_key = ?, updated_at = datetime('now') WHERE owner_telegram_id = ? AND provider = ?",
      [encrypted, auth.telegramId, provider],
    );
  } else {
    await d1Run(c.env.DB,
      "INSERT INTO ai_api_keys (owner_telegram_id, provider, api_key) VALUES (?, ?, ?)",
      [auth.telegramId, provider, encrypted],
    );
  }

  return c.json({ ok: true });
});

app.delete("/ai/keys/:provider", async (c: HonoCtx) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const provider = c.req.param("provider");
  await d1Run(c.env.DB,
    "DELETE FROM ai_api_keys WHERE owner_telegram_id = ? AND provider = ?",
    [auth.telegramId, provider],
  );
  return c.json({ ok: true });
});

app.get("/ai/conversations", async (c: HonoCtx) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const convs = await d1All(c.env.DB,
    "SELECT id, title, model, created_at, updated_at FROM ai_conversations WHERE owner_telegram_id = ? ORDER BY updated_at DESC LIMIT 100",
    [auth.telegramId],
  );
  return c.json({ conversations: convs });
});

app.post("/ai/conversations", async (c: HonoCtx) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  let body: { model?: string; system_prompt?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid request body" }, 400); }
  const { model, system_prompt } = body;
  const m = VALID_MODELS.includes(model as ModelId) ? model! : "gpt-4o";

  const count = await d1First<{ cnt: number }>(c.env.DB,
    "SELECT COUNT(*) as cnt FROM ai_conversations WHERE owner_telegram_id = ?",
    [auth.telegramId],
  );
  if (count && count.cnt >= MAX_CONVERSATIONS) {
    return c.json({ error: `Max ${MAX_CONVERSATIONS} conversations` }, 400);
  }

  await d1Run(c.env.DB,
    "INSERT INTO ai_conversations (owner_telegram_id, model, system_prompt) VALUES (?, ?, ?)",
    [auth.telegramId, m, (system_prompt || "").slice(0, 2000)],
  );

  const conv = await d1First(c.env.DB,
    "SELECT id, title, model, system_prompt, created_at, updated_at FROM ai_conversations WHERE rowid = last_insert_rowid()",
    [],
  );

  return c.json({ ok: true, conversation: conv });
});

app.get("/ai/conversations/:id", async (c: HonoCtx) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const convId = c.req.param("id");
  const conv = await d1First(c.env.DB,
    "SELECT * FROM ai_conversations WHERE id = ? AND owner_telegram_id = ?",
    [convId, auth.telegramId],
  );
  if (!conv) return c.json({ error: "Not found" }, 404);

  const msgs = await d1All(c.env.DB,
    "SELECT id, role, content, model, tokens_used, created_at FROM ai_messages WHERE conversation_id = ? ORDER BY id ASC LIMIT 200",
    [convId],
  );

  return c.json({ conversation: conv, messages: msgs });
});

app.put("/ai/conversations/:id", async (c: HonoCtx) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const convId = c.req.param("id");
  const conv = await d1First(c.env.DB,
    "SELECT id FROM ai_conversations WHERE id = ? AND owner_telegram_id = ?",
    [convId, auth.telegramId],
  );
  if (!conv) return c.json({ error: "Not found" }, 404);

  let body: { title?: string; model?: string; system_prompt?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid request body" }, 400); }
  const { title, model, system_prompt } = body;

  const updates: string[] = [];
  const params: unknown[] = [];
  if (title !== undefined) { updates.push("title = ?"); params.push(title.slice(0, 100)); }
  if (model !== undefined && VALID_MODELS.includes(model as ModelId)) { updates.push("model = ?"); params.push(model); }
  if (system_prompt !== undefined) { updates.push("system_prompt = ?"); params.push(system_prompt.slice(0, 2000)); }

  if (updates.length === 0) return c.json({ error: "Nothing to update" }, 400);
  params.push(convId);
  await d1Run(c.env.DB, `UPDATE ai_conversations SET ${updates.join(", ")}, updated_at = datetime('now') WHERE id = ?`, params);
  return c.json({ ok: true });
});

app.delete("/ai/conversations/:id", async (c: HonoCtx) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const convId = c.req.param("id");
  const conv = await d1First(c.env.DB,
    "SELECT id FROM ai_conversations WHERE id = ? AND owner_telegram_id = ?",
    [convId, auth.telegramId],
  );
  if (!conv) return c.json({ error: "Not found" }, 404);

  await d1Run(c.env.DB, "DELETE FROM ai_messages WHERE conversation_id = ?", [convId]);
  await d1Run(c.env.DB, "DELETE FROM ai_conversations WHERE id = ?", [convId]);
  return c.json({ ok: true });
});

app.post("/ai/conversations/:id/messages", async (c: HonoCtx) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);

  const convId = c.req.param("id");
  const conv = await d1First<{
    id: number; owner_telegram_id: string; model: string; system_prompt: string; title: string;
  }>(c.env.DB,
    "SELECT * FROM ai_conversations WHERE id = ? AND owner_telegram_id = ?",
    [convId, auth.telegramId],
  );
  if (!conv) return c.json({ error: "Not found" }, 404);

  let body: { content?: string; model?: string };
  try { body = await c.req.json(); } catch { return c.json({ error: "Invalid request body" }, 400); }
  const { content, model: overrideModel } = body;
  if (!content || content.trim().length === 0) return c.json({ error: "Message required" }, 400);
  if (content.length > 10000) return c.json({ error: "Message too long (max 10000 chars)" }, 400);

  const activeModel = (overrideModel && VALID_MODELS.includes(overrideModel as ModelId))
    ? overrideModel : conv.model;
  const provider = getProvider(activeModel);

  const keyRow = await d1First<{ api_key: string }>(c.env.DB,
    "SELECT api_key FROM ai_api_keys WHERE owner_telegram_id = ? AND provider = ?",
    [auth.telegramId, provider],
  );
  if (!keyRow) {
    return c.json({ error: `No ${provider} API key configured. Go to AI Settings to add your key.` }, 400);
  }

  const encSecret = c.env.AI_KEY_ENCRYPTION_SECRET;
  if (!encSecret) return c.json({ error: "Encryption not configured" }, 500);
  let userApiKey: string;
  try {
    userApiKey = await decryptKey(keyRow.api_key, encSecret);
  } catch {
    return c.json({ error: "Failed to decrypt API key. Please re-save your key in AI Settings." }, 500);
  }

  await d1Run(c.env.DB,
    "INSERT INTO ai_messages (conversation_id, role, content, model) VALUES (?, 'user', ?, ?)",
    [convId, content.trim(), activeModel],
  );

  const history = await d1All<{ role: string; content: string }>(c.env.DB,
    `SELECT role, content FROM ai_messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ${MAX_HISTORY}`,
    [convId],
  );
  history.reverse();

  const chatMessages = history.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content }));
  if (conv.system_prompt) {
    chatMessages.unshift({ role: "system", content: conv.system_prompt });
  }

  const isFirstMsg = history.length <= 1;

  return streamSSE(c, async (stream) => {
    let fullResponse = "";

    try {
      if (provider === "openai") {
        const openai = new OpenAI({ apiKey: userApiKey });
        const completion = await openai.chat.completions.create({
          model: activeModel,
          max_completion_tokens: 4096,
          messages: chatMessages,
          stream: true,
        });
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            fullResponse += text;
            await stream.writeSSE({ data: JSON.stringify({ content: text }) });
          }
        }
      } else if (provider === "anthropic") {
        const anthropic = new Anthropic({ apiKey: userApiKey });
        const sysMsg = chatMessages.find(m => m.role === "system");
        const userMsgs = chatMessages.filter(m => m.role !== "system").map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const params: Anthropic.MessageCreateParams = {
          model: activeModel,
          max_tokens: 4096,
          messages: userMsgs,
          stream: true,
        };
        if (sysMsg) params.system = sysMsg.content;

        const msgStream = anthropic.messages.stream(params);
        for await (const event of msgStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            fullResponse += event.delta.text;
            await stream.writeSSE({ data: JSON.stringify({ content: event.delta.text }) });
          }
        }
      } else {
        const ai = new GoogleGenAI({ apiKey: userApiKey });
        const geminiMsgs = chatMessages.filter(m => m.role !== "system").map(m => ({
          role: m.role === "assistant" ? "model" as const : "user" as const,
          parts: [{ text: m.content }],
        }));
        const sysInstruction = chatMessages.find(m => m.role === "system")?.content;

        const response = await ai.models.generateContentStream({
          model: activeModel,
          contents: geminiMsgs,
          config: {
            maxOutputTokens: 4096,
            ...(sysInstruction ? { systemInstruction: sysInstruction } : {}),
          },
        });
        for await (const chunk of response) {
          const text = chunk.text;
          if (text) {
            fullResponse += text;
            await stream.writeSSE({ data: JSON.stringify({ content: text }) });
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      console.error("AI stream error:", errMsg.slice(0, 200));
      let safeMsg = "Something went wrong. Please try again.";
      if (err instanceof Error) {
        const m = err.message.toLowerCase();
        if (m.includes("api key") || m.includes("auth") || m.includes("401") || m.includes("invalid")) safeMsg = "Invalid API key. Please check your key in AI Settings.";
        else if (m.includes("rate") || m.includes("429")) safeMsg = "Rate limit reached. Please wait a moment.";
        else if (m.includes("timeout") || m.includes("504")) safeMsg = "Request timed out. Please try again.";
        else if (m.includes("context") || m.includes("token") || m.includes("too long")) safeMsg = "Conversation too long. Start a new chat.";
        else if (m.includes("quota") || m.includes("billing") || m.includes("insufficient")) safeMsg = "API quota exceeded. Check your billing on the provider's dashboard.";
      }
      await stream.writeSSE({ data: JSON.stringify({ error: safeMsg }) });
    }

    if (fullResponse) {
      await d1Run(c.env.DB,
        "INSERT INTO ai_messages (conversation_id, role, content, model) VALUES (?, 'assistant', ?, ?)",
        [convId, fullResponse, activeModel],
      );
      await d1Run(c.env.DB,
        "UPDATE ai_conversations SET updated_at = datetime('now') WHERE id = ?",
        [convId],
      );

      if (isFirstMsg) {
        const autoTitle = fullResponse.slice(0, 60).replace(/\n/g, " ").trim();
        await d1Run(c.env.DB,
          "UPDATE ai_conversations SET title = ? WHERE id = ? AND title = 'New Chat'",
          [autoTitle, convId],
        );
      }
    }

    await stream.writeSSE({ data: JSON.stringify({ done: true }) });
  });
});

app.get("/ai/admin/keys", async (c: HonoCtx) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Admin only" }, 403);

  const keys = await d1All<{
    owner_telegram_id: string; provider: string; created_at: string; updated_at: string;
  }>(c.env.DB,
    "SELECT k.owner_telegram_id, k.provider, k.created_at, k.updated_at FROM ai_api_keys k ORDER BY k.updated_at DESC",
    [],
  );

  const userIds = [...new Set(keys.map(k => k.owner_telegram_id))];
  const userMap: Record<string, string> = {};
  for (const tid of userIds) {
    const u = await d1First<{ first_name: string; username: string }>(c.env.DB,
      "SELECT first_name, username FROM users WHERE telegram_id = ?", [tid],
    );
    if (u) userMap[tid] = u.first_name || u.username || tid;
  }

  return c.json({
    keys: keys.map(k => ({
      ...k,
      user_name: userMap[k.owner_telegram_id] || k.owner_telegram_id,
    })),
    total: keys.length,
  });
});

app.get("/ai/admin/stats", async (c: HonoCtx) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Admin only" }, 403);

  const stats = await d1First<{
    total_conversations: number;
    total_messages: number;
    unique_users: number;
  }>(c.env.DB, `
    SELECT
      (SELECT COUNT(*) FROM ai_conversations) as total_conversations,
      (SELECT COUNT(*) FROM ai_messages) as total_messages,
      (SELECT COUNT(DISTINCT owner_telegram_id) FROM ai_conversations) as unique_users
  `, []);

  const modelBreakdown = await d1All(c.env.DB,
    "SELECT model, COUNT(*) as count FROM ai_messages WHERE role = 'assistant' GROUP BY model ORDER BY count DESC",
    [],
  );

  return c.json({ stats, modelBreakdown });
});

app.get("/ai/admin/conversations", async (c: HonoCtx) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Admin only" }, 403);

  const page = parseInt(c.req.query("page") || "1");
  const limit = 20;
  const offset = (page - 1) * limit;

  const convs = await d1All(c.env.DB,
    "SELECT id, owner_telegram_id, title, model, created_at, updated_at FROM ai_conversations ORDER BY updated_at DESC LIMIT ? OFFSET ?",
    [limit, offset],
  );
  const total = await d1First<{ cnt: number }>(c.env.DB, "SELECT COUNT(*) as cnt FROM ai_conversations", []);

  return c.json({ conversations: convs, total: total?.cnt || 0, page });
});

app.delete("/ai/admin/conversations/:id", async (c: HonoCtx) => {
  const auth = await parseAuth(c);
  if (!auth?.isAdmin) return c.json({ error: "Admin only" }, 403);

  const convId = c.req.param("id");
  await d1Run(c.env.DB, "DELETE FROM ai_messages WHERE conversation_id = ?", [convId]);
  await d1Run(c.env.DB, "DELETE FROM ai_conversations WHERE id = ?", [convId]);
  return c.json({ ok: true });
});

export default app;
