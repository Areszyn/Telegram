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

**Telegram Contact Admin System** with:
- Telegram bot that forwards all user messages to admin (true forwardMessage)
- Media handling: photos, video, documents, voice → uploaded to Cloudflare R2
- Message history stored in Cloudflare D1
- Mini App frontend at `/miniapp/` — user chat + admin inbox
- Admin can reply by swiping on forwarded messages in Telegram
- Broadcast system via `/broadcast <text>` command
- OxaPay donation system in the Mini App

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── lib/d1.ts       # Cloudflare D1 REST client
│   │       ├── lib/r2.ts       # Cloudflare R2 S3 uploader
│   │       ├── lib/telegram.ts # Telegram Bot API helpers
│   │       ├── lib/auth.ts     # initData validation + admin check
│   │       └── routes/
│   │           ├── webhook.ts  # Telegram webhook handler
│   │           ├── messages.ts # User/admin message APIs
│   │           └── donations.ts# OxaPay donation APIs
│   └── miniapp/            # React Vite Telegram Mini App
│       └── src/
│           ├── lib/telegram-context.tsx  # Telegram WebApp context
│           ├── pages/user/chat.tsx       # User chat page
│           ├── pages/user/donate.tsx     # Donation page
│           ├── pages/admin/inbox.tsx     # Admin inbox
│           ├── pages/admin/chat.tsx      # Admin per-user chat
│           └── pages/admin/broadcast.tsx # Broadcast page
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   └── api-zod/            # Generated Zod schemas
└── scripts/                # Utility scripts
```

## Key Secrets Required

- `BOT_TOKEN` — Telegram bot token
- `ADMIN_ID` — Admin Telegram user ID
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token (D1 + R2 permissions)
- `D1_DATABASE_ID` — D1 database ID
- `R2_BUCKET_NAME` — R2 bucket name
- `R2_ACCESS_KEY_ID` — R2 S3 access key
- `R2_SECRET_ACCESS_KEY` — R2 S3 secret key
- `R2_PUBLIC_URL` — Public URL for R2 bucket
- `OXAPAY_MERCHANT_KEY` — OxaPay merchant key

## D1 Schema Tables

- `users` — telegram_id, first_name, username
- `messages` — user_id, sender_type (user/admin), text, media_type, media_url, telegram_file_id
- `donations` — user_id, amount, status, tx_id, track_id

## Key API Endpoints

- `POST /api/webhook` — Telegram bot webhook
- `POST /api/setup-webhook` — Register webhook URL with Telegram
- `POST /api/init-db` — Initialize D1 schema
- `GET /api/my-profile` — Current user profile
- `GET /api/my-messages` — Current user messages
- `GET /api/users` — All users (admin)
- `GET /api/messages/:userId` — Messages for a user
- `POST /api/send-message` — Send message
- `POST /api/broadcast` — Broadcast to all users
- `POST /api/donations/create` — Create OxaPay invoice
- `GET /api/donations/verify/:trackId` — Verify donation
- `GET /api/donations/history` — Donation history

## Mini App URL

Configure in @BotFather: `https://<your-domain>/miniapp/`
