import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Env } from "../types.ts";
import { parseAuth, type HonoCtx } from "../lib/auth.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

const VALID_MODELS = [
  "gpt-5.2",
  "gpt-4o",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
] as const;
type ModelId = typeof VALID_MODELS[number];

const MODEL_LABELS: Record<ModelId, string> = {
  "gpt-5.2": "GPT-5.2",
  "gpt-4o": "GPT-4o",
  "gemini-2.5-flash": "Gemini 2.5 Flash",
  "gemini-2.5-pro": "Gemini 2.5 Pro",
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "claude-haiku-4-5": "Claude Haiku 4.5",
};

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
  const models = VALID_MODELS.map(id => ({
    id,
    label: MODEL_LABELS[id],
    provider: getProvider(id),
  }));
  return c.json({ models });
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
  const m = VALID_MODELS.includes(model as ModelId) ? model! : "gpt-5.2";

  const count = await d1First<{ cnt: number }>(c.env.DB,
    "SELECT COUNT(*) as cnt FROM ai_conversations WHERE owner_telegram_id = ?",
    [auth.telegramId],
  );
  if (count && count.cnt >= MAX_CONVERSATIONS) {
    return c.json({ error: `Max ${MAX_CONVERSATIONS} conversations` }, 400);
  }

  const result = await d1Run(c.env.DB,
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
        const openai = new OpenAI({
          baseURL: c.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          apiKey: c.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        });
        const completion = await openai.chat.completions.create({
          model: activeModel,
          max_completion_tokens: 8192,
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
        const anthropic = new Anthropic({
          baseURL: c.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
          apiKey: c.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
        });
        const sysMsg = chatMessages.find(m => m.role === "system");
        const userMsgs = chatMessages.filter(m => m.role !== "system").map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        const params: Anthropic.MessageCreateParams = {
          model: activeModel,
          max_tokens: 8192,
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
        const ai = new GoogleGenAI({
          apiKey: c.env.AI_INTEGRATIONS_GEMINI_API_KEY,
          httpOptions: { baseUrl: c.env.AI_INTEGRATIONS_GEMINI_BASE_URL },
        });
        const geminiMsgs = chatMessages.filter(m => m.role !== "system").map(m => ({
          role: m.role === "assistant" ? "model" as const : "user" as const,
          parts: [{ text: m.content }],
        }));
        const sysInstruction = chatMessages.find(m => m.role === "system")?.content;

        const response = await ai.models.generateContentStream({
          model: activeModel,
          contents: geminiMsgs,
          config: {
            maxOutputTokens: 8192,
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
      console.error("AI stream error:", err);
      let safeMsg = "Something went wrong. Please try again.";
      if (err instanceof Error) {
        if (err.message.includes("rate") || err.message.includes("429")) safeMsg = "Rate limit reached. Please wait a moment.";
        else if (err.message.includes("timeout") || err.message.includes("504")) safeMsg = "Request timed out. Please try again.";
        else if (err.message.includes("context") || err.message.includes("token")) safeMsg = "Conversation too long. Start a new chat.";
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

  const recentUsers = await d1All(c.env.DB,
    `SELECT owner_telegram_id, COUNT(*) as conv_count,
     (SELECT COUNT(*) FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations c2 WHERE c2.owner_telegram_id = ai_conversations.owner_telegram_id)) as msg_count
     FROM ai_conversations GROUP BY owner_telegram_id ORDER BY conv_count DESC LIMIT 20`,
    [],
  );

  return c.json({ stats, modelBreakdown, recentUsers });
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
