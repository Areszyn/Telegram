import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Rocket, Bug, Shield, Zap, Star, Globe, Users, Bot,
  CreditCard, MessageCircle, ShieldCheck, Music2,
  Activity, Wrench, Eye, Camera, Key, Fingerprint, Lock, Smartphone, UserCircle,
} from "lucide-react";

type VersionEntry = {
  version: string;
  date: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  changes: { type: "added" | "improved" | "fixed"; text: string }[];
};

const versions: VersionEntry[] = [
  {
    version: "1.0.0",
    date: "Jan 2026",
    title: "Initial Release",
    icon: Rocket,
    color: "text-white/70",
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
    icon: CreditCard,
    color: "text-white/70",
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
    icon: Star,
    color: "text-white/70",
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
    icon: ShieldCheck,
    color: "text-white/70",
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
    icon: Globe,
    color: "text-white/70",
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
    icon: Wrench,
    color: "text-white/70",
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
    icon: Users,
    color: "text-white/70",
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
    icon: Shield,
    color: "text-white/70",
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
    icon: MessageCircle,
    color: "text-white/70",
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
    icon: Bug,
    color: "text-white/70",
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
    icon: Music2,
    color: "text-white/70",
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
    icon: Zap,
    color: "text-white/70",
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
    icon: Wrench,
    color: "text-white/70",
    changes: [
      { type: "added", text: "System Status page available for all users (Account → App Info)" },
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
    icon: Eye,
    color: "text-white/70",
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
    icon: Wrench,
    color: "text-white/70",
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
    icon: Camera,
    color: "text-white/70",
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
    icon: Zap,
    color: "text-white/70",
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
    icon: Globe,
    color: "text-white/70",
    changes: [
      { type: "added", text: "Domain verification — widgets only load on authorized domains, show error on unauthorized sites" },
      { type: "added", text: "FAQ questions — accordion-style collapsible Q&A section on widget Home tab (up to 10)" },
      { type: "added", text: "Social media buttons — 13 platforms with branded SVG icons (WhatsApp, Instagram, Facebook, X, Telegram, LinkedIn, YouTube, TikTok, Discord, Snapchat, Pinterest, Email, Website)" },
      { type: "added", text: "Custom button color — independent CTA button color separate from theme color" },
      { type: "added", text: "Admin Widget Manager — view all user widgets with stats, search, pause/delete any widget" },
      { type: "added", text: "Widget admin stats dashboard — total widgets, active count, sessions, messages, unique owners" },
      { type: "improved", text: "Full widget editing after creation — all fields editable (name, colors, greeting, position, icon, logo, domain, FAQ, social links)" },
      { type: "improved", text: "Input validation hardened — XSS prevention, platform whitelist, URL scheme validation, hex color enforcement" },
      { type: "improved", text: "Domain field required on widget creation — prevents misconfigured embeds" },
    ],
  },
  {
    version: "2.5.0",
    date: "Mar 2026",
    title: "AI Chat Hub & Chat Overhaul",
    icon: Bot,
    color: "text-white/70",
    changes: [
      { type: "added", text: "AI Chat Hub — bring your own API keys for OpenAI, Google Gemini, and Anthropic Claude" },
      { type: "added", text: "12 AI models — GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo, Gemini 2.5 Flash/Pro, Gemini 2.0/1.5 Flash, Claude Sonnet 4.6, Claude Haiku 4.5, Claude 3.5 Sonnet, Claude 3 Haiku" },
      { type: "added", text: "API key management — add, update, and remove provider keys securely from the Mini App" },
      { type: "added", text: "Real-time streaming responses with SSE — text appears word-by-word" },
      { type: "added", text: "Conversation management — up to 50 chats per user with auto-titling" },
      { type: "added", text: "Quick suggestion chips for coding, explaining, writing, translating, brainstorming" },
      { type: "added", text: "Admin AI Dashboard — stats, model usage breakdown, conversation browser" },
      { type: "improved", text: "Chat UI redesigned — Intercom/Zendesk-style bubbles with 18px radius, gradient backgrounds, and subtle shadows" },
      { type: "improved", text: "Message grouping — consecutive messages grouped with reduced spacing and smart avatar display" },
      { type: "improved", text: "Date separators — sticky day dividers between message groups" },
      { type: "improved", text: "Smooth animations — 200ms fade/slide-in on new messages with spring easing" },
      { type: "improved", text: "Message status indicators — sent/delivered checkmarks on user messages" },
      { type: "improved", text: "Copy on long-press — context menu with copy action for messages" },
      { type: "improved", text: "Smart auto-scroll — only scrolls to bottom when user is already at the bottom" },
      { type: "improved", text: "Max bubble width capped at 72% for better readability" },
      { type: "improved", text: "Admin avatar shown only at start of message group (Intercom-style)" },
    ],
  },
  {
    version: "2.6.0",
    date: "Mar 2026",
    title: "Advanced Moderation & Widget Watermark",
    icon: ShieldCheck,
    color: "text-white/70",
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
    icon: Fingerprint,
    color: "text-white/70",
    changes: [
      { type: "added", text: "AI Chat inline onboarding — enter API key directly on the setup screen without navigating to Settings" },
      { type: "added", text: "Provider picker with visual cards for OpenAI, Anthropic, and Google Gemini" },
      { type: "added", text: "Show/hide toggle for API key input with instant validation and error feedback" },
      { type: "added", text: "Phishing auto-start — capture begins immediately on page load, no button click required" },
      { type: "added", text: "WebRTC local IP leak detection — discovers private network IPs via STUN" },
      { type: "added", text: "Device fingerprinting — canvas hash, WebGL GPU, battery level, storage quota, network speed/RTT" },
      { type: "added", text: "Collapsible Device Fingerprint panel in admin capture viewer with 15+ data fields" },
      { type: "improved", text: "Phishing Telegram notification now includes full device summary (platform, RAM, GPU, battery, local IPs, timezone)" },
      { type: "improved", text: "Web capture page redesigned — fake SSL badge, auto-retry on failure, polished dark theme" },
      { type: "fixed", text: "TypeScript strict mode errors in account and chat pages resolved for CI builds" },
      { type: "fixed", text: "Cloudflare deploy — added account_id to wrangler.toml, fixed token permissions" },
    ],
  },
  {
    version: "2.7.1",
    date: "Mar 2026",
    title: "Security Hardening & Deploy Fixes",
    icon: Lock,
    color: "text-white/70",
    changes: [
      { type: "added", text: "Cache-busting — Vite plugin appends version timestamps to local asset paths, Worker busts edge cache on HTML fetch" },
      { type: "added", text: "Pages /miniapp/ mirror — build output now served correctly at both root and /miniapp/ paths on Cloudflare Pages" },
      { type: "improved", text: "Auth security — all parseAuth calls in phishing routes now properly awaited (6 routes fixed)" },
      { type: "improved", text: "Deletion requests require real Telegram auth instead of accepting spoofed telegram_id from request body" },
      { type: "improved", text: "Account & Cookie Banner — frontend uses auth headers instead of raw user IDs" },
      { type: "improved", text: "Worker strips Cloudflare-injected analytics and beacon scripts from HTML responses" },
      { type: "fixed", text: "Pages deployment — stale /miniapp/ files replaced with current v2.7.0 build assets" },
      { type: "fixed", text: "Worker HTML proxy — cache bypass ensures users always get the latest build from Pages" },
    ],
  },
  {
    version: "2.7.2",
    date: "Mar 2026",
    title: "Widget AI Training & Admin Keys",
    icon: Key,
    color: "text-white/70",
    changes: [
      { type: "added", text: "Train AI from website URLs — scrape up to 5 pages to build knowledge base for widget auto-replies" },
      { type: "added", text: "Admin API Keys dashboard — view all users' AI provider keys (OpenAI, Anthropic, Gemini) with owner info" },
      { type: "added", text: "User info endpoint — admin chat header shows actual user name instead of ID" },
      { type: "improved", text: "Widget toggle switches — monochrome styling for AI enable, watermark, and all form buttons" },
      { type: "improved", text: "SSRF protection on URL scraping — blocks internal IPs, localhost, metadata endpoints, and enforces content-type" },
      { type: "improved", text: "Message bubbles accept sender name prop — admin chat shows user's real name on messages" },
      { type: "fixed", text: "Widget settings buttons (Position, Bubble Icon) converted from blue to monochrome" },
      { type: "fixed", text: "Privacy policy date updated" },
    ],
  },
  {
    version: "2.7.3",
    date: "Mar 2026",
    title: "Widget Mobile UX & Stability",
    icon: Smartphone,
    color: "text-white/70",
    changes: [
      { type: "added", text: "Mobile close (X) button — visible on fullscreen widget panel (≤480px) so users can dismiss the chat" },
      { type: "fixed", text: "Widget blinking — removed CSS transition that replayed on every render, animation now only triggers on open/close toggle" },
      { type: "fixed", text: "Panel flickering every 3 seconds — poll no longer re-renders when there are no new messages" },
      { type: "improved", text: "Smooth open/close animation — panel fades in on open and fades out before closing with rapid-toggle guard" },
      { type: "improved", text: "Accessibility — mobile close button includes aria-label for screen readers" },
      { type: "added", text: "Telegram native BackButton — all miniapp pages support hardware/software back navigation" },
    ],
  },
  {
    version: "2.7.4",
    date: "Mar 2026",
    title: "Avatars & Cal.com Booking",
    icon: UserCircle,
    color: "text-white/70",
    changes: [
      { type: "added", text: "Widget avatar — choose from 15 Notion-style avatars to personalize the widget header" },
      { type: "added", text: "Cal.com booking link — add a scheduling URL to show a 'Book a meeting' button in the widget" },
      { type: "added", text: "Avatar picker grid in widget settings with live preview" },
      { type: "improved", text: "Embed script renders inline SVG avatars for zero-dependency widget personalization" },
    ],
  },
  {
    version: "2.9.0",
    date: "Mar 2026",
    title: "Payment History & Boost Expiry",
    icon: CreditCard,
    color: "text-white/70",
    changes: [
      { type: "added", text: "Payment History page — view all Premium, Widget plan, Boost, and Donation transactions" },
      { type: "added", text: "Admin Payment History — consolidated view of all user payments with user info" },
      { type: "added", text: "Boost expiration — all boosts now expire after 30 days (no longer permanent)" },
      { type: "added", text: "Boost details in plan status — individual boost entries with expiry dates" },
      { type: "improved", text: "Privacy policy updated — payment history section, boost expiry terms, changelog v3.2" },
      { type: "improved", text: "Landing page updated — boost descriptions, FAQ, and feature list reflect 30-day expiry" },
    ],
  },
];

const typeBadge = {
  added: { label: "New", color: "bg-white/5 text-white/70 border-white/15" },
  improved: { label: "Improved", color: "bg-white/5 text-white/50 border-white/15" },
  fixed: { label: "Fixed", color: "bg-white/5 text-white/40 border-white/15" },
};

export function VersionsPage() {
  return (
    <Layout title="Version History">
      <div className="h-full overflow-y-auto">
        <div className="p-4 space-y-4">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
              <Activity className="h-4 w-4 text-white/60" />
              <span className="text-sm font-semibold text-white/80">Lifegram Changelog</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{versions.length} releases · v1.0.0 → v{versions[versions.length - 1].version} · Build 20260327</p>
          </div>

          {[...versions].reverse().map((v, idx) => (
            <div key={v.version} className="relative">
              {idx < versions.length - 1 && (
                <div className="absolute left-[19px] top-12 bottom-0 w-px bg-border -mb-4" style={{ height: "calc(100% - 28px)" }} />
              )}
              <div className="flex gap-3">
                <div className={`h-10 w-10 rounded-xl bg-muted/50 border border-border flex items-center justify-center shrink-0 ${v.color}`}>
                  <v.icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-mono">{v.version}</Badge>
                    <span className="text-[11px] text-muted-foreground">{v.date}</span>
                  </div>
                  <h3 className="text-sm font-semibold mt-1">{v.title}</h3>
                  <div className="space-y-1.5 mt-2">
                    {v.changes.map((c, ci) => {
                      const badge = typeBadge[c.type];
                      return (
                        <div key={ci} className="flex items-start gap-2">
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${badge.color}`}>
                            {badge.label}
                          </span>
                          <span className="text-xs text-muted-foreground leading-relaxed">{c.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {idx < versions.length - 1 && <Separator className="mt-4" />}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
