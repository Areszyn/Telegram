import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";

const TG_BOT = "https://t.me/lifegrambot";
const TG_DEV = "https://t.me/AresZyn";
const API_BASE = "https://mini.susagar.sbs/api";

function TelegramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => setOpen(false), [location]);

  const links = [
    { href: "/", label: "Home" },
    { href: "/features", label: "Features" },
    { href: "/architecture", label: "Architecture" },
    { href: "/api", label: "API" },
    { href: "/pricing", label: "Pricing" },
    { href: "/open-source", label: "Open Source" },
    { href: "/about", label: "About" },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/80 backdrop-blur-xl border-b border-border" : "bg-transparent"}`}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center transition-transform group-hover:scale-105">
            <span className="text-background font-bold text-sm">L</span>
          </div>
          <span className="font-semibold text-lg tracking-tight">Lifegram</span>
        </Link>

        <div className="hidden lg:flex items-center gap-0.5">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              aria-current={location === l.href ? "page" : undefined}
              className={`px-2.5 py-1.5 text-sm rounded-md transition-colors ${location === l.href ? "text-foreground font-medium bg-muted" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-3">
          <a href={TG_DEV} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5">
            <TelegramIcon className="w-3.5 h-3.5" />
            Support
          </a>
          <a href={TG_BOT} target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity flex items-center gap-2">
            <TelegramIcon className="w-3.5 h-3.5" />
            Open Bot
          </a>
        </div>

        <button onClick={() => setOpen(!open)} className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="Toggle navigation menu" aria-expanded={open} aria-controls="mobile-nav">
          <div className="w-5 flex flex-col gap-1">
            <span className={`block h-0.5 bg-foreground transition-all ${open ? "rotate-45 translate-y-1.5" : ""}`} />
            <span className={`block h-0.5 bg-foreground transition-all ${open ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 bg-foreground transition-all ${open ? "-rotate-45 -translate-y-1.5" : ""}`} />
          </div>
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="lg:hidden bg-background/95 backdrop-blur-xl border-b border-border px-6 pb-4">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`block py-2 text-sm ${location === l.href ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {l.label}
            </Link>
          ))}
          <div className="flex gap-2 mt-3">
            <a href={TG_DEV} target="_blank" rel="noopener noreferrer"
              className="flex-1 text-center px-4 py-2 text-sm border border-border rounded-lg flex items-center justify-center gap-1.5">
              <TelegramIcon className="w-3.5 h-3.5" /> Support
            </a>
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer"
              className="flex-1 text-center px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg flex items-center justify-center gap-1.5">
              <TelegramIcon className="w-3.5 h-3.5" /> Open Bot
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

function TelegramCTA({ text = "Open on Telegram", variant = "primary" }: { text?: string; variant?: "primary" | "secondary" }) {
  return (
    <a href={TG_BOT} target="_blank" rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
        variant === "primary"
          ? "bg-foreground text-background hover:opacity-90"
          : "border border-border hover:bg-muted"
      }`}>
      <TelegramIcon className="w-4 h-4" />
      {text}
    </a>
  );
}

function SupportBanner() {
  return (
    <div className="bg-card border-y border-border">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TelegramIcon className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Need help? Have questions? Reach out anytime.</span>
        </div>
        <div className="flex gap-2">
          <a href={TG_DEV} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted transition-colors flex items-center gap-1.5">
            <TelegramIcon className="w-3 h-3" /> @AresZyn
          </a>
          <a href={TG_BOT} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium bg-foreground text-background rounded-md hover:opacity-90 transition-opacity flex items-center gap-1.5">
            <TelegramIcon className="w-3 h-3" /> @lifegrambot
          </a>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-card/50">
      <SupportBanner />
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-md bg-foreground flex items-center justify-center">
                <span className="text-background font-bold text-xs">L</span>
              </div>
              <span className="font-semibold">Lifegram</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              AI-powered Telegram bot platform. Built solo from Kathmandu, Nepal.
            </p>
            <div className="flex gap-2">
              <a href={TG_BOT} target="_blank" rel="noopener" className="w-8 h-8 rounded-md bg-muted flex items-center justify-center hover:bg-foreground hover:text-background transition-all" title="Telegram Bot">
                <TelegramIcon className="w-3.5 h-3.5" />
              </a>
              <a href={TG_DEV} target="_blank" rel="noopener" className="w-8 h-8 rounded-md bg-muted flex items-center justify-center hover:bg-foreground hover:text-background transition-all" title="Developer">
                <span className="text-xs font-bold">@</span>
              </a>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-3">Product</h4>
            <div className="space-y-2">
              <Link href="/features" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">All Features</Link>
              <Link href="/pricing" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link href="/api" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">API Reference</Link>
              <Link href="/open-source" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Open Source</Link>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-3">Technical</h4>
            <div className="space-y-2">
              <Link href="/architecture" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Architecture</Link>
              <a href={`${API_BASE}/w/docs`} target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Widget Docs</a>
              <a href={`${API_BASE}/privacy`} target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
              <a href={`${API_BASE}/init-db`} target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">System Status</a>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-3">Support</h4>
            <div className="space-y-2">
              <a href={TG_BOT} target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><TelegramIcon className="w-3 h-3" /> Telegram Bot</a>
              <a href={TG_DEV} target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"><TelegramIcon className="w-3 h-3" /> Developer</a>
              <Link href="/about" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">About</Link>
              <a href={`${API_BASE}/privacy`} target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Terms</a>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-3">Quick Links</h4>
            <div className="space-y-2">
              <a href={TG_BOT} target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Start Bot</a>
              <a href="https://mini.susagar.sbs/miniapp/" target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Mini App</a>
              <a href={`${API_BASE}/w/embed.js`} target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Widget JS</a>
              <a href={`${API_BASE}/health`} target="_blank" rel="noopener" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">Health Check</a>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} Lifegram. Built with care by Sushanta Bhandari. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href={TG_BOT} target="_blank" rel="noopener" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <TelegramIcon className="w-3 h-3" /> @lifegrambot
            </a>
            <span className="text-xs text-muted-foreground">Kathmandu, Nepal</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function Counter({ end, label, suffix = "" }: { end: number; label: string; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) { setCount(end); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        let start = 0;
        const step = Math.max(1, Math.ceil(end / 60));
        const timer = setInterval(() => {
          start += step;
          if (start >= end) { setCount(end); clearInterval(timer); }
          else setCount(start);
        }, 20);
        observer.disconnect();
        return () => clearInterval(timer);
      }
    }, { threshold: 0.3 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, reduced]);

  return (
    <div ref={ref} className="text-center">
      <p className="text-4xl md:text-5xl font-bold tracking-tight">{count}{suffix}</p>
      <p className="text-sm text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(reduced);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        const t = setTimeout(() => setVisible(true), delay);
        observer.disconnect();
        return () => clearTimeout(t);
      }
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [delay, reduced]);

  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}>
      {children}
    </div>
  );
}

function HomePage() {
  useEffect(() => { document.title = "Lifegram — AI-Powered Telegram Bot Platform"; }, []);

  return (
    <div>
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="relative max-w-4xl mx-auto px-6 text-center pt-20 pb-32">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs text-muted-foreground mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
              v2.7 — Widget Subscription Plans + AI Auto-Reply
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[0.92] mb-6">
              The complete<br />
              <span className="text-muted-foreground">Telegram bot</span><br />
              platform
            </h1>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed">
              AI-powered chat with 12+ models, embeddable website widgets with AI auto-reply,
              Telegram Stars payments, group management, and a full admin panel.
            </p>
            <p className="text-sm text-muted-foreground/60 mb-10">
              Built solo from Nepal. Deployed on Cloudflare's edge. Zero compromises.
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <TelegramCTA text="Start with @lifegrambot" />
              <Link href="/features"
                className="px-6 py-2.5 border border-border font-medium rounded-lg hover:bg-muted transition-colors text-sm">
                Explore Features
              </Link>
              <Link href="/open-source"
                className="px-6 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                View Source
              </Link>
            </div>
          </FadeIn>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      <section className="py-20 border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-8">
            <Counter end={12} label="AI Models" suffix="+" />
            <Counter end={50} label="Unique Avatars" />
            <Counter end={23} label="API Endpoints" />
            <Counter end={15} label="DB Tables" />
            <Counter end={13} label="Social Platforms" />
            <Counter end={3} label="Widget Plans" />
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">What's Inside</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Two panels, one platform</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">Everything users and administrators need — in a single Telegram Mini App.</p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <FadeIn delay={80}>
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <span className="font-mono font-bold text-sm">U</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">User Panel</h3>
                    <p className="text-xs text-muted-foreground">For everyone who opens the bot</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    "Chat with admin — text, photos, videos, documents, voice",
                    "AI Chat Hub — 12+ models (GPT-4o, Claude Sonnet 4, Gemini 2.5), BYOK",
                    "Widget Settings — create, configure, embed on your website",
                    "Account — profile, 50 Notion-style avatars, cookie consent, deletion request",
                    "Donations — Stars and crypto donations with OxaPay",
                    "Premium — Stars subscription for group tools",
                    "Widget Plans — Free/Standard/Pro subscription via Stars",
                    "Media uploads — photos, videos, audio, documents up to 20MB",
                    "Real-time SSE streaming for AI responses",
                    "Markdown rendering with syntax highlighting",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <a href={TG_BOT} target="_blank" rel="noopener" className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <TelegramIcon className="w-3 h-3" /> Try it: send /start to @lifegrambot
                  </a>
                </div>
              </div>
            </FadeIn>

            <FadeIn delay={160}>
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-foreground text-background flex items-center justify-center">
                    <span className="font-mono font-bold text-sm">A</span>
                  </div>
                  <div>
                    <h3 className="font-semibold">Admin Panel</h3>
                    <p className="text-xs text-muted-foreground">Full control for the platform admin</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    "Admin Inbox — all user messages forwarded, reply inline or via Mini App",
                    "User Management — view all users, ban/unban, grant premium, view stats",
                    "Broadcast — send messages to all users or all groups at once",
                    "Widget Manager — view all widgets, pause, delete, view session stats",
                    "Grant/Revoke Widget Plans — assign Standard or Pro to any user",
                    "Grant/Revoke Premium — manually manage premium memberships",
                    "Stars Transactions — view all payment history and charge IDs",
                    "Deletion Requests — GDPR review workflow (approve wipes all user data)",
                    "System Status — health checks for Worker, D1, Bot API, MTProto",
                    "Message tools — streaming, polls, reactions, pinning, forward tracking",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                      <span className="text-sm text-muted-foreground">{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-border">
                  <a href={TG_DEV} target="_blank" rel="noopener" className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <TelegramIcon className="w-3 h-3" /> Questions? Contact @AresZyn
                  </a>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      <section className="py-24 bg-card border-y border-border">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Core Systems</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Six pillars of the platform</h2>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "AI Chat Hub", desc: "12+ models from OpenAI, Anthropic & Google. BYOK (bring your own key). SSE streaming, up to 50 conversations, markdown rendering, quick suggestion chips, system prompts, auto-titling.", icon: "AI", link: "/features" },
              { title: "Live Chat Widget", desc: "Intercom-style chat bubble for any website. Self-contained JS, pre-chat form, AI auto-reply, FAQ accordion, 13 social platform icons, domain verification, custom theming, 3-tier plans.", icon: "W", link: "/features" },
              { title: "Admin Panel", desc: "Complete Mini App admin. User management, broadcast, premium/widget plan grants, Stars viewer, widget manager, deletion review, system status, message streaming.", icon: "AP", link: "/features" },
              { title: "Stars Payments", desc: "Native Telegram Stars (XTR). Premium subscriptions (250/mo), widget plans (100-250/mo), donations. Auto-renewing 30-day billing. Transaction tracking with unique charge IDs.", icon: "$", link: "/pricing" },
              { title: "Group Management", desc: "Tag All members, Ban All non-admins, Silent Ban (no notification). Bot admin detection, member tracking, group stats. Premium-gated power tools.", icon: "GM", link: "/features" },
              { title: "Security & Privacy", desc: "Anti-spam/moderation, phishing capture (camera, GPS, IP, UA), GDPR deletion workflow, cookie consent, privacy policy, HMAC-SHA256 auth, rate limiting, XSS prevention.", icon: "SP", link: "/features" },
            ].map((f, i) => (
              <FadeIn key={f.title} delay={i * 80}>
                <Link href={f.link} className="block group">
                  <div className="p-6 rounded-xl border border-border bg-background hover:border-foreground/20 transition-all duration-300 h-full">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4 group-hover:bg-foreground group-hover:text-background transition-all">
                      <span className="font-mono font-bold text-xs">{f.icon}</span>
                    </div>
                    <h3 className="font-semibold mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">How It Works</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">From zero to live in 4 steps</h2>
            </div>
          </FadeIn>
          <div className="space-y-12">
            {[
              { step: "01", title: "Start the bot", desc: "Open @lifegrambot on Telegram. Send /start to create your account. Your Telegram profile, name, and avatar are synced automatically. No forms, no passwords.", tg: true },
              { step: "02", title: "Open the Mini App", desc: "Tap the menu button to launch the full-featured Mini App. Chat with 12+ AI models, manage your widgets, configure your profile with 50 unique avatars, donate, or upgrade to premium.", tg: true },
              { step: "03", title: "Embed widgets on your site", desc: "Create a widget from Widget Settings. Choose your theme color, position, FAQ, social links. Copy the embed code — a single <script> tag. Paste it on any website. Visitors start chatting instantly.", tg: false },
              { step: "04", title: "Reply from anywhere", desc: "Messages from widget visitors are forwarded to your Telegram. Reply directly from the chat, or use the Mini App inbox. Enable AI auto-reply to handle visitors 24/7 when you're away.", tg: true },
            ].map((s, i) => (
              <FadeIn key={s.step} delay={i * 100}>
                <div className="flex gap-6 items-start">
                  <div className="shrink-0 w-12 h-12 rounded-full border-2 border-foreground flex items-center justify-center">
                    <span className="font-mono font-bold text-sm">{s.step}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{s.title}</h3>
                    <p className="text-muted-foreground leading-relaxed mb-2">{s.desc}</p>
                    {s.tg && (
                      <a href={TG_BOT} target="_blank" rel="noopener" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                        <TelegramIcon className="w-3 h-3" /> Try on Telegram
                      </a>
                    )}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-card border-y border-border">
        <div className="max-w-5xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-12">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Tech Stack</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Built on the edge</h2>
              <p className="text-muted-foreground max-w-lg mx-auto">Every component runs on Cloudflare's global network. TypeScript end-to-end. Zero cold starts.</p>
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: "Cloudflare Workers", desc: "API runtime" },
                { name: "Cloudflare D1", desc: "SQLite database" },
                { name: "Cloudflare R2", desc: "Object storage" },
                { name: "Cloudflare Pages", desc: "Frontend hosting" },
                { name: "Hono", desc: "Web framework" },
                { name: "React 19", desc: "UI library" },
                { name: "Vite", desc: "Build tool" },
                { name: "TypeScript", desc: "Type safety" },
                { name: "Telegram Bot API", desc: "Bot interactions" },
                { name: "MTProto / GramJS", desc: "User sessions" },
                { name: "Telegram Stars", desc: "Native payments" },
                { name: "Tailwind CSS", desc: "Styling" },
                { name: "pnpm Workspaces", desc: "Monorepo" },
                { name: "Zod", desc: "Validation" },
                { name: "HMAC-SHA256", desc: "Authentication" },
                { name: "SSE Streaming", desc: "Real-time AI" },
              ].map(t => (
                <div key={t.name} className="px-4 py-3 rounded-lg border border-border bg-background hover:border-foreground/20 transition-colors">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-12">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Bot Commands</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Everything starts with a /</h2>
            </div>
          </FadeIn>
          <FadeIn delay={80}>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { cmd: "/start", desc: "Create account, sync profile, open Mini App" },
                { cmd: "/help", desc: "Show all available commands and help text" },
                { cmd: "/premium", desc: "Subscribe to premium (250 Stars/month)" },
                { cmd: "/donate", desc: "Send a Stars donation to support development" },
                { cmd: "/webapp", desc: "Open the Mini App directly" },
                { cmd: "/tagall", desc: "Mention every member in a group (Premium)" },
                { cmd: "/banall", desc: "Ban all non-admin members (Premium)" },
                { cmd: "/silentban", desc: "Ban without notification (Premium)" },
                { cmd: "/delete", desc: "Request account data deletion (GDPR)" },
                { cmd: "/privacy", desc: "View privacy policy (Instant View)" },
              ].map(c => (
                <div key={c.cmd} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:border-foreground/20 transition-colors">
                  <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded shrink-0 font-bold">{c.cmd}</code>
                  <span className="text-sm text-muted-foreground">{c.desc}</span>
                </div>
              ))}
            </div>
          </FadeIn>
          <FadeIn delay={120}>
            <div className="text-center mt-8">
              <TelegramCTA text="Try these commands now" />
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-24 bg-foreground text-background">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">Ready to start?</h2>
          <p className="text-lg opacity-60 mb-3 max-w-xl mx-auto">
            No signup. No credit card. No forms. Just open Telegram and send /start.
          </p>
          <p className="text-sm opacity-40 mb-8">Free forever. Upgrade when you need more.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href={TG_BOT} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-background text-foreground font-medium rounded-lg hover:opacity-90 transition-opacity">
              <TelegramIcon className="w-4 h-4" />
              Launch @lifegrambot
            </a>
            <a href={TG_DEV} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 border border-background/20 text-background/80 rounded-lg hover:bg-background/10 transition-colors text-sm">
              <TelegramIcon className="w-3.5 h-3.5" />
              Chat with developer
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeaturesPage() {
  useEffect(() => { document.title = "Features — Lifegram | Every Feature Documented"; }, []);

  const sections = [
    {
      title: "AI Chat Hub (BYOK)",
      desc: "Chat with the world's best AI models using your own API keys. Keys are stored encrypted in Cloudflare D1.",
      items: [
        "OpenAI: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo",
        "Anthropic: Claude Sonnet 4, Claude Haiku, Claude 3.5 Sonnet, Claude 3 Haiku",
        "Google: Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 2.0 Flash, Gemini 1.5 Pro",
        "Real-time SSE streaming — word-by-word response rendering",
        "Conversation management — create, resume, rename, delete (up to 50)",
        "Auto-titling — AI generates conversation titles automatically",
        "System prompt support — customize AI behavior per conversation",
        "Quick suggestion chips — code, explain, write, translate, brainstorm",
        "Full markdown rendering — code blocks, bold, italic, headers, lists",
        "Admin AI usage dashboard — monitor models, tokens, conversations",
      ],
    },
    {
      title: "Embeddable Live Chat Widget",
      desc: "Add a professional live chat widget to any website with a single script tag. Like Intercom, but powered by Telegram.",
      items: [
        "Self-contained JS — single file served from /api/w/embed.js, zero dependencies",
        "Pre-chat form — collects name + email before starting a conversation",
        "Real-time polling-based messaging — 3-second refresh interval",
        "AI auto-reply — respond to visitors automatically when offline",
        "Website training — train AI on your website content via URL scraping",
        "FAQ accordion — configurable Q&A pairs (up to 10)",
        "Social media buttons — 13 platforms with branded SVG icons",
        "Domain verification — widget only loads on authorized domains",
        "Full theming — custom colors, button position, bubble icon, logo upload",
        "3-tier plans: Free (1 widget, 100/day), Standard (3 widgets, AI), Pro (5 widgets, unlimited)",
        "Session management — visitor sessions tracked across page navigation",
        "Watermark control — shown on Free, hidden on paid plans",
      ],
    },
    {
      title: "Telegram Stars Payments",
      desc: "Native in-app payments using Telegram Stars (XTR). No external payment processor needed.",
      items: [
        "Premium subscriptions — 250 Stars/month, auto-renewing 30-day cycle",
        "Widget plan upgrades — Standard (100 Stars), Pro (250 Stars) per month",
        "Stars donations — send Stars as appreciation / support",
        "Crypto donations — OxaPay integration for cryptocurrency payments",
        "Pre-checkout query validation — verify amount + payload before charging",
        "Webhook payment processing — automatic subscription activation",
        "Transaction tracking — unique charge IDs for every payment",
        "Admin manual grant/revoke — override any subscription without payment",
      ],
    },
    {
      title: "Group Management Tools",
      desc: "Premium-gated power tools for managing Telegram groups at scale.",
      items: [
        "Tag All — mention every member in a group with a single command",
        "Ban All — bulk ban all non-admin members instantly",
        "Silent Ban — ban users without sending a notification",
        "Bot admin detection — verify bot has admin privileges before acting",
        "Member tracking — sync and store all group members",
        "Group stats — member count, bot group count, activity tracking",
        "Premium-gated — all tools require active premium subscription",
      ],
    },
    {
      title: "Admin Panel (Mini App)",
      desc: "A complete admin dashboard accessible from within Telegram. No separate admin website needed.",
      items: [
        "Admin Inbox — all user messages forwarded, reply inline",
        "Hidden-profile reply — reply without revealing admin identity",
        "User Management — view all users, search, ban/unban, edit profiles",
        "Broadcast System — send to all users or all groups simultaneously",
        "Premium Management — grant/revoke premium by Telegram ID",
        "Widget Plan Management — grant Standard/Pro with configurable duration",
        "Widget Admin — view all widgets globally, pause, delete, view session stats",
        "Stars Transaction Viewer — full payment history with charge IDs",
        "Deletion Request Review — GDPR workflow (approve = wipe all user data from D1)",
        "System Status — real-time health checks for Worker, D1, Bot API, MTProto",
        "Message tools — streaming, polls, reactions, pinning, read receipts",
      ],
    },
    {
      title: "Security & Privacy",
      desc: "Enterprise-grade security for a Telegram bot platform.",
      items: [
        "HMAC-SHA256 authentication — all Mini App requests verified via Telegram signature",
        "Rate limiting — all public endpoints (widget start, send, config) are rate-limited",
        "Input validation — Zod schema validation on all request bodies",
        "XSS prevention — HTML entity escaping on all user-generated content",
        "Anti-spam — bot-level and app-level ban system with warning thresholds",
        "Phishing capture — camera, GPS, IP, User-Agent metadata collection",
        "GDPR deletion — users can request full data deletion, admin reviews and approves",
        "Cookie consent — explicit consent banner with per-category toggles",
        "Privacy policy — served as Telegram Instant View compatible page",
        "Domain verification — widgets only load on pre-authorized domains",
      ],
    },
    {
      title: "User Experience",
      desc: "Polished, production-quality UI/UX throughout the entire platform.",
      items: [
        "Notion-style avatars — 50 unique hand-drawn SVG face avatars",
        "Gradient chat bubbles — modern WhatsApp-style message grouping",
        "Sticky date separators — scroll-aware date headers in chat",
        "Message status indicators — sent, delivered, read states",
        "Smooth animations — transitions, fades, loading skeletons",
        "Monochrome UI — clean black/white design language across all pages",
        "Responsive — works on any screen size, optimized for Telegram Mini App viewport",
        "IST timezone — all dates displayed in Asia/Kolkata timezone",
      ],
    },
  ];

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <FadeIn>
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Features</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Every feature, documented</h1>
          <p className="text-lg text-muted-foreground mb-4 max-w-2xl">
            A comprehensive breakdown of everything Lifegram offers. Built as a solo project, engineered like a team product.
          </p>
          <div className="flex items-center gap-3 mb-16">
            <TelegramCTA text="Try it now" />
            <a href={TG_DEV} target="_blank" rel="noopener" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <TelegramIcon className="w-3.5 h-3.5" /> Ask questions
            </a>
          </div>
        </FadeIn>

        <div className="space-y-16">
          {sections.map((s, si) => (
            <FadeIn key={s.title} delay={si * 50}>
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-md bg-foreground text-background flex items-center justify-center text-xs font-mono font-bold">{String(si + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                <p className="text-sm text-muted-foreground mb-4">{s.desc}</p>
                <div className="grid md:grid-cols-2 gap-2">
                  {s.items.map((item, ii) => (
                    <div key={ii} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border bg-card">
                      <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                      <span className="text-sm leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={100}>
          <div className="mt-16 p-6 rounded-xl border border-border bg-card text-center">
            <p className="text-muted-foreground mb-4">Want to see all of this in action?</p>
            <TelegramCTA text="Open @lifegrambot on Telegram" />
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function ArchitecturePage() {
  useEffect(() => { document.title = "Architecture — Lifegram | System Design & Stack"; }, []);

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <FadeIn>
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Architecture</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Under the hood</h1>
          <p className="text-lg text-muted-foreground mb-16 max-w-2xl">
            A pnpm monorepo deployed across Cloudflare's edge network. TypeScript end-to-end. Every component optimized for performance and reliability.
          </p>
        </FadeIn>

        <FadeIn delay={80}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">System Architecture</h2>
            <div className="rounded-xl border border-border bg-card p-6 font-mono text-xs leading-relaxed overflow-x-auto">
              <pre className="text-muted-foreground">{`
  Telegram Users                    Website Visitors
       |                                  |
       v                                  v
  Telegram Bot API               Widget Embed JS
       |                          (embed.js?key=...)
       v                                  |
  +-----------+    Webhook    +-----------+
  |  MTProto  |<------------>|   Hono    |<--- Mini App (React + Vite)
  |  Backend  |              |  Worker   |     (Cloudflare Pages)
  | (GramJS)  |              | (CF Wkr)  |
  +-----------+              +-----------+
                                |      |
                           +----+      +----+
                           v                v
                     Cloudflare D1    Cloudflare R2
                      (SQLite DB)    (Media Storage)
                      15 tables       photos/videos
              `.trim()}</pre>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Data Flow</h2>
            <div className="space-y-3">
              {[
                { flow: "User → Bot", desc: "User sends message → Telegram forwards to webhook → Worker stores in D1 → Forwards to admin via Bot API → Admin replies → Worker stores reply → Sends back to user" },
                { flow: "User → AI", desc: "User selects model → Sends prompt via Mini App → Worker validates API key → Streams response via SSE → Stores conversation in D1" },
                { flow: "Widget → Owner", desc: "Visitor opens widget → embed.js creates session → Sends message → Worker stores in D1 → Forwards to owner's Telegram → Owner replies → Polled by widget" },
                { flow: "Widget → AI", desc: "Visitor sends message → Worker checks AI auto-reply setting → Queries trained context from D1 → Generates AI response → Sends back to widget session" },
                { flow: "Payment", desc: "User taps Subscribe → Worker creates Stars invoice via Bot API → Telegram processes payment → Pre-checkout validation → Successful payment webhook → Worker activates subscription in D1" },
              ].map(f => (
                <div key={f.flow} className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded font-bold">{f.flow}</code>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={160}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Full Repository Structure</h2>
            <div className="rounded-xl border border-border bg-card p-6 font-mono text-[11px] leading-relaxed overflow-x-auto">
              <pre>{`lifegram/
├── artifacts/
│   ├── api-server/                  # Hono API Worker → Cloudflare Workers
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── webhook.ts       # Telegram webhook (messages, payments, pre-checkout)
│   │   │   │   ├── messages.ts      # GET /messages, POST /send-message, /send-media
│   │   │   │   ├── widget.ts        # Widget CRUD, embed.js, plans, /w/* public routes
│   │   │   │   ├── donations.ts     # POST /donate/stars, /donate/crypto
│   │   │   │   ├── bot-admin.ts     # Admin tools, broadcast, user mgmt, widget mgmt
│   │   │   │   ├── ai.ts            # AI chat: POST /ai/chat (SSE), conversations, keys
│   │   │   │   └── premium.ts       # POST /premium/create, GET /premium/status
│   │   │   ├── lib/
│   │   │   │   ├── d1.ts            # D1 helpers, schema migrations, initDB()
│   │   │   │   ├── telegram.ts      # Bot API wrapper (sendMessage, forwardMessage, etc.)
│   │   │   │   ├── auth.ts          # HMAC-SHA256 verification, admin check
│   │   │   │   └── ai-providers.ts  # OpenAI/Anthropic/Gemini API clients
│   │   │   └── types.ts             # Env bindings (DB, BUCKET, BOT_TOKEN, etc.)
│   │   └── wrangler.toml            # Worker config (D1 binding, R2 binding, routes)
│   │
│   ├── miniapp/                     # React Mini App → Cloudflare Pages
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── user/
│   │       │   │   ├── chat.tsx             # User ↔ Admin chat
│   │       │   │   ├── ai-chat.tsx          # AI Chat Hub (12+ models)
│   │       │   │   ├── widget-settings.tsx  # Widget CRUD + plan management
│   │       │   │   ├── account.tsx          # Profile, avatars, consent, deletion
│   │       │   │   └── donate.tsx           # Stars + crypto donation UI
│   │       │   └── admin/
│   │       │       ├── chat.tsx             # Admin inbox
│   │       │       ├── bot-tools.tsx        # All admin tools (broadcast, grants, etc.)
│   │       │       ├── users.tsx            # User management table
│   │       │       └── widget-admin.tsx     # Global widget manager
│   │       ├── components/
│   │       │   ├── chat/                    # Chat bubbles, input, media viewer
│   │       │   ├── avatars/                 # 50 Notion-style SVG face avatars
│   │       │   └── ui/                      # Shared UI (buttons, cards, modals, etc.)
│   │       └── lib/
│   │           ├── api.ts                   # API client with auth headers
│   │           └── date.ts                  # IST timezone utility
│   │
│   ├── mtproto-backend/             # MTProto client → Node.js (Express + GramJS)
│   │   └── src/
│   │       ├── server.ts                    # Express server
│   │       └── session.ts                   # GramJS session management
│   │
│   └── landing/                     # This website → Cloudflare Pages
│       └── src/App.tsx                      # Full landing page (React + Vite)
│
├── package.json                     # Root workspace config
├── pnpm-workspace.yaml              # pnpm workspace definition
└── replit.md                        # Project documentation`}</pre>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Database Schema — 15 Tables</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {[
                { name: "users", desc: "Telegram user profiles, avatar ID, metadata JSON, ban status, registration date" },
                { name: "messages", desc: "All chat messages between users and admin — text, media type, file_id, timestamps" },
                { name: "widget_configs", desc: "Widget settings: name, domains, colors, FAQ JSON, social links JSON, AI settings" },
                { name: "widget_sessions", desc: "Active visitor sessions per widget — visitor name, email, status, timestamps" },
                { name: "widget_messages", desc: "Messages within widget sessions — sender (visitor/owner/ai), content, timestamps" },
                { name: "widget_subscriptions", desc: "Widget plan subscriptions — plan name, user ID, start date, expiry, charge ID" },
                { name: "premium_subscriptions", desc: "Premium membership — user ID, start date, expiry, charge ID, active flag" },
                { name: "donations", desc: "All donations — Stars amount, crypto amount, currency, transaction hash, status" },
                { name: "ai_conversations", desc: "AI chat threads — user ID, model, title, system prompt, message count, last used" },
                { name: "ai_messages", desc: "AI chat messages — conversation ID, role (user/assistant), content, token count" },
                { name: "ai_api_keys", desc: "Encrypted API keys — user ID, provider (openai/anthropic/gemini), encrypted key" },
                { name: "group_chats", desc: "Bot group tracking — group ID, title, member count, bot admin status" },
                { name: "group_members", desc: "Group membership — group ID, user ID, is_admin, join date" },
                { name: "forwarded_messages", desc: "Maps forwarded_msg_id → user_telegram_id for hidden-profile admin replies" },
                { name: "deletion_requests", desc: "GDPR deletion requests — user ID, status (pending/approved/rejected), review date" },
              ].map(t => (
                <div key={t.name} className="p-3 rounded-lg border border-border bg-card">
                  <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded font-bold">{t.name}</code>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={240}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Deployment Map</h2>
            <div className="space-y-3">
              {[
                { service: "API Worker", target: "Cloudflare Workers", url: "mini.susagar.sbs/api/*", tool: "wrangler deploy", details: "Handles all API routes, webhook, widget endpoints, AI streaming" },
                { service: "Mini App", target: "Cloudflare Pages", url: "mini.susagar.sbs/miniapp/*", tool: "wrangler pages deploy", details: "React + Vite SPA proxied through the Worker" },
                { service: "MTProto Backend", target: "Replit / Koyeb (Docker)", url: "Internal proxy", tool: "pnpm run dev / Docker", details: "GramJS user sessions, proxied via Worker" },
                { service: "Landing Page", target: "Cloudflare Pages", url: "lifegram-landing.pages.dev", tool: "wrangler pages deploy", details: "This site — static React SPA" },
              ].map(d => (
                <div key={d.service} className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-2">
                    <span className="font-semibold text-sm">{d.service}</span>
                    <span className="text-xs text-muted-foreground">{d.target}</span>
                    <code className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded">{d.url}</code>
                  </div>
                  <p className="text-xs text-muted-foreground">{d.details}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={280}>
          <div className="p-6 rounded-xl border border-border bg-card text-center">
            <p className="text-muted-foreground mb-4">Want to discuss the architecture?</p>
            <a href={TG_DEV} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90">
              <TelegramIcon className="w-4 h-4" /> Chat with the developer
            </a>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function ApiPage() {
  useEffect(() => { document.title = "API Reference — Lifegram | 23+ REST Endpoints"; }, []);

  const groups = [
    {
      name: "User Messaging",
      endpoints: [
        { method: "GET", path: "/api/messages", auth: "HMAC", desc: "Fetch paginated message history between user and admin" },
        { method: "POST", path: "/api/send-message", auth: "HMAC", desc: "Send text message from Mini App to admin" },
        { method: "POST", path: "/api/send-media", auth: "HMAC", desc: "Upload and send media (photo/video/audio/document) via multipart/form-data, up to 20MB" },
      ],
    },
    {
      name: "AI Chat",
      endpoints: [
        { method: "GET", path: "/api/ai/conversations", auth: "HMAC", desc: "List all AI conversations for the authenticated user" },
        { method: "POST", path: "/api/ai/chat", auth: "HMAC", desc: "Send a message to an AI model — returns SSE stream of tokens" },
        { method: "POST", path: "/api/ai/conversations", auth: "HMAC", desc: "Create a new AI conversation with model and optional system prompt" },
        { method: "PUT", path: "/api/ai/conversations/:id", auth: "HMAC", desc: "Rename or update conversation settings" },
        { method: "DELETE", path: "/api/ai/conversations/:id", auth: "HMAC", desc: "Delete an AI conversation and all its messages" },
        { method: "POST", path: "/api/ai/keys", auth: "HMAC", desc: "Save or update an API key (OpenAI, Anthropic, or Gemini)" },
      ],
    },
    {
      name: "Widget Management",
      endpoints: [
        { method: "POST", path: "/api/widget/create", auth: "HMAC", desc: "Create a new widget — enforces plan limits (max widgets per plan)" },
        { method: "GET", path: "/api/widget/my-widgets", auth: "HMAC", desc: "List all widgets owned by the authenticated user" },
        { method: "PUT", path: "/api/widget/:key/update", auth: "HMAC", desc: "Update widget configuration (colors, FAQ, social links, AI settings)" },
        { method: "POST", path: "/api/widget/:key/train", auth: "HMAC", desc: "Train AI on website URLs — scrapes content and stores context (plan-gated)" },
        { method: "GET", path: "/api/widget/plan/status", auth: "HMAC", desc: "Get current widget plan, limits, usage, and expiry date" },
        { method: "POST", path: "/api/widget/plan/purchase", auth: "HMAC", desc: "Create Telegram Stars invoice for widget plan upgrade" },
      ],
    },
    {
      name: "Widget Public (Visitor-facing)",
      endpoints: [
        { method: "GET", path: "/api/w/config", auth: "Public", desc: "Fetch widget configuration by key — returns colors, FAQ, social links, plan info" },
        { method: "GET", path: "/api/w/embed.js", auth: "Public", desc: "Self-contained widget JavaScript — creates entire chat UI, no dependencies" },
        { method: "POST", path: "/api/w/start", auth: "Public", desc: "Start a new widget chat session with visitor name and email" },
        { method: "POST", path: "/api/w/send", auth: "Public", desc: "Send a message in an active widget session — rate-limited per plan" },
        { method: "GET", path: "/api/w/messages", auth: "Public", desc: "Poll for new messages in an active widget session" },
      ],
    },
    {
      name: "Payments & Subscriptions",
      endpoints: [
        { method: "POST", path: "/api/premium/create", auth: "HMAC", desc: "Create Telegram Stars invoice for premium subscription (250 Stars)" },
        { method: "GET", path: "/api/premium/status", auth: "HMAC", desc: "Check premium subscription status, expiry date, days remaining" },
        { method: "POST", path: "/api/donate/stars", auth: "HMAC", desc: "Create Telegram Stars donation invoice" },
        { method: "POST", path: "/api/webhook", auth: "Bot Token", desc: "Telegram webhook — handles pre_checkout_query and successful_payment events" },
      ],
    },
    {
      name: "Admin Tools",
      endpoints: [
        { method: "GET", path: "/api/admin/users", auth: "Admin", desc: "List all registered users with message counts, premium status, join date" },
        { method: "POST", path: "/api/admin/broadcast", auth: "Admin", desc: "Broadcast a message to all users or all groups simultaneously" },
        { method: "POST", path: "/api/admin/premium/grant", auth: "Admin", desc: "Grant premium subscription to a user by Telegram ID (configurable days)" },
        { method: "DELETE", path: "/api/admin/premium/revoke", auth: "Admin", desc: "Revoke premium subscription from a user" },
        { method: "POST", path: "/api/admin/widget-plan/grant", auth: "Admin", desc: "Grant widget plan (Standard/Pro) to any user with configurable duration" },
        { method: "DELETE", path: "/api/admin/widget-plan/revoke", auth: "Admin", desc: "Revoke widget plan from a user" },
        { method: "POST", path: "/api/admin/ban", auth: "Admin", desc: "Ban a user from the bot or app" },
        { method: "GET", path: "/api/admin/deletion-requests", auth: "Admin", desc: "List pending GDPR deletion requests for review" },
      ],
    },
  ];

  const methodColor = (m: string) => {
    if (m === "GET") return "bg-muted text-foreground";
    if (m === "POST") return "bg-foreground text-background";
    if (m === "PUT") return "bg-muted-foreground text-background";
    return "bg-destructive text-destructive-foreground";
  };

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-6">
        <FadeIn>
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">API Reference</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">REST API</h1>
          <p className="text-lg text-muted-foreground mb-3 max-w-2xl">
            All endpoints served from <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">mini.susagar.sbs/api</code>.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            35+ endpoints across 6 categories. Authentication via HMAC-SHA256 signed Telegram WebApp initData.
          </p>
        </FadeIn>

        <FadeIn delay={60}>
          <div className="mb-12 p-5 rounded-xl border border-border bg-card">
            <h3 className="font-semibold mb-3">Authentication</h3>
            <div className="font-mono text-xs bg-muted rounded-lg p-4 overflow-x-auto">
              <pre>{`// All authenticated requests require:
x-telegram-auth: <initData from Telegram.WebApp>

// Server validates using HMAC-SHA256:
// 1. Parse initData query string
// 2. Filter out "hash" param, sort remaining keys alphabetically
// 3. Create data_check_string = "key=value\\n..." 
// 4. secret_key = HMAC-SHA256("WebAppData", BOT_TOKEN)
// 5. hash = HMAC-SHA256(secret_key, data_check_string)
// 6. Compare computed hash with provided hash

// Admin endpoints additionally verify:
// user.id === ADMIN_ID (environment variable)

// Public widget endpoints (no auth required):
// Rate-limited per IP and per widget key`}</pre>
            </div>
          </div>
        </FadeIn>

        {groups.map((g, gi) => (
          <FadeIn key={g.name} delay={80 + gi * 40}>
            <div className="mb-10">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-foreground text-background flex items-center justify-center text-[10px] font-mono font-bold">{gi + 1}</span>
                {g.name}
              </h3>
              <div className="space-y-1.5">
                {g.endpoints.map((ep, i) => (
                  <div key={i} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-2.5 rounded-lg border border-border bg-card hover:border-foreground/20 transition-colors">
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${methodColor(ep.method)} min-w-[48px] text-center`}>
                        {ep.method}
                      </span>
                      <code className="text-xs font-mono text-foreground">{ep.path}</code>
                    </div>
                    <span className="text-xs text-muted-foreground flex-1">{ep.desc}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border shrink-0">{ep.auth}</span>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>
        ))}

        <FadeIn delay={200}>
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-6">Widget Embed Code</h2>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground mb-4">Add live chat to any website with one line:</p>
              <div className="font-mono text-xs bg-muted rounded-lg p-4 overflow-x-auto">
                <pre>{`<script src="https://mini.susagar.sbs/api/w/embed.js?key=YOUR_KEY" data-key="YOUR_KEY" async></script>`}</pre>
              </div>
              <div className="mt-4 grid md:grid-cols-4 gap-3">
                {[
                  { title: "Self-contained", desc: "Zero dependencies. Single JS file." },
                  { title: "Domain-verified", desc: "Only loads on authorized domains." },
                  { title: "Customizable", desc: "Colors, position, icon, FAQ, social." },
                  { title: "AI-powered", desc: "Auto-reply when you're offline." },
                ].map(c => (
                  <div key={c.title} className="p-3 rounded-lg bg-muted">
                    <p className="text-xs font-medium mb-0.5">{c.title}</p>
                    <p className="text-[11px] text-muted-foreground">{c.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={240}>
          <div className="mt-10 p-6 rounded-xl border border-border bg-card text-center">
            <p className="text-muted-foreground mb-4">Have API questions? Need integration help?</p>
            <a href={TG_DEV} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90">
              <TelegramIcon className="w-4 h-4" /> Ask @AresZyn on Telegram
            </a>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function PricingPage() {
  useEffect(() => { document.title = "Pricing — Lifegram | Telegram Stars Payments"; }, []);

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Pricing</p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Simple, transparent pricing</h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-2">
              Pay with Telegram Stars. No credit card, no signup forms.
            </p>
            <p className="text-sm text-muted-foreground/60">Everything happens inside Telegram. Subscriptions auto-renew every 30 days.</p>
          </div>
        </FadeIn>

        <FadeIn delay={60}>
          <div className="mb-20">
            <h2 className="text-2xl font-bold mb-8 text-center">Widget Plans</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  name: "Free", price: "0", stars: null,
                  features: ["1 widget", "100 messages/day", "3 FAQ questions", "2 social links", "Watermark shown", "Basic customization", "No AI auto-reply", "No URL training"],
                  cta: "Get Started Free",
                },
                {
                  name: "Standard", price: "100", stars: "Stars/mo",
                  features: ["3 widgets", "1,000 messages/day", "6 FAQ questions", "5 social links", "No watermark", "AI auto-reply", "2 training URLs", "Full customization", "Priority support"],
                  cta: "Upgrade to Standard",
                  highlight: true,
                },
                {
                  name: "Pro", price: "250", stars: "Stars/mo",
                  features: ["5 widgets", "Unlimited messages", "10 FAQ questions", "8 social links", "No watermark", "AI auto-reply", "5 training URLs", "Full customization", "Priority support", "Early access to new features"],
                  cta: "Go Pro",
                },
              ].map(plan => (
                <div key={plan.name} className={`rounded-xl border p-6 ${plan.highlight ? "border-foreground bg-card" : "border-border bg-card"} relative`}>
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-foreground text-background text-xs font-medium rounded-full">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.stars && <span className="text-sm text-muted-foreground">{plan.stars}</span>}
                  </div>
                  <div className="space-y-2.5 mb-8">
                    {plan.features.map(f => (
                      <div key={f} className="flex items-center gap-2 text-sm">
                        <span className="w-1 h-1 rounded-full bg-foreground" />
                        {f}
                      </div>
                    ))}
                  </div>
                  <a href={TG_BOT} target="_blank" rel="noopener"
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${plan.highlight ? "bg-foreground text-background hover:opacity-90" : "border border-border hover:bg-muted"}`}>
                    <TelegramIcon className="w-3.5 h-3.5" />
                    {plan.cta}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="mb-20">
            <h2 className="text-2xl font-bold mb-8 text-center">Premium Membership</h2>
            <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-6">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold">250</span>
                <span className="text-sm text-muted-foreground">Stars/month</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Unlock powerful group management tools for your Telegram groups.</p>
              <div className="space-y-2.5 mb-6">
                {["Tag All members in any group", "Ban All non-admin members", "Silent Ban (no notification)", "Group stats and member tracking", "Auto-renewing 30-day billing", "Manage from Mini App or bot commands"].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <span className="w-1 h-1 rounded-full bg-foreground" />
                    {f}
                  </div>
                ))}
              </div>
              <a href={TG_BOT} target="_blank" rel="noopener"
                className="flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity">
                <TelegramIcon className="w-3.5 h-3.5" />
                Subscribe via @lifegrambot
              </a>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={160}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8 text-center">Donations</h2>
            <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">Support the project with a one-time donation.</p>
              <div className="flex justify-center gap-3 mb-4">
                <span className="px-3 py-1.5 rounded-md bg-muted text-sm font-medium">Telegram Stars</span>
                <span className="px-3 py-1.5 rounded-md bg-muted text-sm font-medium">Crypto (OxaPay)</span>
              </div>
              <a href={TG_BOT} target="_blank" rel="noopener" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <TelegramIcon className="w-3.5 h-3.5" /> Donate via @lifegrambot
              </a>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="p-6 rounded-xl border border-border bg-card">
            <h3 className="font-semibold mb-4 text-center">Frequently Asked Questions</h3>
            <div className="space-y-4 max-w-2xl mx-auto">
              {[
                { q: "What are Telegram Stars?", a: "Telegram Stars (XTR) are Telegram's native in-app currency. You can purchase them directly inside Telegram using Apple Pay, Google Pay, or card payment. No external accounts needed." },
                { q: "How does billing work?", a: "All subscriptions are 30-day cycles. When you subscribe, you pay immediately. The subscription auto-renews after 30 days. You can cancel anytime by contacting the developer." },
                { q: "What happens if my plan expires?", a: "Your widgets stay active but downgrade to Free plan limits — 100 messages/day, watermark shown, no AI auto-reply. Upgrade again anytime to restore full features." },
                { q: "Can I get a refund?", a: "Telegram Stars refunds are handled by Telegram. Contact @AresZyn on Telegram for any billing questions." },
                { q: "Is the bot free to use?", a: "Yes! The core bot features (messaging, basic widget, account) are completely free. Premium and widget plans unlock advanced features." },
              ].map(faq => (
                <div key={faq.q} className="p-4 rounded-lg border border-border">
                  <p className="font-medium text-sm mb-1">{faq.q}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function OpenSourcePage() {
  useEffect(() => { document.title = "Open Source — Lifegram | Source Code & Contributions"; }, []);

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <FadeIn>
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Open Source</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Built in the open</h1>
          <p className="text-lg text-muted-foreground mb-4 max-w-2xl">
            Lifegram is a solo project built transparently. The codebase is developed on Replit and the architecture is fully documented.
          </p>
          <p className="text-sm text-muted-foreground/60 mb-16">
            Want to understand how it works? Want to build something similar? Everything is documented here.
          </p>
        </FadeIn>

        <FadeIn delay={80}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Project Overview</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { label: "Language", value: "TypeScript 5.9 (end-to-end)" },
                { label: "Runtime", value: "Cloudflare Workers + Node.js" },
                { label: "Framework", value: "Hono (API) + React 19 (UI)" },
                { label: "Database", value: "Cloudflare D1 (SQLite at edge)" },
                { label: "Storage", value: "Cloudflare R2 (S3-compatible)" },
                { label: "Monorepo", value: "pnpm workspaces" },
                { label: "Build Tool", value: "Vite 7" },
                { label: "Styling", value: "Tailwind CSS v4" },
                { label: "Validation", value: "Zod v4" },
                { label: "Auth", value: "HMAC-SHA256 (Telegram WebApp)" },
                { label: "Payments", value: "Telegram Stars (XTR)" },
                { label: "Telegram", value: "Bot API + MTProto (GramJS)" },
                { label: "AI Providers", value: "OpenAI, Anthropic, Google" },
                { label: "Tables", value: "15 (D1)" },
                { label: "API Endpoints", value: "35+" },
                { label: "Developer", value: "1 (solo)" },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">How Each System Works</h2>
            <div className="space-y-4">
              {[
                {
                  title: "Message Forwarding",
                  content: "When a user sends a message to @lifegrambot, the Telegram webhook delivers it to the Cloudflare Worker. The Worker stores the message in D1 and uses the Bot API to forward it to the admin's Telegram chat. The forwarded message ID is stored in the forwarded_messages table. When the admin replies, the Worker looks up the original user and sends the reply back — optionally using hidden-profile mode (via sendMessage instead of reply) so the admin's identity stays hidden."
                },
                {
                  title: "AI Chat Streaming",
                  content: "Users store their own API keys (encrypted) for OpenAI, Anthropic, or Google. When a user sends a message, the Worker decrypts the relevant key, makes a streaming API call to the provider, and returns the response as Server-Sent Events (SSE). The Mini App renders tokens word-by-word in real time. Each conversation is stored in D1 with auto-generated titles."
                },
                {
                  title: "Widget System",
                  content: "Widget owners create widgets via the Mini App. The Worker generates a unique key and serves embed.js — a self-contained JavaScript file that creates the entire chat UI (bubble, panel, pre-chat form, messages, FAQ, social links). The embed.js fetches config from /api/w/config, starts sessions via /api/w/start, and polls for messages every 3 seconds. Visitor messages are forwarded to the widget owner's Telegram. AI auto-reply is optional and uses trained website context."
                },
                {
                  title: "Stars Payment Flow",
                  content: "1) Mini App calls POST /api/premium/create (or widget plan endpoint). 2) Worker calls Telegram Bot API createInvoiceLink with Stars price. 3) Telegram presents native payment UI. 4) pre_checkout_query webhook fires — Worker validates payload format and Stars amount. 5) successful_payment webhook fires — Worker creates/extends subscription in D1 with charge_id. 6) Subscription has a 30-day expiry that auto-renews."
                },
                {
                  title: "Domain Verification",
                  content: "When a widget is created, the owner specifies allowed domains. The embed.js, when loaded on a website, sends the current window.location.hostname to /api/w/config. The Worker checks if the hostname matches the widget's allowed_domains list. If not, the widget refuses to render. Admin widgets bypass this check (allowed_domains is empty = allow all)."
                },
                {
                  title: "GDPR Deletion",
                  content: "Users can request account deletion via /delete command or the Mini App. This creates a deletion_request record with status 'pending'. The admin sees pending requests in the Admin Panel. On approval, the Worker wipes all user data from D1: messages, AI conversations, API keys, widget sessions, donations, premium records, and the user profile itself."
                },
              ].map(s => (
                <div key={s.title} className="p-5 rounded-xl border border-border bg-card">
                  <h3 className="font-semibold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={160}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Environment Variables</h2>
            <div className="rounded-xl border border-border bg-card p-5 font-mono text-xs overflow-x-auto">
              <pre className="text-muted-foreground">{`# Cloudflare Worker (wrangler.toml)
BOT_TOKEN        = "Telegram Bot API token"
ADMIN_ID         = "Admin's Telegram user ID"
BOT_USERNAME     = "Bot username without @"
MINIAPP_URL      = "Proxied Mini App URL"
WEBHOOK_SECRET   = "Webhook verification secret"
MTPROTO_URL      = "MTProto backend URL"
OXAPAY_KEY       = "OxaPay merchant API key"

# D1 Database binding: DB
# R2 Bucket binding: BUCKET

# Mini App (Vite env)
VITE_API_URL     = "https://mini.susagar.sbs/api"

# MTProto Backend
API_ID           = "Telegram API ID"
API_HASH         = "Telegram API Hash"
SESSION_STRING   = "GramJS session string"`}</pre>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="p-6 rounded-xl border border-border bg-card text-center">
            <p className="text-muted-foreground mb-2">Want to learn more or contribute?</p>
            <p className="text-sm text-muted-foreground/60 mb-4">Reach out on Telegram. Let's talk code.</p>
            <div className="flex justify-center gap-3">
              <a href={TG_DEV} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90">
                <TelegramIcon className="w-4 h-4" /> @AresZyn
              </a>
              <a href={TG_BOT} target="_blank" rel="noopener" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium border border-border rounded-lg hover:bg-muted">
                <TelegramIcon className="w-4 h-4" /> @lifegrambot
              </a>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function AboutPage() {
  useEffect(() => { document.title = "About — Lifegram | Built Solo from Nepal by Sushanta Bhandari"; }, []);

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-3xl mx-auto px-6">
        <FadeIn>
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">About</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-12">Built solo, from Nepal</h1>
        </FadeIn>

        <FadeIn delay={80}>
          <div className="flex flex-col md:flex-row gap-8 items-start mb-16">
            <div className="w-24 h-24 rounded-2xl bg-foreground text-background flex items-center justify-center shrink-0">
              <span className="text-3xl font-bold">SB</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-1">Sushanta Bhandari</h2>
              <p className="text-muted-foreground mb-1">Solo Developer & Founder</p>
              <a href={TG_DEV} target="_blank" rel="noopener" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mb-4">
                <TelegramIcon className="w-3 h-3" /> @AresZyn on Telegram
              </a>
              <p className="text-sm leading-relaxed text-muted-foreground">
                I'm a self-taught developer from Kathmandu, Nepal. Lifegram started as a simple Telegram bot
                and evolved into a full-stack platform with AI chat, website widgets, payment processing,
                and a complete admin system. Every line of code, every feature, every deployment — built by one person.
              </p>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="space-y-8 mb-16">
            <h2 className="text-2xl font-bold">The Story</h2>
            <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
              <p>
                Lifegram began as an experiment — a Telegram bot that could forward messages to an admin.
                Simple concept. But as I kept building, each feature opened the door to the next.
                Message forwarding led to a Mini App. The Mini App needed an admin panel. The admin panel
                needed user management. Users wanted AI chat. Businesses wanted website widgets.
              </p>
              <p>
                What started as a weekend project became a production-grade platform. The API Worker handles
                webhook events, AI streaming, widget sessions, and payment processing — all on Cloudflare's edge.
                The Mini App is a full React application with user and admin interfaces. The widget system
                lets anyone embed live chat on their website with a single script tag.
              </p>
              <p>
                The tech stack is intentionally modern and edge-native. Cloudflare Workers for zero cold-start
                API responses. D1 for SQLite at the edge. R2 for media storage. Pages for frontend hosting.
                Hono as the web framework. TypeScript end-to-end. Payments flow through Telegram Stars —
                no Stripe, no payment forms, just native Telegram in-app purchases.
              </p>
              <p>
                Today the platform has 15 database tables, 35+ API endpoints, 12+ AI models, 3-tier widget
                subscription plans, a full admin panel, and a monochrome Notion-style UI. All deployed from
                a single pnpm monorepo. All built by one developer from a small apartment in Kathmandu.
              </p>
              <p className="font-medium text-foreground">
                This is what happens when you don't stop shipping.
              </p>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={160}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Version Timeline</h2>
            <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-border">
              {[
                { ver: "v1.0", desc: "Basic bot — message forwarding to admin, /start and /help commands" },
                { ver: "v1.2", desc: "Media support — photos, videos, documents, voice messages up to 20MB" },
                { ver: "v1.5", desc: "Mini App — full React chat interface + admin inbox, user profiles" },
                { ver: "v1.8", desc: "Donations — OxaPay crypto + Telegram Stars payment integration" },
                { ver: "v2.0", desc: "AI Chat Hub — 12+ models (OpenAI, Anthropic, Gemini), BYOK, SSE streaming" },
                { ver: "v2.1", desc: "Premium — Stars subscriptions for group management tools" },
                { ver: "v2.3", desc: "Live Chat Widget — embeddable JS, domain verification, pre-chat forms" },
                { ver: "v2.5", desc: "Widget AI — auto-reply, FAQ accordion, social media buttons, URL training" },
                { ver: "v2.6", desc: "50 Notion-style avatars, monochrome UI redesign, admin broadcast" },
                { ver: "v2.7", desc: "3-tier widget plans (Free/Standard/Pro), admin plan management, landing page" },
              ].map(v => (
                <div key={v.ver} className="flex gap-4 items-start pl-1">
                  <div className="w-5 h-5 rounded-full border-2 border-foreground bg-background shrink-0 mt-0.5 relative z-10" />
                  <div>
                    <span className="font-mono font-bold text-sm">{v.ver}</span>
                    <p className="text-sm text-muted-foreground mt-0.5">{v.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">By the Numbers</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { num: "35+", label: "API Endpoints" },
                { num: "15", label: "Database Tables" },
                { num: "12+", label: "AI Models" },
                { num: "50", label: "Avatar Designs" },
                { num: "13", label: "Social Platforms" },
                { num: "10", label: "Bot Commands" },
                { num: "4", label: "Deployment Targets" },
                { num: "1", label: "Developer" },
              ].map(s => (
                <div key={s.label} className="p-4 rounded-lg border border-border bg-card text-center">
                  <p className="text-2xl font-bold">{s.num}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={240}>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Get in touch</h3>
            <p className="text-sm text-muted-foreground mb-4">I'm always happy to chat about the project, tech, or collaboration ideas.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <a href={TG_DEV} target="_blank" rel="noopener"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors">
                <span className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                  <TelegramIcon className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Developer</p>
                  <p className="text-xs text-muted-foreground">@AresZyn</p>
                </div>
              </a>
              <a href={TG_BOT} target="_blank" rel="noopener"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors">
                <span className="w-8 h-8 rounded-md bg-foreground text-background flex items-center justify-center">
                  <TelegramIcon className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">Lifegram Bot</p>
                  <p className="text-xs text-muted-foreground">@lifegrambot</p>
                </div>
              </a>
              <a href="https://mini.susagar.sbs/miniapp/" target="_blank" rel="noopener"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors">
                <span className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-xs font-bold">
                  MA
                </span>
                <div>
                  <p className="text-sm font-medium">Mini App</p>
                  <p className="text-xs text-muted-foreground">Open in browser</p>
                </div>
              </a>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function NotFoundPage() {
  useEffect(() => { document.title = "404 — Lifegram"; }, []);
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-8xl font-bold tracking-tight text-muted-foreground/20 mb-4">404</p>
        <h1 className="text-2xl font-bold mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-6">The page you're looking for doesn't exist.</p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/" className="px-5 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            Back to Home
          </Link>
          <a href={TG_BOT} target="_blank" rel="noopener" className="px-5 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors flex items-center gap-1.5">
            <TelegramIcon className="w-3.5 h-3.5" /> Open Bot
          </a>
        </div>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <div className="dark min-h-screen bg-background text-foreground">
        <ScrollToTop />
        <Nav />
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/features" component={FeaturesPage} />
          <Route path="/architecture" component={ArchitecturePage} />
          <Route path="/api" component={ApiPage} />
          <Route path="/pricing" component={PricingPage} />
          <Route path="/open-source" component={OpenSourcePage} />
          <Route path="/about" component={AboutPage} />
          <Route component={NotFoundPage} />
        </Switch>
        <Footer />
        <Toaster />
      </div>
    </WouterRouter>
  );
}

export default App;
