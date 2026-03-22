# Lifegram Bot — Full-Stack Telegram Bot Platform

**Bot:** [@lifegrambot](https://t.me/lifegrambot)  
**Mini App:** https://mini.susagar.sbs/miniapp/  
**API:** https://mini.susagar.sbs/api  
**Privacy:** https://mini.susagar.sbs/api/privacy

A production-grade Telegram bot with a full admin dashboard, video streaming, crypto donations, Telegram Stars payments, premium subscriptions, group management, anti-spam, analytics, and a Telegram Mini App — all running on a **Cloudflare Worker** with **Hono**, **D1** (SQLite), and **R2** (object storage).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Features](#features)
3. [Premium Features](#premium-features)
4. [Moderation System](#moderation-system)
5. [Prerequisites](#prerequisites)
6. [Environment Variables / Secrets](#environment-variables--secrets)
7. [Cloudflare Setup (D1 + R2)](#cloudflare-setup-d1--r2)
8. [Telegram Setup](#telegram-setup)
9. [Local Development](#local-development)
10. [Deployment](#deployment)
11. [Database Schema](#database-schema)
12. [API Reference](#api-reference)
13. [Bot Commands](#bot-commands)
14. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
Telegram Users / Bot
        │
        ▼
  Telegram Webhook ──► Cloudflare Worker (Hono + TypeScript)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        Cloudflare D1   Cloudflare R2   Telegram Bot API
        (SQLite DB)     (media files)   (video streaming)
              │
              ▼
        Cloudflare Pages (Mini App)
        proxied at /miniapp/*
```

- **`artifacts/api-server`** — Cloudflare Worker (Hono framework) handling all API routes, Telegram webhook, and proxying the Mini App
- **`artifacts/miniapp`** — Telegram Mini App (React + Vite), deployed to Cloudflare Pages, proxied by the Worker at `/miniapp/*`
- **Cloudflare D1** — primary persistent store (users, donations, moderation, premium subscriptions, video tokens, etc.)
- **Cloudflare R2** — stores uploaded media and static assets
- **Video streaming** — files streamed directly from Telegram's servers via Bot API (no FFmpeg needed)

---

## Features

| Category | What it does |
|---|---|
| **Admin Inbox** | Every user message is forwarded to admin DM; admin replies are delivered back to the user |
| **Broadcast** | Scheduled and instant broadcasts to all users |
| **Video Streaming** | Premium-only: 24-hour stream/download links with web video player |
| **Crypto Donations** | OxaPay integration (USDT/TRX/BTC/ETH/LTC and more) with static and dynamic addresses |
| **Telegram Stars** | Built-in invoice flow with `createInvoiceLink` / `answerPreCheckoutQuery` |
| **Premium Subscriptions** | 250 Stars (~$5/month) unlocks video streaming, tag all, ban all |
| **Group Management** | Tag-all, ban-all, member tracking, welcome messages |
| **Anti-Spam** | Rate limiting, keyword blocking, link whitelist, automatic warnings |
| **Moderation** | Warn / restrict / ban (bot/app/global scope) with escalation and audit log |
| **Analytics** | Per-user message counts, command stats, global stats |
| **Deletion Requests** | GDPR-style user data deletion workflow |
| **Privacy Policy** | Comprehensive policy served at `/api/privacy` |
| **Cookie Consent** | IP/device metadata collection with consent tracking |

---

## Premium Features

Premium is a 30-day subscription purchased with 250 Telegram Stars (~$5 USD). It unlocks:

| Feature | Description |
|---|---|
| **Video Streaming** | Send a video to the bot and get a 24-hour web player link + download link. Non-premium users have their videos forwarded to the admin as normal messages. |
| **Tag All** | Mention every tracked member in a managed Telegram group via the Mini App |
| **Ban All** | Ban all tracked members in a managed Telegram group via the Mini App |

The admin (`ADMIN_ID`) always has full access to all features regardless of premium status.

### How it works

1. User opens the Mini App → navigates to the Premium section
2. Taps "Get Premium" → Telegram Stars payment invoice is created
3. User pays → `successful_payment` webhook fires → subscription recorded in D1
4. For 30 days, the user can use all premium features

Subscriptions do **not** auto-renew. The user must purchase again after expiry.

---

## Moderation System

### Scopes

Moderation actions can target specific scopes:
- **`bot`** — restricts access to the Telegram bot
- **`app`** — restricts access to the Mini App
- **`global`** — restricts access to both

### Automated Escalation

| Warning Count | Action |
|---|---|
| 1st warning | Status changed to `warned` |
| 2nd warning | Status changed to `restricted`, 24-hour ban applied |
| 3rd warning | Automatic 7-day global ban |

### Triggers

- **Rate limiting** — 5 messages per 10 seconds (configurable); exceeding triggers a system warning
- **Keyword blocking** — messages matching blocked keywords are rejected and the user is warned
- **Link protection** — messages with URLs are blocked unless the user is whitelisted

### Admin Commands (reply to forwarded message)

| Command | Action |
|---|---|
| `!ban [bot\|app\|global] [reason]` | Ban user in specified scope |
| `!warn [reason]` | Issue a warning (triggers escalation) |
| `!restrict [reason]` | Restrict user access |
| `!unban` | Remove all bans |

---

## Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 20 LTS | Use `nvm install 20` |
| pnpm | 8+ | `npm i -g pnpm` |
| Cloudflare account | Free tier works | For D1, R2, Workers, Pages |
| Wrangler CLI | 3.x | `pnpm add -g wrangler` |
| Telegram Bot Token | — | From @BotFather |
| OxaPay account | — | For crypto donations |

---

## Environment Variables / Secrets

These are set as **Cloudflare Worker secrets** via `wrangler secret put`:

```bash
wrangler secret put BOT_TOKEN          # @BotFather token
wrangler secret put ADMIN_ID           # Your Telegram user ID
wrangler secret put OXAPAY_MERCHANT_KEY # OxaPay merchant API key
wrangler secret put R2_PUBLIC_URL      # Public URL for R2 bucket
wrangler secret put TELEGRAM_API_ID    # From https://my.telegram.org
wrangler secret put TELEGRAM_API_HASH  # From https://my.telegram.org
```

The following are configured in `wrangler.toml` as bindings:
- **D1 database** (`DB`) — bound by name in wrangler.toml
- **R2 bucket** (`BUCKET`) — bound by name in wrangler.toml
- **NODE_ENV** — set as a var in wrangler.toml

---

## Cloudflare Setup (D1 + R2)

### D1 Database

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **D1**
2. Click **Create database** → name it (e.g. `lifegram`)
3. Copy the **Database ID** for `wrangler.toml`
4. The schema is applied automatically on first request via `initSchema()`

### R2 Bucket

1. **Cloudflare Dashboard** → **R2** → **Create Bucket**
2. Name your bucket (e.g. `waspros`)
3. **Settings** → **Public Access** → Enable public access
4. Copy the public URL → set as `R2_PUBLIC_URL` secret

### wrangler.toml

```toml
name = "lifegram-api"
main = "src/index.ts"
compatibility_date = "2025-03-14"

[vars]
NODE_ENV = "production"

[[d1_databases]]
binding = "DB"
database_name = "lifegram"
database_id = "your-database-id"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "your-bucket-name"

[triggers]
crons = ["*/2 * * * *"]

[[routes]]
pattern = "mini.susagar.sbs/api/*"
zone_name = "susagar.sbs"

[[routes]]
pattern = "mini.susagar.sbs/miniapp/*"
zone_name = "susagar.sbs"

[[routes]]
pattern = "mini.susagar.sbs/miniapp"
zone_name = "susagar.sbs"
```

---

## Telegram Setup

### Create the Bot

```
/newbot          → Choose a name
/setdescription  → Set a description
/setuserpic      → Set a profile photo
/setcommands     → Paste the commands list below
```

#### Recommended Bot Commands

```
start - Welcome message & main menu
help - Help & support
donate - Support with crypto or Stars
premium - Get Premium access
privacy - Privacy policy
```

### Set the Webhook

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://mini.susagar.sbs/api/webhook" \
  -d "allowed_updates=[\"message\",\"callback_query\",\"pre_checkout_query\",\"chat_member\",\"my_chat_member\"]" \
  -d "drop_pending_updates=true"
```

### Enable the Mini App

```
/newapp → Select your bot → set the URL to https://mini.susagar.sbs/miniapp/
```

---

## Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Start API server (wrangler dev)
pnpm --filter @workspace/api-server run dev

# 3. In another terminal — start Mini App
pnpm --filter @workspace/miniapp run dev
```

---

## Deployment

### Deploy the Worker

```bash
cd artifacts/api-server
CLOUDFLARE_API_TOKEN="your-token" pnpm exec wrangler deploy
```

### Deploy the Mini App (Cloudflare Pages)

```bash
# Build
cd artifacts/miniapp
BASE_PATH=/miniapp/ PORT=3000 NODE_ENV=production pnpm run build

# Deploy to Pages
cd ../api-server
CLOUDFLARE_API_TOKEN="your-token" pnpm exec wrangler pages deploy \
  ../miniapp/dist/public \
  --project-name lifegram-miniapp \
  --branch main \
  --commit-dirty=true
```

The Worker proxies `/miniapp/*` requests to the Pages deployment.

---

## Database Schema

All tables are created automatically on first request. Key tables:

| Table | Purpose |
|---|---|
| `users` | Telegram user profiles, message counts, activity |
| `messages` | Message history (user ↔ admin) with media metadata |
| `donations` | Crypto and Stars payment records |
| `static_addresses` | Persistent crypto deposit addresses |
| `moderation` | User ban/warn/restrict status |
| `moderation_logs` | Audit trail of all moderation actions |
| `group_chats` | Telegram groups where bot is a member/admin |
| `group_members` | Group membership tracking |
| `user_sessions` | MTProto session strings for user-client operations |
| `premium_subscriptions` | Active premium subscriptions with expiry |
| `blocked_keywords` | Blocked words for spam filtering |
| `link_whitelist` | Users allowed to send links |
| `scheduled_broadcasts` | Queued broadcast messages |
| `video_tokens` | Active video stream tokens |
| `user_metadata` | IP, user-agent, cookie consent |
| `deletion_requests` | GDPR data deletion requests |
| `rate_limit_windows` | Rate limiting state |

---

## API Reference

### Public Routes

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/privacy` | Privacy policy page |
| POST | `/webhook` | Telegram webhook handler |
| GET | `/watch/:token` | Video player page (24h expiry) |
| GET | `/stream/:token` | Video stream (24h expiry) |
| GET | `/download/:token` | Video download (24h expiry) |
| POST | `/donate/callback` | OxaPay payment callback |
| GET | `/miniapp/*` | Proxied Mini App |

### Authenticated Routes (require `X-Init-Data` header)

| Method | Path | Description |
|---|---|---|
| GET | `/donations/currencies` | List supported crypto currencies |
| POST | `/donations/create` | Create crypto payment invoice |
| GET | `/donations/status/:trackId` | Check payment status |
| POST | `/donations/stars/create` | Create Telegram Stars invoice |
| GET | `/donations/history` | User's donation history |
| POST | `/donations/static-address` | Generate static crypto address |
| GET | `/donations/static-addresses` | List user's static addresses |
| DELETE | `/donations/static-address` | Revoke static address |
| GET | `/premium/status` | Check premium subscription status |
| POST | `/premium/create` | Create premium subscription invoice |
| GET | `/premium/groups` | List bot-managed groups |
| POST | `/premium/tag-all` | Tag all members in a group (Premium) |
| POST | `/premium/ban-all` | Ban all members in a group (Premium) |

### Admin Routes (require admin `X-Init-Data`)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/videos` | List active video tokens |
| DELETE | `/admin/videos/:uid` | Revoke a video token |
| GET | `/donations/admin/all` | All donations |
| GET | `/donations/admin/static-addresses` | All static addresses |
| POST | `/donations/admin/verify` | Verify payment via OxaPay |
| GET | `/messages/chat/:id` | Chat history with a user |
| GET | `/moderation/status/:id` | User moderation status |

---

## Bot Commands

### User Commands

| Command | Description |
|---|---|
| `/start` | Welcome message with feature list |
| `/help` | Help menu |
| `/donate` | Donation options |
| `/premium` | Premium subscription info |
| `/history` | View donation history |

### Admin Commands

| Command | Description |
|---|---|
| `/start` | Admin panel activation message |
| `/stats` | Global statistics (users, messages, donations) |
| `/keyword <word>` | Add a blocked keyword |
| `/whitelist <id>` | Whitelist a user for link sending |
| `/schedule <msg>\|<date>` | Schedule a broadcast |
| `/tagall <chat_id>` | Tag all members in a group |
| `/broadcast <text>` | Send message to all users |
| `/help` | List all admin commands |

### Natural Language Triggers

The bot responds to keywords like "price", "help", "support", "contact" with relevant info and Mini App links.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| Mini App shows blank | Check that the Worker is deployed and `/miniapp/*` route is active |
| "Internal Server Error" on video | Video token may be expired (24h TTL) — request a new link |
| Bot not responding | Verify webhook is set correctly: `GET /bot<TOKEN>/getWebhookInfo` |
| Payments not updating | Check OxaPay callback URL matches: `https://mini.susagar.sbs/api/donate/callback` |
| Premium not activating | Verify `successful_payment` webhook is reaching the Worker |
| Cloudflare challenge in WebView | Disable Bot Fight Mode in Cloudflare Security → Bots |
| D1 errors | Check wrangler.toml database_id matches your D1 database |
