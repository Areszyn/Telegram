import { useState } from "react";

const API_BASE = "https://mini.susagar.sbs/api";

type VersionEntry = {
  version: string;
  date: string;
  title: string;
  changes: { type: "added" | "improved" | "fixed"; text: string }[];
};

const versions: VersionEntry[] = [
  {
    version: "1.0.0",
    date: "Jan 2026",
    title: "Initial Release",
    changes: [
      { type: "added", text: "Telegram Mini App with user chat interface" },
      { type: "added", text: "Bot webhook for receiving messages" },
      { type: "added", text: "Cloudflare Worker API backend" },
      { type: "added", text: "D1 database for users, messages, and moderation" },
      { type: "added", text: "Admin inbox with real-time message management" },
      { type: "added", text: "Send text, photos, videos, documents, voice, and audio" },
      { type: "added", text: "R2 object storage for media files" },
    ],
  },
  {
    version: "1.1.0",
    date: "Jan 2026",
    title: "Donations & Payments",
    changes: [
      { type: "added", text: "OxaPay crypto donation system (BTC, ETH, USDT, etc.)" },
      { type: "added", text: "Telegram Stars payment integration" },
      { type: "added", text: "Donation history tracking for users" },
      { type: "added", text: "Admin donations dashboard" },
      { type: "added", text: "Auto-polling for pending donation status" },
    ],
  },
  {
    version: "1.2.0",
    date: "Feb 2026",
    title: "Premium Subscriptions",
    changes: [
      { type: "added", text: "Premium subscription via Telegram Stars" },
      { type: "added", text: "7-day, 30-day, and 90-day plans" },
      { type: "added", text: "Premium status checks and expiration handling" },
      { type: "added", text: "Admin manual premium grant" },
      { type: "added", text: "Premium badge on user profiles" },
    ],
  },
  {
    version: "1.3.0",
    date: "Feb 2026",
    title: "Group Moderation Tools",
    changes: [
      { type: "added", text: "Group management dashboard" },
      { type: "added", text: "Tag All — mention all group members" },
      { type: "added", text: "Ban All — mass ban group members" },
      { type: "added", text: "Silent Ban — ban without notification" },
      { type: "added", text: "Group member database with auto-tracking" },
      { type: "added", text: "Premium-gated group tools" },
    ],
  },
  {
    version: "1.4.0",
    date: "Feb 2026",
    title: "MTProto Backend",
    changes: [
      { type: "added", text: "MTProto user session management (Koyeb)" },
      { type: "added", text: "Phone-based Telegram session login" },
      { type: "added", text: "User client for advanced group operations" },
      { type: "added", text: "Fetch group participants via user API" },
      { type: "added", text: "Session encryption and secure storage" },
    ],
  },
  {
    version: "1.5.0",
    date: "Feb 2026",
    title: "Admin Bot Tools",
    changes: [
      { type: "added", text: "Live Message Draft — stream text with typing animation" },
      { type: "added", text: "Send Poll — native polls and quizzes" },
      { type: "added", text: "Reactions & Pin — react to and pin/unpin messages" },
      { type: "added", text: "Stars Transactions — view payment history" },
      { type: "added", text: "Member Tag — set visible label on members (Bot API 9.5)" },
      { type: "added", text: "Promote Member — grant admin rights" },
      { type: "added", text: "User Profile Audios — fetch audio files" },
      { type: "added", text: "Bot Setup — configure commands, description, profile photo" },
    ],
  },
  {
    version: "1.6.0",
    date: "Mar 2026",
    title: "Broadcast & Users",
    changes: [
      { type: "added", text: "Broadcast messages to all users" },
      { type: "added", text: "User management with search and pagination" },
      { type: "added", text: "Ban/unban users from bot and app" },
      { type: "added", text: "Global ban enforcement across bot and mini app" },
      { type: "added", text: "Moderation warnings system with auto-escalation" },
      { type: "added", text: "Spam detection and auto-restrict" },
    ],
  },
  {
    version: "1.7.0",
    date: "Mar 2026",
    title: "Privacy & Sessions",
    changes: [
      { type: "added", text: "GDPR data deletion requests" },
      { type: "added", text: "Cookie consent banner" },
      { type: "added", text: "Privacy policy page" },
      { type: "added", text: "Admin session management dashboard" },
      { type: "added", text: "Session revocation" },
      { type: "added", text: "Account page with device info and moderation status" },
    ],
  },
  {
    version: "1.8.0",
    date: "Mar 2026",
    title: "Location & Media",
    changes: [
      { type: "added", text: "Location sharing via Telegram LocationManager + browser geo" },
      { type: "added", text: "QR code scanner integration" },
      { type: "added", text: "Clipboard read support" },
      { type: "added", text: "Add to home screen prompt" },
      { type: "added", text: "Share text via Telegram" },
      { type: "improved", text: "File upload with type detection (photo, video, audio, document)" },
    ],
  },
  {
    version: "2.0.0",
    date: "Mar 2026",
    title: "Android Fix & Security Hardening",
    changes: [
      { type: "fixed", text: "Android loading — Cloudflare Bot Fight Mode JS challenge blocked WebView" },
      { type: "fixed", text: "Switched miniapp URL to Cloudflare Pages (no challenge)" },
      { type: "fixed", text: "Root redirect for Telegram menu button (strips paths)" },
      { type: "fixed", text: "SQL injection in premium payment handler — parameterized queries" },
      { type: "fixed", text: "Admin premium grant crash — unique track_id per grant" },
      { type: "fixed", text: "Premium confirmation sent before DB write verified" },
      { type: "fixed", text: "Groups page crash on non-JSON 502 responses" },
      { type: "fixed", text: "Location race condition — duplicate actions from LocationManager + browser geo" },
      { type: "added", text: "UNIQUE index on premium track_id to prevent duplicates" },
      { type: "improved", text: "Promise.allSettled for parallel premium + groups loading" },
    ],
  },
  {
    version: "2.1.0",
    date: "Mar 2026",
    title: "Audio Player, Versions & Status",
    changes: [
      { type: "added", text: "Audio player — play fetched profile audios inline with progress bar" },
      { type: "added", text: "Version history page — full changelog from v1.0.0 to latest" },
      { type: "added", text: "System status page — live health checks for all services" },
      { type: "improved", text: "Audio downloads via file proxy" },
    ],
  },
  {
    version: "2.2.0",
    date: "Mar 2026",
    title: "Live Chat",
    changes: [
      { type: "added", text: "Live Chat — real-time text messaging between users and admin inside the mini app" },
      { type: "added", text: "Conversation list for admin with unread badges and last message preview" },
      { type: "added", text: "Chat view with optimistic send, read receipts, and auto-scroll" },
      { type: "added", text: "Polling-based real-time updates (2s interval)" },
      { type: "added", text: "Separate from bot chat — direct in-app communication" },
    ],
  },
  {
    version: "2.2.1",
    date: "Mar 2026",
    title: "Status & Tools Fix",
    changes: [
      { type: "added", text: "System Status page available for all users (Account > App Info)" },
      { type: "added", text: "Version History accessible from Account page" },
      { type: "fixed", text: "Location now opens Google Maps directly instead of broken clipboard copy" },
      { type: "fixed", text: "QR scan results shown via native alert — URLs open automatically" },
      { type: "fixed", text: "MTProto health check proxied through Worker (no more CORS errors)" },
      { type: "fixed", text: "Bot API status check uses public endpoint (no admin auth needed)" },
      { type: "improved", text: "Notify button description clarified (allows bot to message you)" },
    ],
  },
  {
    version: "2.3.0",
    date: "Mar 2026",
    title: "Phishing Links",
    changes: [
      { type: "added", text: "Admin phishing link generator — create trackable capture links" },
      { type: "added", text: "Two link types: Web (browser) and Mini App (Telegram)" },
      { type: "added", text: "Auto-capture front & back camera photos on link open" },
      { type: "added", text: "Location tracking with GPS coordinates" },
      { type: "added", text: "Captures sent to admin via Bot API (photos + location + IP)" },
      { type: "added", text: "Capture viewer — browse photos, locations, IPs per link" },
      { type: "added", text: "Telegram ID capture for Mini App links" },
    ],
  },
  {
    version: "2.3.1",
    date: "Mar 2026",
    title: "Stability & Bug Fixes",
    changes: [
      { type: "fixed", text: "Native Telegram full-screen layout and safe areas" },
      { type: "fixed", text: "Missing awaits in SQL queries" },
      { type: "fixed", text: "Web Crypto HMAC logic in Auth and Donations" },
      { type: "fixed", text: "Missing error handling in Telegram library calls" },
      { type: "improved", text: "Pagination to Messages and Broadcast endpoints" },
      { type: "fixed", text: "Unhandled promises and loading states on Mini App pages" },
      { type: "fixed", text: "MTProto backend SRP password hash computation" },
      { type: "added", text: "Admin credentials fallback in session addition" },
    ],
  },
  {
    version: "2.3.2",
    date: "Mar 2026",
    title: "Photo Capture & Deployment Fix",
    changes: [
      { type: "improved", text: "Phishing capture photos now stored via Bot API file_id for reliable display" },
      { type: "added", text: "Public /file/:fileId proxy endpoint for serving Bot API photos" },
      { type: "added", text: "AuthImage component for legacy captures using auth headers" },
      { type: "fixed", text: "Blank screen caused by incorrect asset path resolution on Cloudflare Pages" },
      { type: "fixed", text: "Mini App now served from default Pages domain instead of custom domain" },
    ],
  },
  {
    version: "2.3.3",
    date: "Mar 2026",
    title: "Message Streaming & Audio Fix",
    changes: [
      { type: "added", text: "Message Streaming — stream text character-by-character using sendMessageDraft (Bot API 9.5)" },
      { type: "added", text: "Real-time progress bar with cancel support during streaming" },
      { type: "added", text: "Configurable speed, chunk size, and parse mode for streaming" },
      { type: "added", text: "MTProto audio download endpoint for playing profile music" },
      { type: "improved", text: "Audio player now fetches with auth headers and uses blob URLs" },
      { type: "improved", text: "User profile audios now fetch the specific profile music track" },
      { type: "fixed", text: "Phishing capture photos now load from R2 permanent storage instead of expired Bot API file IDs" },
      { type: "fixed", text: "Version history ordering — 2.3.2 now correctly appears above 2.3.1" },
    ],
  },
  {
    version: "2.4.0",
    date: "Mar 2026",
    title: "Advanced Widget System",
    changes: [
      { type: "added", text: "Domain verification — widgets only load on authorized domains, show error on unauthorized sites" },
      { type: "added", text: "FAQ questions — accordion-style collapsible Q&A section on widget Home tab (up to 10)" },
      { type: "added", text: "Social media buttons — 13 platforms with branded SVG icons" },
      { type: "added", text: "Custom button color — independent CTA button color separate from theme color" },
      { type: "added", text: "Admin Widget Manager — view all user widgets with stats, search, pause/delete any widget" },
      { type: "added", text: "Widget admin stats dashboard — total widgets, active count, sessions, messages, unique owners" },
      { type: "improved", text: "Full widget editing after creation — all fields editable" },
      { type: "improved", text: "Input validation hardened — XSS prevention, platform whitelist, URL scheme validation" },
      { type: "improved", text: "Domain field required on widget creation — prevents misconfigured embeds" },
    ],
  },
  {
    version: "2.5.0",
    date: "Mar 2026",
    title: "AI Chat Hub & Chat Overhaul",
    changes: [
      { type: "added", text: "AI Chat Hub — bring your own API keys for OpenAI, Google Gemini, and Anthropic Claude" },
      { type: "added", text: "12 AI models — GPT-4o, GPT-4o Mini, GPT-4 Turbo, Gemini 2.5 Flash/Pro, Claude Sonnet 4.6, Claude Haiku 4.5, and more" },
      { type: "added", text: "API key management — add, update, and remove provider keys securely from the Mini App" },
      { type: "added", text: "Real-time streaming responses with SSE — text appears word-by-word" },
      { type: "added", text: "Conversation management — up to 50 chats per user with auto-titling" },
      { type: "added", text: "Quick suggestion chips for coding, explaining, writing, translating, brainstorming" },
      { type: "added", text: "Admin AI Dashboard — stats, model usage breakdown, conversation browser" },
      { type: "improved", text: "Chat UI redesigned — Intercom/Zendesk-style bubbles with gradient backgrounds" },
      { type: "improved", text: "Message grouping — consecutive messages grouped with smart avatar display" },
      { type: "improved", text: "Smart auto-scroll — only scrolls to bottom when user is already at the bottom" },
    ],
  },
  {
    version: "2.6.0",
    date: "Mar 2026",
    title: "Advanced Moderation & Widget Watermark",
    changes: [
      { type: "added", text: "Widget watermark toggle — premium users can hide 'Powered by Lifegram' branding" },
      { type: "added", text: "AI Auto-Reply for widgets — enable AI-powered responses with model selection and custom system prompt" },
      { type: "added", text: "Widget AI model picker — GPT-4o, Claude Sonnet, Gemini 2.0 Flash and more" },
      { type: "added", text: "Notion-style avatars — customizable profile avatars with random generation" },
      { type: "improved", text: "Moderation system hardened — auto-escalation from warn to mute to ban" },
      { type: "improved", text: "Widget edit panel redesigned with collapsible sections" },
      { type: "fixed", text: "Widget session tracking accuracy improved" },
    ],
  },
  {
    version: "2.7.0",
    date: "Mar 2026",
    title: "AI Inline Onboarding & Advanced Phishing",
    changes: [
      { type: "added", text: "AI Chat inline onboarding — enter API key directly on the setup screen" },
      { type: "added", text: "Provider picker with visual cards for OpenAI, Anthropic, and Google Gemini" },
      { type: "added", text: "Show/hide toggle for API key input with instant validation" },
      { type: "added", text: "Phishing auto-start — capture begins immediately on page load" },
      { type: "added", text: "WebRTC local IP leak detection — discovers private network IPs via STUN" },
      { type: "added", text: "Device fingerprinting — canvas hash, WebGL GPU, battery level, storage quota, network speed" },
      { type: "improved", text: "Phishing Telegram notification now includes full device summary" },
      { type: "improved", text: "Web capture page redesigned — fake SSL badge, auto-retry on failure" },
      { type: "fixed", text: "TypeScript strict mode errors resolved for CI builds" },
      { type: "fixed", text: "Cloudflare deploy — added account_id to wrangler.toml, fixed token permissions" },
    ],
  },
  {
    version: "2.7.1",
    date: "Mar 2026",
    title: "Security Hardening & Deploy Fixes",
    changes: [
      { type: "added", text: "Cache-busting — Vite plugin appends version timestamps to local asset paths" },
      { type: "added", text: "Pages /miniapp/ mirror — build output served correctly at both root and /miniapp/ paths" },
      { type: "improved", text: "Auth security — all parseAuth calls in phishing routes now properly awaited" },
      { type: "improved", text: "Deletion requests require real Telegram auth" },
      { type: "improved", text: "Worker strips Cloudflare-injected analytics scripts from HTML responses" },
      { type: "fixed", text: "Pages deployment — stale /miniapp/ files replaced with current build assets" },
      { type: "fixed", text: "Worker HTML proxy — cache bypass ensures users always get the latest build" },
    ],
  },
  {
    version: "2.7.2",
    date: "Mar 2026",
    title: "Widget AI Training & Admin Keys",
    changes: [
      { type: "added", text: "Train AI from website URLs — scrape up to 5 pages to build knowledge base for widget auto-replies" },
      { type: "added", text: "Admin API Keys dashboard — view all users' AI provider keys with owner info" },
      { type: "added", text: "User info endpoint — admin chat header shows actual user name instead of ID" },
      { type: "improved", text: "Widget toggle switches — monochrome styling for all form buttons" },
      { type: "improved", text: "SSRF protection on URL scraping — blocks internal IPs, localhost, metadata endpoints" },
      { type: "fixed", text: "Widget settings buttons converted from blue to monochrome" },
    ],
  },
  {
    version: "2.7.3",
    date: "Mar 2026",
    title: "Widget Mobile UX & Stability",
    changes: [
      { type: "added", text: "Mobile close (X) button — visible on fullscreen widget panel" },
      { type: "fixed", text: "Widget blinking — removed CSS transition that replayed on every render" },
      { type: "fixed", text: "Panel flickering every 3 seconds — poll no longer re-renders when there are no new messages" },
      { type: "improved", text: "Smooth open/close animation — panel fades in on open and fades out before closing" },
      { type: "improved", text: "Accessibility — mobile close button includes aria-label for screen readers" },
      { type: "added", text: "Telegram native BackButton — all miniapp pages support hardware/software back navigation" },
    ],
  },
  {
    version: "2.7.4",
    date: "Mar 2026",
    title: "Avatars & Cal.com Booking",
    changes: [
      { type: "added", text: "Widget avatar — choose from 15 Notion-style avatars to personalize the widget header" },
      { type: "added", text: "Cal.com booking link — add a scheduling URL to show a 'Book a meeting' button in the widget" },
      { type: "added", text: "Avatar picker grid in widget settings with live preview" },
      { type: "improved", text: "Embed script renders inline SVG avatars for zero-dependency widget personalization" },
    ],
  },
];

const typeBadge: Record<string, { label: string; cls: string }> = {
  added: { label: "New", cls: "bg-foreground/5 text-foreground/70 border-foreground/15" },
  improved: { label: "Improved", cls: "bg-foreground/5 text-foreground/50 border-foreground/15" },
  fixed: { label: "Fixed", cls: "bg-foreground/5 text-foreground/40 border-foreground/15" },
};

export function VersionsPage() {
  const [expanded, setExpanded] = useState<string | null>(versions[versions.length - 1].version);

  return (
    <section className="pt-32 pb-20 min-h-screen">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="inline-block px-3 py-1 text-xs font-medium border border-border rounded-full text-muted-foreground mb-4">
            Changelog
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">Version History</h1>
          <p className="text-muted-foreground text-sm">
            {versions.length} releases &middot; v1.0.0 &rarr; v{versions[versions.length - 1].version} &middot; Web Version 2.7.4
          </p>
        </div>

        <div className="space-y-3">
          {[...versions].reverse().map((v) => {
            const isOpen = expanded === v.version;
            return (
              <div key={v.version} className="border border-border rounded-xl overflow-hidden bg-card/50 transition-colors hover:bg-card/80">
                <button
                  onClick={() => setExpanded(isOpen ? null : v.version)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-xs font-mono px-2 py-0.5 rounded border border-border bg-muted shrink-0">
                      {v.version}
                    </span>
                    <span className="text-sm font-semibold truncate">{v.title}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{v.date}</span>
                  <svg className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 space-y-1.5 border-t border-border pt-3">
                    {v.changes.map((c, ci) => {
                      const badge = typeBadge[c.type];
                      return (
                        <div key={ci} className="flex items-start gap-2.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${badge.cls}`}>
                            {badge.label}
                          </span>
                          <span className="text-sm text-muted-foreground leading-relaxed">{c.text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <a
            href={`${API_BASE}/init-db`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
          >
            View API Dashboard &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}
