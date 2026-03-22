import express from "express";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { randomBytes } from "crypto";

const app = express();
app.use(express.json());

const API_KEY = process.env.MTPROTO_API_KEY;
if (!API_KEY) {
  console.error("FATAL: MTPROTO_API_KEY environment variable is required");
  process.exit(1);
}
const PORT = parseInt(process.env.PORT || process.env.MTPROTO_PORT || "3003", 10);

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) {
    res.status(401).json({ error: "Invalid API key" });
    return;
  }
  next();
}

app.use(auth);

const pendingClients = new Map<
  string,
  { client: TelegramClient; phoneCodeHash: string; phone: string; apiId: number; apiHash: string; timer: ReturnType<typeof setTimeout> }
>();

function cleanPending(id: string) {
  const p = pendingClients.get(id);
  if (p) {
    p.client.disconnect().catch(() => {});
    clearTimeout(p.timer);
    pendingClients.delete(id);
  }
}

async function withClient<T>(
  sessionString: string,
  apiId: number,
  apiHash: string,
  fn: (client: TelegramClient) => Promise<T>,
): Promise<{ result: T; updatedSession: string }> {
  const session = new StringSession(sessionString);
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 3,
    deviceModel: "Lifegram Bot",
    appVersion: "1.0",
  });
  await client.connect();
  try {
    const result = await fn(client);
    const updatedSession = client.session.save() as unknown as string;
    return { result, updatedSession };
  } finally {
    await client.disconnect().catch(() => {});
  }
}

app.post("/mtproto/auth/start", async (req, res) => {
  try {
    const { phone, api_id, api_hash } = req.body;
    if (!phone || !api_id || !api_hash) {
      res.status(400).json({ error: "phone, api_id, api_hash required" });
      return;
    }

    const apiId = Number(api_id);
    const apiHash = String(api_hash);
    const session = new StringSession("");
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 3,
      deviceModel: "Lifegram Bot",
      appVersion: "1.0",
    });

    await client.connect();
    const sendResult = await client.sendCode(
      { apiId, apiHash },
      String(phone),
    );

    const pendingId = randomBytes(16).toString("hex");
    const timer = setTimeout(() => cleanPending(pendingId), 5 * 60 * 1000);
    pendingClients.set(pendingId, {
      client,
      phoneCodeHash: sendResult.phoneCodeHash,
      phone: String(phone),
      apiId,
      apiHash,
      timer,
    });

    res.json({ ok: true, pending_id: pendingId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/mtproto/auth/verify", async (req, res) => {
  try {
    const { pending_id, code, password } = req.body;
    if (!pending_id || !code) {
      res.status(400).json({ error: "pending_id and code required" });
      return;
    }

    const pending = pendingClients.get(pending_id);
    if (!pending) {
      res.status(404).json({ error: "Session expired or not found. Please start again." });
      return;
    }

    const { client, phoneCodeHash, phone, apiId, apiHash } = pending;

    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: phone,
          phoneCodeHash,
          phoneCode: String(code),
        }),
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("SESSION_PASSWORD_NEEDED")) {
        if (!password) {
          res.json({ ok: true, needs_password: true });
          return;
        }
        const srpResult = await client.invoke(new Api.account.GetPassword());
        const passwordResult = await client.invoke(
          new Api.auth.CheckPassword({
            password: await client.computeSrpPassword(srpResult, String(password)) as unknown as Api.TypeInputCheckPasswordSRP,
          }),
        );
        if (!passwordResult) {
          res.status(400).json({ error: "Invalid 2FA password" });
          return;
        }
      } else {
        throw err;
      }
    }

    const me = await client.getMe() as Api.User;
    const sessionString = client.session.save() as unknown as string;
    cleanPending(pending_id);

    res.json({
      ok: true,
      session_string: sessionString,
      telegram_id: me.id?.toString(),
      phone: me.phone,
      first_name: me.firstName,
      username: me.username,
      account_id: me.id?.toString(),
      api_id: apiId,
      api_hash: apiHash,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/mtproto/info", async (req, res) => {
  try {
    const { session_string, api_id, api_hash } = req.body;
    if (!session_string || !api_id || !api_hash) {
      res.status(400).json({ error: "session_string, api_id, api_hash required" });
      return;
    }

    const { result, updatedSession } = await withClient(
      session_string, Number(api_id), String(api_hash),
      async (client) => {
        const me = await client.getMe() as Api.User;
        const fullUser = await client.invoke(
          new Api.users.GetFullUser({ id: new Api.InputUserSelf() }),
        );
        return {
          id: me.id?.toString(),
          first_name: me.firstName,
          last_name: me.lastName,
          username: me.username,
          phone: me.phone,
          bio: (fullUser.fullUser as any)?.about ?? "",
          premium: me.premium ?? false,
          verified: me.verified ?? false,
        };
      },
    );

    res.json({ ok: true, info: result, updated_session: updatedSession });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/mtproto/chats", async (req, res) => {
  try {
    const { session_string, api_id, api_hash } = req.body;
    if (!session_string || !api_id || !api_hash) {
      res.status(400).json({ error: "session_string, api_id, api_hash required" });
      return;
    }

    const { result, updatedSession } = await withClient(
      session_string, Number(api_id), String(api_hash),
      async (client) => {
        const dialogs = await client.getDialogs({ limit: 50 });
        return dialogs.map((d) => {
          let chatType = "user";
          if (d.isChannel) chatType = "channel";
          else if (d.isGroup) chatType = "group";
          return {
            id: d.id?.toString(),
            name: d.name ?? d.title ?? "Unknown",
            type: chatType,
            unread: d.unreadCount ?? 0,
          };
        });
      },
    );

    res.json({ ok: true, chats: result, updated_session: updatedSession });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/mtproto/profile", async (req, res) => {
  try {
    const { session_string, api_id, api_hash, first_name, last_name, username, about } = req.body;
    if (!session_string || !api_id || !api_hash) {
      res.status(400).json({ error: "session_string, api_id, api_hash required" });
      return;
    }

    const { result, updatedSession } = await withClient(
      session_string, Number(api_id), String(api_hash),
      async (client) => {
        const results: string[] = [];

        if (first_name !== undefined || last_name !== undefined || about !== undefined) {
          await client.invoke(
            new Api.account.UpdateProfile({
              ...(first_name !== undefined ? { firstName: first_name } : {}),
              ...(last_name !== undefined ? { lastName: last_name } : {}),
              ...(about !== undefined ? { about } : {}),
            }),
          );
          results.push("Profile updated");
        }

        if (username !== undefined) {
          try {
            await client.invoke(
              new Api.account.UpdateUsername({ username: username || "" }),
            );
            results.push("Username updated");
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes("USERNAME_NOT_MODIFIED")) {
              results.push("Username unchanged");
            } else {
              results.push(`Username error: ${msg}`);
            }
          }
        }

        return results;
      },
    );

    res.json({ ok: true, results: result, updated_session: updatedSession });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/mtproto/password", async (req, res) => {
  try {
    const { session_string, api_id, api_hash, current_password, new_password, hint } = req.body;
    if (!session_string || !api_id || !api_hash) {
      res.status(400).json({ error: "session_string, api_id, api_hash required" });
      return;
    }

    const { result, updatedSession } = await withClient(
      session_string, Number(api_id), String(api_hash),
      async (client) => {
        if (new_password) {
          const srpData = await client.invoke(new Api.account.GetPassword());
          let inputPassword: Api.TypeInputCheckPasswordSRP;
          if (srpData.hasPassword && current_password) {
            inputPassword = await client.computeSrpPassword(srpData, current_password) as unknown as Api.TypeInputCheckPasswordSRP;
          } else {
            inputPassword = new Api.InputCheckPasswordEmpty();
          }

          const newSrpHash = await client.computeNewPasswordHash(srpData, new_password);
          await client.invoke(
            new Api.account.UpdatePasswordSettings({
              password: inputPassword,
              newSettings: new Api.account.PasswordInputSettings({
                newAlgo: srpData.newAlgo,
                newPasswordHash: newSrpHash,
                hint: hint || "",
              }),
            }),
          );
          return "Password changed";
        } else {
          const srpData = await client.invoke(new Api.account.GetPassword());
          if (!srpData.hasPassword) return "No password set";
          let inputPassword: Api.TypeInputCheckPasswordSRP;
          if (current_password) {
            inputPassword = await client.computeSrpPassword(srpData, current_password) as unknown as Api.TypeInputCheckPasswordSRP;
          } else {
            return "Current password required to remove";
          }
          await client.invoke(
            new Api.account.UpdatePasswordSettings({
              password: inputPassword,
              newSettings: new Api.account.PasswordInputSettings({
                newAlgo: srpData.newAlgo,
                newPasswordHash: Buffer.alloc(0),
                hint: "",
              }),
            }),
          );
          return "Password removed";
        }
      },
    );

    res.json({ ok: true, message: result, updated_session: updatedSession });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/mtproto/send", async (req, res) => {
  try {
    const { session_string, api_id, api_hash, to, text } = req.body;
    if (!session_string || !api_id || !api_hash || !to || !text) {
      res.status(400).json({ error: "session_string, api_id, api_hash, to, text required" });
      return;
    }

    const { result, updatedSession } = await withClient(
      session_string, Number(api_id), String(api_hash),
      async (client) => {
        await client.sendMessage(to, { message: text });
        return "Message sent";
      },
    );

    res.json({ ok: true, message: result, updated_session: updatedSession });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/mtproto/chat-edit", async (req, res) => {
  try {
    const { session_string, api_id, api_hash, chat_id, title, about } = req.body;
    if (!session_string || !api_id || !api_hash || !chat_id) {
      res.status(400).json({ error: "session_string, api_id, api_hash, chat_id required" });
      return;
    }

    const { result, updatedSession } = await withClient(
      session_string, Number(api_id), String(api_hash),
      async (client) => {
        const results: string[] = [];
        const entity = await client.getEntity(chat_id);

        if (title) {
          if (entity instanceof Api.Channel) {
            await client.invoke(
              new Api.channels.EditTitle({
                channel: entity,
                title,
              }),
            );
          } else if (entity instanceof Api.Chat) {
            await client.invoke(
              new Api.messages.EditChatTitle({
                chatId: entity.id,
                title,
              }),
            );
          }
          results.push("Title updated");
        }

        if (about !== undefined) {
          if (entity instanceof Api.Channel) {
            await client.invoke(
              new Api.messages.EditChatAbout({
                peer: entity,
                about: about || "",
              }),
            );
          }
          results.push("Description updated");
        }

        return results;
      },
    );

    res.json({ ok: true, results: result, updated_session: updatedSession });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

app.post("/mtproto/participants", async (req, res) => {
  try {
    const { session_string, api_id, api_hash, chat_id } = req.body;
    if (!session_string || !api_id || !api_hash || !chat_id) {
      res.status(400).json({ error: "session_string, api_id, api_hash, chat_id required" });
      return;
    }

    const { result, updatedSession } = await withClient(
      session_string, Number(api_id), String(api_hash),
      async (client) => {
        const entity = await client.getEntity(chat_id);
        let participants: Array<{ id: string; firstName?: string; username?: string }> = [];

        if (entity instanceof Api.Channel) {
          const result = await client.getParticipants(entity, {});
          participants = result.map((p) => ({
            id: p.id.toString(),
            firstName: (p as Api.User).firstName ?? undefined,
            username: (p as Api.User).username ?? undefined,
          }));
        } else if (entity instanceof Api.Chat) {
          const fullChat = await client.invoke(
            new Api.messages.GetFullChat({ chatId: entity.id }),
          );
          const users = fullChat.users as Api.User[];
          participants = users.map((u) => ({
            id: u.id.toString(),
            firstName: u.firstName ?? undefined,
            username: u.username ?? undefined,
          }));
        }

        return participants;
      },
    );

    res.json({ ok: true, participants: result, updated_session: updatedSession });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "mtproto-server", pendingSessions: pendingClients.size });
});

app.get("/mtproto/health", (_req, res) => {
  res.json({ ok: true, service: "mtproto-server", pendingSessions: pendingClients.size });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MTProto server running on port ${PORT}`);
});
