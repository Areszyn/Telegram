import { d1First, d1Run } from "./d1.js";
import { sendMessage } from "./telegram.js";

const ADMIN_ID = process.env.ADMIN_ID!;

export interface ModerationRecord {
  user_id: string;
  status: "active" | "warned" | "restricted";
  bot_banned: number;
  app_banned: number;
  global_banned: number;
  warnings_count: number;
  ban_reason: string | null;
  ban_until: string | null;
  last_warning_reason: string | null;
  updated_at: string;
}

export interface AccessResult {
  allowed: boolean;
  restricted: boolean;
  reason?: string;
}

export async function getModerationRecord(userId: string): Promise<ModerationRecord | null> {
  return d1First<ModerationRecord>("SELECT * FROM moderation WHERE user_id = ?", [userId]);
}

export async function checkUserAccess(userId: string, source: "bot" | "app"): Promise<AccessResult> {
  const mod = await getModerationRecord(userId);
  if (!mod) return { allowed: true, restricted: false };

  // Auto-expire temporary bans
  if (mod.ban_until) {
    if (new Date(mod.ban_until) < new Date()) {
      await d1Run(
        `UPDATE moderation SET bot_banned=0, app_banned=0, global_banned=0,
         ban_until=NULL, status='active', updated_at=datetime('now') WHERE user_id=?`,
        [userId]
      );
      return { allowed: true, restricted: false };
    }
  }

  if (mod.global_banned) {
    return { allowed: false, restricted: false, reason: mod.ban_reason ?? "Global ban" };
  }
  if (source === "bot" && mod.bot_banned) {
    return { allowed: false, restricted: false, reason: mod.ban_reason ?? "Bot ban" };
  }
  if (source === "app" && mod.app_banned) {
    return { allowed: false, restricted: false, reason: mod.ban_reason ?? "App ban" };
  }
  if (mod.status === "restricted") {
    return { allowed: true, restricted: true };
  }
  return { allowed: true, restricted: false };
}

export interface ParsedAction {
  action: "ban" | "warn" | "restrict" | "unban";
  scope: "bot" | "app" | "global";
  reason: string;
}

export function parseModerationMessage(text: string): ParsedAction | null {
  const t = text.trim();
  const lower = t.toLowerCase();

  if (lower === "unban") {
    return { action: "unban", scope: "global", reason: "" };
  }

  const warnM = lower.match(/^warn\s+(.+)$/);
  if (warnM) return { action: "warn", scope: "bot", reason: t.slice(5).trim() };

  const restrictM = lower.match(/^restrict\s+(.+)$/);
  if (restrictM) return { action: "restrict", scope: "bot", reason: t.slice(9).trim() };

  const banM = lower.match(/^ban\s+(.+)$/);
  if (banM) {
    const rest = t.slice(4).trim();
    const lRest = rest.toLowerCase();
    if (lRest.startsWith("global ")) return { action: "ban", scope: "global", reason: rest.slice(7).trim() };
    if (lRest.startsWith("app "))    return { action: "ban", scope: "app",    reason: rest.slice(4).trim() };
    if (lRest.startsWith("bot "))    return { action: "ban", scope: "bot",    reason: rest.slice(4).trim() };
    return { action: "ban", scope: "bot", reason: rest };
  }

  return null;
}

export async function applyModAction(
  targetUserId: string,
  adminId: string,
  parsed: ParsedAction
): Promise<string> {
  const { action, scope, reason } = parsed;
  const now = new Date().toISOString();

  // Ensure moderation record exists
  await d1Run(
    `INSERT OR IGNORE INTO moderation (user_id, status, bot_banned, app_banned, global_banned, warnings_count)
     VALUES (?, 'active', 0, 0, 0, 0)`,
    [targetUserId]
  );

  let summary = "";
  let userMsg = "";

  switch (action) {
    case "ban": {
      if (scope === "global") {
        await d1Run(
          `UPDATE moderation SET global_banned=1, bot_banned=1, app_banned=1,
           ban_reason=?, ban_until=NULL, status='active', updated_at=? WHERE user_id=?`,
          [reason, now, targetUserId]
        );
      } else if (scope === "app") {
        await d1Run(
          `UPDATE moderation SET app_banned=1, ban_reason=?, ban_until=NULL, updated_at=? WHERE user_id=?`,
          [reason, now, targetUserId]
        );
      } else {
        await d1Run(
          `UPDATE moderation SET bot_banned=1, ban_reason=?, ban_until=NULL, updated_at=? WHERE user_id=?`,
          [reason, now, targetUserId]
        );
      }
      const label = scope === "global" ? "everywhere" : scope === "bot" ? "the bot" : "the app";
      userMsg = `🚫 You were banned from ${label}.\nReason: ${reason}`;
      summary = `Banned from ${scope}`;
      break;
    }

    case "warn": {
      const mod = await getModerationRecord(targetUserId);
      const count = (mod?.warnings_count ?? 0) + 1;

      if (count >= 3) {
        const until = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
        await d1Run(
          `UPDATE moderation SET global_banned=1, bot_banned=1, app_banned=1,
           ban_reason=?, ban_until=?, warnings_count=?, status='active',
           last_warning_reason=?, updated_at=? WHERE user_id=?`,
          [`Warning escalation: ${reason}`, until, count, reason, now, targetUserId]
        );
        userMsg = `⛔ 3rd warning — you are globally banned for 7 days.\nReason: ${reason}`;
        summary = `Warning #3 → temp global ban (7d)`;
      } else if (count === 2) {
        const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        await d1Run(
          `UPDATE moderation SET status='restricted', warnings_count=?,
           last_warning_reason=?, ban_until=?, updated_at=? WHERE user_id=?`,
          [count, reason, until, now, targetUserId]
        );
        userMsg = `⚠️ 2nd warning — you are restricted for 24 hours.\nReason: ${reason}`;
        summary = `Warning #2 → restricted (24h)`;
      } else {
        await d1Run(
          `UPDATE moderation SET status='warned', warnings_count=?,
           last_warning_reason=?, updated_at=? WHERE user_id=?`,
          [count, reason, now, targetUserId]
        );
        userMsg = `⚠️ You received a warning.\nReason: ${reason}`;
        summary = `Warning #${count}`;
      }
      break;
    }

    case "restrict": {
      await d1Run(
        `UPDATE moderation SET status='restricted', ban_reason=?, updated_at=? WHERE user_id=?`,
        [reason, now, targetUserId]
      );
      userMsg = `🔒 Your access has been restricted.${reason ? `\nReason: ${reason}` : ""}`;
      summary = "Restricted";
      break;
    }

    case "unban": {
      await d1Run(
        `UPDATE moderation SET bot_banned=0, app_banned=0, global_banned=0,
         ban_reason=NULL, ban_until=NULL, status='active', warnings_count=0,
         updated_at=? WHERE user_id=?`,
        [now, targetUserId]
      );
      userMsg = "✅ You have been unbanned. Welcome back!";
      summary = "Unbanned";
      break;
    }
  }

  // Notify user
  await sendMessage(targetUserId, userMsg).catch(() => {});

  // Log action
  await d1Run(
    `INSERT INTO moderation_logs (user_id, admin_id, action, scope, reason) VALUES (?, ?, ?, ?, ?)`,
    [targetUserId, adminId, action, scope, reason || null]
  ).catch(() => {});

  return summary;
}
