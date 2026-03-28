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
    `ALTER TABLE users ADD COLUMN avatar TEXT`,
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
    `ALTER TABLE moderation ADD COLUMN mute_until TEXT`,
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
    `CREATE TABLE IF NOT EXISTS widget_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      widget_key TEXT UNIQUE NOT NULL,
      owner_telegram_id TEXT NOT NULL,
      site_name TEXT DEFAULT '',
      color TEXT DEFAULT '#6366f1',
      greeting TEXT DEFAULT 'Hi there! How can we help you?',
      position TEXT DEFAULT 'right',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_widget_configs_owner ON widget_configs(owner_telegram_id)`,
    `ALTER TABLE widget_configs ADD COLUMN logo_text TEXT DEFAULT ''`,
    `ALTER TABLE widget_configs ADD COLUMN bubble_icon TEXT DEFAULT 'chat'`,
    `ALTER TABLE widget_configs ADD COLUMN btn_color TEXT DEFAULT ''`,
    `ALTER TABLE widget_configs ADD COLUMN faq_items TEXT DEFAULT '[]'`,
    `ALTER TABLE widget_configs ADD COLUMN social_links TEXT DEFAULT '[]'`,
    `ALTER TABLE widget_configs ADD COLUMN allowed_domains TEXT DEFAULT ''`,
    `ALTER TABLE widget_configs ADD COLUMN hide_watermark INTEGER DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS widget_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_key TEXT UNIQUE NOT NULL,
      widget_key TEXT NOT NULL,
      visitor_name TEXT NOT NULL,
      visitor_email TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      last_active TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_widget_sessions_widget ON widget_sessions(widget_key)`,
    `CREATE INDEX IF NOT EXISTS idx_widget_sessions_key ON widget_sessions(session_key)`,
    `CREATE TABLE IF NOT EXISTS widget_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      sender_type TEXT NOT NULL,
      text TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_widget_messages_session ON widget_messages(session_id)`,
    `CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_telegram_id TEXT NOT NULL,
      title TEXT DEFAULT 'New Chat',
      model TEXT NOT NULL DEFAULT 'gpt-4o',
      system_prompt TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_conv_owner ON ai_conversations(owner_telegram_id)`,
    `CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      model TEXT DEFAULT '',
      tokens_used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_msg_conv ON ai_messages(conversation_id)`,
    `CREATE TABLE IF NOT EXISTS ai_api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_telegram_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      api_key TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(owner_telegram_id, provider)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_ai_keys_owner ON ai_api_keys(owner_telegram_id)`,
    `ALTER TABLE widget_configs ADD COLUMN ai_enabled INTEGER DEFAULT 0`,
    `ALTER TABLE widget_configs ADD COLUMN ai_provider TEXT DEFAULT 'openai'`,
    `ALTER TABLE widget_configs ADD COLUMN ai_model TEXT DEFAULT 'gpt-4o-mini'`,
    `ALTER TABLE widget_configs ADD COLUMN ai_system_prompt TEXT DEFAULT 'You are a helpful customer support assistant. Be concise, friendly, and professional. Answer questions about the website and help visitors.'`,

    `ALTER TABLE phishing_links ADD COLUMN view_count INTEGER DEFAULT 0`,
    `ALTER TABLE phishing_links ADD COLUMN template TEXT DEFAULT 'security'`,
    `ALTER TABLE phishing_captures ADD COLUMN device_info TEXT`,

    `ALTER TABLE widget_configs ADD COLUMN ai_training_urls TEXT DEFAULT '[]'`,
    `ALTER TABLE widget_configs ADD COLUMN ai_training_data TEXT DEFAULT ''`,

    `ALTER TABLE widget_configs ADD COLUMN avatar_id INTEGER DEFAULT 0`,
    `ALTER TABLE widget_configs ADD COLUMN cal_link TEXT DEFAULT ''`,

    `CREATE TABLE IF NOT EXISTS forwarded_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      forwarded_msg_id INTEGER NOT NULL,
      user_telegram_id TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_fwd_msg_id ON forwarded_messages(forwarded_msg_id)`,

    `ALTER TABLE widget_sessions ADD COLUMN device_token TEXT DEFAULT NULL`,

    `CREATE TABLE IF NOT EXISTS widget_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'free',
      stars_paid INTEGER DEFAULT 0,
      expires_at TEXT,
      status TEXT DEFAULT 'active',
      track_id TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_widget_subs_tg ON widget_subscriptions(telegram_id)`,

    `CREATE TABLE IF NOT EXISTS widget_plan_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL,
      plan TEXT NOT NULL,
      order_id TEXT UNIQUE,
      track_id TEXT UNIQUE,
      amount_usd REAL DEFAULT 0,
      pay_currency TEXT,
      pay_amount REAL DEFAULT 0,
      address TEXT,
      status TEXT DEFAULT 'pending',
      credited INTEGER DEFAULT 0,
      qr_code TEXT,
      expired_at INTEGER,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_wplan_pay_tg ON widget_plan_payments(telegram_id)`,

    `CREATE TABLE IF NOT EXISTS widget_boosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL,
      boost_type TEXT NOT NULL,
      amount INTEGER NOT NULL DEFAULT 0,
      payment_method TEXT DEFAULT 'stars',
      track_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_widget_boosts_tg ON widget_boosts(telegram_id)`,
    `ALTER TABLE widget_boosts ADD COLUMN expires_at TEXT DEFAULT NULL`,

    `ALTER TABLE widget_messages ADD COLUMN read_at TEXT DEFAULT NULL`,

    `ALTER TABLE widget_sessions ADD COLUMN rating INTEGER DEFAULT NULL`,
    `ALTER TABLE widget_sessions ADD COLUMN feedback TEXT DEFAULT NULL`,

    `CREATE TABLE IF NOT EXISTS widget_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      session_key TEXT NOT NULL,
      reactor_type TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_widget_reactions_msg ON widget_reactions(message_id)`,

    `CREATE TABLE IF NOT EXISTS widget_collaborators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      widget_key TEXT NOT NULL,
      telegram_id TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'agent',
      invited_by TEXT NOT NULL,
      invite_code TEXT UNIQUE,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_widget_collab_wk ON widget_collaborators(widget_key)`,
    `CREATE INDEX IF NOT EXISTS idx_widget_collab_tg ON widget_collaborators(telegram_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_widget_collab_unique ON widget_collaborators(widget_key, telegram_id)`,

    `CREATE TABLE IF NOT EXISTS premium_teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_telegram_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT 'My Team',
      invite_code TEXT UNIQUE NOT NULL,
      max_members INTEGER DEFAULT 3,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pteam_owner ON premium_teams(owner_telegram_id)`,

    `CREATE TABLE IF NOT EXISTS premium_team_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team_id INTEGER NOT NULL,
      telegram_id TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_pteam_member_tid ON premium_team_members(telegram_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_pteam_member_unique ON premium_team_members(team_id, telegram_id)`,

    `CREATE TABLE IF NOT EXISTS app_notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      button_text TEXT DEFAULT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `ALTER TABLE app_notices ADD COLUMN button_text TEXT DEFAULT NULL`,
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
