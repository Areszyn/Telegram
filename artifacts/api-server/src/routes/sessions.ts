import { Hono } from "hono";
import type { Env } from "../types.ts";
import { d1All, d1First, d1Run } from "../lib/d1.ts";
import { parseAuth } from "../lib/auth.ts";

const sessions = new Hono<{ Bindings: Env }>();

sessions.get("/sessions/status", (c) =>
  c.json({
    ok: true,
    api_configured: !!(c.env.TELEGRAM_API_ID && c.env.TELEGRAM_API_HASH),
    gramjs_available: false,
    note: "MTProto (GramJS) sessions are not supported in the Worker runtime. Use the Node.js backend for session management.",
  }),
);

sessions.post("/sessions/auth/start", (c) =>
  c.json({ error: "MTProto session creation is not supported in the Worker runtime." }, 501),
);

sessions.post("/sessions/auth/verify", (c) =>
  c.json({ error: "MTProto session creation is not supported in the Worker runtime." }, 501),
);

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

sessions.get("/sessions/:id/info", (c) =>
  c.json({ error: "Live session info requires the Node.js backend with GramJS support." }, 501),
);

sessions.get("/sessions/:id/chats", (c) =>
  c.json({ error: "Live chat listing requires the Node.js backend with GramJS support." }, 501),
);

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

sessions.post("/sessions/:id/account/update", (c) =>
  c.json({ error: "Account updates via MTProto require the Node.js backend." }, 501),
);

sessions.post("/sessions/:id/password", (c) =>
  c.json({ error: "Password updates via MTProto require the Node.js backend." }, 501),
);

sessions.post("/sessions/:id/send", (c) =>
  c.json({ error: "Sending via session requires the Node.js backend." }, 501),
);

sessions.post("/sessions/:id/chat", (c) =>
  c.json({ error: "Chat editing via MTProto requires the Node.js backend." }, 501),
);

export default sessions;
