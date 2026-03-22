import { d1All, d1First, d1Run } from "./d1.ts";

const RATE_LIMIT_MAX    = 5;
const RATE_LIMIT_WINDOW = 10;

export async function checkRateLimit(db: D1Database, userId: string): Promise<{ blocked: boolean; hitCount: number }> {
  const row = await d1First<{ window_start: string; hit_count: number }>(db,
    "SELECT window_start, hit_count FROM rate_limit_windows WHERE user_id = ?",
    [userId],
  );

  if (!row) {
    await d1Run(db,
      "INSERT INTO rate_limit_windows (user_id, window_start, hit_count) VALUES (?, datetime('now'), 1)",
      [userId],
    );
    return { blocked: false, hitCount: 1 };
  }

  const ageMs = Date.now() - new Date(row.window_start + "Z").getTime();
  if (ageMs > RATE_LIMIT_WINDOW * 1000) {
    await d1Run(db,
      "UPDATE rate_limit_windows SET window_start = datetime('now'), hit_count = 1 WHERE user_id = ?",
      [userId],
    );
    return { blocked: false, hitCount: 1 };
  }

  const newCount = row.hit_count + 1;
  await d1Run(db,
    "UPDATE rate_limit_windows SET hit_count = ? WHERE user_id = ?",
    [newCount, userId],
  );
  return { blocked: newCount > RATE_LIMIT_MAX, hitCount: newCount };
}

export async function findBlockedKeyword(db: D1Database, text: string): Promise<string | null> {
  const rows = await d1All<{ keyword: string }>(db, "SELECT keyword FROM blocked_keywords");
  const lower = text.toLowerCase();
  for (const { keyword } of rows) {
    if (lower.includes(keyword.toLowerCase())) return keyword;
  }
  return null;
}

export function containsLink(text: string): boolean {
  return /https?:\/\/|t\.me\//i.test(text);
}

export async function isLinkWhitelisted(db: D1Database, telegramId: string): Promise<boolean> {
  const row = await d1First(db, "SELECT 1 FROM link_whitelist WHERE telegram_id = ?", [telegramId]);
  return !!row;
}

export async function updateAnalytics(db: D1Database, telegramId: string): Promise<void> {
  await d1Run(db,
    `UPDATE users SET last_active = datetime('now'), message_count = COALESCE(message_count, 0) + 1
     WHERE telegram_id = ?`,
    [telegramId],
  );
}

export async function getGlobalStats(db: D1Database): Promise<{
  total_users: number;
  daily_active: number;
  total_messages: number;
  banned_users: number;
}> {
  const [u, a, m, b] = await Promise.all([
    d1First<{ c: number }>(db, "SELECT COUNT(*) AS c FROM users"),
    d1First<{ c: number }>(db, "SELECT COUNT(*) AS c FROM users WHERE last_active > datetime('now', '-1 day')"),
    d1First<{ c: number }>(db, "SELECT COUNT(*) AS c FROM messages WHERE sender_type = 'user'"),
    d1First<{ c: number }>(db, "SELECT COUNT(*) AS c FROM moderation WHERE bot_banned = 1 OR global_banned = 1"),
  ]);
  return {
    total_users:    u?.c ?? 0,
    daily_active:   a?.c ?? 0,
    total_messages: m?.c ?? 0,
    banned_users:   b?.c ?? 0,
  };
}

export async function runScheduledBroadcasts(
  db: D1Database,
  sendFn: (id: string, text: string) => Promise<unknown>,
  getUsersFn: () => Promise<{ telegram_id: string }[]>,
  adminId: string,
  notifyAdmin: (text: string) => Promise<unknown>,
): Promise<void> {
  const pending = await d1All<{ id: number; message: string }>(db,
    "SELECT id, message FROM scheduled_broadcasts WHERE sent = 0 AND scheduled_at <= datetime('now') LIMIT 3",
  );
  if (!pending.length) return;

  for (const b of pending) {
    await d1Run(db, "UPDATE scheduled_broadcasts SET sent = 1 WHERE id = ?", [b.id]).catch(() => {});
    const users = await getUsersFn().catch(() => [] as { telegram_id: string }[]);
    let sent = 0;
    for (const u of users) {
      if (u.telegram_id === adminId) continue;
      const ok = await sendFn(u.telegram_id, b.message).then(() => true).catch(() => false);
      if (ok) sent++;
    }
    await notifyAdmin(`📨 Scheduled broadcast #${b.id} sent to ${sent}/${users.length} users.`).catch(() => {});
  }
}

export async function getInactiveUsers(
  db: D1Database,
  days = 3,
): Promise<{ telegram_id: string; first_name: string | null }[]> {
  return d1All<{ telegram_id: string; first_name: string | null }>(db,
    `SELECT u.telegram_id, u.first_name
     FROM users u
     WHERE (u.last_active IS NULL OR u.last_active < datetime('now', '-${days} days'))
       AND u.telegram_id NOT IN (
         SELECT m.user_id FROM moderation m WHERE m.bot_banned = 1 OR m.global_banned = 1
       )`,
  );
}
