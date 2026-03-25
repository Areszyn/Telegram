# Lifegram Bot v2.3.3

## Current Version: 2.3.3 — Message Streaming & Audio Fix (Mar 2026)

## What Is This

Telegram bot platform (`@lifegrambot`) with:
- React Mini App frontend (Cloudflare Pages)
- Hono API Worker backend (Cloudflare Workers + D1 + R2)
- MTProto backend (Koyeb / GramJS)
- pnpm monorepo on Replit for development

Users message the bot → messages forwarded to admin. Admin replies inline. Mini App provides chat UI, donations (crypto + Stars), premium subscriptions, group tools, live chat, phishing links, and more.

## Production URLs

- **Mini App**: `https://mini.susagar.sbs/miniapp/`
- **API**: `https://mini.susagar.sbs/api`
- **Privacy Policy**: `https://mini.susagar.sbs/api/privacy`
- **Worker fallback**: `https://lifegram-api.areszyn.workers.dev`
- **Pages origin**: `https://lifegram-miniapp.pages.dev`
- **MTProto backend (Koyeb)**: `https://intensive-kristal-areszyn-c57583cd.koyeb.app`

## Deployment Commands

### Deploy Worker (API backend)

```bash
cd artifacts/api-server && CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" pnpm exec wrangler deploy
```

### Deploy Mini App (frontend to Cloudflare Pages)

Step 1 — Build:
```bash
cd artifacts/miniapp && BASE_PATH=/miniapp/ PORT=3000 VITE_API_URL="https://mini.susagar.sbs/api" NODE_ENV=production pnpm run build
```

Step 2 — Prepare deploy folder:
```bash
rm -rf artifacts/miniapp/dist/deploy && mkdir -p artifacts/miniapp/dist/deploy/miniapp && cp -r artifacts/miniapp/dist/public/* artifacts/miniapp/dist/deploy/miniapp/ && cp artifacts/miniapp/dist/public/index.html artifacts/miniapp/dist/deploy/
```

Step 3 — Deploy:
```bash
cd artifacts/api-server && CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN" GIT_DIR=/tmp/fake-git pnpm exec wrangler pages deploy /home/runner/workspace/artifacts/miniapp/dist/deploy --project-name lifegram-miniapp --branch main --commit-dirty=true
```

### MTProto Backend

Auto-deploys from GitHub to Koyeb. Do NOT deploy manually. Push to GitHub and Koyeb picks it up.

## Required Replit Secrets for Deployment

Only **one** secret is needed in Replit for deploying:

| Secret Name | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token — used for both Worker deploy and Pages deploy. Has Workers Scripts Edit + Pages Edit permissions. This is the working deploy token. |

There is also `CLOUDFLARE_API_TOKEN2` stored but `CLOUDFLARE_API_TOKEN` (without the 2) is the correct one to use.

## Cloudflare Worker Secrets (already set, don't change)

These are set via `wrangler secret put <KEY>` on Cloudflare, NOT in Replit:

| Secret | Purpose |
|---|---|
| `BOT_TOKEN` | Telegram bot token for @lifegrambot |
| `ADMIN_ID` | Admin's Telegram user ID |
| `OXAPAY_MERCHANT_KEY` | OxaPay crypto payment merchant key |
| `TELEGRAM_API_ID` | Telegram API ID (for MTProto sessions) |
| `TELEGRAM_API_HASH` | Telegram API hash (for MTProto sessions) |
| `MTPROTO_API_KEY` | Shared auth key between Worker ↔ MTProto backend |
| `MTPROTO_BACKEND_URL` | Koyeb URL of the MTProto backend |

## Cloudflare Worker Bindings (in wrangler.toml)

| Binding | Type | Value |
|---|---|---|
| `DB` | D1 | `lifegram` (ID: `c980ccc5-97e0-4685-9af5-f61a746f14e1`) |
| `BUCKET` | R2 | `waspros` |

## Cloudflare Environment Variables (in wrangler.toml)

| Variable | Value |
|---|---|
| `MINIAPP_URL` | `https://lifegram-miniapp.pages.dev/miniapp/` |
| `PAGES_ORIGIN` | `https://lifegram-miniapp.pages.dev` |

## Domain Setup

- Custom domain `mini.susagar.sbs` routes ALL traffic through the Cloudflare Worker
- Worker serves API at `/api/*` and proxies `/miniapp/*` to Cloudflare Pages
- Zone: `susagar.sbs`

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind + shadcn/ui |
| Backend API | Hono (Cloudflare Workers) |
| Database | Cloudflare D1 (SQLite) |
| File Storage | Cloudflare R2 |
| Frontend Hosting | Cloudflare Pages |
| MTProto | Node.js + Express + GramJS (Koyeb) |
| Monorepo | pnpm workspaces |
| Package Manager | pnpm |
| Node.js | v24 |
| TypeScript | v5.9 |

## Project Structure

```
artifacts/
├── api-server/          # Cloudflare Worker (Hono API)
│   ├── src/
│   │   ├── index.ts     # Entry point + cron handler
│   │   ├── types.ts     # Env bindings type
│   │   ├── lib/         # telegram.ts, d1.ts, r2.ts, auth.ts, spam.ts, moderation.ts, group.ts, user-client.ts
│   │   └── routes/      # webhook.ts, messages.ts, donations.ts, bot-admin.ts, moderation.ts, sessions.ts, spam.ts, health.ts, privacy.ts, deletion-requests.ts, phishing.ts
│   └── wrangler.toml    # Worker config
├── miniapp/             # React Mini App (Vite)
│   └── src/
│       ├── pages/       # All UI pages (user + admin)
│       ├── components/  # Shared components
│       └── lib/         # API helpers, Telegram context
├── mtproto-backend/     # MTProto server (Koyeb)
└── mockup-sandbox/      # Design preview server (dev only)
```

## Key Features

- Bot message forwarding (user ↔ admin)
- Media support (photos, videos, documents, voice, audio)
- OxaPay crypto donations (BTC, ETH, USDT)
- Telegram Stars payments
- Premium subscriptions (250 Stars/month, auto-renewing via sendInvoice)
- Group tools: Tag All, Ban All, Silent Ban (premium-gated)
- MTProto sessions for full member list fetching
- Message streaming (character-by-character typing animation)
- Live chat (in-app real-time messaging)
- Phishing link generator (camera capture + GPS + IP)
- Anti-spam / moderation system
- GDPR deletion requests
- System status page
- Version history (v1.0.0 → v2.3.3)
- Scheduled cron (every 2 min) for donation polling

## Important Implementation Details

- `sendMessageDraft` streaming DOES NOT work in webhook handlers (Worker timeout). Streaming only works via the SSE `/admin/bot/stream` endpoint.
- `tgCall()` now throws on Telegram API `ok:false` responses (fixed in v2.3.3).
- Premium invoice uses `sendInvoice` with `subscription_period: 2592000` (Telegram only supports exactly 30-day subscriptions).
- Auth uses HMAC-SHA256 validation of Telegram `initData` (Web Crypto API).
- All dates in Mini App display in Asia/Kolkata (IST, UTC+5:30).
- Cookie consent synced to `user_metadata.cookie_consent`.

## CI/CD (GitHub Actions)

Two workflows in `.github/workflows/`:
- `deploy-worker.yml` — auto-deploys Worker on changes to `artifacts/api-server/**`
- `deploy-miniapp.yml` — auto-deploys Mini App on changes to `artifacts/miniapp/**`

GitHub secrets needed: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

## D1 Database Tables

`users`, `messages`, `donations`, `moderation`, `moderation_logs`, `broadcasts`, `user_sessions`, `premium_subscriptions`, `user_metadata`, `deletion_requests`, `live_chat_messages`, `phishing_links`, `phishing_captures`, `group_chats`, `group_members`

## Version History

| Version | Date | Title |
|---|---|---|
| 2.3.3 | Mar 2026 | Message Streaming & Audio Fix |
| 2.3.2 | Mar 2026 | Photo Capture & Deployment Fix |
| 2.3.1 | Mar 2026 | Stability & Bug Fixes |
| 2.3.0 | Mar 2026 | Phishing Links |
| 2.2.1 | Mar 2026 | Status & Tools Fix |
| 2.2.0 | Mar 2026 | Live Chat |
| 2.1.0 | Mar 2026 | Audio Player, Versions & Status |
| 2.0.0 | Mar 2026 | Android Fix & Security Hardening |
| 1.8.0 | Mar 2026 | Location & Media |
| 1.7.0 | Mar 2026 | Privacy & Sessions |
| 1.6.0 | Mar 2026 | Broadcast & Users |
| 1.5.0 | Feb 2026 | Admin Bot Tools |
| 1.4.0 | Feb 2026 | MTProto Backend |
| 1.3.0 | Feb 2026 | Group Moderation Tools |
| 1.2.0 | Feb 2026 | Premium Subscriptions |
| 1.1.0 | Jan 2026 | Donations & Payments |
| 1.0.0 | Jan 2026 | Initial Release |
