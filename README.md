# Lifegram Bot v2.3.1 — Full-Stack Telegram Bot Platform

**Bot:** [@lifegrambot](https://t.me/lifegrambot)  
**Mini App:** https://mini.susagar.sbs/miniapp/  
**API:** https://mini.susagar.sbs/api  
**Privacy:** https://mini.susagar.sbs/api/privacy

A production-grade Telegram bot with a full admin dashboard, video streaming, crypto donations, Telegram Stars payments, premium subscriptions, group management, anti-spam, analytics, and a Telegram Mini App — all running on a **Cloudflare Worker** with **Hono**, **D1** (SQLite), and **R2** (object storage).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Features](#features)
3. [Telegram Mini App SDK](#telegram-mini-app-sdk)
4. [Premium Features](#premium-features)
5. [Moderation System](#moderation-system)
6. [Prerequisites](#prerequisites)
7. [Environment Variables / Secrets](#environment-variables--secrets)
8. [Cloudflare Setup (D1 + R2)](#cloudflare-setup-d1--r2)
9. [Telegram Setup](#telegram-setup)
10. [Local Development](#local-development)
11. [Deployment](#deployment)
12. [CI/CD — GitHub Auto-Deploy](#cicd--github-auto-deploy)
13. [Changing Secrets](#changing-secrets)
14. [Database Schema](#database-schema)
15. [API Reference](#api-reference)
16. [Bot Commands](#bot-commands)
17. [Timezone](#timezone)
18. [Privacy Policy](#privacy-policy)
19. [Troubleshooting](#troubleshooting)

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
        (SQLite DB)     (media files)   (file proxy + video)
              │                               │
              ▼                               ▼
        Cloudflare Pages              MTProto Backend (Koyeb)
        (Mini App React)              (GramJS user sessions)
```

| Component | Tech | Location |
|---|---|---|
| **API Server** | Cloudflare Worker + Hono | `artifacts/api-server` |
| **Mini App** | React + Vite + Tailwind | `artifacts/miniapp` |
| **MTProto Backend** | Node.js + GramJS + Express (Koyeb) | `artifacts/mtproto-backend` |
| **Database** | Cloudflare D1 (SQLite) | Bound in `wrangler.toml` |
| **Object Storage** | Cloudflare R2 | Bound in `wrangler.toml` |
| **Media Proxy** | Bot API file proxy | `/api/file/:fileId` |

---

## Features

| Category | What it does |
|---|---|
| **Admin Inbox** | Every user message is forwarded to admin DM; admin replies are delivered back to the user |
| **Media Proxy** | Photos, videos, voice, documents served via `/api/file/:fileId` (Bot API proxy, up to 20MB) — no R2 upload needed |
| **Broadcast** | Scheduled and instant broadcasts to all users |
| **Video Streaming** | Premium-only: MTProto-based video delivery with 24-hour stream/download links |
| **Crypto Donations** | OxaPay integration (USDT/TRX/BTC/ETH/LTC and more) with static and dynamic addresses |
| **Telegram Stars** | Built-in invoice flow with `createInvoiceLink` / `answerPreCheckoutQuery` |
| **Premium Subscriptions** | 250 Stars/month recurring (native `subscription_period`) unlocks video streaming, tag all, ban all |
| **Group Management** | Tag-all, ban-all, silent ban, member tracking, welcome messages, ownership-based permissions |
| **Anti-Spam** | Rate limiting, keyword blocking, link whitelist, automatic warnings |
| **Moderation** | Warn / restrict / ban (bot/app/global scope) with escalation and audit log |
| **Analytics** | Per-user message counts, command stats, global stats |
| **Location Sharing** | Users can share GPS location from Mini App chat (Google Maps link) |
| **Optimistic UI** | Messages appear instantly before server confirms, with rollback on error |
| **Fullscreen Mode** | Mini App auto-enters fullscreen with safe area handling |
| **Deletion Requests** | GDPR-style user data deletion workflow |
| **Privacy Policy** | Comprehensive policy served at `/api/privacy` |
| **Cookie Consent** | IP/device metadata collection with consent tracking |

---

## Telegram Mini App SDK

The Mini App integrates extensively with the [Telegram Web App API](https://core.telegram.org/bots/webapps). All SDK features are exposed via the `useTelegram()` React hook from `telegram-context.tsx`.

### Integrated Features

| Feature | SDK Method | Description |
|---|---|---|
| **Fullscreen** | `requestFullscreen` / `exitFullscreen` | Auto-requested on init; safe area CSS vars updated |
| **Back Button** | `showBackButton` / `hideBackButton` | Native back button with custom callback |
| **Closing Confirmation** | `enableClosingConfirmation` / `disableClosingConfirmation` | Prevents accidental close |
| **Add to Home** | `addToHomeScreen` | Prompts user to add Mini App to device home screen |
| **Write Access** | `requestWriteAccess` | Requests permission for bot to send messages (notifications) |
| **Share** | `shareText` | Opens native Telegram share dialog |
| **Haptic Feedback** | `haptic("light" \| "medium" \| "heavy")` | Vibration feedback on tap |
| **Popup / Alert / Confirm** | `showPopup` / `showAlert` / `showConfirm` | Native Telegram dialogs |
| **QR Scanner** | `showScanQrPopup` / `closeScanQrPopup` | Native QR code scanner |
| **Clipboard** | `readClipboard` | Read text from device clipboard |
| **External Links** | `openLink` / `openTelegramLink` | Open URLs in browser or Telegram |
| **Invoice** | `openInvoice` | Open Telegram payment invoice |
| **Inline Query** | `switchInlineQuery` | Switch to inline mode with pre-filled query |
| **Cloud Storage** | `cloudStorageSet` / `cloudStorageGet` / `cloudStorageRemove` | Persistent key-value storage |
| **Theme** | `themeParams` / `colorScheme` | React to theme changes, CSS vars auto-applied |
| **Platform Info** | `platform` / `version` | Device platform and API version |
| **Viewport** | Auto-managed | `--app-height`, `--safe-top/bottom`, `--content-safe-top/bottom` CSS vars |
| **Vertical Swipes** | Auto-disabled | Prevents accidental close by swiping down |
| **Header/Bottom Bar** | Auto-configured | Colors set to match theme |

### Usage Example

```tsx
import { useTelegram } from "@/lib/telegram-context";

function MyComponent() {
  const {
    haptic, showConfirm, openLink, showBackButton,
    cloudStorageSet, cloudStorageGet, showScanQrPopup,
  } = useTelegram();

  const handleAction = () => {
    haptic("medium");
    showConfirm("Are you sure?", (ok) => {
      if (ok) { /* proceed */ }
    });
  };
}
```

---

## Premium Features

Premium is a 30-day recurring subscription purchased with 250 Telegram Stars (~$5 USD) using native `subscription_period`. It unlocks:

| Feature | Description |
|---|---|
| **Video Streaming** | Send a video to the bot and get a 24-hour web player link + download link |
| **Tag All** | Mention every tracked member in a managed Telegram group via the Mini App |
| **Ban All** | Ban all tracked members in a managed Telegram group via the Mini App |
| **Silent Ban** | Ban users without notification in managed groups |

The admin (`ADMIN_ID`) always has full access to all features regardless of premium status.

### How it works

1. User opens the Mini App → navigates to the Premium section
2. Taps "Get Premium" → Telegram Stars payment invoice is created with `subscription_period: 2592000` (30 days)
3. User pays → `successful_payment` webhook fires → subscription recorded in D1
4. Telegram handles recurring billing natively — no manual renewal needed

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
| pnpm | 9+ | `npm i -g pnpm` |
| Cloudflare account | Free tier works | For D1, R2, Workers, Pages |
| Wrangler CLI | 4.x | `pnpm add -g wrangler` |
| Telegram Bot Token | — | From @BotFather |
| OxaPay account | — | For crypto donations |

---

## Environment Variables / Secrets

### Cloudflare Worker Secrets

Set via `wrangler secret put <NAME>`:

| Secret | Description |
|---|---|
| `BOT_TOKEN` | Telegram bot token from @BotFather |
| `ADMIN_ID` | Your Telegram user ID (numeric) |
| `OXAPAY_MERCHANT_KEY` | OxaPay merchant API key |
| `R2_PUBLIC_URL` | Public URL for the R2 bucket |
| `TELEGRAM_API_ID` | From https://my.telegram.org |
| `TELEGRAM_API_HASH` | From https://my.telegram.org |
| `MTPROTO_BACKEND_URL` | URL of the MTProto backend (e.g. `https://your-service.koyeb.app`) |
| `MTPROTO_API_KEY` | API key for authenticating with the MTProto backend |

**Secrets are live immediately after update.** When you run `wrangler secret put`, the old value is replaced instantly — the next Worker invocation uses the new value. No redeployment needed.

### Cloudflare Worker Vars (in `wrangler.toml`)

| Variable | Description |
|---|---|
| `NODE_ENV` | `production` |
| `APP_DOMAIN` | `mini.susagar.sbs` |
| `MINIAPP_URL` | `https://lifegram-miniapp.pages.dev/` |

### Koyeb Environment (MTProto Backend)

| Variable | Description |
|---|---|
| `MTPROTO_API_KEY` | Same key used in the Worker's `MTPROTO_API_KEY` — must match |

### wrangler.toml Bindings

```toml
[[d1_databases]]
binding = "DB"
database_name = "lifegram"
database_id = "your-database-id"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "your-bucket-name"
```

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
PORT=3000 BASE_PATH=/miniapp/ pnpm --filter @workspace/miniapp run dev

# 4. In another terminal — start MTProto backend
pnpm --filter @workspace/mtproto-backend run dev
```

---

## Deployment

### Deploy the Worker (API Server)

```bash
cd artifacts/api-server
CLOUDFLARE_API_TOKEN="your-workers-deploy-token" npx wrangler deploy
```

### Deploy the Mini App (Cloudflare Pages)

```bash
# Build
cd artifacts/miniapp
PORT=3000 BASE_PATH=/ VITE_API_URL=https://mini.susagar.sbs/api NODE_ENV=production pnpm run build

# Deploy to Pages
CLOUDFLARE_API_TOKEN="your-workers-deploy-token" npx wrangler pages deploy dist/public \
  --project-name lifegram-miniapp \
  --commit-dirty true
```

The Worker proxies `/miniapp/*` requests to the Pages deployment.

### Deploy the MTProto Backend (Koyeb)

The MTProto backend is a standalone Node.js + Express server deployed on **Koyeb** via Docker.

#### Koyeb Setup

1. Create a new **Web Service** on [app.koyeb.com](https://app.koyeb.com)
2. Select **GitHub** → connect your repo (`Areszyn/Telegram`)
3. Select **Dockerfile** builder:
   - **Dockerfile location**: `Dockerfile`
   - **Work directory**: `artifacts/mtproto-backend`
4. Configure **Ports**: `3003` / HTTP, Public HTTPS access path: `/`
5. Configure **Health checks**: Port `3003`, Protocol `HTTP`, Path `/health`
6. Add **Environment Variable**:

| Variable | Value |
|---|---|
| `MTPROTO_API_KEY` | Same key set in the Cloudflare Worker |

7. Deploy — Koyeb builds the Docker image and starts the service
8. Copy the Koyeb URL (e.g. `https://your-service.koyeb.app`)
9. Set it in the Cloudflare Worker:

```bash
wrangler secret put MTPROTO_BACKEND_URL
# Paste: https://your-service.koyeb.app
```

The API server will now route MTProto requests to your Koyeb backend.

> **Note:** Koyeb's free tier uses autoscaling (0-1 instances) — the service scales down when idle and spins up on requests. First request after idle may take a few seconds.

---

## CI/CD — GitHub Auto-Deploy

Two GitHub Actions workflows are included for automatic deployment when you push to `main`:

### `.github/workflows/deploy-worker.yml`

Triggers on changes to `artifacts/api-server/**` or `lib/**`. Runs `wrangler deploy`.

### `.github/workflows/deploy-miniapp.yml`

Triggers on changes to `artifacts/miniapp/**` or `lib/**`. Builds the Mini App and deploys to Cloudflare Pages.

### Setup

1. Connect your GitHub repo to Cloudflare Pages (optional — the GitHub Action handles deployment)
2. Add these secrets in GitHub repo → **Settings** → **Secrets and variables** → **Actions**:

| GitHub Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers/Pages deploy permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |

3. Push to `main` — both workflows trigger automatically on relevant file changes
4. You can also trigger manually via **Actions** → **Run workflow**

---

## Changing Secrets

### Cloudflare Worker Secrets (BOT_TOKEN, MTPROTO_BACKEND_URL, etc.)

```bash
# Update a secret — the old value is immediately replaced
wrangler secret put BOT_TOKEN
# Enter the new value when prompted

wrangler secret put MTPROTO_BACKEND_URL
# Enter the new URL when prompted

wrangler secret put MTPROTO_API_KEY
# Enter the new API key when prompted
```

**No redeployment is required.** Cloudflare Workers pick up secret changes immediately on the next request. The old value is permanently discarded and only the new value is used.

### MTProto Backend Secrets (Koyeb)

Update environment variables in Koyeb Dashboard → Service → Settings → Environment. The backend will use new values after the next redeploy.

### Important: Keep in Sync

If you change `MTPROTO_API_KEY` in the Cloudflare Worker, you **must** also update it in the MTProto backend (Koyeb) — both sides must use the same key for authentication.

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
| `group_chats` | Telegram groups where bot is a member/admin (`added_by` tracks ownership) |
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
| GET | `/file/:fileId` | Media file proxy (Bot API, up to 20MB) |
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
| GET | `/premium/groups` | List bot-managed groups (filtered by ownership) |
| POST | `/premium/tag-all` | Tag all members in a group (Premium) |
| POST | `/premium/ban-all` | Ban all members in a group (Premium) |
| POST | `/premium/silent-ban` | Silent ban in a group (Premium) |
| GET | `/messages/my` | User's own message history |
| POST | `/messages/send` | Send message to admin |
| GET | `/user/profile` | Get own profile |
| POST | `/user/device-info` | Submit device metadata |
| POST | `/user/deletion-request` | Submit data deletion request |
| GET | `/user/deletion-request` | Check deletion request status |

### Admin Routes (require admin `X-Init-Data`)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/videos` | List active video tokens |
| DELETE | `/admin/videos/:uid` | Revoke a video token |
| GET | `/donations/admin/all` | All donations |
| GET | `/donations/admin/static-addresses` | All static addresses |
| POST | `/donations/admin/verify` | Verify payment via OxaPay |
| GET | `/messages/chat/:id` | Chat history with a user |
| POST | `/messages/admin/send` | Send message to user |
| GET | `/moderation/status/:id` | User moderation status |
| GET | `/admin/users` | List all users |
| GET | `/admin/stats` | Global statistics |

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
| `/banall <chat_id>` | Ban all members in a group |
| `/silentban <chat_id> <user_id>` | Silently ban a user in a group |
| `/broadcast <text>` | Send message to all users |
| `/help` | List all admin commands |

### Natural Language Triggers

The bot responds to keywords like "price", "help", "support", "contact" with relevant info and Mini App links.

---

## Timezone

All dates and times in the Mini App are displayed in **Asia/Kolkata (IST, UTC+5:30)** timezone.

The timezone utility is centralized in `artifacts/miniapp/src/lib/date.ts` and provides:

| Function | Output Example |
|---|---|
| `formatTimeIST(date)` | `14:30` |
| `formatDateTimeIST(date)` | `Mar 23, 2026 · 14:30` |
| `formatDateIST(date)` | `Mar 23, 2026` |
| `formatShortIST(date)` | `Mar 23 · 14:30` |
| `toLocaleIST(date)` | Full locale string in IST |
| `relativeTime(date)` | `2 hours ago` |

---

## Privacy Policy

A comprehensive privacy policy covering 30 sections is served at [`/api/privacy`](https://mini.susagar.sbs/api/privacy).

Key highlights:
- **v2.0** — last updated 2026-03-23
- Covers: data collection, GDPR legal basis, retention, security, third-party services, international transfers, cookies, MTProto sessions, video streaming, group management, payments, user rights, acceptable use, refunds
- **Location data**: Only collected when user voluntarily shares via the chat location button; stored as a Google Maps link text, not raw GPS coordinates
- **Media proxy**: Files are streamed from Telegram servers on-demand via Bot API; only `file_id` references are stored, not the files themselves
- **Data deletion**: Users can request deletion via the in-app form; admin reviews within 30 days
- Contact: support@areszyn.org

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
| Media not loading | Ensure the bot has access to the file — files over 20MB need MTProto streaming |
| Secret changes not taking effect | Cloudflare secrets are instant — clear browser cache or wait for next request |
| MTProto auth failing | Ensure `MTPROTO_API_KEY` matches between Worker and Replit backend |
| GitHub Actions failing | Check `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets are set in GitHub repo |
| Times showing wrong timezone | All dates use Asia/Kolkata (IST) — see `lib/date.ts` |
