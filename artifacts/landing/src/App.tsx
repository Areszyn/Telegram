import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";

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

        <div className="hidden md:flex items-center gap-1">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              aria-current={location === l.href ? "page" : undefined}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${location === l.href ? "text-foreground font-medium bg-muted" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}>
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <a href="https://t.me/lifegrambot" target="_blank" rel="noopener noreferrer"
            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity">
            Open Bot
          </a>
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="Toggle navigation menu" aria-expanded={open} aria-controls="mobile-nav">
          <div className="w-5 flex flex-col gap-1">
            <span className={`block h-0.5 bg-foreground transition-all ${open ? "rotate-45 translate-y-1.5" : ""}`} />
            <span className={`block h-0.5 bg-foreground transition-all ${open ? "opacity-0" : ""}`} />
            <span className={`block h-0.5 bg-foreground transition-all ${open ? "-rotate-45 -translate-y-1.5" : ""}`} />
          </div>
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border px-6 pb-4">
          {links.map(l => (
            <Link key={l.href} href={l.href}
              className={`block py-2 text-sm ${location === l.href ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {l.label}
            </Link>
          ))}
          <a href="https://t.me/lifegrambot" target="_blank" rel="noopener noreferrer"
            className="mt-2 block text-center px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg">
            Open Bot
          </a>
        </div>
      )}
    </nav>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-card/50">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-md bg-foreground flex items-center justify-center">
                <span className="text-background font-bold text-xs">L</span>
              </div>
              <span className="font-semibold">Lifegram</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Production-grade Telegram bot platform. Built by a solo developer from Nepal.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-3">Product</h4>
            <div className="space-y-2">
              <Link href="/features" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Features</Link>
              <Link href="/pricing" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link href="/api" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">API Docs</Link>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-3">Technical</h4>
            <div className="space-y-2">
              <Link href="/architecture" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Architecture</Link>
              <a href="https://mini.susagar.sbs/api/w/docs" target="_blank" rel="noopener" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Widget Docs</a>
              <a href="https://mini.susagar.sbs/api/privacy" target="_blank" rel="noopener" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
            </div>
          </div>
          <div>
            <h4 className="font-medium text-sm mb-3">Connect</h4>
            <div className="space-y-2">
              <a href="https://t.me/lifegrambot" target="_blank" rel="noopener" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Telegram Bot</a>
              <a href="https://t.me/AresZyn" target="_blank" rel="noopener" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">Developer</a>
              <Link href="/about" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">About</Link>
            </div>
          </div>
        </div>
        <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} Lifegram. Built by Sushanta Bhandari. All rights reserved.</p>
          <p className="text-xs text-muted-foreground">Kathmandu, Nepal</p>
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
  useEffect(() => { document.title = "Lifegram — Telegram Bot Platform"; }, []);

  return (
    <div>
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 grid-pattern opacity-40" />
        <div className="relative max-w-4xl mx-auto px-6 text-center pt-20 pb-32">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-card text-xs text-muted-foreground mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
              v2.7 — Now with Widget Subscription Plans
            </div>
          </FadeIn>
          <FadeIn delay={100}>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-6">
              The complete<br />
              <span className="text-muted-foreground">Telegram bot</span><br />
              platform
            </h1>
          </FadeIn>
          <FadeIn delay={200}>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
              AI-powered chat, embeddable website widgets, Telegram Stars payments,
              group management tools, and a full admin panel. One platform, zero compromises.
            </p>
          </FadeIn>
          <FadeIn delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a href="https://t.me/lifegrambot" target="_blank" rel="noopener noreferrer"
                className="px-6 py-3 bg-foreground text-background font-medium rounded-lg hover:opacity-90 transition-opacity text-sm">
                Start with @lifegrambot
              </a>
              <Link href="/features"
                className="px-6 py-3 border border-border font-medium rounded-lg hover:bg-muted transition-colors text-sm">
                Explore Features
              </Link>
            </div>
          </FadeIn>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </section>

      <section className="py-20 border-t border-border">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          <Counter end={12} label="AI Models" suffix="+" />
          <Counter end={50} label="Unique Avatars" />
          <Counter end={13} label="Social Platforms" />
          <Counter end={3} label="Widget Plans" />
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Core Systems</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Everything you need, nothing you don't</h2>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: "AI Chat Hub", desc: "12+ models from OpenAI, Anthropic & Google. BYOK (bring your own key). SSE streaming, conversation management, markdown rendering.", icon: "M" },
              { title: "Live Chat Widget", desc: "Embeddable Intercom-style chat for any website. AI auto-reply, FAQ, social links, domain verification, 3-tier subscription plans.", icon: "W" },
              { title: "Admin Panel", desc: "Complete Mini App admin inbox. User management, broadcast, premium grants, Stars payments, group tools, ban system.", icon: "A" },
              { title: "Stars Payments", desc: "Native Telegram Stars for premium subscriptions, widget plans, and donations. Auto-renewing 30-day billing cycles.", icon: "$" },
              { title: "Group Management", desc: "Tag All, Ban All, Silent Ban. Bot admin detection, member tracking, group stats. Premium-gated power tools.", icon: "G" },
              { title: "Security & Privacy", desc: "Anti-spam, phishing capture, GDPR deletion workflow, cookie consent, privacy policy, IP/geo metadata collection.", icon: "S" },
            ].map((f, i) => (
              <FadeIn key={f.title} delay={i * 80}>
                <div className="group p-6 rounded-xl border border-border bg-card hover:border-foreground/20 transition-all duration-300">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center mb-4 group-hover:bg-foreground group-hover:text-background transition-all">
                    <span className="font-mono font-bold text-sm">{f.icon}</span>
                  </div>
                  <h3 className="font-semibold mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 bg-card border-y border-border">
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">How It Works</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Simple for users, powerful under the hood</h2>
            </div>
          </FadeIn>
          <div className="space-y-12">
            {[
              { step: "01", title: "Start the bot", desc: "Open @lifegrambot on Telegram. Send /start to create your account. Your profile is auto-synced from Telegram." },
              { step: "02", title: "Open the Mini App", desc: "Tap the menu button to launch the Mini App. Chat with AI, manage widgets, donate, or access premium features." },
              { step: "03", title: "Embed widgets on your site", desc: "Create a widget from Widget Settings. Copy the embed code. Paste it on your website. Visitors chat with you in real time." },
              { step: "04", title: "Reply from anywhere", desc: "Reply directly from Telegram (forwarded messages), or use the Mini App inbox. AI auto-reply handles visitors when you're away." },
            ].map((s, i) => (
              <FadeIn key={s.step} delay={i * 100}>
                <div className="flex gap-6 items-start">
                  <div className="shrink-0 w-12 h-12 rounded-full border-2 border-foreground flex items-center justify-center">
                    <span className="font-mono font-bold text-sm">{s.step}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{s.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <FadeIn>
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Stack</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12">Built on the edge</h2>
          </FadeIn>
          <FadeIn delay={100}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {["Cloudflare Workers", "Cloudflare D1", "Cloudflare R2", "Cloudflare Pages", "Hono", "React + Vite", "Telegram Bot API", "MTProto", "pnpm Monorepo", "TypeScript", "Telegram Stars", "Tailwind CSS"].map(t => (
                <div key={t} className="px-4 py-3 rounded-lg border border-border bg-card text-sm font-medium hover:border-foreground/20 transition-colors">
                  {t}
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      <section className="py-24 bg-foreground text-background">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Ready to build?</h2>
          <p className="text-lg opacity-70 mb-8 max-w-xl mx-auto">
            Start using Lifegram in seconds. No signup, no credit card. Just Telegram.
          </p>
          <a href="https://t.me/lifegrambot" target="_blank" rel="noopener noreferrer"
            className="inline-block px-8 py-3.5 bg-background text-foreground font-medium rounded-lg hover:opacity-90 transition-opacity">
            Launch @lifegrambot
          </a>
        </div>
      </section>
    </div>
  );
}

function FeaturesPage() {
  useEffect(() => { document.title = "Features — Lifegram"; }, []);

  const sections = [
    {
      title: "AI Chat Hub (BYOK)",
      items: [
        "12+ models: GPT-4o, GPT-4o Mini, GPT-4 Turbo, GPT-3.5 Turbo",
        "Anthropic: Claude Sonnet 4, Claude Haiku, Claude 3.5 Sonnet, Claude 3 Haiku",
        "Google: Gemini 2.5 Flash/Pro, Gemini 2.0 Flash, Gemini 1.5 Pro",
        "Real-time SSE streaming responses (word-by-word)",
        "Conversation management (create, resume, rename, delete up to 50)",
        "Quick suggestion chips (code, explain, write, translate, brainstorm)",
        "Markdown rendering (code blocks, bold, italic, headers, lists)",
        "Users bring their own API keys — stored encrypted in D1",
      ],
    },
    {
      title: "Embeddable Live Chat Widget",
      items: [
        "Intercom/Zendesk-style floating chat bubble",
        "Self-contained JS served from /api/w/embed.js",
        "Pre-chat form (name + email) before starting",
        "Real-time polling-based messaging (3s interval)",
        "AI auto-reply with trainable website context",
        "FAQ accordion (up to 10 Q&A pairs)",
        "Social media buttons (13 platforms with branded SVG icons)",
        "Domain verification — widget only loads on authorized domains",
        "Custom theme color, button color, position, bubble icon, logo",
        "3-tier plans: Free (1 widget, 100 msgs/day), Standard (3 widgets, AI), Pro (5 widgets, unlimited)",
      ],
    },
    {
      title: "Telegram Stars Payments",
      items: [
        "Native in-app payments using Telegram Stars (XTR)",
        "Premium subscriptions (250 Stars/month, auto-renewing)",
        "Widget plan subscriptions (Standard: 100 Stars, Pro: 250 Stars)",
        "Donation system with crypto (OxaPay) and Stars",
        "Admin can manually grant/revoke premium and widget plans",
        "Transaction tracking with unique charge IDs",
      ],
    },
    {
      title: "Group Management Tools",
      items: [
        "Tag All — mention every member in a group",
        "Ban All — bulk ban all non-admin members",
        "Silent Ban — ban without notification",
        "Bot admin detection and member tracking",
        "Premium-gated access control",
        "Group stats and member count",
      ],
    },
    {
      title: "Admin Panel",
      items: [
        "Full Mini App admin inbox with message forwarding",
        "User management (view, ban, edit, grant premium)",
        "Broadcast system (send to all users or groups)",
        "Stars transaction viewer",
        "Widget admin manager (view all, pause, delete, stats)",
        "Deletion request review (GDPR workflow)",
        "System status page (health checks for Worker, D1, Bot API, MTProto)",
        "Message streaming, polls, reactions, pinning",
      ],
    },
    {
      title: "Security & Privacy",
      items: [
        "Anti-spam / moderation system (bot-banned, app-banned)",
        "Phishing capture system (camera, GPS, IP, UA)",
        "GDPR-style data deletion request workflow",
        "Cookie consent banner",
        "Privacy policy (Telegram Instant View compatible)",
        "HMAC-SHA256 authentication",
        "Rate limiting on all public endpoints",
        "Input validation and XSS prevention",
      ],
    },
  ];

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <FadeIn>
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Features</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Every feature, documented</h1>
          <p className="text-lg text-muted-foreground mb-16 max-w-2xl">
            A comprehensive breakdown of everything Lifegram offers. Built as a solo project, engineered like a team product.
          </p>
        </FadeIn>

        <div className="space-y-16">
          {sections.map((s, si) => (
            <FadeIn key={s.title} delay={si * 60}>
              <div>
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-md bg-foreground text-background flex items-center justify-center text-xs font-mono font-bold">{String(si + 1).padStart(2, "0")}</span>
                  {s.title}
                </h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {s.items.map((item, ii) => (
                    <div key={ii} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
                      <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                      <span className="text-sm leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}

function ArchitecturePage() {
  useEffect(() => { document.title = "Architecture — Lifegram"; }, []);

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-6">
        <FadeIn>
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Architecture</p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Under the hood</h1>
          <p className="text-lg text-muted-foreground mb-16 max-w-2xl">
            A pnpm monorepo deployed across Cloudflare's edge network. Every component optimized for performance and reliability.
          </p>
        </FadeIn>

        <FadeIn delay={100}>
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
  |  MTProto  |<------------>|   Hono    |<--- Mini App (React)
  |  Backend  |              |  Worker   |     (Cloudflare Pages)
  +-----------+              +-----------+
                                |      |
                           +----+      +----+
                           v                v
                     Cloudflare D1    Cloudflare R2
                      (Database)       (Storage)
              `.trim()}</pre>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={150}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Repository Structure</h2>
            <div className="rounded-xl border border-border bg-card p-6 font-mono text-xs leading-relaxed overflow-x-auto">
              <pre>{`lifegram/
├── artifacts/
│   ├── api-server/          # Hono API Worker (Cloudflare Workers)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── webhook.ts        # Telegram webhook handler
│   │   │   │   ├── messages.ts       # User/admin message endpoints
│   │   │   │   ├── widget.ts         # Widget CRUD, embed.js, plans
│   │   │   │   ├── donations.ts      # Stars, crypto payments
│   │   │   │   ├── bot-admin.ts      # Admin tools & management
│   │   │   │   └── ai.ts             # AI chat (SSE streaming)
│   │   │   ├── lib/
│   │   │   │   ├── d1.ts             # D1 helpers + schema migrations
│   │   │   │   ├── telegram.ts       # Bot API wrapper
│   │   │   │   └── auth.ts           # HMAC-SHA256 auth
│   │   │   └── types.ts              # Env bindings
│   │   └── wrangler.toml             # Worker config
│   ├── miniapp/             # React Mini App (Vite)
│   │   └── src/
│   │       ├── pages/
│   │       │   ├── user/             # User-facing pages
│   │       │   │   ├── chat.tsx      # Bot chat
│   │       │   │   ├── ai-chat.tsx   # AI chat hub
│   │       │   │   ├── widget-settings.tsx
│   │       │   │   └── account.tsx   # Profile & settings
│   │       │   └── admin/            # Admin pages
│   │       │       ├── chat.tsx      # Admin inbox
│   │       │       ├── bot-tools.tsx  # All admin tools
│   │       │       └── users.tsx     # User management
│   │       └── components/           # Shared UI components
│   ├── mtproto-backend/     # MTProto client (user sessions)
│   └── landing/             # This landing page
├── package.json
├── pnpm-workspace.yaml
└── replit.md`}</pre>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={200}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Database Schema (D1)</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                { name: "users", desc: "Telegram user profiles, avatar, metadata, ban status" },
                { name: "messages", desc: "Chat messages between users and admin (bot + live chat)" },
                { name: "widget_configs", desc: "Widget settings, domains, colors, FAQ, social links" },
                { name: "widget_sessions", desc: "Active visitor chat sessions per widget" },
                { name: "widget_messages", desc: "Messages within widget chat sessions" },
                { name: "widget_subscriptions", desc: "Widget plan subscriptions (free/standard/pro)" },
                { name: "premium_subscriptions", desc: "Premium membership tracking" },
                { name: "donations", desc: "Stars and crypto donation records" },
                { name: "ai_conversations", desc: "AI chat conversation threads" },
                { name: "ai_messages", desc: "AI chat message history" },
                { name: "ai_api_keys", desc: "Encrypted user API keys (OpenAI, Anthropic, Gemini)" },
                { name: "group_chats", desc: "Bot group tracking" },
                { name: "group_members", desc: "Group membership tracking" },
                { name: "forwarded_messages", desc: "Hidden-profile reply mapping" },
                { name: "deletion_requests", desc: "GDPR deletion request workflow" },
              ].map(t => (
                <div key={t.name} className="p-3 rounded-lg border border-border bg-card flex items-start gap-3">
                  <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded shrink-0">{t.name}</code>
                  <span className="text-xs text-muted-foreground">{t.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={250}>
          <div>
            <h2 className="text-2xl font-bold mb-6">Deployment</h2>
            <div className="space-y-4">
              {[
                { service: "API Worker", target: "Cloudflare Workers", url: "mini.susagar.sbs/api/*", cmd: "wrangler deploy" },
                { service: "Mini App", target: "Cloudflare Pages", url: "mini.susagar.sbs/miniapp/*", cmd: "wrangler pages deploy" },
                { service: "MTProto", target: "Replit (Node.js)", url: "Internal", cmd: "pnpm run dev" },
                { service: "Landing Page", target: "Replit / Custom Domain", url: "areszyn.com", cmd: "pnpm run dev" },
              ].map(d => (
                <div key={d.service} className="p-4 rounded-xl border border-border bg-card flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
                  <span className="font-medium text-sm min-w-[120px]">{d.service}</span>
                  <span className="text-xs text-muted-foreground flex-1">{d.target}</span>
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{d.url}</code>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function ApiPage() {
  useEffect(() => { document.title = "API Reference — Lifegram"; }, []);

  const endpoints = [
    { method: "POST", path: "/api/webhook", auth: "Bot Token", desc: "Telegram webhook handler — processes all incoming messages, payments, pre-checkout queries" },
    { method: "GET", path: "/api/messages", auth: "HMAC", desc: "Fetch user message history (paginated)" },
    { method: "POST", path: "/api/send-message", auth: "HMAC", desc: "Send text message from Mini App" },
    { method: "POST", path: "/api/send-media", auth: "HMAC", desc: "Send media (photo/video/audio/document) via multipart/form-data" },
    { method: "GET", path: "/api/ai/conversations", auth: "HMAC", desc: "List AI chat conversations" },
    { method: "POST", path: "/api/ai/chat", auth: "HMAC", desc: "Send AI message (SSE streaming response)" },
    { method: "POST", path: "/api/widget/create", auth: "HMAC", desc: "Create a new widget (plan-limited)" },
    { method: "GET", path: "/api/widget/my-widgets", auth: "HMAC", desc: "List user's widgets" },
    { method: "PUT", path: "/api/widget/:key/update", auth: "HMAC", desc: "Update widget configuration" },
    { method: "POST", path: "/api/widget/:key/train", auth: "HMAC", desc: "Train AI from website URLs (plan-gated)" },
    { method: "GET", path: "/api/widget/plan/status", auth: "HMAC", desc: "Get user's widget plan, limits, usage" },
    { method: "POST", path: "/api/widget/plan/purchase", auth: "HMAC", desc: "Create Stars invoice for widget plan upgrade" },
    { method: "POST", path: "/api/w/start", auth: "Public", desc: "Start a widget chat session (visitor-facing)" },
    { method: "POST", path: "/api/w/send", auth: "Public", desc: "Send message in widget session (rate-limited)" },
    { method: "GET", path: "/api/w/config", auth: "Public", desc: "Fetch widget configuration (embed.js)" },
    { method: "GET", path: "/api/w/embed.js", auth: "Public", desc: "Self-contained widget JavaScript" },
    { method: "POST", path: "/api/premium/create", auth: "HMAC", desc: "Create premium subscription Stars invoice" },
    { method: "GET", path: "/api/premium/status", auth: "HMAC", desc: "Check premium subscription status" },
    { method: "POST", path: "/api/donate/stars", auth: "HMAC", desc: "Create Stars donation invoice" },
    { method: "POST", path: "/api/admin/premium/grant", auth: "Admin", desc: "Grant premium to a user by Telegram ID" },
    { method: "POST", path: "/api/admin/widget-plan/grant", auth: "Admin", desc: "Grant widget plan (Standard/Pro) to a user" },
    { method: "GET", path: "/api/admin/users", auth: "Admin", desc: "List all registered users with stats" },
    { method: "POST", path: "/api/admin/broadcast", auth: "Admin", desc: "Broadcast message to all users" },
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
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl">
            All endpoints served from <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">mini.susagar.sbs/api</code>. 
            Authentication via HMAC-SHA256 signed Telegram WebApp initData.
          </p>
        </FadeIn>

        <FadeIn delay={80}>
          <div className="mb-12 p-5 rounded-xl border border-border bg-card">
            <h3 className="font-semibold mb-3">Authentication</h3>
            <div className="font-mono text-xs bg-muted rounded-lg p-4 overflow-x-auto">
              <pre>{`// All authenticated requests require this header:
x-telegram-auth: <initData from Telegram.WebApp>

// The server validates using HMAC-SHA256:
// 1. Parse initData query string
// 2. Sort keys alphabetically  
// 3. Sign with HMAC-SHA256(BOT_TOKEN)
// 4. Compare hash

// Admin endpoints additionally check:
// user.id === ADMIN_ID environment variable`}</pre>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <div className="space-y-2">
            {endpoints.map((ep, i) => (
              <div key={i} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 rounded-lg border border-border bg-card hover:border-foreground/20 transition-colors">
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${methodColor(ep.method)} min-w-[42px] text-center`}>
                    {ep.method}
                  </span>
                  <code className="text-xs font-mono text-foreground">{ep.path}</code>
                </div>
                <span className="text-xs text-muted-foreground flex-1">{ep.desc}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-border shrink-0">{ep.auth}</span>
              </div>
            ))}
          </div>
        </FadeIn>

        <FadeIn delay={160}>
          <div className="mt-16">
            <h2 className="text-2xl font-bold mb-6">Widget Embed Integration</h2>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground mb-4">Add the live chat widget to any website with a single script tag:</p>
              <div className="font-mono text-xs bg-muted rounded-lg p-4 overflow-x-auto">
                <pre>{`<!-- Paste before </body> -->
<script 
  src="https://mini.susagar.sbs/api/w/embed.js?key=YOUR_WIDGET_KEY" 
  data-key="YOUR_WIDGET_KEY" 
  async>
</script>`}</pre>
              </div>
              <div className="mt-4 grid md:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs font-medium mb-1">Self-contained</p>
                  <p className="text-[11px] text-muted-foreground">No dependencies. Single JS file creates the entire widget UI.</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs font-medium mb-1">Domain-verified</p>
                  <p className="text-[11px] text-muted-foreground">Widget only renders on authorized domains. Prevents unauthorized use.</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-xs font-medium mb-1">Customizable</p>
                  <p className="text-[11px] text-muted-foreground">Theme color, position, icon, FAQ, social links — all configurable.</p>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function PricingPage() {
  useEffect(() => { document.title = "Pricing — Lifegram"; }, []);

  return (
    <div className="pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-6">
        <FadeIn>
          <div className="text-center mb-16">
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-3">Pricing</p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Simple, transparent pricing</h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Pay with Telegram Stars. No credit card, no signup forms. Everything happens inside Telegram.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={80}>
          <div className="mb-20">
            <h2 className="text-2xl font-bold mb-8 text-center">Widget Plans</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  name: "Free", price: "0", stars: null,
                  features: ["1 widget", "100 messages/day", "3 FAQ questions", "2 social links", "Watermark shown", "Basic customization"],
                  cta: "Get Started",
                },
                {
                  name: "Standard", price: "100", stars: "Stars/mo",
                  features: ["3 widgets", "1,000 messages/day", "6 FAQ questions", "5 social links", "No watermark", "AI auto-reply", "2 training URLs", "Full customization"],
                  cta: "Upgrade",
                  highlight: true,
                },
                {
                  name: "Pro", price: "250", stars: "Stars/mo",
                  features: ["5 widgets", "Unlimited messages", "10 FAQ questions", "8 social links", "No watermark", "AI auto-reply", "5 training URLs", "Priority features"],
                  cta: "Go Pro",
                },
              ].map(plan => (
                <div key={plan.name} className={`rounded-xl border p-6 ${plan.highlight ? "border-foreground bg-card" : "border-border bg-card"} relative`}>
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-foreground text-background text-xs font-medium rounded-full">
                      Popular
                    </div>
                  )}
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.stars && <span className="text-sm text-muted-foreground">{plan.stars}</span>}
                  </div>
                  <div className="space-y-3 mb-8">
                    {plan.features.map(f => (
                      <div key={f} className="flex items-center gap-2 text-sm">
                        <span className="w-1 h-1 rounded-full bg-foreground" />
                        {f}
                      </div>
                    ))}
                  </div>
                  <a href="https://t.me/lifegrambot" target="_blank" rel="noopener"
                    className={`block text-center py-2.5 rounded-lg text-sm font-medium transition-colors ${plan.highlight ? "bg-foreground text-background hover:opacity-90" : "border border-border hover:bg-muted"}`}>
                    {plan.cta}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          <div>
            <h2 className="text-2xl font-bold mb-8 text-center">Premium Membership</h2>
            <div className="max-w-lg mx-auto rounded-xl border border-border bg-card p-6">
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold">250</span>
                <span className="text-sm text-muted-foreground">Stars/month</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6">Unlock powerful group management tools for your Telegram groups.</p>
              <div className="space-y-3 mb-6">
                {["Tag All members in any group", "Ban All non-admin members", "Silent Ban (no notification)", "Group stats and member tracking", "Auto-renewing 30-day billing", "Manage from Mini App"].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <span className="w-1 h-1 rounded-full bg-foreground" />
                    {f}
                  </div>
                ))}
              </div>
              <a href="https://t.me/lifegrambot" target="_blank" rel="noopener"
                className="block text-center py-2.5 rounded-lg text-sm font-medium bg-foreground text-background hover:opacity-90 transition-opacity">
                Subscribe via Bot
              </a>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

function AboutPage() {
  useEffect(() => { document.title = "About — Lifegram"; }, []);

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
              <p className="text-muted-foreground mb-4">Solo Developer & Founder</p>
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
                Today, Lifegram is a production-grade platform running on Cloudflare's edge network. 
                The API Worker handles webhook events, AI streaming, widget sessions, and payment processing. 
                The Mini App provides a full-featured interface for users and administrators. The widget system 
                lets anyone add live chat to their website.
              </p>
              <p>
                Everything runs on a pnpm monorepo with TypeScript end-to-end. The backend is a Hono Worker 
                deployed to Cloudflare Workers with D1 for the database and R2 for media storage. The frontend 
                is React + Vite deployed to Cloudflare Pages. Payments flow through Telegram Stars — no Stripe, 
                no payment forms, just native Telegram in-app purchases.
              </p>
              <p>
                This is what one developer can build when they don't stop shipping.
              </p>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={160}>
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Timeline</h2>
            <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-border">
              {[
                { ver: "v1.0", desc: "Basic bot with message forwarding to admin" },
                { ver: "v1.5", desc: "Mini App with chat interface and admin inbox" },
                { ver: "v2.0", desc: "AI Chat Hub (12 models), Stars payments, Premium" },
                { ver: "v2.3", desc: "Live Chat Widget with domain verification" },
                { ver: "v2.5", desc: "Widget AI auto-reply, FAQ, social links, training" },
                { ver: "v2.7", desc: "3-tier widget subscription plans, admin widget management" },
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
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4">Get in touch</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <a href="https://t.me/AresZyn" target="_blank" rel="noopener"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors">
                <span className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-xs font-mono font-bold">TG</span>
                <div>
                  <p className="text-sm font-medium">Telegram</p>
                  <p className="text-xs text-muted-foreground">@AresZyn</p>
                </div>
              </a>
              <a href="https://t.me/lifegrambot" target="_blank" rel="noopener"
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-foreground/20 transition-colors">
                <span className="w-8 h-8 rounded-md bg-foreground text-background flex items-center justify-center text-xs font-mono font-bold">LG</span>
                <div>
                  <p className="text-sm font-medium">Lifegram Bot</p>
                  <p className="text-xs text-muted-foreground">@lifegrambot</p>
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
        <Link href="/" className="px-5 py-2 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
          Back to Home
        </Link>
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
