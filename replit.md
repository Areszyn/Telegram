# Workspace

## Overview

This project is a pnpm workspace monorepo using TypeScript, designed to function as a comprehensive **Telegram Contact Admin System** (`@lifegrambot`). Its core purpose is to facilitate seamless communication between Telegram users and an administrator, offering advanced features beyond standard Telegram bots.

Key capabilities include:
- A Telegram bot that forwards user messages and media (photos, videos, documents, voice) to an admin, and allows the admin to reply.
- A Mini App frontend for user chat, admin inbox, and advanced features like media uploads, live chat, and account management.
- Integration with payment systems like OxaPay and Telegram Stars for donations and premium subscriptions.
- Advanced moderation tools, anti-spam systems, and data privacy features including GDPR-style deletion requests.
- Unique features such as an embeddable Live Chat Widget for external websites and an AI Chat Hub supporting multiple large language models with user-provided API keys.
- A phishing link generation tool for admin use, capable of capturing user device data.

The project aims to provide a robust, feature-rich platform for managing Telegram interactions, monetizing services through premium features, and offering advanced communication and AI functionalities within a secure and privacy-conscious environment.

## User Preferences

- All dates/times in the Mini App display in **Asia/Kolkata (IST, UTC+5:30)**. The centralized utility is in `artifacts/miniapp/src/lib/date.ts`.

## System Architecture

The project is structured as a pnpm workspace monorepo, primarily leveraging Cloudflare's ecosystem for deployment and services.

**Core Technologies:**
- **Monorepo Tool**: pnpm workspaces
- **Language**: TypeScript 5.9
- **Runtime**: Node.js 24
- **API Framework**: Hono (for Cloudflare Worker)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **Crypto**: Web Crypto API (HMAC-SHA256 for auth)

**Deployment & Hosting:**
- **Worker**: Cloudflare Workers (`artifacts/api-server`) acts as the primary backend, handling API routes and proxying Mini App requests.
- **Frontend**: Cloudflare Pages (`artifacts/miniapp`) hosts the Mini App, proxied via the Worker.
- **Custom Domain**: `mini.susagar.sbs` routes all traffic through the Worker.
- **MTProto Backend**: A Node.js Express server using GramJS (`telegram` package) for Telegram MTProto operations, deployed on Koyeb via Docker. The Cloudflare Worker proxies session operations to this backend.

**UI/UX Decisions:**
- The Mini App features a redesigned chat interface with gradient chat bubbles, message grouping, sticky date separators, smooth animations, and message status indicators.
- Notion-style Avatars: 50 unique SVG face avatars for user personalization, displayed across chat and admin interfaces.
- Cookie consent banner implemented in the Mini App, with consent management on the Account page.

**Feature Specifications & Technical Implementations:**
- **Telegram Bot Integration**: True message forwarding, media handling (up to 20MB via Bot API file proxy), admin replies with hidden-profile fallback.
- **Mini App**: User chat, admin inbox, media upload, account management (profile, consent, deletion requests).
- **Donation & Premium Systems**: OxaPay and Telegram Stars integrations for donations and premium subscriptions (e.g., group tools, Live Chat Widget plans).
    - **pre_checkout_query validation**: Validates payload format, currency (XTR only), and expected amount before approving checkout (Premium=250, Widget Standard=150, Widget Pro=400, Boosts=quantity*perUnitStars).
    - **Recurring subscription handling**: Supports Telegram's `subscription_period` (30 days). Handles `is_recurring` and `is_first_recurring` on `successful_payment` — renewals extend the existing subscription instead of creating duplicates. Uses `subscription_expiration_date` from Telegram when available.
    - **Plan downgrade prevention**: Server-side enforcement in both Stars and crypto purchase endpoints — only upgrades allowed (free→standard→pro). UI also hides downgrade buttons.
    - **Boost add-ons**: Per-unit pricing with custom quantity input. Users type how many they want (msgs, widgets, FAQ, URLs, links). Payload format: `wboost-{tid}-{boostKey}-{quantity}-{timestamp}`. Prices: msgs=1 Star/unit, widgets=50, FAQ=10, training=20, social=15.
    - **`editUserStarSubscription`**: API wrapper in `telegram.ts` for canceling/reactivating user Star subscriptions per Bot API docs.
- **Moderation & Anti-Spam**: Bot-level and app-level bans, warning systems, and moderation logs.
- **Data Privacy**: GDPR-style data deletion requests with admin review and D1 data wipe, privacy policy.
- **Live Chat**: Real-time polling-based text messaging between users and admin within the Mini App.
- **Phishing Links**: Admin-generated trackable links that capture device data (camera photos, GPS, IP/UA) upon access.
- **Embeddable Live Chat Widget v2**:
    - Self-contained JS (`/api/w/embed.js`).
    - Pre-chat form, real-time polling, localStorage chat history.
    - Domain verification, FAQ section, social media buttons, customizable aesthetics.
    - Widget avatar (1-15 Notion-style inline SVG faces) and Cal.com booking link support.
    - 3-tier subscription plans (Free/Standard/Pro) via Telegram Stars or OxaPay crypto, with plan enforcement and an Admin Widget Manager.
    - **OxaPay Crypto Widget Plans**: Users can pay for Standard ($2) or Pro ($5) plans with cryptocurrency. Uses server-side OxaPay verification (never trusts callback status alone), atomic `credited` flag for idempotent activation, and cron-based polling for pending payments. DB table: `widget_plan_payments`.
    - **Widget Boost/Add-ons**: Stackable boosts (extra_messages, extra_widgets, extra_faq, extra_training, extra_social) for Standard/Pro subscribers, purchasable via Stars or crypto. Boosts expire after 30 days (`expires_at` column). DB table: `widget_boosts`.
    - **Active Payment Addresses**: Users can see all their pending/confirming crypto payment addresses with countdown timers until expiry. Backend endpoints: `GET /donations/active` (donation payments), `GET /widget/payments/active` (widget plan/boost payments). Both pages auto-poll every 15 seconds.
    - **Session String Copy**: Users and admins can copy their MTProto session string via `GET /sessions/:id/string` (owner-scoped with admin bypass). Copy buttons on both admin and user session cards.
    - **Admin Plan Manager**: New `/admin/plans` page with 3 tabs — Premium, Widget Plans, Boosts. View all subscriptions, grant/revoke premium and widget plans, grant manual boosts. Backend endpoints: `GET /admin/widget-plans`, `GET /admin/widget-boosts`, `POST /admin/boost/grant`.
    - **Payment History**: User (`/payments`) and admin (`/admin/payments`) pages showing all payment types (Premium, Widget Plans, Boosts, Donations) in tabbed views with expandable details. Backend endpoints: `GET /payments/my-history` (user-scoped), `GET /admin/payments/all` (admin-only with user info via JOIN).
    - **Downgrade behavior**: No background job — `getUserWidgetPlan` checks for active non-expired subscription in real-time. When expired, user falls back to Free plan: extra widgets disabled, message limit drops to 100/day, AI auto-reply stops, watermark returns. Re-subscribing reactivates everything.
    - **Email-based session resume**: If a returning visitor enters the same email on the same widget from the same browser (verified via `device_token` in localStorage), their previous chat session is restored with full message history. The `device_token` prevents session hijacking by email guessing.
    - DB migration required: `widget_sessions.device_token` column (run "Initialize DB" from `/api/health`).
    - **Typing Indicators**: In-memory Map with 5-second TTL. Visitor: `POST /w/typing`, Owner: `POST /widget/typing/:sessionId`. Typing state exposed in poll responses.
    - **Read Receipts**: `read_at` timestamp on `widget_messages`. Auto-set when messages are fetched by the opposite party. Visitor: `POST /w/read`, Owner: `POST /widget/read/:sessionId`. Displayed as check/double-check marks.
    - **Emoji Reactions**: `widget_reactions` table. 8 allowed emojis (👍❤️😂😮😢🙏🔥👎). Visitor: `POST /w/react`, Owner: `POST /widget/react/:sessionId`. Displayed inline on messages.
    - **Chat Rating/Feedback**: `widget_sessions.rating` (1-5) and `feedback` columns. Visitor: `POST /w/rate`. Rating prompt shown when visitor navigates away from chat. Displayed in session list.
    - **Widget Collaborators (Multi-Agent)**: `widget_collaborators` table. Owner generates invite codes (`POST /widget/invite/:widgetKey`), users accept (`POST /widget/invite/accept`). Collaborators can view conversations, reply, and receive notifications. Managed in Widget Settings UI.
    - **Team Premium Sharing**: `premium_teams` + `premium_team_members` tables. Premium owners create teams with invite codes. First 3 member slots free (added one at a time up to 3), additional seats $5/user (250★ via Telegram Stars) while owner's premium is active. `isPremiumActive` checks team membership as fallback — team members get all premium features (Tag All, Ban All, Silent Ban, Group Tools, Widget watermark removal). Members sorted by `created_at ASC` — first 3 by join order are "free", rest are "paid". User Account page shows clear pricing breakdown and feature list for team members. Admin Plan Manager "Teams" tab shows team stats (free vs paid breakdown), member details with Telegram IDs and join dates, and global totals. Endpoints: `POST /premium/team/create`, `POST /premium/team/invite`, `POST /premium/team/join`, `GET /premium/team`, `DELETE /premium/team/member/:id`, `DELETE /premium/team`, `POST /premium/team/seat/buy` (Stars invoice). Admin endpoints: `GET /admin/teams`, `DELETE /admin/team/:id`, `DELETE /admin/team/member/:id`, `POST /admin/team/:id/seats` (grant seats).
- **Deep Linking**: Mini App supports `startapp` parameter routing via `t.me/lifegrambot/miniapp?startapp=SECTION`. Admin commands (`/ai`, `/premium`, `/widget`, `/users`, `/mod`, `/payments`, `/sessions`, `/phishing`, `/live`, `/groups`, `/deletions`) send inline buttons with deep links to corresponding admin sections. Routes defined in `DEEP_LINK_ROUTES` and `ADMIN_DEEP_LINK_ROUTES` maps in `App.tsx`.
- **Managed Bots (Bot API 9.6)**: Create and manage bots on behalf of users. Both admin and user-facing.
    - **Admin**: `/managed list|create|token|rotate` commands in chat. ManagedBots UI in admin Bot Tools page with copyable t.me links per bot, copy token buttons, owner info display, and create-link generator with Open/Copy options. Full token access via `getManagedBotToken`/`replaceManagedBotToken` APIs.
    - **User**: "My Bots" page (`/my-bots`) in user navigation. Users create bots via `t.me/newbot/lifegrambot` with mandatory name + username fields (username must end with "bot"). Features: token reveal/copy/rotate, activate/deactivate, auto-reply, message forwarding, bot description sync. Owner-scoped API routes: `GET /my-bots`, `POST /my-bots/create-link`, `POST /my-bots/configure`, `POST /my-bots/setup-webhook`, `POST /my-bots/remove-webhook`, `GET /my-bots/:id/info`, `POST /my-bots/get-token`, `POST /my-bots/rotate-token`.
    - **Webhook handler**: `managed_bot` update type auto-upserts to `managed_bots` D1 table. `managed_bot_created` message field also triggers upsert. Early returns prevent fall-through.
    - **Managed bot webhook**: `POST /managed-webhook/:botUserId` receives messages from managed bots, forwards to owner and/or sends auto-reply based on config.
    - **DB columns**: `webhook_url`, `bot_description`, `forward_to_owner`, `auto_reply`, `welcome_message` on `managed_bots` table.
    - **Auto-activation**: `autoSetupManagedWebhook()` fires on `managed_bot`/`managed_bot_created` events — sets webhook URL and `/start` command automatically.
    - **Welcome tiers**: (1) ADMIN_ID → boss welcome with bot stats + owner ID; (2) bot owner → status welcome with Manage Bot button; (3) regular users → custom `welcome_message` + "Made by @lifegrambot" watermark + "Create Your Own Bot" inline button.
    - **Message forwarding**: Non-boss messages forwarded to owner inside the managed bot via the managed bot's own token (not @lifegrambot).
    - **Deep links**: `my-bots`, `my_bots`, `mybots`, `bots`, `managed` all route to `/my-bots`.
- **AI Chat Hub (BYOK)**:
    - Supports 12+ models from OpenAI (GPT-4o, GPT-4.1, o3-mini, o4-mini), Google Gemini (2.5 Flash/Pro), and Anthropic Claude.
    - Users manage their own API keys, stored encrypted in D1.
    - **System API Keys**: Admin can configure system-level API keys (via DB or env vars) that serve as fallback for all users without personal keys. Admin UI in AI Settings shows key source (ENV vs DB) with priority indicators.
    - Real-time SSE streaming responses, conversation management, markdown rendering, auto-titling, system prompt support.
    - Admin dashboard for monitoring AI usage.
    - DB table: `system_api_keys` (provider, encrypted_key, iv, created_at). Env vars: `SYSTEM_OPENAI_KEY`, `SYSTEM_GEMINI_KEY`, `SYSTEM_ANTHROPIC_KEY` (checked first, DB is fallback).

## External Dependencies

- **Database**: Cloudflare D1 (native binding) - `DB` binding, database `lifegram`.
- **Media Storage**: Cloudflare R2 (native binding) - `BUCKET` binding, bucket `waspros`.
- **Payment Gateways**:
    - OxaPay (for crypto donations).
    - Telegram Stars (for in-app payments, donations, and premium subscriptions).
- **Telegram APIs**:
    - Telegram Bot API (for bot functionalities).
    - Telegram MTProto (via GramJS in a separate backend).
- **AI Model Providers**:
    - OpenAI (GPT series).
    - Google Gemini (Flash/Pro series).
    - Anthropic Claude (Sonnet/Haiku series).
- **Hosting/Deployment**:
    - Cloudflare (Workers, Pages).
    - Koyeb (for MTProto backend hosting).
- **Libraries/Frameworks**:
    - Hono (API framework).
    - Zod (validation).
    - drizzle-zod (schema validation).
    - GramJS (for MTProto).
    - Express (for MTProto backend).

## Landing Page (artifacts/landing)

A dynamic React + Vite landing page for **areszyn.org** — the public-facing site for the Lifegram project.

**Design:** Black/white monochrome, dark-mode-first, Notion-inspired aesthetic.

**Pages:**
- **Home** (`/`): Hero section, stats counters, core systems grid, how it works, tech stack, CTA
- **Features** (`/features`): Comprehensive feature breakdown in 6 sections
- **Architecture** (`/architecture`): System architecture diagram, repo structure, DB schema, deployment map
- **API** (`/api`): REST API reference with all endpoints documented
- **Pricing** (`/pricing`): Widget plans (Free/Standard/Pro) and Premium membership pricing
- **About** (`/about`): Sushanta Bhandari profile, project story, version timeline, contact links
- **Versions** (`/versions`): Accordion changelog with 30+ releases (v1.0.0–v3.2.0)
- **Status** (`/status`): Live health checks for 5 services
- **Privacy** (`/privacy`): Full privacy policy, terms of service, and terms & conditions (static HTML, language switcher)
- **Docs** (`/docs`): Widget setup guide (static HTML)

**Technical:** Single-file App.tsx with wouter routing, FadeIn/Counter animation components with reduced-motion support, responsive nav with a11y attributes, Inter + JetBrains Mono fonts, dark class wrapper for forced dark mode. Static HTML pages served via Cloudflare Pages _redirects rules.

## Replit Development Setup

### Local Dev Servers (auto-started)
| Service | URL | Notes |
|---|---|---|
| API Server | `http://localhost:8080` | Node.js + SQLite (dev-server.ts), not wrangler |
| Mini App | `http://localhost:PORT/miniapp/` | Vite HMR |
| Landing Page | `http://localhost:PORT/landing/` | Vite HMR |
| MTProto Backend | `http://localhost:3003` | tsx watch |

**API Dev Server**: `artifacts/api-server/src/dev-server.ts` — runs the Hono app via `@hono/node-server` with a local SQLite D1 shim and in-memory R2 mock. SQLite data persists to `.wrangler/state/v3/d1/`.

### Deployment (to Cloudflare)

Uses `CLOUDFLARE_API_TOKEN2` (with Pages permissions) automatically. Secrets set via Replit Secrets panel.

```bash
# Deploy Cloudflare Worker only (API backend)
bash scripts/deploy.sh

# Deploy everything
bash scripts/deploy.sh --all

# Deploy individual targets
bash scripts/deploy.sh --miniapp      # Cloudflare Pages: lifegram-miniapp
bash scripts/deploy.sh --landing      # Cloudflare Pages: lifegram-landing
bash scripts/deploy.sh --push-secrets # Sync Replit secrets → Cloudflare Worker secrets
```

**Cloudflare resources:**
- Worker: `lifegram-api` → `mini.susagar.sbs/api/*`
- Pages (miniapp): `lifegram-miniapp` → `lifegram-miniapp.pages.dev`
- Pages (landing): `lifegram-landing` → `areszyn.org`
- D1: `lifegram` (id: `c980ccc5-97e0-4685-9af5-f61a746f14e1`)
- R2: `waspros`

## Current Version: 3.3.0