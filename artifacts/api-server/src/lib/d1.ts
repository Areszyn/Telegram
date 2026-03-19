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
      status TEXT DEFAULT 'pending',
      tx_id TEXT,
      track_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
  ];
  for (const sql of stmts) {
    await d1Run(sql);
  }
}
