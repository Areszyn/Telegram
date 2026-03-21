import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

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

/** Express middleware — rejects non-admin requests with 403. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const initData = (req.headers["x-init-data"] as string) ?? "";
  const parsed = validateTelegramInitData(initData);
  if (!parsed) { res.status(401).json({ error: "Unauthorized" }); return; }
  const userStr = parsed["user"];
  if (!userStr) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const user = JSON.parse(userStr) as { id: number };
    if (String(user.id) !== process.env.ADMIN_ID) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  } catch {
    res.status(401).json({ error: "Unauthorized" }); return;
  }
  next();
}

/** Helper — returns true if the telegramId matches the admin. */
export function isAdminId(telegramId: string): boolean {
  return telegramId === process.env.ADMIN_ID;
}
