/**
 * String Session Management Routes
 *
 * Admin: uses server TELEGRAM_API_ID / TELEGRAM_API_HASH automatically
 * User:  must supply their own api_id + api_hash in the start request
 *
 * POST /sessions/auth/start    — send OTP to phone
 * POST /sessions/auth/verify   — verify code (handles 2FA)
 * GET  /sessions               — list sessions (admin: all, user: own)
 * GET  /sessions/status        — API config status
 * GET  /sessions/:id/info      — live account info from session
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

const ENV_API_ID   = () => parseInt(process.env.TELEGRAM_API_ID  ?? "0", 10);
const ENV_API_HASH = () => process.env.TELEGRAM_API_HASH ?? "";

type PendingAuth = {
  client: TelegramClient;
  phone: string;
  phoneCodeHash: string;
  ownerTelegramId: string;
  expiresAt: number;
  apiId: number;
  apiHash: string;
};
const pending = new Map<string, PendingAuth>();

setInterval(() => {
  const now = Date.now();
  for (const [id, p] of pending) {
    if (p.expiresAt < now) { p.client.disconnect().catch(() => {}); pending.delete(id); }
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

function makeClient(sessionStr = "", apiId = ENV_API_ID(), apiHash = ENV_API_HASH()) {
  return new TelegramClient(
    new StringSession(sessionStr),
    apiId, apiHash,
    { connectionRetries: 3, useWSS: false },
  );
}

// ── GET /sessions/status ───────────────────────────────────────────────────────
router.get("/sessions/status", async (_req, res) => {
  res.json({
    ok: true,
    api_configured: !!(ENV_API_ID() && ENV_API_HASH()),
    env_session: !!process.env.TELEGRAM_SESSION,
  });
});

// ── POST /sessions/auth/start ─────────────────────────────────────────────────
router.post("/sessions/auth/start", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { phone, api_id, api_hash } = req.body as {
    phone?: string; api_id?: number | string; api_hash?: string;
  };

  if (!phone?.trim()) { res.status(400).json({ error: "phone required" }); return; }

  let apiId: number;
  let apiHash: string;

  if (auth.isAdmin) {
    // Admin uses server credentials
    if (!ENV_API_ID() || !ENV_API_HASH()) {
      res.status(503).json({ error: "TELEGRAM_API_ID / TELEGRAM_API_HASH not set on server" });
      return;
    }
    apiId = ENV_API_ID();
    apiHash = ENV_API_HASH();
  } else {
    // Regular user must provide their own credentials
    const parsedId = parseInt(String(api_id ?? ""), 10);
    if (!parsedId || !api_hash?.trim()) {
      res.status(400).json({ error: "api_id and api_hash are required for user sessions" });
      return;
    }
    apiId = parsedId;
    apiHash = api_hash.trim();
  }

  try {
    const client = makeClient("", apiId, apiHash);
    await client.connect();

    const result = await client.invoke(new Api.auth.SendCode({
      phoneNumber: phone.trim(),
      apiId,
      apiHash,
      settings: new Api.CodeSettings({}),
    })) as Api.auth.SentCode;

    const pendingId = crypto.randomUUID();
    pending.set(pendingId, {
      client,
      phone: phone.trim(),
      phoneCodeHash: result.phoneCodeHash,
      ownerTelegramId: auth.telegramId,
      expiresAt: Date.now() + 10 * 60 * 1000,
      apiId,
      apiHash,
    });

    res.json({ ok: true, pending_id: pendingId });
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
          res.json({ ok: false, needs_password: true });
          return;
        }
        const srpData = await p.client.invoke(new Api.account.GetPassword()) as Api.account.Password;
        const passwordCheck = await computeCheck(srpData, password.trim());
        await p.client.invoke(new Api.auth.CheckPassword({ password: passwordCheck }));
      } else {
        throw signInErr;
      }
    }

    const sessionStr = p.client.session.save() as unknown as string;
    const me = await p.client.getMe() as Api.User;

    await p.client.disconnect().catch(() => {});
    pending.delete(pending_id);

    // Save session — store api_id/hash only for user sessions (not admin using server creds)
    const storeApiId = auth.isAdmin ? null : p.apiId;
    const storeApiHash = auth.isAdmin ? null : p.apiHash;

    await d1Run(
      `INSERT INTO user_sessions
         (telegram_id, phone, session_string, first_name, username, account_id, api_id, api_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [p.ownerTelegramId, p.phone, sessionStr, me.firstName ?? null,
       me.username ?? null, String(me.id), storeApiId, storeApiHash],
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
    const sessions = auth.isAdmin
      ? await d1All(
          `SELECT id, telegram_id, phone, first_name, username, account_id, status, created_at, last_used
             FROM user_sessions WHERE status = 'active' ORDER BY created_at DESC`,
        )
      : await d1All(
          `SELECT id, telegram_id, phone, first_name, username, account_id, status, created_at, last_used
             FROM user_sessions WHERE telegram_id = ? AND status = 'active' ORDER BY created_at DESC`,
          [auth.telegramId],
        );
    res.json({ ok: true, sessions });
  } catch (err) {
    res.status(500).json({ error: "Failed to load sessions" });
  }
});

// helper — load session row and validate ownership
async function loadSessionRow(id: string, auth: { telegramId: string; isAdmin: boolean }) {
  const row = await d1First<{
    telegram_id: string; session_string: string; api_id: number | null; api_hash: string | null;
  }>(
    `SELECT telegram_id, session_string, api_id, api_hash FROM user_sessions WHERE id = ? AND status = 'active'`,
    [id],
  );
  if (!row) return { error: "Session not found", status: 404, row: null };
  if (row.telegram_id !== auth.telegramId && !auth.isAdmin)
    return { error: "Forbidden", status: 403, row: null };
  return { error: null, status: 200, row };
}

function clientFromRow(row: { session_string: string; api_id: number | null; api_hash: string | null }) {
  return makeClient(row.session_string, row.api_id ?? ENV_API_ID(), row.api_hash ?? ENV_API_HASH());
}

// ── GET /sessions/:id/info ─────────────────────────────────────────────────────
router.get("/sessions/:id/info", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { error, status, row } = await loadSessionRow(req.params.id, auth);
  if (error || !row) { res.status(status).json({ error }); return; }

  try {
    const client = clientFromRow(row);
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
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /sessions/:id/chats ────────────────────────────────────────────────────
router.get("/sessions/:id/chats", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { error, status, row } = await loadSessionRow(req.params.id, auth);
  if (error || !row) { res.status(status).json({ error }); return; }

  try {
    const client = clientFromRow(row);
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
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── DELETE /sessions/:id ───────────────────────────────────────────────────────
router.delete("/sessions/:id", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { error, status, row } = await loadSessionRow(req.params.id, auth);
  if (error || !row) { res.status(status).json({ error }); return; }

  try {
    const client = clientFromRow(row);
    await client.connect();
    await client.invoke(new Api.auth.LogOut());
    await client.disconnect().catch(() => {});
  } catch { /* best-effort */ }

  await d1Run(`UPDATE user_sessions SET status = 'revoked' WHERE id = ?`, [req.params.id]);
  res.json({ ok: true });
});

// ── POST /sessions/:id/account/update ─────────────────────────────────────────
// Update profile: first_name, last_name, username, about
router.post("/sessions/:id/account/update", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Admin only" }); return; }

  const { error, status, row } = await loadSessionRow(req.params.id, auth);
  if (error || !row) { res.status(status).json({ error }); return; }

  const { first_name, last_name, username, about } = req.body as {
    first_name?: string; last_name?: string; username?: string; about?: string;
  };

  try {
    const client = clientFromRow(row);
    await client.connect();

    await client.invoke(new Api.account.UpdateProfile({
      firstName: first_name ?? undefined,
      lastName: last_name ?? undefined,
      about: about ?? undefined,
    }));

    if (username !== undefined) {
      await client.invoke(new Api.account.UpdateUsername({ username: username.replace(/^@/, "") }));
    }

    await client.disconnect().catch(() => {});

    // Refresh cached fields in DB
    if (first_name !== undefined) {
      await d1Run(
        `UPDATE user_sessions SET first_name = ?, username = COALESCE(?, username), last_used = datetime('now') WHERE id = ?`,
        [first_name, username?.replace(/^@/, "") ?? null, req.params.id],
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("[sessions/account/update]", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /sessions/:id/password ────────────────────────────────────────────────
// Change or remove 2FA password
router.post("/sessions/:id/password", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Admin only" }); return; }

  const { error, status, row } = await loadSessionRow(req.params.id, auth);
  if (error || !row) { res.status(status).json({ error }); return; }

  const { current_password, new_password, hint } = req.body as {
    current_password?: string; new_password?: string; hint?: string;
  };

  try {
    const client = clientFromRow(row);
    await client.connect();

    // updateTwoFaSettings wraps the complex SRP password flow
    await (client as unknown as {
      updateTwoFaSettings: (opts: {
        isCheckPassword?: boolean;
        currentPassword?: string;
        newPassword?: string;
        hint?: string;
        email?: string;
      }) => Promise<void>
    }).updateTwoFaSettings({
      isCheckPassword: false,
      currentPassword: current_password ?? undefined,
      newPassword: new_password ?? "",
      hint: hint ?? "",
      email: "",
    });

    await client.disconnect().catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error("[sessions/password]", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /sessions/:id/send ────────────────────────────────────────────────────
// Send a message to any user or chat via this session
router.post("/sessions/:id/send", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Admin only" }); return; }

  const { error, status, row } = await loadSessionRow(req.params.id, auth);
  if (error || !row) { res.status(status).json({ error }); return; }

  const { to, text } = req.body as { to?: string; text?: string };
  if (!to?.trim() || !text?.trim()) {
    res.status(400).json({ error: "to and text are required" }); return;
  }

  try {
    const client = clientFromRow(row);
    await client.connect();

    // Accept username (@handle), numeric ID, or phone
    const recipient = to.trim().startsWith("@")
      ? to.trim()
      : isNaN(Number(to.trim())) ? to.trim() : BigInt(to.trim());

    const msg = await client.sendMessage(recipient as Parameters<typeof client.sendMessage>[0], {
      message: text.trim(),
    });

    await client.disconnect().catch(() => {});
    await d1Run(`UPDATE user_sessions SET last_used = datetime('now') WHERE id = ?`, [req.params.id]);

    res.json({ ok: true, message_id: msg.id });
  } catch (err) {
    console.error("[sessions/send]", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /sessions/:id/chat ────────────────────────────────────────────────────
// Edit a group or channel (title, about/description)
router.post("/sessions/:id/chat", async (req, res) => {
  const auth = parseAuth(req);
  if (!auth?.isAdmin) { res.status(403).json({ error: "Admin only" }); return; }

  const { error, status, row } = await loadSessionRow(req.params.id, auth);
  if (error || !row) { res.status(status).json({ error }); return; }

  const { chat_id, title, about } = req.body as {
    chat_id?: string; title?: string; about?: string;
  };
  if (!chat_id?.trim()) { res.status(400).json({ error: "chat_id required" }); return; }
  if (!title && about === undefined) { res.status(400).json({ error: "title or about required" }); return; }

  try {
    const client = clientFromRow(row);
    await client.connect();

    const entity = await client.getEntity(
      isNaN(Number(chat_id)) ? chat_id.trim() : BigInt(chat_id.trim()),
    );

    const results: string[] = [];

    if (title?.trim()) {
      try {
        // Supergroups and channels
        await client.invoke(new Api.channels.EditTitle({
          channel: entity as Api.Channel,
          title: title.trim(),
        }));
        results.push("title updated");
      } catch {
        // Legacy groups
        await client.invoke(new Api.messages.EditChatTitle({
          chatId: BigInt(chat_id.trim()),
          title: title.trim(),
        }));
        results.push("title updated");
      }
    }

    if (about !== undefined) {
      await client.invoke(new Api.messages.EditChatAbout({
        peer: entity as Api.Channel,
        about: about.trim(),
      }));
      results.push("description updated");
    }

    await client.disconnect().catch(() => {});
    await d1Run(`UPDATE user_sessions SET last_used = datetime('now') WHERE id = ?`, [req.params.id]);

    res.json({ ok: true, results });
  } catch (err) {
    console.error("[sessions/chat]", err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

async function d1First<T>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await d1All<T>(sql, params);
  return rows[0] ?? null;
}

export default router;
