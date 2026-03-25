import { Layout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Rocket, Bug, Shield, Zap, Star, Globe, Users,
  CreditCard, MessageCircle, ShieldCheck, Music2,
  Activity, Wrench, Eye, Camera,
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
    color: "text-blue-400",
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
    color: "text-green-400",
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
    color: "text-yellow-400",
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
    color: "text-purple-400",
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
    color: "text-cyan-400",
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
    color: "text-orange-400",
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
    color: "text-pink-400",
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
    color: "text-emerald-400",
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
    color: "text-indigo-400",
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
    color: "text-red-400",
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
    color: "text-violet-400",
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
    color: "text-amber-400",
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
    color: "text-cyan-400",
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
    color: "text-red-400",
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
    color: "text-emerald-400",
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
    color: "text-blue-400",
    changes: [
      { type: "improved", text: "Phishing capture photos now stored via Bot API file_id for reliable display" },
      { type: "added", text: "Public /file/:fileId proxy endpoint for serving Bot API photos" },
      { type: "added", text: "AuthImage component for legacy captures using auth headers" },
      { type: "fixed", text: "Blank screen caused by incorrect asset path resolution on Cloudflare Pages" },
      { type: "fixed", text: "Mini App now served from default Pages domain instead of custom domain" },
    ],
  },
];

const typeBadge = {
  added: { label: "New", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  improved: { label: "Improved", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  fixed: { label: "Fixed", color: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export function VersionsPage() {
  return (
    <Layout title="Version History">
      <div className="h-full overflow-y-auto">
        <div className="p-4 space-y-4">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Lifegram Changelog</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{versions.length} releases · v1.0.0 → v{versions[versions.length - 1].version}</p>
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
