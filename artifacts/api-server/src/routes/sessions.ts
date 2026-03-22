import { Hono } from "hono";
import type { Env } from "../types.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import { parseAuth } from "../lib/auth.ts";

const sessions = new Hono<{ Bindings: Env }>();

async function proxyToMtproto(
  c: { env: Env },
  path: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; [key: string]: unknown }> {
  if (!c.env.MTPROTO_BACKEND_URL || c.env.MTPROTO_BACKEND_URL.includes("placeholder")) {
    return { ok: false, error: "MTProto backend not configured. Deploy the Replit project and set MTPROTO_BACKEND_URL." };
  }
  const url = `${c.env.MTPROTO_BACKEND_URL}${path}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": c.env.MTPROTO_API_KEY,
      },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<{ ok: boolean; [key: string]: unknown }>;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "MTProto backend unreachable";
    return { ok: false, error: `MTProto backend error: ${msg}` };
  }
}

async function getSessionData(db: D1Database, id: string) {
  return d1First<{
    session_string: string;
    api_id: number;
    api_hash: string;
    telegram_id: string;
  }>(db,
    "SELECT session_string, api_id, api_hash, telegram_id FROM user_sessions WHERE id = ? AND status = 'active'",
    [id],
  );
}

async function updateSessionString(db: D1Database, id: string, updatedSession: string) {
  if (updatedSession) {
    await d1Run(db, "UPDATE user_sessions SET session_string = ?, last_used = datetime('now') WHERE id = ?", [updatedSession, id]);
  }
}

sessions.get("/sessions/status", (c) => {
  const backendConfigured = !!(c.env.MTPROTO_BACKEND_URL && c.env.MTPROTO_API_KEY);
  return c.json({
    ok: true,
    api_configured: !!(c.env.TELEGRAM_API_ID && c.env.TELEGRAM_API_HASH),
    gramjs_available: backendConfigured,
    mtproto_backend: backendConfigured,
    note: backendConfigured
      ? "MTProto operations are proxied to the Node.js backend."
      : "MTProto backend not configured. Set MTPROTO_BACKEND_URL and MTPROTO_API_KEY.",
  });
});

sessions.post("/sessions/auth/start", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  if (!c.env.MTPROTO_BACKEND_URL) return c.json({ error: "MTProto backend not configured" }, 501);

  try {
    const body = await c.req.json();
    const apiId = body.api_id || parseInt(c.env.TELEGRAM_API_ID, 10);
    const apiHash = body.api_hash || c.env.TELEGRAM_API_HASH;

    const result = await proxyToMtproto(c, "/mtproto/auth/start", {
      phone: body.phone,
      api_id: apiId,
      api_hash: apiHash,
    });

    if (!result.ok) return c.json(result, 500);
    return c.json(result);
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});

sessions.post("/sessions/auth/verify", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  if (!c.env.MTPROTO_BACKEND_URL) return c.json({ error: "MTProto backend not configured" }, 501);

  try {
    const body = await c.req.json();
    const result = await proxyToMtproto(c, "/mtproto/auth/verify", body);

    if (!result.ok) return c.json(result, 500);
    if (result.needs_password) return c.json(result);

    const accountTgId = result.telegram_id as string || result.account_id as string || auth.telegramId;
    await d1Run(c.env.DB,
      `INSERT INTO user_sessions (telegram_id, phone, session_string, first_name, username, account_id, api_id, api_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        auth.telegramId,
        result.phone as string || null,
        result.session_string as string,
        result.first_name as string || null,
        result.username as string || null,
        accountTgId,
        result.api_id as number,
        result.api_hash as string,
      ],
    );

    return c.json({
      ok: true,
      first_name: result.first_name,
      username: result.username,
      account_id: result.account_id,
    });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});

sessions.get("/sessions", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  try {
    const list = auth.isAdmin
      ? await d1All(c.env.DB,
          `SELECT id, telegram_id, phone, first_name, username, account_id, status, created_at, last_used
             FROM user_sessions WHERE status = 'active' ORDER BY created_at DESC`,
        )
      : await d1All(c.env.DB,
          `SELECT id, telegram_id, phone, first_name, username, account_id, status, created_at, last_used
             FROM user_sessions WHERE telegram_id = ? AND status = 'active' ORDER BY created_at DESC`,
          [auth.telegramId],
        );
    return c.json({ ok: true, sessions: list });
  } catch {
    return c.json({ error: "Failed to load sessions" }, 500);
  }
});

sessions.get("/sessions/:id/info", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  if (!c.env.MTPROTO_BACKEND_URL) return c.json({ error: "MTProto backend not configured" }, 501);

  const { id } = c.req.param();
  const session = await getSessionData(c.env.DB, id);
  if (!session) return c.json({ error: "Session not found" }, 404);
  if (session.telegram_id !== auth.telegramId && !auth.isAdmin) return c.json({ error: "Forbidden" }, 403);
  if (!session.session_string || !session.api_id || !session.api_hash) {
    return c.json({ error: "Session missing credentials. Please remove and re-add the session." }, 400);
  }

  try {
    const result = await proxyToMtproto(c, "/mtproto/info", {
      session_string: session.session_string,
      api_id: session.api_id,
      api_hash: session.api_hash,
    });

    if (!result.ok) return c.json(result, 500);
    if (result.updated_session) await updateSessionString(c.env.DB, id, result.updated_session as string);
    return c.json({ ok: true, info: result.info });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});

sessions.get("/sessions/:id/chats", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  if (!c.env.MTPROTO_BACKEND_URL) return c.json({ error: "MTProto backend not configured" }, 501);

  const { id } = c.req.param();
  const session = await getSessionData(c.env.DB, id);
  if (!session) return c.json({ error: "Session not found" }, 404);
  if (session.telegram_id !== auth.telegramId && !auth.isAdmin) return c.json({ error: "Forbidden" }, 403);
  if (!session.session_string || !session.api_id || !session.api_hash) {
    return c.json({ error: "Session missing credentials. Please remove and re-add the session." }, 400);
  }

  try {
    const result = await proxyToMtproto(c, "/mtproto/chats", {
      session_string: session.session_string,
      api_id: session.api_id,
      api_hash: session.api_hash,
    });

    if (!result.ok) return c.json(result, 500);
    if (result.updated_session) await updateSessionString(c.env.DB, id, result.updated_session as string);
    return c.json({ ok: true, chats: result.chats });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});

sessions.delete("/sessions/:id", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  const { id } = c.req.param();
  const row = await d1First<{ telegram_id: string }>(c.env.DB,
    "SELECT telegram_id FROM user_sessions WHERE id = ? AND status = 'active'",
    [id],
  );
  if (!row) return c.json({ error: "Session not found" }, 404);
  if (row.telegram_id !== auth.telegramId && !auth.isAdmin) return c.json({ error: "Forbidden" }, 403);
  await d1Run(c.env.DB, "UPDATE user_sessions SET status = 'revoked' WHERE id = ?", [id]);
  return c.json({ ok: true });
});

sessions.post("/sessions/:id/account/update", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  if (!c.env.MTPROTO_BACKEND_URL) return c.json({ error: "MTProto backend not configured" }, 501);

  const { id } = c.req.param();
  const session = await getSessionData(c.env.DB, id);
  if (!session) return c.json({ error: "Session not found" }, 404);
  if (session.telegram_id !== auth.telegramId && !auth.isAdmin) return c.json({ error: "Forbidden" }, 403);
  if (!session.session_string || !session.api_id || !session.api_hash) {
    return c.json({ error: "Session missing credentials. Please remove and re-add the session." }, 400);
  }

  try {
    const body = await c.req.json();
    const result = await proxyToMtproto(c, "/mtproto/profile", {
      session_string: session.session_string,
      api_id: session.api_id,
      api_hash: session.api_hash,
      first_name: body.first_name,
      last_name: body.last_name,
      username: body.username,
      about: body.about,
    });

    if (!result.ok) return c.json(result, 500);
    if (result.updated_session) await updateSessionString(c.env.DB, id, result.updated_session as string);

    if (body.first_name !== undefined) {
      await d1Run(c.env.DB, "UPDATE user_sessions SET first_name = ? WHERE id = ?", [body.first_name, id]).catch(() => {});
    }
    if (body.username !== undefined) {
      await d1Run(c.env.DB, "UPDATE user_sessions SET username = ? WHERE id = ?", [body.username, id]).catch(() => {});
    }

    return c.json({ ok: true, results: result.results });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});

sessions.post("/sessions/:id/password", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  if (!c.env.MTPROTO_BACKEND_URL) return c.json({ error: "MTProto backend not configured" }, 501);

  const { id } = c.req.param();
  const session = await getSessionData(c.env.DB, id);
  if (!session) return c.json({ error: "Session not found" }, 404);
  if (session.telegram_id !== auth.telegramId && !auth.isAdmin) return c.json({ error: "Forbidden" }, 403);
  if (!session.session_string || !session.api_id || !session.api_hash) {
    return c.json({ error: "Session missing credentials. Please remove and re-add the session." }, 400);
  }

  try {
    const body = await c.req.json();
    const result = await proxyToMtproto(c, "/mtproto/password", {
      session_string: session.session_string,
      api_id: session.api_id,
      api_hash: session.api_hash,
      current_password: body.current_password,
      new_password: body.new_password,
      hint: body.hint,
    });

    if (!result.ok) return c.json(result, 500);
    if (result.updated_session) await updateSessionString(c.env.DB, id, result.updated_session as string);
    return c.json({ ok: true, message: result.message });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});

sessions.post("/sessions/:id/send", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  if (!c.env.MTPROTO_BACKEND_URL) return c.json({ error: "MTProto backend not configured" }, 501);

  const { id } = c.req.param();
  const session = await getSessionData(c.env.DB, id);
  if (!session) return c.json({ error: "Session not found" }, 404);
  if (session.telegram_id !== auth.telegramId && !auth.isAdmin) return c.json({ error: "Forbidden" }, 403);
  if (!session.session_string || !session.api_id || !session.api_hash) {
    return c.json({ error: "Session missing credentials. Please remove and re-add the session." }, 400);
  }

  try {
    const body = await c.req.json();
    const result = await proxyToMtproto(c, "/mtproto/send", {
      session_string: session.session_string,
      api_id: session.api_id,
      api_hash: session.api_hash,
      to: body.to,
      text: body.text,
    });

    if (!result.ok) return c.json(result, 500);
    if (result.updated_session) await updateSessionString(c.env.DB, id, result.updated_session as string);
    return c.json({ ok: true, message: result.message });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});

sessions.post("/sessions/:id/chat", async (c) => {
  const auth = await parseAuth(c);
  if (!auth) return c.json({ error: "Unauthorized" }, 401);
  if (!c.env.MTPROTO_BACKEND_URL) return c.json({ error: "MTProto backend not configured" }, 501);

  const { id } = c.req.param();
  const session = await getSessionData(c.env.DB, id);
  if (!session) return c.json({ error: "Session not found" }, 404);
  if (session.telegram_id !== auth.telegramId && !auth.isAdmin) return c.json({ error: "Forbidden" }, 403);
  if (!session.session_string || !session.api_id || !session.api_hash) {
    return c.json({ error: "Session missing credentials. Please remove and re-add the session." }, 400);
  }

  try {
    const body = await c.req.json();
    const result = await proxyToMtproto(c, "/mtproto/chat-edit", {
      session_string: session.session_string,
      api_id: session.api_id,
      api_hash: session.api_hash,
      chat_id: body.chat_id,
      title: body.title,
      about: body.about,
    });

    if (!result.ok) return c.json(result, 500);
    if (result.updated_session) await updateSessionString(c.env.DB, id, result.updated_session as string);
    return c.json({ ok: true, results: result.results });
  } catch (e: unknown) {
    return c.json({ error: e instanceof Error ? e.message : "Failed" }, 500);
  }
});

export default sessions;
