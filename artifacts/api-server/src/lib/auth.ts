import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "../types.ts";

async function hmacBytes(key: Uint8Array | ArrayBuffer, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

function toHex(buf: Uint8Array): string {
  return [...buf].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function validateTelegramInitData(
  initData: string,
  botToken: string,
): Promise<Record<string, string> | null> {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");
    const sorted = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const secretKey = await hmacBytes(
      new TextEncoder().encode("WebAppData"),
      botToken,
    );
    const expected = toHex(await hmacBytes(secretKey, sorted));
    if (expected !== hash) return null;
    const result: Record<string, string> = {};
    for (const [k, v] of params.entries()) result[k] = v;
    return result;
  } catch {
    return null;
  }
}

export type HonoCtx = Context<{ Bindings: Env }>;

export async function parseAuth(
  c: HonoCtx,
): Promise<{ telegramId: string; isAdmin: boolean } | null> {
  const initData = c.req.header("x-init-data") ?? "";
  const validated = await validateTelegramInitData(initData, c.env.BOT_TOKEN);
  if (!validated) return null;
  const userStr = validated["user"];
  if (!userStr) return null;
  try {
    const user = JSON.parse(userStr) as { id: number };
    const telegramId = String(user.id);
    return { telegramId, isAdmin: telegramId === c.env.ADMIN_ID };
  } catch {
    return null;
  }
}

export function requireAdmin(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const auth = await parseAuth(c as HonoCtx);
    if (!auth) return c.json({ error: "Unauthorized" }, 401);
    if (!auth.isAdmin) return c.json({ error: "Forbidden" }, 403);
    await next();
  };
}
