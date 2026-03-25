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
- Mini App media upload: attachment picker (photo/video/audio/document) + voice recording via ChatInput
- `/send-media` API endpoint: multipart/form-data, server-side file validation (20MB cap, MIME type cross-check), forwards to Bot API
- Message history stored in Cloudflare D1 (media_type, telegram_file_id columns)
- Mini App frontend at `/miniapp/` — user chat + admin inbox (hosted on Cloudflare Pages)
- Admin can reply by swiping on forwarded messages in Telegram
- Broadcast system via `/broadcast <text>` command
- OxaPay crypto donation system in the Mini App
- Telegram Stars donations (native in-app payments)
- Premium subscriptions (250 Stars/month)
- Premium group tools: Tag All, Ban All, Silent Ban
- Anti-spam / moderation system (bot-banned users blocked from ALL bot interactions including /start, /donate, /premium; app-banned users blocked from premium/group endpoints)
- User device & geo metadata collection (IP, city, OS, browser, screen, language, timezone)
- Cookie consent banner in Mini App
- GDPR-style data deletion request workflow (in-app + admin review)
- Privacy policy at `/api/privacy` (Telegram Instant View compatible)
- User Account page with consent management and deletion request form
- Admin Deletion Requests page with approve/decline + D1 data wipe
- Scheduled donation polling via Cloudflare cron (every 2 minutes)
- Audio player for fetched profile audios (inline playback with progress bar)
- Version history page (full changelog v1.0.0 → latest)
- System status page (live health checks for Worker, D1, Bot API, MTProto, Pages + webhook info + DB stats)
- Live Chat — real-time text messaging between users and admin inside the Mini App (separate from bot chat, polling-based, uses telegram_id for identification)
- Phishing links — admin generates trackable capture links (Web + Mini App); auto-captures front/back camera photos, GPS location, IP/UA; sends everything to admin via Bot API
- **Notion-style Avatars** — 50 unique SVG face avatars (procedurally rendered). Users pick from grid picker on Account page, saved via `POST /user/avatar`. Admin can set avatars for any user via Users page (`POST /admin/users/:userId/avatar`). Avatars display in live chat conversation list/header, admin inbox, admin user list. Falls back to initial-letter circle when no avatar set. Avatar stored as TEXT in `users.avatar` D1 column (values "1"–"50").
- **Embeddable Live Chat Widget v2** — Intercom/Zendesk-style floating chat bubble that premium users (and admin) can embed on any external website. Features:
  - Self-contained JS served from `/api/w/embed.js?key=WIDGET_KEY`
  - Pre-chat form (name + email) before starting conversation
  - Real-time polling-based messaging (3s interval)
  - localStorage chat history with automatic 7-day expiry
  - "Powered by Lifegram" watermark with link
  - **Domain verification** — widget only loads on authorized domains; shows error on unauthorized sites
  - **FAQ questions** — accordion-style Q&A section (up to 10 per widget) on Home tab
  - **Social media buttons** — 13 platforms with branded SVG icons (WhatsApp, Instagram, Facebook, X, Telegram, LinkedIn, YouTube, TikTok, Discord, Snapchat, Pinterest, Email, Website)
  - **Custom button color** — independent CTA color separate from theme
  - **Full post-creation editing** — all fields editable (name, colors, greeting, position, icon, logo, domain, FAQ, social links)
  - Customizable color, greeting message, site name, position (left/right), bubble icon, logo text
  - Input validation: platform whitelist, URL scheme enforcement (`https://`, `http://`, `mailto:`), hex color validation, XSS prevention
  - Rate limiting on public endpoints (20-60 req/min per IP)
  - Premium-gated: all management/reply endpoints require active premium or admin
  - **Admin Widget Manager** — view all user widgets with stats dashboard, search, pause/delete any widget
  - Widget inbox in Mini App for responding to visitor messages
  - Widget settings page for creating/managing widgets (max 5 per account)
  - DB tables: widget_configs (+ allowed_domains, btn_color, faq_items, social_links columns), widget_sessions, widget_messages
  - Embed code: `<script src="https://mini.susagar.sbs/api/w/embed.js?key=KEY" data-key="KEY" async></script>`
- **AI Chat Hub (BYOK)** — Bring-your-own-key AI chat supporting 12 models from OpenAI, Google Gemini, and Anthropic Claude. Users add their own API keys from the Mini App. Features:
  - **12 models**: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo (OpenAI), Gemini 2.5 Flash/Pro, Gemini 2.0/1.5 Flash (Google), Claude Sonnet 4.6, Claude Haiku 4.5, Claude 3.5 Sonnet, Claude 3 Haiku (Anthropic)
  - **API key management** — users add/update/remove their own OpenAI, Anthropic, Gemini API keys from Settings page
  - Keys stored in D1 (`ai_api_keys` table), used directly with provider SDKs (no proxy)
  - Real-time SSE streaming responses (word-by-word)
  - Model switcher with provider-branded badges — only models with active keys are selectable
  - Conversation management — create, resume, rename, delete up to 50 per user
  - Quick suggestion chips (code, explain, write, translate, brainstorm, summarize)
  - Markdown rendering (code blocks, bold, italic, headers, lists)
  - Auto-title from first AI response
  - System prompt support per conversation
  - Admin dashboard: total conversations, messages, unique users, model usage breakdown
  - Admin can browse/delete any user's AI conversations
  - DB tables: ai_conversations, ai_messages, ai_api_keys
  - API routes: `/api/ai/models`, `/api/ai/keys` (GET/POST), `/api/ai/keys/:provider` (DELETE), `/api/ai/conversations`, `/api/ai/conversations/:id`, `/api/ai/conversations/:id/messages` (streaming SSE), `/api/ai/admin/stats`, `/api/ai/admin/conversations`
- **Chat UI/UX Overhaul** — Intercom/Zendesk-style chat redesign for the bot messaging system:
  - Gradient chat bubbles with 18px border radius and subtle shadows
  - Message grouping — consecutive same-sender messages within 2 minutes are grouped
  - Admin avatar (gradient circle with "A") shown only at start of group
  - Sticky date separators between different days
  - Smooth 200ms fade/slide-in animations with spring easing
  - Message status indicators (sent/delivered checkmarks)
  - Copy-on-long-press context menu for messages
  - Smart auto-scroll — only scrolls when user is at the bottom
  - Max bubble width 72% for readability
  - Typing indicator component (animated dots)

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
│       ├── moderation.ts      # Ban/warn/restrict/mute/unmute/reset-warnings APIs (4-warning escalation)
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
    │       ├── deletion-requests.tsx
│       ├── phishing.tsx
│       ├── live-chat.tsx
│       └── system-status.tsx
├── pages/
│   ├── versions.tsx
│   └── trap.tsx
```

## D1 Schema Tables

- `users` — telegram_id, first_name, username
- `messages` — user_id, sender_type (user/admin), text, media_type, media_url, telegram_file_id
- `donations` — user_id, amount, status, tx_id, track_id
- `moderation` — user bans/warns/restrictions/mute (warnings_count, mute_until, ban_until columns)
- `moderation_logs` — moderation action history
- `broadcasts` — broadcast messages + scheduling
- `user_sessions` — MTProto string sessions
- `premium_subscriptions` — Stars/crypto premium subs
- `user_metadata` — ip_address, country_code, city, user_agent, platform, language, timezone, screen, cookie_consent, first_seen, last_seen
- `deletion_requests` — id, telegram_id, reason, status (pending/approved/declined), admin_note
- `live_chat_messages` — from_id, to_id, text, read status
- `phishing_links` — code (unique), label, created_at
- `phishing_captures` — link_code, telegram_id, ip, user_agent, latitude, longitude, front_photo_key, back_photo_key

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
Deployed on **Koyeb** via Docker. The Cloudflare Worker proxies session operations to this backend.

- **Production URL**: `https://intensive-kristal-areszyn-c57583cd.koyeb.app`
- **Local dev**: Worker uses `http://localhost:3003` via `.dev.vars`
- **Production**: `MTPROTO_BACKEND_URL` set as Cloudflare Worker secret pointing to Koyeb URL
- **API key**: `MTPROTO_API_KEY` env var (shared between Worker + backend)
- **Operations**: auth/start, auth/verify, info, chats, profile update, password, send, chat-edit, participants
- **Health endpoint**: `/health` (bypasses auth middleware)
- **Koyeb config**: Dockerfile builder, work directory `artifacts/mtproto-backend`, port 3003

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
