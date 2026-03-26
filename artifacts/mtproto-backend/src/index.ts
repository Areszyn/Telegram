import "dotenv/config";
import express from "express";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { computeCheck, computeDigest } from "telegram/Password.js";
import { randomBytes } from "crypto";

const app = express();
app.use(express.json());

const API_KEY = process.env.MTPROTO_API_KEY;
if (!API_KEY) {
  console.error("FATAL: MTPROTO_API_KEY environment variable is required");
  process.exit(1);
}
const PORT = parseInt(process.env.PORT || process.env.MTPROTO_PORT || "3003", 10);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

function auth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const p = req.path.replace(/\/+$/, "");
  if (p === "/health" || p === "/mtproto/health") {
    next();
    return;
  }
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
            password: await computeCheck(srpResult, String(password)),
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
            inputPassword = await computeCheck(srpData, current_password);
          } else {
            inputPassword = new Api.InputCheckPasswordEmpty();
          }

          if (!(srpData.newAlgo instanceof Api.PasswordKdfAlgoUnknown)) { srpData.newAlgo.salt1 = Buffer.concat([srpData.newAlgo.salt1, randomBytes(32)]); }
          const newSrpHash = await computeDigest(srpData.newAlgo as any, new_password);
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
            inputPassword = await computeCheck(srpData, current_password);
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
        let participants: Array<{ id: string; firstName?: string; username?: string; isBot?: boolean }> = [];

        if (entity instanceof Api.Channel) {
          const result = await client.getParticipants(entity, {});
          participants = result.map((p) => {
            const user = p as Api.User;
            return {
              id: p.id.toString(),
              firstName: user.firstName ?? undefined,
              username: user.username ?? undefined,
              isBot: user.bot === true,
            };
          });
        } else if (entity instanceof Api.Chat) {
          const fullChat = await client.invoke(
            new Api.messages.GetFullChat({ chatId: entity.id }),
          );
          const users = fullChat.users as Api.User[];
          participants = users.map((u) => ({
            id: u.id.toString(),
            firstName: u.firstName ?? undefined,
            username: u.username ?? undefined,
            isBot: u.bot === true,
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

app.post("/mtproto/download-media", async (req, res) => {
  try {
    const { session_string, api_id, api_hash, document_id, access_hash, file_reference } = req.body;
    if (!session_string || !api_id || !api_hash || !document_id || !access_hash) {
      res.status(400).json({ error: "session_string, api_id, api_hash, document_id, access_hash required" });
      return;
    }

    const session = new StringSession(session_string);
    const client = new TelegramClient(session, Number(api_id), String(api_hash), {
      connectionRetries: 3,
      deviceModel: "Lifegram Bot",
      appVersion: "1.0",
    });
    await client.connect();

    try {
      const inputDoc = new Api.InputDocumentFileLocation({
        id: BigInt(document_id) as any,
        accessHash: BigInt(access_hash) as any,
        fileReference: file_reference ? Buffer.from(file_reference, "base64") : Buffer.alloc(0),
        thumbSize: "",
      });

      const buffer = await client.downloadFile(inputDoc, {
        dcId: undefined,
        fileSize: undefined as any,
      });

      const updatedSession = client.session.save() as unknown as string;
      res.setHeader("X-Updated-Session", updatedSession);
      res.setHeader("Content-Type", "application/octet-stream");
      res.send(Buffer.from(buffer as any));
    } finally {
      await client.disconnect().catch(() => {});
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    console.error("[download-media]", msg);
    res.status(500).json({ error: msg });
  }
});

app.post("/mtproto/user-audios", async (req, res) => {
  try {
    const { session_string, api_id, api_hash, user_id, offset, limit } = req.body;
    if (!session_string || !api_id || !api_hash || !user_id) {
      res.status(400).json({ error: "session_string, api_id, api_hash, user_id required" });
      return;
    }

    const maxLimit = Math.min(Number(limit) || 20, 100);
    const startOffset = Number(offset) || 0;

    const { result, updatedSession } = await withClient(
      session_string, Number(api_id), String(api_hash),
      async (client) => {
        const entity = await client.getEntity(String(user_id));
        const fullUserResult = await client.invoke(
          new Api.users.GetFullUser({ id: entity as unknown as Api.InputUser }),
        );
        const fullUser = fullUserResult.fullUser as any;

        const audios: Array<{
          file_id: string;
          file_unique_id: string;
          access_hash: string;
          file_reference: string;
          file_name?: string;
          title?: string;
          performer?: string;
          duration?: number;
          file_size?: number;
          mime_type?: string;
          source?: string;
        }> = [];

        const seenIds = new Set<string>();
        const pushAudio = (doc: any, source: string) => {
          const docId = `${doc.id}`;
          if (seenIds.has(docId)) return;
          seenIds.add(docId);
          const attrs = doc.attributes || [];
          const audioAttr = attrs.find((a: any) => a.className === "DocumentAttributeAudio");
          if (!audioAttr) return;
          audios.push({
            file_id: docId,
            file_unique_id: `${doc.accessHash}`,
            access_hash: `${doc.accessHash}`,
            file_reference: doc.fileReference ? Buffer.from(doc.fileReference).toString("base64") : "",
            file_name: attrs.find((a: any) => a.className === "DocumentAttributeFilename")?.fileName,
            title: audioAttr.title || undefined,
            performer: audioAttr.performer || undefined,
            duration: audioAttr.duration || 0,
            file_size: Number(doc.size) || 0,
            mime_type: doc.mimeType || "audio/mpeg",
            source,
          });
        };

        console.log("[user-audios] fullUser keys:", Object.keys(fullUser));
        console.log("[user-audios] personalChannelId:", fullUser.personalChannelId);
        console.log("[user-audios] personalChannelMessage:", fullUser.personalChannelMessage);

        const personalChannelId = fullUser.personalChannelId;
        const personalChannelMessage = fullUser.personalChannelMessage;

        if (personalChannelId && personalChannelMessage) {
          try {
            const channelEntity = await client.getEntity(personalChannelId);
            const msgIds = [new Api.InputMessageID({ id: personalChannelMessage })];
            const pinnedMsgs = await client.invoke(
              new Api.channels.GetMessages({ channel: channelEntity as unknown as Api.InputChannel, id: msgIds }),
            );
            const msgs = (pinnedMsgs as any).messages || [];
            for (const msg of msgs) {
              if (!msg.media) continue;
              const doc = (msg.media as any).document;
              if (doc) pushAudio(doc, "profile_music");
            }
          } catch (e) {
            console.error("[user-audios] Failed to fetch profile music message:", e);
          }
        }

        if (personalChannelId) {
          try {
            const channelEntity = await client.getEntity(personalChannelId);
            const messages = await client.getMessages(channelEntity, {
              limit: maxLimit,
              offsetId: 0,
              addOffset: startOffset,
            });

            for (const msg of messages) {
              if (!msg.media) continue;
              const doc = (msg.media as any).document;
              if (doc) pushAudio(doc, "personal_channel");
            }
          } catch (e) {
            console.error("[user-audios] Failed to fetch personal channel:", e);
          }
        }

        try {
          const searchResult = await client.invoke(
            new Api.messages.Search({
              peer: entity as unknown as Api.InputUser,
              q: "",
              filter: new Api.InputMessagesFilterMusic(),
              minDate: 0,
              maxDate: 0,
              offsetId: 0,
              addOffset: startOffset,
              limit: maxLimit,
              maxId: 0,
              minId: 0,
              hash: BigInt(0) as any,
            }),
          );

          const msgs = (searchResult as any).messages || [];
          for (const msg of msgs) {
            if (!msg.media) continue;
            const doc = (msg.media as any).document;
            if (doc) pushAudio(doc, "search");
          }
        } catch (e) {
          console.error("[user-audios] Search failed:", e);
        }

        return audios;
      },
    );

    res.json({ ok: true, audios: result, updated_session: updatedSession });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed";
    res.status(500).json({ error: msg });
  }
});

app.get("/mtproto/health", (_req, res) => {
  res.json({ ok: true, service: "mtproto-server", pendingSessions: pendingClients.size });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MTProto server running on port ${PORT}`);
});
