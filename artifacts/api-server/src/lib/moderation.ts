import { d1First, d1Run, d1All } from "./d1.ts";
import { sendMessage } from "./telegram.ts";

export interface ModerationRecord {
  user_id: string;
  status: "active" | "warned" | "muted" | "restricted";
  bot_banned: number;
  app_banned: number;
  global_banned: number;
  warnings_count: number;
  ban_reason: string | null;
  ban_until: string | null;
  mute_until: string | null;
  last_warning_reason: string | null;
  updated_at: string;
}

export interface AccessResult {
  allowed: boolean;
  restricted: boolean;
  muted: boolean;
  reason?: string;
}

export async function getModerationRecord(db: D1Database, userId: string): Promise<ModerationRecord | null> {
  return d1First<ModerationRecord>(db, "SELECT * FROM moderation WHERE user_id = ?", [userId]);
}

export async function checkUserAccess(db: D1Database, userId: string, source: "bot" | "app"): Promise<AccessResult> {
  const mod = await getModerationRecord(db, userId);
  if (!mod) return { allowed: true, restricted: false, muted: false };

  const now = new Date();

  if (mod.ban_until && new Date(mod.ban_until) < now) {
    await d1Run(db,
      `UPDATE moderation SET bot_banned=0, app_banned=0, global_banned=0,
       ban_until=NULL, status='active', updated_at=datetime('now') WHERE user_id=?`,
      [userId],
    );
    return { allowed: true, restricted: false, muted: false };
  }

  if (mod.mute_until && new Date(mod.mute_until) < now) {
    await d1Run(db,
      `UPDATE moderation SET mute_until=NULL, status=CASE WHEN warnings_count > 0 THEN 'warned' ELSE 'active' END, updated_at=datetime('now') WHERE user_id=?`,
      [userId],
    );
  }

  if (mod.global_banned) return { allowed: false, restricted: false, muted: false, reason: mod.ban_reason ?? "Global ban" };
  if (source === "bot" && mod.bot_banned) return { allowed: false, restricted: false, muted: false, reason: mod.ban_reason ?? "Bot ban" };
  if (source === "app" && mod.app_banned) return { allowed: false, restricted: false, muted: false, reason: mod.ban_reason ?? "App ban" };

  const isMuted = mod.mute_until ? new Date(mod.mute_until) > now : false;
  if (isMuted) return { allowed: true, restricted: false, muted: true, reason: "You are muted" };
  if (mod.status === "restricted") return { allowed: true, restricted: true, muted: false };
  return { allowed: true, restricted: false, muted: false };
}

export interface ParsedAction {
  action: "ban" | "warn" | "restrict" | "mute" | "unmute" | "unban" | "reset-warnings";
  scope: "bot" | "app" | "global";
  reason: string;
  duration?: number;
}

export function parseModerationMessage(text: string): ParsedAction | null {
  const t = text.trim().replace(/^\//, "");
  const lower = t.toLowerCase();

  if (lower === "unban") return { action: "unban", scope: "global", reason: "" };
  if (lower === "unmute") return { action: "unmute", scope: "bot", reason: "" };
  if (lower === "reset-warnings" || lower === "resetwarnings") return { action: "reset-warnings", scope: "bot", reason: "" };

  const muteM = lower.match(/^mute(\s+(.+))?$/);
  if (muteM) {
    const rest = muteM[2] ? t.slice(5).trim() : "";
    const durMatch = rest.match(/^(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|d|day|days)?\s*(.*)?$/i);
    if (durMatch) {
      const num = parseInt(durMatch[1]);
      const unit = (durMatch[2] || "h").toLowerCase().charAt(0);
      const multiplier = unit === "d" ? 86400 : unit === "m" ? 60 : 3600;
      return { action: "mute", scope: "bot", reason: durMatch[3]?.trim() || "Muted", duration: num * multiplier * 1000 };
    }
    return { action: "mute", scope: "bot", reason: rest || "Muted", duration: 3600 * 1000 };
  }

  const warnM = lower.match(/^warn(\s+(.+))?$/);
  if (warnM) return { action: "warn", scope: "bot", reason: (warnM[2] ? t.slice(5).trim() : "") || "No reason provided" };

  const restrictM = lower.match(/^restrict(\s+(.+))?$/);
  if (restrictM) return { action: "restrict", scope: "bot", reason: (restrictM[2] ? t.slice(9).trim() : "") || "No reason provided" };

  const banM = lower.match(/^ban(\s+(.+))?$/);
  if (banM) {
    const rest = (banM[2] ? t.slice(4).trim() : "") || "";
    const lRest = rest.toLowerCase();
    if (lRest.startsWith("global ")) return { action: "ban", scope: "global", reason: rest.slice(7).trim() || "No reason provided" };
    if (lRest.startsWith("app "))    return { action: "ban", scope: "app",    reason: rest.slice(4).trim() || "No reason provided" };
    if (lRest.startsWith("bot "))    return { action: "ban", scope: "bot",    reason: rest.slice(4).trim() || "No reason provided" };
    if (lRest === "global")          return { action: "ban", scope: "global", reason: "No reason provided" };
    if (lRest === "app")             return { action: "ban", scope: "app",    reason: "No reason provided" };
    if (lRest === "bot")             return { action: "ban", scope: "bot",    reason: "No reason provided" };
    return { action: "ban", scope: "bot", reason: rest || "No reason provided" };
  }

  return null;
}

const WARNING_THRESHOLDS = {
  1: { label: "1st Warning", emoji: "⚠️", effect: "warning" as const },
  2: { label: "2nd Warning", emoji: "⚠️⚠️", effect: "mute_1h" as const },
  3: { label: "3rd Warning — Final", emoji: "🔴", effect: "restrict_24h" as const },
  4: { label: "4th Warning — Auto-Ban", emoji: "⛔", effect: "global_ban" as const },
};

export async function applyModAction(
  db: D1Database,
  token: string,
  targetUserId: string,
  adminId: string,
  parsed: ParsedAction,
): Promise<string> {
  const { action, scope, reason } = parsed;
  const now = new Date().toISOString();

  await d1Run(db,
    `INSERT OR IGNORE INTO moderation (user_id, status, bot_banned, app_banned, global_banned, warnings_count)
     VALUES (?, 'active', 0, 0, 0, 0)`,
    [targetUserId],
  );

  let summary = "";
  let userMsg = "";

  switch (action) {
    case "ban": {
      if (scope === "global") {
        await d1Run(db,
          `UPDATE moderation SET global_banned=1, bot_banned=1, app_banned=1,
           ban_reason=?, ban_until=NULL, status='active', updated_at=? WHERE user_id=?`,
          [reason, now, targetUserId],
        );
      } else if (scope === "app") {
        await d1Run(db,
          `UPDATE moderation SET app_banned=1, ban_reason=?, ban_until=NULL, updated_at=? WHERE user_id=?`,
          [reason, now, targetUserId],
        );
      } else {
        await d1Run(db,
          `UPDATE moderation SET bot_banned=1, ban_reason=?, ban_until=NULL, updated_at=? WHERE user_id=?`,
          [reason, now, targetUserId],
        );
      }
      const label = scope === "global" ? "everywhere" : scope === "bot" ? "the bot" : "the app";
      userMsg = `🚫 You have been banned from ${label}.\nReason: ${reason}`;
      summary = `Banned from ${scope}`;
      break;
    }
    case "warn": {
      const mod = await getModerationRecord(db, targetUserId);
      const count = (mod?.warnings_count ?? 0) + 1;
      const threshold = WARNING_THRESHOLDS[Math.min(count, 4) as keyof typeof WARNING_THRESHOLDS];

      if (count >= 4) {
        await d1Run(db,
          `UPDATE moderation SET global_banned=1, bot_banned=1, app_banned=1,
           ban_reason=?, ban_until=NULL, warnings_count=?, status='active',
           last_warning_reason=?, updated_at=? WHERE user_id=?`,
          [`Auto-ban: ${count} warnings — ${reason}`, count, reason, now, targetUserId],
        );
        userMsg = `${threshold.emoji} *${threshold.label}*\n\nYou have been permanently banned after ${count} warnings.\nLatest reason: ${reason}\n\nContact admin to appeal.`;
        summary = `Warning #${count} → permanent global ban`;
      } else if (count === 3) {
        const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        await d1Run(db,
          `UPDATE moderation SET status='restricted', warnings_count=?,
           last_warning_reason=?, ban_until=?, updated_at=? WHERE user_id=?`,
          [count, reason, until, now, targetUserId],
        );
        userMsg = `${threshold.emoji} *${threshold.label}*\n\nYou are restricted for 24 hours.\nReason: ${reason}\n\n⛔ Next warning = permanent ban.`;
        summary = `Warning #3 → restricted 24h (final warning)`;
      } else if (count === 2) {
        const muteUntil = new Date(Date.now() + 3600 * 1000).toISOString();
        await d1Run(db,
          `UPDATE moderation SET status='muted', warnings_count=?,
           last_warning_reason=?, mute_until=?, updated_at=? WHERE user_id=?`,
          [count, reason, muteUntil, now, targetUserId],
        );
        userMsg = `${threshold.emoji} *${threshold.label}*\n\nYou are muted for 1 hour.\nReason: ${reason}\n\n🔴 2 warnings remaining before ban.`;
        summary = `Warning #2 → muted 1h`;
      } else {
        await d1Run(db,
          `UPDATE moderation SET status='warned', warnings_count=?,
           last_warning_reason=?, updated_at=? WHERE user_id=?`,
          [count, reason, now, targetUserId],
        );
        userMsg = `${threshold.emoji} *${threshold.label}*\n\nReason: ${reason}\n\n⚠️ 3 warnings remaining before ban.`;
        summary = `Warning #${count}`;
      }
      break;
    }
    case "mute": {
      const dur = parsed.duration ?? 3600 * 1000;
      const muteUntil = new Date(Date.now() + dur).toISOString();
      const durLabel = dur >= 86400000 ? `${Math.round(dur / 86400000)}d` : dur >= 3600000 ? `${Math.round(dur / 3600000)}h` : `${Math.round(dur / 60000)}m`;
      await d1Run(db,
        `UPDATE moderation SET status='muted', mute_until=?, updated_at=? WHERE user_id=?`,
        [muteUntil, now, targetUserId],
      );
      userMsg = `🔇 You have been muted for ${durLabel}.\n${reason !== "Muted" ? `Reason: ${reason}` : ""}`;
      summary = `Muted for ${durLabel}`;
      break;
    }
    case "unmute": {
      await d1Run(db,
        `UPDATE moderation SET mute_until=NULL, status=CASE WHEN warnings_count > 0 THEN 'warned' ELSE 'active' END, updated_at=? WHERE user_id=?`,
        [now, targetUserId],
      );
      userMsg = "🔊 You have been unmuted.";
      summary = "Unmuted";
      break;
    }
    case "restrict": {
      await d1Run(db,
        `UPDATE moderation SET status='restricted', ban_reason=?, updated_at=? WHERE user_id=?`,
        [reason, now, targetUserId],
      );
      userMsg = `🔒 Your access has been restricted.${reason ? `\nReason: ${reason}` : ""}`;
      summary = "Restricted";
      break;
    }
    case "reset-warnings": {
      await d1Run(db,
        `UPDATE moderation SET warnings_count=0, last_warning_reason=NULL, mute_until=NULL, ban_until=NULL, ban_reason=NULL, status='active', updated_at=? WHERE user_id=?`,
        [now, targetUserId],
      );
      userMsg = "✅ Your warnings have been reset.";
      summary = "Warnings reset to 0 (mute/restrict cleared)";
      break;
    }
    case "unban": {
      await d1Run(db,
        `UPDATE moderation SET bot_banned=0, app_banned=0, global_banned=0,
         ban_reason=NULL, ban_until=NULL, mute_until=NULL, status='active', warnings_count=0,
         last_warning_reason=NULL, updated_at=? WHERE user_id=?`,
        [now, targetUserId],
      );
      userMsg = "✅ You have been unbanned and all warnings cleared. Welcome back!";
      summary = "Unbanned + warnings reset";
      break;
    }
  }

  await sendMessage(token, targetUserId, userMsg, { parse_mode: "Markdown" }).catch(() => {});
  await d1Run(db,
    `INSERT INTO moderation_logs (user_id, admin_id, action, scope, reason) VALUES (?, ?, ?, ?, ?)`,
    [targetUserId, adminId, action, scope, reason || null],
  ).catch(() => {});

  return summary;
}

export async function getWarningHistory(db: D1Database, userId: string) {
  return d1All(db,
    `SELECT action, scope, reason, created_at FROM moderation_logs WHERE user_id = ? AND action = 'warn' ORDER BY created_at DESC LIMIT 20`,
    [userId],
  );
}
