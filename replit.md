# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Hono (Cloudflare Worker)
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (native binding)
- **Media storage**: Cloudflare R2 (native binding)
- **Frontend hosting**: Cloudflare Pages (proxied via Worker)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Crypto**: Web Crypto API (HMAC-SHA256 for auth)

## What This App Does

**Telegram Contact Admin System** (`@lifegrambot`) with:
- Telegram bot that forwards all user messages to admin (true forwardMessage)
- Media handling: photos, video, documents, voice → served via Bot API file proxy (up to 20MB)
- Message history stored in Cloudflare D1
- Mini App frontend at `/miniapp/` — user chat + admin inbox (hosted on Cloudflare Pages)
- Admin can reply by swiping on forwarded messages in Telegram
- Broadcast system via `/broadcast <text>` command
- OxaPay crypto donation system in the Mini App
- Telegram Stars donations (native in-app payments)
- Premium subscriptions (250 Stars/month)
- Premium group tools: Tag All, Ban All, Silent Ban
- Anti-spam / moderation system
- User device & geo metadata collection (IP, city, OS, browser, screen, language, timezone)
- Cookie consent banner in Mini App
- GDPR-style data deletion request workflow (in-app + admin review)
- Privacy policy at `/api/privacy` (Telegram Instant View compatible)
- User Account page with consent management and deletion request form
- Admin Deletion Requests page with approve/decline + D1 data wipe
- Scheduled donation polling via Cloudflare cron (every 2 minutes)

## Production URLs

- **Mini App**: `https://mini.susagar.sbs/miniapp/`
- **API**: `https://mini.susagar.sbs/api`
- **Privacy Policy**: `https://mini.susagar.sbs/api/privacy`
- **Worker fallback**: `https://lifegram-api.areszyn.workers.dev`
- **Pages origin**: `https://lifegram-miniapp.pages.dev`

## Deployment

- **Worker deploy**: `cd artifacts/api-server && CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN2" pnpm exec wrangler deploy`
- **Mini App deploy**: Build with `cd artifacts/miniapp && BASE_PATH=/miniapp/ PORT=3000 NODE_ENV=production pnpm run build`, then `cd artifacts/api-server && CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN2" GIT_DIR=/tmp/fake-git pnpm exec wrangler pages deploy /path/to/dist --project-name lifegram-miniapp --branch main`
- **Worker secrets**: Set via `wrangler secret put <KEY>` (use CLOUDFLARE_API_TOKEN2)
- **Cron trigger**: `*/2 * * * *` — polls pending OxaPay donations

## Architecture

- Worker entry point: `src/index.ts` — Hono app with routes mounted at `/api`, miniapp proxy at `/miniapp/*`
- The Worker proxies `/miniapp/*` requests to Cloudflare Pages (`lifegram-miniapp.pages.dev`)
- Custom domain `mini.susagar.sbs` routes all traffic through the Worker
- D1 binding: `DB` (database: `lifegram`, ID: `c980ccc5-97e0-4685-9af5-f61a746f14e1`)
- R2 binding: `BUCKET` (bucket: `waspros`)

## Structure

```text
artifacts/
├── api-server/src/
│   ├── index.ts        # Worker entry point (Hono app + scheduled handler)
│   ├── types.ts        # Env type (D1, R2 bindings + secrets)
│   ├── lib/
│   │   ├── d1.ts          # D1 query helpers + schema init
│   │   ├── r2.ts          # R2 upload/presign helpers
│   │   ├── telegram.ts    # Telegram Bot API helpers
│   │   ├── auth.ts        # HMAC initData validation (Web Crypto) + requireAdmin
│   │   ├── spam.ts        # Anti-spam detection
│   │   ├── moderation.ts  # Ban/warn/restrict logic
│   │   ├── group.ts       # Group tagall/banall helpers
│   │   └── user-client.ts # Telegram user info fetcher
│   └── routes/
│       ├── webhook.ts         # Telegram webhook handler
│       ├── messages.ts        # User/admin message APIs
│       ├── donations.ts       # OxaPay + Stars donation APIs + pollPendingDonations
│       ├── moderation.ts      # Ban/warn/restrict APIs
│       ├── bot-admin.ts       # Admin broadcast, tools
│       ├── sessions.ts        # Session management (proxies to MTProto backend)
│       ├── spam.ts            # Anti-spam APIs
│       ├── health.ts          # Health check endpoint
│       ├── privacy.ts         # Privacy policy + ToS HTML page
│       └── deletion-requests.ts  # User metadata, deletion request flow
└── miniapp/src/
    ├── lib/
    │   ├── telegram-context.tsx  # Telegram WebApp context (fullscreen, back button, QR, clipboard, cloud storage, etc.)
    │   └── date.ts               # Timezone utility (Asia/Kolkata IST)
    ├── components/
    │   ├── layout.tsx            # Nav tabs
    │   └── CookieBanner.tsx      # Cookie consent banner + hook
    ├── pages/
    │   ├── group-tools.tsx       # Shared: admin + premium users group management
    │   ├── user/
    │   │   ├── chat.tsx
    │   │   ├── donate.tsx
    │   │   ├── session.tsx
    │   │   └── account.tsx           # Profile, consent toggle, deletion request
    │   └── admin/
    │       ├── inbox.tsx
    │       ├── chat.tsx
    │       ├── broadcast.tsx
    │       ├── donations.tsx
    │       ├── users.tsx
    │       ├── moderation.tsx
    │       ├── bot-tools.tsx
    │       ├── sessions.tsx
    │       └── deletion-requests.tsx
```

## D1 Schema Tables

- `users` — telegram_id, first_name, username
- `messages` — user_id, sender_type (user/admin), text, media_type, media_url, telegram_file_id
- `donations` — user_id, amount, status, tx_id, track_id
- `moderation` — user bans/warns/restrictions
- `moderation_logs` — moderation action history
- `broadcasts` — broadcast messages + scheduling
- `user_sessions` — MTProto string sessions
- `premium_subscriptions` — Stars/crypto premium subs
- `user_metadata` — ip_address, country_code, city, user_agent, platform, language, timezone, screen, cookie_consent, first_seen, last_seen
- `deletion_requests` — id, telegram_id, reason, status (pending/approved/declined), admin_note

## Key API Endpoints

### Public / User
- `POST /api/webhook` — Telegram bot webhook
- `GET /api/my-profile` — Current user profile
- `GET /api/my-messages` — Current user messages
- `POST /api/send-message` — Send message to admin
- `POST /api/donations/create` — Create OxaPay invoice
- `GET /api/donations/verify/:trackId` — Verify donation
- `GET /api/donations/history` — Donation history
- `POST /api/user/device-info` — Upsert device/geo metadata
- `POST /api/user/deletion-request` — Submit data deletion request
- `GET /api/user/deletion-request?telegram_id=` — Check deletion request status
- `GET /api/privacy` — Privacy policy HTML page

### Admin (requires x-init-data header with HMAC validation)
- `GET /api/users` — All users
- `GET /api/messages/:userId` — Messages for a user
- `POST /api/broadcast` — Broadcast to all users
- `GET /api/admin/user-metadata/:userId` — Device/geo data
- `GET /api/admin/deletion-requests?status=` — List deletion requests
- `POST /api/admin/deletion-requests/:id/approve` — Approve + wipe user data
- `POST /api/admin/deletion-requests/:id/decline` — Decline request
## MTProto Backend

Node.js Express server using GramJS (`telegram` package) for Telegram MTProto operations.
Runs on port 3003 on Replit. The Cloudflare Worker proxies session operations to this backend.

- **Registered as artifact** at `/mtproto` path, accessible via `https://<replit-dev-domain>/mtproto/...`
- **Local dev**: Worker uses `http://localhost:3003` via `.dev.vars`
- **Production**: `MTPROTO_BACKEND_URL` auto-detected from Replit domain and pushed to Cloudflare
- **API key**: `MTPROTO_API_KEY` env var (shared between Worker + backend)
- **Operations**: auth/start, auth/verify, info, chats, profile update, password, send, chat-edit, participants
- **Deploy anywhere**: `bash deploy.sh <platform>` — supports railway, fly, koyeb, render, docker, vps
- **Auto-link**: `bash deploy.sh link <URL>` pushes backend URL to Cloudflare Worker secret
- **dotenv**: Auto-loads `.env` file on startup — no platform env var config needed

## Deployment

One-command deploy via `scripts/deploy.sh`:
1. Set all secrets in Replit Secrets tab (see `.env.example`)
2. Run `bash scripts/deploy.sh` — generates `wrangler.toml`, pushes all secrets, deploys Worker
3. `MTPROTO_BACKEND_URL` is auto-detected from `REPLIT_DEV_DOMAIN` and pushed to Cloudflare — no manual step needed
4. Run `DEPLOY_MINIAPP=true bash scripts/deploy.sh` to also deploy the Mini App to Cloudflare Pages
5. If `CLOUDFLARE_API_TOKEN2` exists, it's used as fallback (legacy compat)

Domain config env vars (with defaults):
- `APP_DOMAIN` (default: `mini.susagar.sbs`)
- `MINIAPP_URL` (default: `https://lifegram-miniapp.pages.dev/`)
- `WORKER_NAME` (default: `lifegram-api`)
- `ZONE_NAME` (default: `susagar.sbs`)
- `CF_PAGES_PROJECT` (default: `lifegram-miniapp`)

## Key Secrets

- `BOT_TOKEN` — Telegram bot token
- `ADMIN_ID` — Admin Telegram user ID
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Workers Scripts Edit permission
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID
- `D1_DATABASE_ID` — Cloudflare D1 database ID
- `R2_BUCKET_NAME` — R2 bucket name
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — R2 API keys
- `R2_PUBLIC_URL` — Public URL for R2 bucket
- `OXAPAY_MERCHANT_KEY` — OxaPay merchant key
- `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` — Telegram API credentials
- `MTPROTO_API_KEY` — Shared secret for Worker ↔ MTProto backend auth
- `MTPROTO_BACKEND_URL` — URL of the MTProto backend (Cloudflare Worker secret, set after Replit deploy)

## Timezone

All dates/times in the Mini App display in **Asia/Kolkata (IST, UTC+5:30)**. The centralized utility is in `artifacts/miniapp/src/lib/date.ts`.

## CI/CD

Two GitHub Actions workflows in `.github/workflows/`:
- `deploy-worker.yml` — auto-deploys Worker on changes to `artifacts/api-server/**`
- `deploy-miniapp.yml` — auto-builds and deploys Mini App on changes to `artifacts/miniapp/**`

Requires GitHub secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Cookie Consent

- Mini App: `cookie_consent_v1` in localStorage; banner shown 800ms after load; managed in Account page
- Consent is synced to `user_metadata.cookie_consent` via `POST /api/user/device-info`
