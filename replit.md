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
- Media handling: photos, video, documents, voice → uploaded to Cloudflare R2
- Message history stored in Cloudflare D1
- Mini App frontend at `/miniapp/` — user chat + admin inbox (hosted on Cloudflare Pages)
- Admin can reply by swiping on forwarded messages in Telegram
- Broadcast system via `/broadcast <text>` command
- OxaPay crypto donation system in the Mini App
- Telegram Stars donations (native in-app payments)
- Premium subscriptions (250 Stars/month)
- Premium group tools: Tag All, Ban All, Silent Ban
- Video streaming (admin-only) via Bot API (≤20MB, JWT-signed tokens, 24h TTL)
- Netflix-style HTML5 video player with auto-hiding controls, seek preview, speed control, PiP
- Anti-spam / moderation system
- User device & geo metadata collection (IP, city, OS, browser, screen, language, timezone)
- Cookie consent banner in Mini App + video player
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
│   │   ├── video-token.ts  # JWT-like signed video tokens (24h TTL)
│   │   ├── video-store.ts  # D1-backed active video registry
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
│       ├── video.ts           # Video streaming (Bot API, JWT tokens)
│       ├── health.ts          # Health check endpoint
│       ├── privacy.ts         # Privacy policy + ToS HTML page
│       └── deletion-requests.ts  # User metadata, deletion request flow
└── miniapp/src/
    ├── lib/telegram-context.tsx  # Telegram WebApp context
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
    │       ├── videos.tsx
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
- `GET /api/admin/videos` — Active video streaming links
- `DELETE /api/admin/videos/:uid` — Revoke video link

## MTProto Backend

Node.js Express server using GramJS (`telegram` package) for Telegram MTProto operations.
Runs on port 3003 on Replit. The Cloudflare Worker proxies session operations to this backend.

- **Local dev**: Worker uses `http://localhost:3003` via `.dev.vars`
- **Production**: Set `MTPROTO_BACKEND_URL` Cloudflare secret to deployed Replit URL
- **API key**: `MTPROTO_API_KEY` env var (shared between Worker + backend)
- **Operations**: auth/start, auth/verify, info, chats, profile update, password, send, chat-edit, participants

## Key Secrets

- `BOT_TOKEN` — Telegram bot token
- `ADMIN_ID` — Admin Telegram user ID (2114237158)
- `CLOUDFLARE_API_TOKEN2` — Cloudflare API token with Workers Scripts Edit permission
- `R2_PUBLIC_URL` — Public URL for R2 bucket
- `OXAPAY_MERCHANT_KEY` — OxaPay merchant key
- `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` — Telegram API credentials
- `MTPROTO_API_KEY` — Shared secret for Worker ↔ MTProto backend auth
- `MTPROTO_BACKEND_URL` — URL of the MTProto backend (Cloudflare Worker secret)

## Cookie Consent

- Mini App: `cookie_consent_v1` in localStorage; banner shown 800ms after load; managed in Account page
- Video player: `ck_player_v1` in localStorage; slide-up banner on first view
- Consent is synced to `user_metadata.cookie_consent` via `POST /api/user/device-info`
