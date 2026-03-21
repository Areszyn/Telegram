# Lifegram Bot — Full-Stack Telegram Bot Platform

**Bot:** [@lifegrambot](https://t.me/lifegrambot)  
**Mini App:** https://mini.susagar.sbs/miniapp/  
**API:** https://mini.susagar.sbs/api

A production-grade Telegram bot with a full admin dashboard, HLS video streaming, crypto donations, Telegram Stars payments, premium subscriptions, group management, anti-spam, analytics, MTProto-based large-file handling, and a Telegram Mini App — all backed by **Cloudflare D1** (SQLite) and **Cloudflare R2** (object storage).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Features](#features)
3. [Prerequisites](#prerequisites)
4. [Environment Variables](#environment-variables)
5. [Cloudflare Setup (D1 + R2)](#cloudflare-setup-d1--r2)
6. [Telegram Setup](#telegram-setup)
7. [MTProto Session Setup](#mtproto-session-setup)
8. [Local Development](#local-development)
9. [Deploy to VPS (Ubuntu/Debian)](#deploy-to-vps-ubuntudebian)
10. [Deploy to Railway](#deploy-to-railway)
11. [Deploy to Render](#deploy-to-render)
12. [Deploy to Koyeb](#deploy-to-koyeb)
13. [Post-Deploy Checklist](#post-deploy-checklist)
14. [Database Schema](#database-schema)
15. [API Reference](#api-reference)
16. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
Telegram Users / Bot
        │
        ▼
  Telegram Webhook  ──►  API Server (Express + TypeScript)
                              │
              ┌───────────────┼───────────────────┐
              ▼               ▼                   ▼
        Cloudflare D1   Cloudflare R2      /tmp (HLS segments)
        (SQLite DB)     (media / files)    (short-lived streams)
              │
              ▼
        MTProto Client (GramJS)
        [large-file download + forward]
```

- **`artifacts/api-server`** — Express API + Telegram bot webhook logic (TypeScript)
- **`artifacts/miniapp`** — Telegram Mini App (React + Vite)
- Cloudflare D1 is the primary persistent store (users, donations, moderation, etc.)
- Cloudflare R2 stores uploaded media and static assets
- HLS video streams are generated on disk via FFmpeg and served directly from the API server

---

## Features

| Category | What it does |
|---|---|
| **Admin Inbox** | Every user message is forwarded to admin DM; admin replies are delivered back to the user |
| **Broadcast** | Scheduled and instant broadcasts to all users or filtered segments |
| **Video Streaming** | HLS adaptive streaming (720p / 480p / 360p) via FFmpeg + hls.js watch page |
| **MTProto Downloads** | Bypasses 20 MB Bot API limit; downloads any size file directly via GramJS |
| **Crypto Donations** | OxaPay integration (USDT/TRX/BTC/ETH/LTC) with static and dynamic addresses |
| **Telegram Stars** | Built-in invoice flow with `sendInvoice` / `answerPreCheckoutQuery` |
| **Premium Subscriptions** | Tier-based access control stored in D1 |
| **Group Management** | Tag-all chunking, welcome messages, admin commands, member tracking |
| **Anti-Spam** | Rate limiting, keyword blocking, link whitelist, automatic mute/ban/kick |
| **Analytics** | Per-user message counts, command stats, global stats command |
| **Moderation** | Warn / mute / ban / kick with audit log in D1 |
| **Deletion Requests** | GDPR-style user data deletion workflow |
| **Privacy Policy** | Served at `/api/privacy` |
| **Cookie Consent** | Shown on the video watch page |
| **MTProto String Sessions** | Stored securely; user-client and bot-client separation |

---

## Prerequisites

| Tool | Minimum version | Notes |
|---|---|---|
| Node.js | 20 LTS | Use `nvm install 20` |
| pnpm | 8+ | `npm i -g pnpm` |
| FFmpeg | 6+ | Must have `libx264`, `libx265`, `aac` |
| ffprobe | (bundled with FFmpeg) | Used for height detection |
| Cloudflare account | Free tier works | For D1 + R2 |
| Telegram Bot Token | — | From @BotFather |
| MTProto API credentials | — | From https://my.telegram.org |
| OxaPay account | — | For crypto donations |

---

## Environment Variables

Create a `.env` file (or set these as secrets in your hosting platform):

```env
# ── Telegram ──────────────────────────────────────────────────────────────────
BOT_TOKEN=123456:ABC-DEF...          # @BotFather token
ADMIN_ID=2114237158                  # Your Telegram user ID (number, no quotes)

# ── Cloudflare D1 ─────────────────────────────────────────────────────────────
CLOUDFLARE_ACCOUNT_ID=abc123...      # Cloudflare account ID
CLOUDFLARE_API_TOKEN=eyJ...          # API token with D1 Edit permission
D1_DATABASE_ID=xxxxxxxx-xxxx-...     # Database UUID from Cloudflare dashboard

# ── Cloudflare R2 ─────────────────────────────────────────────────────────────
R2_ACCESS_KEY_ID=...                 # R2 access key
R2_SECRET_ACCESS_KEY=...             # R2 secret key
R2_BUCKET_NAME=your-bucket           # Bucket name
R2_PUBLIC_URL=https://your-bucket.r2.dev   # Public access URL for the bucket

# ── OxaPay ────────────────────────────────────────────────────────────────────
OXAPAY_MERCHANT_KEY=...              # OxaPay merchant API key

# ── MTProto (GramJS) ─────────────────────────────────────────────────────────
TELEGRAM_API_ID=12345678             # From https://my.telegram.org
TELEGRAM_API_HASH=abcdef1234...      # From https://my.telegram.org
# Optional — pre-generated string sessions (see MTProto Session Setup)
BOT_SESSION=...                      # Bot MTProto session string
USER_SESSION=...                     # User MTProto session string (for tag-all etc.)

# ── Runtime ───────────────────────────────────────────────────────────────────
PORT=8080                            # Port the API server listens on
NODE_ENV=production
```

---

## Cloudflare Setup (D1 + R2)

### D1 Database

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **D1**
2. Click **Create database** → give it any name (e.g. `lifegram`)
3. Copy the **Database ID** — this is your `D1_DATABASE_ID`
4. Go to **My Profile** → **API Tokens** → **Create Token**
   - Use the **"Edit Cloudflare Workers"** template, or manually add:
     - `D1:Edit` on your account
   - Copy the token → `CLOUDFLARE_API_TOKEN`
5. Your account ID is in the URL: `dash.cloudflare.com/{ACCOUNT_ID}/...`

The database schema is applied automatically on first boot via the API server's `initDb()` call. You can also run it manually:

```bash
# From the api-server directory
pnpm tsx src/lib/init-db.ts
```

### R2 Bucket

1. **Cloudflare Dashboard** → **R2** → **Create Bucket**
2. Name your bucket (e.g. `lifegram-media`)
3. **Settings** → **Public Access** → Enable public access (or use a custom domain)
4. Copy the public URL → `R2_PUBLIC_URL`
5. **Manage R2 API Tokens** → Create token with **Object Read & Write** on your bucket
6. Copy the **Access Key ID** and **Secret Access Key**

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
privacy - Privacy policy
delete_my_data - Request account deletion
subscription - View premium plans
stats - Your message statistics
```

### Set the Webhook

After deploying, run:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/api/webhook" \
  -d "allowed_updates=[\"message\",\"callback_query\",\"pre_checkout_query\",\"chat_member\",\"my_chat_member\"]" \
  -d "drop_pending_updates=true"
```

Verify it worked:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

### Enable the Mini App

```
/newapp          → Select your bot → set the URL to https://your-domain.com/miniapp/
```

---

## MTProto Session Setup

MTProto is needed for two things:
1. **Bot client** — downloading videos > 20 MB from Telegram for HLS conversion
2. **User client** — tag-all feature, reading group participants

### Generate Sessions

```bash
cd artifacts/api-server
pnpm tsx src/scripts/gen-session.ts
```

Follow the prompts. Paste the output strings into `BOT_SESSION` and `USER_SESSION` env vars. These are long base64 strings — keep them secret.

> If you don't have this script yet, you can generate a session with:
> ```js
> const { TelegramClient, StringSession } = require("telegram");
> const session = new StringSession("");
> const client = new TelegramClient(session, API_ID, API_HASH, {});
> await client.start({ botAuthToken: "BOT_TOKEN" });
> console.log(client.session.save());
> ```

---

## Local Development

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env file
cp artifacts/api-server/.env.example artifacts/api-server/.env
# Fill in all values

# 3. Start API server (hot-reload)
pnpm --filter @workspace/api-server run dev

# 4. In another terminal — start Mini App
pnpm --filter @workspace/miniapp run dev

# 5. Expose your local server with ngrok (for Telegram webhook)
ngrok http 8080

# 6. Register the webhook
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<ngrok-url>/webhook"
```

The API server will be at `http://localhost:8080` and the Mini App at `http://localhost:5173`.

---

## Deploy to VPS (Ubuntu/Debian)

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install FFmpeg (with libx264)
sudo apt install -y ffmpeg

# Verify
node -v && ffmpeg -version && pnpm -v
```

### 2. Clone and Build

```bash
git clone https://github.com/your/repo.git /opt/lifegram
cd /opt/lifegram

# Install dependencies
pnpm install

# Build API server
pnpm --filter @workspace/api-server run build

# Build Mini App
pnpm --filter @workspace/miniapp run build
```

### 3. Environment Variables

```bash
sudo nano /opt/lifegram/artifacts/api-server/.env
# Paste all your env vars, save
```

### 4. PM2 Process Manager

```bash
npm install -g pm2

# Start API server
pm2 start "node artifacts/api-server/dist/index.js" \
  --name lifegram-api \
  --cwd /opt/lifegram \
  --env production

# Save and enable autostart
pm2 save
pm2 startup
```

### 5. Nginx Reverse Proxy

```bash
sudo apt install -y nginx

sudo nano /etc/nginx/sites-available/lifegram
```

Paste:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Mini App static files
    location /miniapp/ {
        alias /opt/lifegram/artifacts/miniapp/dist/;
        try_files $uri $uri/ /miniapp/index.html;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:8080/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        # Large file downloads / HLS
        proxy_buffering off;
        proxy_read_timeout 300s;
        client_max_body_size 0;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/lifegram /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 6. SSL with Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
sudo systemctl enable --now certbot.timer
```

### 7. Register Webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/api/webhook&drop_pending_updates=true"
```

---

## Deploy to Railway

Railway gives you persistent disk, automatic HTTPS, and simple env var management.

### Steps

1. Push your code to GitHub

2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**

3. Select your repository

4. Railway auto-detects Node.js. Set the **Root Directory** to `artifacts/api-server`

5. **Settings** → **Build Command:**
   ```
   pnpm install && pnpm build
   ```
   **Start Command:**
   ```
   node dist/index.js
   ```

6. **Variables** → Add all env vars from the [Environment Variables](#environment-variables) section

7. **Settings** → **Networking** → **Generate Domain** — copy your domain

8. Add a **Volume** (for `/tmp` HLS segments):
   - **New** → **Volume** → Mount path: `/tmp`

9. Register the webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<railway-domain>/webhook"
   ```

> **Mini App on Railway:** Add a second service in the same project pointing to `artifacts/miniapp`, build with `pnpm build`, serve with `npx serve dist -s -l $PORT`.

---

## Deploy to Render

Render offers free-tier web services with automatic HTTPS.

### Steps

1. Push to GitHub

2. Go to [render.com](https://render.com) → **New** → **Web Service**

3. Connect your repo. Set:
   - **Root Directory:** `artifacts/api-server`
   - **Build Command:** `pnpm install && pnpm build`
   - **Start Command:** `node dist/index.js`
   - **Environment:** Node

4. **Environment Variables** → Add all vars

5. **Advanced** → add a **Disk**:
   - Name: `tmp-streams`
   - Mount path: `/tmp`
   - Size: 10 GB (free tier gives 1 GB)

6. Deploy. Copy the `onrender.com` URL.

7. Register the webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-app>.onrender.com/webhook"
   ```

> **Note:** Free Render instances spin down after 15 minutes of inactivity. Use a paid plan or keep-alive ping for production.

---

## Deploy to Koyeb

Koyeb runs containers globally with free HTTPS, no spin-down on the free tier.

### Steps

1. Push to GitHub

2. Go to [koyeb.com](https://koyeb.com) → **Create App**

3. Choose **GitHub** → select your repo

4. Set:
   - **Build command:** `pnpm install && pnpm build`
   - **Run command:** `node artifacts/api-server/dist/index.js`
   - **Port:** `8080`

5. **Environment Variables** → add all vars

6. Deploy. Wait for the health check to pass.

7. Copy your `koyeb.app` domain. Register the webhook:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<app>.koyeb.app/webhook"
   ```

> **Important:** Koyeb uses ephemeral storage. HLS `/tmp` files are lost on restart. For production, consider mounting a persistent volume or switching to R2-hosted HLS segments.

---

## Post-Deploy Checklist

After deploying to any platform:

```bash
# 1. Verify API is up
curl https://your-domain.com/api/health

# 2. Set webhook
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://your-domain.com/api/webhook" \
  -d "allowed_updates=[\"message\",\"callback_query\",\"pre_checkout_query\",\"chat_member\",\"my_chat_member\"]"

# 3. Confirm webhook
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
# Should show: "url": "https://your-domain.com/api/webhook", "pending_update_count": 0

# 4. Set bot commands
curl "https://api.telegram.org/bot<TOKEN>/setMyCommands" \
  -H "Content-Type: application/json" \
  -d '{
    "commands": [
      {"command":"start","description":"Welcome message"},
      {"command":"help","description":"Help & support"},
      {"command":"donate","description":"Donate with crypto or Stars"},
      {"command":"privacy","description":"Privacy policy"},
      {"command":"delete_my_data","description":"Request data deletion"},
      {"command":"subscription","description":"Premium plans"},
      {"command":"stats","description":"Your statistics"}
    ]
  }'

# 5. Send /start to your bot — should reply instantly
# 6. Send a video — bot should forward to admin DM, then start HLS conversion
# 7. Admin: reply to any forwarded message — should deliver to the user
```

---

## Database Schema

D1 tables (auto-created on startup):

| Table | Purpose |
|---|---|
| `users` | All users who have messaged the bot |
| `messages` | Audit log of all messages |
| `donations` | OxaPay and Stars donation records |
| `static_addresses` | Admin-set static crypto deposit addresses |
| `moderation` | Active moderation actions (mute, ban, warn) |
| `moderation_logs` | Full history of moderation events |
| `group_chats` | Tracked Telegram groups |
| `group_members` | Group membership records |
| `user_sessions` | MTProto session strings |
| `rate_limit_windows` | Anti-spam rate limit buckets |
| `blocked_keywords` | Regex/keyword blocklist |
| `link_whitelist` | Allowed link domains |
| `scheduled_broadcasts` | Queued broadcast jobs |
| `premium_subscriptions` | User premium tier + expiry |
| `user_metadata` | Arbitrary per-user key-value data |
| `deletion_requests` | GDPR deletion request tracking |

---

## API Reference

All routes are under `/api` (or just `/` if the API server is the root).

### Public

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check — returns `{ ok: true }` |
| `POST` | `/webhook` | Telegram webhook endpoint |
| `GET` | `/watch/:token` | HLS video watch page |
| `GET` | `/download/:token` | Download original video |
| `GET` | `/hls/status/:uid?t=<token>` | Poll HLS conversion status |
| `GET` | `/hls/:uid/:file` | Serve HLS `.m3u8` / `.ts` segments |
| `GET` | `/privacy` | Privacy policy page |

### Admin (requires `Authorization: Bearer <ADMIN_SECRET>`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/videos` | List all active video tokens |
| `DELETE` | `/admin/videos/:uid` | Revoke a video link |
| `GET` | `/admin/users` | List all users from D1 |
| `POST` | `/admin/broadcast` | Send a broadcast message |

---

## Troubleshooting

### Webhook not receiving updates

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```
- Check `last_error_message` field
- Ensure your domain has a valid SSL cert (Telegram requires HTTPS)
- Make sure port 443/80 is open

### HLS conversion never completes

- Check FFmpeg is installed: `ffmpeg -version`
- Check disk space: `df -h /tmp`
- Check server logs for `[hls]` or `[ffmpeg]` lines
- Ensure the bot has an MTProto session (`BOT_SESSION` env var is set)

### Videos larger than 20 MB fail to download

- MTProto session (`BOT_SESSION`) must be set and valid
- The bot must have been forwarded the video to admin DM first (needed for `adminMsgId`)
- Re-generate the session if it's expired

### D1 queries fail

- Verify `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `D1_DATABASE_ID` are all correct
- The API token must have `D1:Edit` permission on your account
- Test directly: `curl "https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/d1/database/<DB_ID>/query" -H "Authorization: Bearer <TOKEN>" -d '{"sql":"SELECT 1"}'`

### R2 uploads fail

- Check bucket name and access key are correct
- Ensure the token has **Object Read & Write** on the specific bucket
- R2 uses S3-compatible endpoints: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

### OxaPay donations not working

- Verify `OXAPAY_MERCHANT_KEY` is the **merchant** key, not the API key
- Webhook URL must be set in OxaPay dashboard to `https://your-domain.com/api/oxapay/webhook`

### Bot replies going to wrong chat

- `ADMIN_ID` must be your numeric Telegram user ID, not a username
- Find your ID: message @userinfobot
