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
    - **pre_checkout_query validation**: Validates payload format, currency (XTR only), and expected amount before approving checkout (Premium=250, Widget Standard=100, Widget Pro=250).
    - **Recurring subscription handling**: Supports Telegram's `subscription_period` (30 days). Handles `is_recurring` and `is_first_recurring` on `successful_payment` — renewals extend the existing subscription instead of creating duplicates. Uses `subscription_expiration_date` from Telegram when available.
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
    - **Widget Boost/Add-ons**: Permanent stackable boosts (extra_messages, extra_widgets, extra_faq, extra_training, extra_social) for Standard/Pro subscribers, purchasable via Stars or crypto. DB table: `widget_boosts`.
    - **Active Payment Addresses**: Users can see all their pending/confirming crypto payment addresses with countdown timers until expiry. Backend endpoints: `GET /donations/active` (donation payments), `GET /widget/payments/active` (widget plan/boost payments). Both pages auto-poll every 15 seconds.
    - **Session String Copy**: Users and admins can copy their MTProto session string via `GET /sessions/:id/string` (owner-scoped with admin bypass). Copy buttons on both admin and user session cards.
    - **Admin Plan Manager**: New `/admin/plans` page with 3 tabs — Premium, Widget Plans, Boosts. View all subscriptions, grant/revoke premium and widget plans, grant manual boosts. Backend endpoints: `GET /admin/widget-plans`, `GET /admin/widget-boosts`, `POST /admin/boost/grant`.
    - **Downgrade behavior**: No background job — `getUserWidgetPlan` checks for active non-expired subscription in real-time. When expired, user falls back to Free plan: extra widgets disabled, message limit drops to 100/day, AI auto-reply stops, watermark returns. Re-subscribing reactivates everything.
    - **Email-based session resume**: If a returning visitor enters the same email on the same widget from the same browser (verified via `device_token` in localStorage), their previous chat session is restored with full message history. The `device_token` prevents session hijacking by email guessing.
    - DB migration required: `widget_sessions.device_token` column (run "Initialize DB" from `/api/health`).
- **AI Chat Hub (BYOK)**:
    - Supports 12 models from OpenAI, Google Gemini, and Anthropic Claude.
    - Users manage their own API keys, stored in D1.
    - Real-time SSE streaming responses, conversation management, markdown rendering, auto-titling, system prompt support.
    - Admin dashboard for monitoring AI usage.

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
- **Versions** (`/versions`): Accordion changelog with 25 releases (v1.0.0–v2.7.5)
- **Status** (`/status`): Live health checks for 5 services
- **Privacy** (`/privacy`): Full privacy policy, terms of service, and terms & conditions (static HTML, language switcher)
- **Docs** (`/docs`): Widget setup guide (static HTML)

**Technical:** Single-file App.tsx with wouter routing, FadeIn/Counter animation components with reduced-motion support, responsive nav with a11y attributes, Inter + JetBrains Mono fonts, dark class wrapper for forced dark mode. Static HTML pages served via Cloudflare Pages _redirects rules.

## Current Version: 2.7.5