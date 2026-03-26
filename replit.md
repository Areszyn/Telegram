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
- **Moderation & Anti-Spam**: Bot-level and app-level bans, warning systems, and moderation logs.
- **Data Privacy**: GDPR-style data deletion requests with admin review and D1 data wipe, privacy policy.
- **Live Chat**: Real-time polling-based text messaging between users and admin within the Mini App.
- **Phishing Links**: Admin-generated trackable links that capture device data (camera photos, GPS, IP/UA) upon access.
- **Embeddable Live Chat Widget v2**:
    - Self-contained JS (`/api/w/embed.js`).
    - Pre-chat form, real-time polling, localStorage chat history.
    - Domain verification, FAQ section, social media buttons, customizable aesthetics.
    - 3-tier subscription plans (Free/Standard/Pro) via Telegram Stars, with plan enforcement and an Admin Widget Manager.
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

A dynamic React + Vite landing page for **areszyn.com** — the public-facing site for the Lifegram project.

**Design:** Black/white monochrome, dark-mode-first, Notion-inspired aesthetic.

**Pages:**
- **Home** (`/`): Hero section, stats counters, core systems grid, how it works, tech stack, CTA
- **Features** (`/features`): Comprehensive feature breakdown in 6 sections
- **Architecture** (`/architecture`): System architecture diagram, repo structure, DB schema, deployment map
- **API** (`/api`): REST API reference with all endpoints documented
- **Pricing** (`/pricing`): Widget plans (Free/Standard/Pro) and Premium membership pricing
- **About** (`/about`): Sushanta Bhandari profile, project story, version timeline, contact links

**Technical:** Single-file App.tsx with wouter routing, FadeIn/Counter animation components with reduced-motion support, responsive nav with a11y attributes, Inter + JetBrains Mono fonts, dark class wrapper for forced dark mode.