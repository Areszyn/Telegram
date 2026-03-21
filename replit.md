# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: Cloudflare D1 (via REST API)
- **Media storage**: Cloudflare R2 (via S3-compatible SDK)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## What This App Does

**Telegram Contact Admin System** (`@lifegrambot`) with:
- Telegram bot that forwards all user messages to admin (true forwardMessage)
- Media handling: photos, video, documents, voice → uploaded to Cloudflare R2
- Message history stored in Cloudflare D1
- Mini App frontend at `/miniapp/` — user chat + admin inbox
- Admin can reply by swiping on forwarded messages in Telegram
- Broadcast system via `/broadcast <text>` command
- OxaPay crypto donation system in the Mini App
- Telegram Stars donations (native in-app payments)
- Premium subscriptions
- MTProto/GramJS-powered video streaming (no file size limit)
- Anti-spam / moderation system
- User device & geo metadata collection (IP, city, OS, browser, screen, language, timezone)
- Cookie consent banner in Mini App + video player
- GDPR-style data deletion request workflow (in-app + admin review)
- Privacy policy at `/api/privacy` (Telegram Instant View compatible)
- User Account page with consent management and deletion request form
- Admin Deletion Requests page with approve/decline + D1 data wipe

## Production URLs

- **Mini App**: `https://mini.susagar.sbs/miniapp/`
- **API**: `https://mini.susagar.sbs/api`
- **Privacy Policy**: `https://mini.susagar.sbs/api/privacy`

## Structure

```text
artifacts/
├── api-server/src/
│   ├── lib/
│   │   ├── d1.ts          # Cloudflare D1 REST client + schema init
│   │   ├── r2.ts          # Cloudflare R2 S3 uploader
│   │   ├── telegram.ts    # Telegram Bot API helpers
│   │   ├── auth.ts        # initData validation + requireAdmin guard
│   │   └── mtproto.ts     # GramJS bot client (video streaming)
│   └── routes/
│       ├── webhook.ts         # Telegram webhook handler
│       ├── messages.ts        # User/admin message APIs
│       ├── donations.ts       # OxaPay + Stars donation APIs
│       ├── moderation.ts      # Ban/warn/restrict APIs
│       ├── bot-admin.ts       # Admin broadcast, tools
│       ├── sessions.ts        # MTProto session management
│       ├── spam.ts            # Anti-spam poller
│       ├── video.ts           # Video streaming (GramJS, R2, JWT tokens)
│       ├── privacy.ts         # Privacy policy + ToS HTML page
│       └── deletion-requests.ts  # User metadata, deletion request flow
└── miniapp/src/
    ├── lib/telegram-context.tsx  # Telegram WebApp context
    ├── components/
    │   ├── layout.tsx            # Nav tabs (user: Chat/Donate/Session/Account; admin: 9 tabs)
    │   └── CookieBanner.tsx      # Cookie consent banner + hook
    ├── pages/user/
    │   ├── chat.tsx
    │   ├── donate.tsx
    │   ├── session.tsx
    │   └── account.tsx           # Profile, consent toggle, deletion request
    └── pages/admin/
        ├── inbox.tsx
        ├── chat.tsx              # Per-user chat with User Intelligence panel (IP, OS, geo, consent)
        ├── broadcast.tsx
        ├── donations.tsx
        ├── users.tsx
        ├── moderation.tsx
        ├── bot-tools.tsx
        ├── sessions.tsx
        ├── videos.tsx
        └── deletion-requests.tsx # Pending/approved/declined deletion requests
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

### Admin (requires x-admin-id header)
- `GET /api/users` — All users
- `GET /api/messages/:userId` — Messages for a user
- `POST /api/broadcast` — Broadcast to all users
- `GET /api/admin/user-metadata/:userId` — Device/geo data for a user (by DB id or telegram_id)
- `GET /api/admin/deletion-requests?status=` — List deletion requests
- `POST /api/admin/deletion-requests/:id/approve` — Approve + wipe user data
- `POST /api/admin/deletion-requests/:id/decline` — Decline request
- `GET /api/admin/videos` — Active video streaming links
- `DELETE /api/admin/videos/:uid` — Revoke video link

## Key Secrets

- `BOT_TOKEN` — Telegram bot token
- `ADMIN_ID` — Admin Telegram user ID (2114237158)
- `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `D1_DATABASE_ID`
- `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_URL`
- `OXAPAY_MERCHANT_KEY`
- `TELEGRAM_API_ID`, `TELEGRAM_API_HASH` — for GramJS MTProto

## Cookie Consent

- Mini App: `cookie_consent_v1` in localStorage; banner shown 800ms after load; managed in Account page
- Video player: `ck_player_v1` in localStorage; slide-up banner on first view
- Consent is synced to `user_metadata.cookie_consent` via `POST /api/user/device-info`
