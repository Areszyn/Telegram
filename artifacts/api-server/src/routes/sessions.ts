/**
 * String Session Management Routes
 *
 * POST /sessions/auth/start    — send OTP to phone number
 * POST /sessions/auth/verify   — verify code (handles 2FA)
 * GET  /sessions               — list sessions (admin: all, user: own)
 * GET  /sessions/status        — API config status
 * GET  /sessions/:id/info      — account info from session
 * GET  /sessions/:id/chats     — recent chats from session
 * DELETE /sessions/:id         — logout and remove session
 */

import { Router } from "express";
import crypto from "crypto";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram";
import { computeCheck } from "telegram/Password.js";
import { d1All, d1First, d1Run } from "../lib/d1.js";
import { validateTelegramInitData, isAdminId } from "../lib/auth.js";

const router = Router();

const API_ID   = () => parseInt(process.env.TELEGRAM_API_ID  ?? "0", 10);
const API_HASH = () => process.env.TELEGRAM_API_HASH ?? "";

type PendingAuth = {
  client: TelegramClient;
  phone: string;
  phoneCodeHash: string;
  ownerTelegramId: string;
  expiresAt: number;
};
const pending = new Map<string, PendingAuth>();

// Expire stale pending auths every minute
setInterval(() => {
  const now = Date.now();
  for (const [id, p] of pending) {
    if (p.expiresAt < now) {
      p.client.disconnect().catch(() => {});
      pending.delete(id);
    }
  }
}, 60_000);

function parseAuth(req: Parameters<Router>[0]): { telegramId: string; isAdmin: boolean } | null {
  const initData = (req.headers["x-init-data"] as string | undefined) ?? "";
  const validated = validateTelegramInitData(initData);
  if (!validated) return null;
  const userStr = validated["user"];
  if (!userStr) return null;
  try {
    const user = JSON.parse(userStr) as { id: number };
    const telegramId = String(user.id);
    return { telegramId, isAdmin: isAdminId(telegramId) };
  } catch { return null; }
}

function makeClient(sessionStr = "") {
  return new TelegramClient(
    new StringSession(sessionStr),
    API_ID(), API_HASH(),
    { connectionRetries: 3, useWSS: false },
  );
}

// ── GET /sessions/status ───────────────────────────────────────────────────────
router.get("/sessions/status", async (_req, res) => {
  res.json({
    ok: true,
    api_configured: !!(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH),
    env_session: !!process.env.TELEGRAM_SESSION,
  });
});

// ── POST /sessions/auth/start ─────────────────────────────────────────────────
router.post("/sessions/auth/start", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  if (!API_ID() || !API_HASH()) {
    res.status(503).json({ error: "TELEGRAM_API_ID / TELEGRAM_API_HASH not set on server" });
    return;
  }

  const { phone } = req.body as { phone?: string };
  if (!phone?.trim()) { res.status(400).json({ error: "phone required" }); return; }

  try {
    const client = makeClient();
    await client.connect();

    const result = await client.invoke(new Api.auth.SendCode({
      phoneNumber: phone.trim(),
      apiId: API_ID(),
      apiHash: API_HASH(),
      settings: new Api.CodeSettings({}),
    })) as Api.auth.SentCode;

    const pendingId = crypto.randomUUID();
    pending.set(pendingId, {
      client,
      phone: phone.trim(),
      phoneCodeHash: result.phoneCodeHash,
      ownerTelegramId: auth.telegramId,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    res.json({ ok: true, pending_id: pendingId, phone_code_hash: result.phoneCodeHash });
  } catch (err) {
    console.error("[sessions/start]", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /sessions/auth/verify ────────────────────────────────────────────────
router.post("/sessions/auth/verify", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { pending_id, code, password } = req.body as {
    pending_id?: string; code?: string; password?: string;
  };
  if (!pending_id) { res.status(400).json({ error: "pending_id required" }); return; }
  if (!code?.trim()) { res.status(400).json({ error: "code required" }); return; }

  const p = pending.get(pending_id);
  if (!p) { res.status(404).json({ error: "Session expired or not found — please start again" }); return; }

  // Verify the pending auth belongs to this user (or admin)
  if (p.ownerTelegramId !== auth.telegramId && !auth.isAdmin) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  try {
    try {
      await p.client.invoke(new Api.auth.SignIn({
        phoneNumber: p.phone,
        phoneCodeHash: p.phoneCodeHash,
        phoneCode: code.trim(),
      }));
    } catch (signInErr: unknown) {
      const msg = (signInErr as { errorMessage?: string })?.errorMessage ?? "";
      if (msg === "SESSION_PASSWORD_NEEDED") {
        if (!password?.trim()) {
          // 2FA required but not provided — keep pending, ask client
          res.json({ ok: false, needs_password: true });
          return;
        }
        // 2FA provided
        const srpData = await p.client.invoke(new Api.account.GetPassword()) as Api.account.Password;
        const passwordCheck = await computeCheck(srpData, password.trim());
        await p.client.invoke(new Api.auth.CheckPassword({ password: passwordCheck }));
      } else {
        throw signInErr;
      }
    }

    // Signed in — grab session string and account info
    const sessionStr = p.client.session.save() as unknown as string;
    const me = await p.client.getMe() as Api.User;

    await p.client.disconnect().catch(() => {});
    pending.delete(pending_id);

    // Save session to DB
    await d1Run(
      `INSERT INTO user_sessions (telegram_id, phone, session_string, first_name, username, account_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [
        p.ownerTelegramId,
        p.phone,
        sessionStr,
        me.firstName ?? null,
        me.username ?? null,
        String(me.id),
      ],
    );

    res.json({
      ok: true,
      first_name: me.firstName,
      username: me.username,
      account_id: String(me.id),
    });
  } catch (err) {
    console.error("[sessions/verify]", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /sessions ─────────────────────────────────────────────────────────────
router.get("/sessions", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  try {
    let sessions;
    if (auth.isAdmin) {
      sessions = await d1All(
        `SELECT id, telegram_id, phone, first_name, username, account_id, status, created_at, last_used
           FROM user_sessions WHERE status = 'active' ORDER BY created_at DESC`,
      );
    } else {
      sessions = await d1All(
        `SELECT id, telegram_id, phone, first_name, username, account_id, status, created_at, last_used
           FROM user_sessions WHERE telegram_id = ? AND status = 'active' ORDER BY created_at DESC`,
        [auth.telegramId],
      );
    }
    res.json({ ok: true, sessions });
  } catch (err) {
    console.error("[sessions/list]", err);
    res.status(500).json({ error: "Failed to load sessions" });
  }
});

// ── GET /sessions/:id/info ─────────────────────────────────────────────────────
router.get("/sessions/:id/info", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const row = await d1First<{ telegram_id: string; session_string: string }>(
    `SELECT telegram_id, session_string FROM user_sessions WHERE id = ? AND status = 'active'`,
    [req.params.id],
  );
  if (!row) { res.status(404).json({ error: "Session not found" }); return; }
  if (row.telegram_id !== auth.telegramId && !auth.isAdmin) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  try {
    const client = makeClient(row.session_string);
    await client.connect();
    const me = await client.getMe() as Api.User;
    await client.disconnect().catch(() => {});

    await d1Run(`UPDATE user_sessions SET last_used = datetime('now') WHERE id = ?`, [req.params.id]);

    res.json({
      ok: true,
      info: {
        id: String(me.id),
        first_name: me.firstName,
        last_name: me.lastName,
        username: me.username,
        phone: me.phone,
        premium: me.premium ?? false,
        verified: me.verified ?? false,
      },
    });
  } catch (err) {
    console.error("[sessions/info]", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /sessions/:id/chats ────────────────────────────────────────────────────
router.get("/sessions/:id/chats", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const row = await d1First<{ telegram_id: string; session_string: string }>(
    `SELECT telegram_id, session_string FROM user_sessions WHERE id = ? AND status = 'active'`,
    [req.params.id],
  );
  if (!row) { res.status(404).json({ error: "Session not found" }); return; }
  if (row.telegram_id !== auth.telegramId && !auth.isAdmin) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  try {
    const client = makeClient(row.session_string);
    await client.connect();

    const dialogs = await client.getDialogs({ limit: 30 });
    const chats = dialogs.map(d => ({
      id: d.id?.toString(),
      name: d.title ?? d.name,
      type: d.isChannel ? "channel" : d.isGroup ? "group" : "private",
      unread: d.dialog.unreadCount,
    }));

    await client.disconnect().catch(() => {});
    await d1Run(`UPDATE user_sessions SET last_used = datetime('now') WHERE id = ?`, [req.params.id]);

    res.json({ ok: true, chats });
  } catch (err) {
    console.error("[sessions/chats]", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── DELETE /sessions/:id ───────────────────────────────────────────────────────
router.delete("/sessions/:id", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const row = await d1First<{ telegram_id: string; session_string: string }>(
    `SELECT telegram_id, session_string FROM user_sessions WHERE id = ? AND status = 'active'`,
    [req.params.id],
  );
  if (!row) { res.status(404).json({ error: "Session not found" }); return; }
  if (row.telegram_id !== auth.telegramId && !auth.isAdmin) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  // Try to sign out the session from Telegram
  try {
    const client = makeClient(row.session_string);
    await client.connect();
    await client.invoke(new Api.auth.LogOut());
    await client.disconnect().catch(() => {});
  } catch {
    // Best-effort logout — still remove from DB
  }

  await d1Run(`UPDATE user_sessions SET status = 'revoked' WHERE id = ?`, [req.params.id]);
  res.json({ ok: true });
});

export default router;
