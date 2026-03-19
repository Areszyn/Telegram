import crypto from "crypto";

export function validateTelegramInitData(initData: string): Record<string, string> | null {
  const BOT_TOKEN = process.env.BOT_TOKEN!;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;
    params.delete("hash");
    const sorted = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");
    const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const expected = crypto.createHmac("sha256", secret).update(sorted).digest("hex");
    if (expected !== hash) return null;
    const result: Record<string, string> = {};
    for (const [k, v] of params.entries()) {
      result[k] = v;
    }
    return result;
  } catch {
    return null;
  }
}

export function requireAdmin(telegramId: string): boolean {
  return telegramId === process.env.ADMIN_ID;
}
