const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN!;
const D1_DATABASE_ID = process.env.D1_DATABASE_ID!;

const D1_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}`;

export interface D1Result {
  results: Record<string, unknown>[];
  success: boolean;
  meta: Record<string, unknown>;
}

async function d1Query(sql: string, params: unknown[] = []): Promise<D1Result> {
  const res = await fetch(`${D1_BASE}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params }),
  });
  const data = (await res.json()) as { success: boolean; result: D1Result[]; errors: unknown[] };
  if (!data.success) {
    throw new Error(`D1 error: ${JSON.stringify(data.errors)}`);
  }
  return data.result[0];
}

export async function d1Run(sql: string, params: unknown[] = []): Promise<D1Result> {
  return d1Query(sql, params);
}

export async function d1All<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await d1Query(sql, params);
  return result.results as T[];
}

export async function d1First<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await d1All<T>(sql, params);
  return rows[0] ?? null;
}

export async function initSchema(): Promise<void> {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      first_name TEXT,
      username TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
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
      currency TEXT DEFAULT 'USDT',
      status TEXT DEFAULT 'pending',
      tx_id TEXT,
      track_id TEXT,
      pay_link TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS static_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      address TEXT NOT NULL UNIQUE,
      currency TEXT NOT NULL,
      network TEXT NOT NULL,
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
    // Safe migrations
    `ALTER TABLE donations ADD COLUMN currency TEXT DEFAULT 'USD'`,
    `ALTER TABLE donations ADD COLUMN pay_link TEXT`,
    `ALTER TABLE donations ADD COLUMN order_id TEXT`,
    `ALTER TABLE donations ADD COLUMN pay_currency TEXT`,
    `ALTER TABLE donations ADD COLUMN pay_amount REAL`,
    `ALTER TABLE donations ADD COLUMN network TEXT`,
    `ALTER TABLE donations ADD COLUMN address TEXT`,
    `ALTER TABLE donations ADD COLUMN expired_at INTEGER`,
    `ALTER TABLE donations ADD COLUMN qr_code TEXT`,
    `ALTER TABLE static_addresses ADD COLUMN track_id TEXT`,
    `ALTER TABLE static_addresses ADD COLUMN qr_code TEXT`,
    `ALTER TABLE static_addresses ADD COLUMN memo TEXT`,
    // Group / channel tracking
    `CREATE TABLE IF NOT EXISTS group_chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT UNIQUE NOT NULL,
      title TEXT,
      type TEXT,
      bot_is_admin INTEGER DEFAULT 0,
      member_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      telegram_id TEXT NOT NULL,
      status TEXT DEFAULT 'member',
      first_seen TEXT DEFAULT (datetime('now')),
      UNIQUE(chat_id, telegram_id)
    )`,
    // User string sessions (MTProto)
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
    `ALTER TABLE user_sessions ADD COLUMN api_id INTEGER`,
    `ALTER TABLE user_sessions ADD COLUMN api_hash TEXT`,
    // Premium subscriptions
    `CREATE TABLE IF NOT EXISTS premium_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL,
      stars_paid INTEGER,
      amount_usd REAL DEFAULT 5.0,
      expires_at TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      track_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ];
  for (const sql of stmts) {
    try {
      await d1Run(sql);
    } catch (e: any) {
      // Ignore "already exists" / "duplicate column" errors
      const msg = String(e?.message ?? "");
      if (!msg.includes("already exists") && !msg.includes("duplicate column")) {
        console.warn("Schema stmt warning:", msg.slice(0, 120));
      }
    }
  }
}
