import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth, useTelegram } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { copyToClipboard } from "@/lib/clipboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Loader2, Code, Globe, Palette, MessageSquare, CheckCircle, HelpCircle, Headphones, Radio, ExternalLink, Settings, ChevronDown, ChevronUp, Link2, Shield, Sparkles, Star, Zap, Crown, Bitcoin, X, Users, UserPlus, Eye, Lock, Share2, Monitor, MousePointer, Home, Paintbrush, Bot, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { NotionAvatar } from "@/components/notion-avatar";

const BUBBLE_ICONS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "help", label: "Help", icon: HelpCircle },
  { id: "wave", label: "Wave", icon: Radio },
  { id: "headset", label: "Headset", icon: Headphones },
] as const;

type FaqItem = { q: string; a: string };
type SocialLink = { platform: string; url: string };

type Widget = {
  id: number;
  widget_key: string;
  site_name: string;
  color: string;
  greeting: string;
  position: string;
  logo_text: string;
  bubble_icon: string;
  btn_color: string;
  faq_items: string;
  social_links: string;
  allowed_domains: string;
  hide_watermark: number;
  active: number;
  created_at: string;
  role?: string;
  bg_style?: string;
  bg_gradient?: string;
  quick_replies?: string;
  show_faq?: number;
  show_social?: number;
  forward_email?: string;
  btn_size?: string;
};

const COLOR_PRESETS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#06b6d4",
];

const BTN_COLOR_PRESETS = ["#25D366", "#E4405F", "#1877F2", "#000000", "#FF6B35", "#7C3AED", "#DC2626", "#059669"];

const SOCIAL_PLATFORMS = [
  "whatsapp", "instagram", "facebook", "twitter", "telegram",
  "linkedin", "youtube", "tiktok", "discord", "snapchat",
  "pinterest", "email", "website",
] as const;

function parseFaq(raw: string | FaqItem[]): FaqItem[] {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || "[]"); } catch { return []; }
}
function parseSocial(raw: string | SocialLink[]): SocialLink[] {
  if (Array.isArray(raw)) return raw;
  try { return JSON.parse(raw || "[]"); } catch { return []; }
}

type PlanInfo = {
  label: string; price: number; priceUsd: number; widgets: number; msgsPerDay: number;
  ai: boolean; trainUrls: number; watermark: boolean; faq: number; social: number;
  maxCrawlPages?: number;
};
type BoostDef = { label: string; starsPerUnit: number; usdPerUnit: number; type: string; unitStep: number; minUnits: number; maxUnits: number; example: string };
type PlanStatus = {
  plan: string; limits: PlanInfo; baseLimits: PlanInfo;
  usage: { widgets: number; dailyMessages: number };
  subscription: { plan: string; expires_at: string; stars_paid: number } | null;
  plans: Record<string, PlanInfo>; isAdmin: boolean;
  boosts: Record<string, number>;
  boostCatalog: Record<string, BoostDef>;
};

const PLAN_ICONS: Record<string, typeof Star> = { free: Star, standard: Zap, pro: Crown };

const PLATFORM_META: Record<string, { icon: string; placeholder: string; prefix: string }> = {
  whatsapp: { icon: "💬", placeholder: "phone number or wa.me/123...", prefix: "wa.me/" },
  instagram: { icon: "📸", placeholder: "username or instagram.com/...", prefix: "instagram.com/" },
  facebook: { icon: "👤", placeholder: "page URL or facebook.com/...", prefix: "facebook.com/" },
  twitter: { icon: "𝕏", placeholder: "username or x.com/...", prefix: "x.com/" },
  telegram: { icon: "✈️", placeholder: "username or t.me/...", prefix: "t.me/" },
  linkedin: { icon: "💼", placeholder: "profile URL or linkedin.com/in/...", prefix: "linkedin.com/in/" },
  youtube: { icon: "▶️", placeholder: "channel URL or youtube.com/@...", prefix: "youtube.com/@" },
  tiktok: { icon: "🎵", placeholder: "username or tiktok.com/@...", prefix: "tiktok.com/@" },
  discord: { icon: "🎮", placeholder: "invite code or discord.gg/...", prefix: "discord.gg/" },
  snapchat: { icon: "👻", placeholder: "username or snapchat.com/add/...", prefix: "snapchat.com/add/" },
  pinterest: { icon: "📌", placeholder: "username or pinterest.com/...", prefix: "pinterest.com/" },
  email: { icon: "✉️", placeholder: "your@email.com", prefix: "mailto:" },
  website: { icon: "🌐", placeholder: "https://yoursite.com", prefix: "https://" },
};

type SettingsTab = "general" | "style" | "home" | "button" | "ai" | "team";

const EDIT_TABS: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "style", label: "Style", icon: Paintbrush },
  { id: "home", label: "Home Screen", icon: Home },
  { id: "button", label: "Widget Button", icon: MousePointer },
  { id: "ai", label: "AI", icon: Bot },
  { id: "team", label: "Team", icon: Users },
];

const CREATE_TABS: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "style", label: "Style", icon: Paintbrush },
  { id: "home", label: "Home Screen", icon: Home },
  { id: "button", label: "Widget Button", icon: MousePointer },
];

const AGENT_TABS: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "style", label: "Style", icon: Paintbrush },
  { id: "home", label: "Home Screen", icon: Home },
  { id: "button", label: "Widget Button", icon: MousePointer },
  { id: "team", label: "Team", icon: Users },
];

function SettingsTabBar({ tabs, active, onChange }: { tabs: typeof EDIT_TABS; active: SettingsTab; onChange: (t: SettingsTab) => void }) {
  return (
    <div className="flex gap-0.5 bg-[#111] rounded-xl p-1 overflow-x-auto no-scrollbar">
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all flex-1 justify-center min-w-0",
              isActive
                ? "bg-[#4ade80] text-black shadow-sm"
                : "text-white/50 hover:text-white/70 hover:bg-white/5"
            )}
          >
            <Icon className="h-3 w-3 shrink-0" />
            <span className="truncate">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-2 mt-1">{children}</p>;
}

function FieldLabel({ children, icon: Icon }: { children: React.ReactNode; icon?: typeof Globe }) {
  return (
    <label className="text-[11px] text-white/60 font-medium mb-1.5 flex items-center gap-1.5">
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </label>
  );
}

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#141414] rounded-xl p-3 space-y-3 border border-white/[0.04]">{children}</div>;
}

function GeneralTab({
  name, setName, domain, setDomain, greeting, setGreeting,
  color, setColor, avatarId, setAvatarId, isAdmin,
}: {
  name: string; setName: (v: string) => void;
  domain: string; setDomain: (v: string) => void;
  greeting: string; setGreeting: (v: string) => void;
  color: string; setColor: (v: string) => void;
  avatarId: number; setAvatarId: (v: number) => void;
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-3">
      <FieldGroup>
        <div>
          <FieldLabel icon={Globe}>Widget Name</FieldLabel>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Website" className="text-xs h-9 bg-[#0c0c0c] border-white/[0.06] focus:border-[#4ade80]/50 rounded-lg" />
        </div>

        <div>
          <FieldLabel icon={Shield}>
            Allowed Domain(s) {!isAdmin && <span className="text-[#4ade80]">*</span>}
          </FieldLabel>
          <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder={isAdmin ? "Optional for admin" : "example.com, sub.example.com"} className="text-xs h-9 bg-[#0c0c0c] border-white/[0.06] focus:border-[#4ade80]/50 rounded-lg" />
          <p className="text-[10px] text-white/30 mt-1">{isAdmin ? "Optional. Leave empty to allow all domains." : "Comma-separated. Widget only loads on these domains."}</p>
        </div>
      </FieldGroup>

      <FieldGroup>
        <div>
          <FieldLabel icon={MessageSquare}>Greeting Message</FieldLabel>
          <Input value={greeting} onChange={e => setGreeting(e.target.value)} className="text-xs h-9 bg-[#0c0c0c] border-white/[0.06] focus:border-[#4ade80]/50 rounded-lg" />
        </div>
      </FieldGroup>

      <FieldGroup>
        <div>
          <FieldLabel icon={Palette}>Theme Color</FieldLabel>
          <div className="flex gap-2 flex-wrap">
            {COLOR_PRESETS.map(c => (
              <button key={c} onClick={() => setColor(c)} className={cn("w-7 h-7 rounded-full transition-all border-2", color === c ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105")} style={{ background: c }} />
            ))}
          </div>
        </div>
      </FieldGroup>

      <FieldGroup>
        <div>
          <FieldLabel>Avatar</FieldLabel>
          <div className="flex gap-1.5 flex-wrap items-center">
            <button onClick={() => setAvatarId(0)} className={cn("w-9 h-9 rounded-full border-2 border-dashed text-[9px] text-white/30 flex items-center justify-center transition-all", avatarId === 0 ? "border-[#4ade80] text-[#4ade80] bg-[#4ade80]/10" : "border-white/10 hover:border-white/20")}>Off</button>
            {Array.from({length: 15}, (_, i) => i + 1).map(id => (
              <button key={id} onClick={() => setAvatarId(id)} className={cn("w-9 h-9 rounded-full overflow-hidden transition-all border-2", avatarId === id ? "border-[#4ade80] scale-110" : "border-transparent hover:scale-105")}>
                <NotionAvatar avatarId={id} size={36} />
              </button>
            ))}
          </div>
          <p className="text-[10px] text-white/30 mt-1">Replaces logo text in widget header</p>
        </div>
      </FieldGroup>
    </div>
  );
}

const GRADIENT_PRESETS = [
  "linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.08) 100%)",
  "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(6,182,212,0.08) 100%)",
  "linear-gradient(135deg, rgba(236,72,153,0.15) 0%, rgba(244,63,94,0.08) 100%)",
  "linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(16,185,129,0.08) 100%)",
  "linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(249,115,22,0.08) 100%)",
];

function StyleTab({
  btnColor, setBtnColor, logoText, setLogoText, calLink, setCalLink,
  bgStyle, setBgStyle, bgGradient, setBgGradient,
}: {
  btnColor: string; setBtnColor: (v: string) => void;
  logoText: string; setLogoText: (v: string) => void;
  calLink: string; setCalLink: (v: string) => void;
  bgStyle: string; setBgStyle: (v: string) => void;
  bgGradient: string; setBgGradient: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <FieldGroup>
        <div>
          <FieldLabel icon={Palette}>Background Style</FieldLabel>
          <p className="text-[10px] text-white/30 mb-2">Widget header/hero background appearance</p>
          <div className="flex gap-2">
            {(["solid", "gradient"] as const).map(s => (
              <button key={s} onClick={() => setBgStyle(s)} className={cn(
                "flex-1 py-2 px-3 rounded-xl text-xs font-medium border-2 transition-all capitalize",
                bgStyle === s
                  ? "bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/40"
                  : "bg-[#0c0c0c] text-white/40 border-white/[0.06] hover:border-white/10"
              )}>{s}</button>
            ))}
          </div>
          {bgStyle === "gradient" && (
            <div className="mt-2 space-y-1.5">
              <p className="text-[10px] text-white/30">Pick a gradient preset</p>
              <div className="flex gap-2 flex-wrap">
                {GRADIENT_PRESETS.map((g, i) => (
                  <button key={i} onClick={() => setBgGradient(g)} className={cn("w-10 h-6 rounded-lg border-2 transition-all", bgGradient === g ? "border-[#4ade80] scale-110" : "border-white/10 hover:border-white/20")} style={{ background: g }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </FieldGroup>

      <FieldGroup>
        <div>
          <FieldLabel icon={Palette}>Button Color</FieldLabel>
          <p className="text-[10px] text-white/30 mb-2">Override the theme color for the chat button</p>
          <div className="flex gap-2 flex-wrap items-center">
            <button onClick={() => setBtnColor("")} className={cn("w-7 h-7 rounded-full border-2 border-dashed text-[7px] text-white/30 flex items-center justify-center transition-all", !btnColor ? "border-[#4ade80] text-[#4ade80] bg-[#4ade80]/10" : "border-white/10 hover:border-white/20")}>Auto</button>
            {BTN_COLOR_PRESETS.map(c => (
              <button key={c} onClick={() => setBtnColor(c)} className={cn("w-7 h-7 rounded-full transition-all border-2", btnColor === c ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105")} style={{ background: c }} />
            ))}
          </div>
        </div>
      </FieldGroup>

      <FieldGroup>
        <div>
          <FieldLabel>Logo Text</FieldLabel>
          <p className="text-[10px] text-white/30 mb-1.5">2 letter abbreviation shown on the widget bubble</p>
          <Input value={logoText} onChange={e => setLogoText(e.target.value.slice(0, 2))} placeholder="LG" className="text-xs h-9 w-24 bg-[#0c0c0c] border-white/[0.06] focus:border-[#4ade80]/50 rounded-lg uppercase text-center font-bold tracking-wide" maxLength={2} />
        </div>
      </FieldGroup>

      <FieldGroup>
        <div>
          <FieldLabel icon={Link2}>Cal.com Link</FieldLabel>
          <p className="text-[10px] text-white/30 mb-1.5">Adds a "Book a meeting" button in the widget</p>
          <Input value={calLink} onChange={e => setCalLink(e.target.value)} placeholder="https://cal.com/your-name/30min" className="text-xs h-9 bg-[#0c0c0c] border-white/[0.06] focus:border-[#4ade80]/50 rounded-lg" />
        </div>
      </FieldGroup>
    </div>
  );
}

function HomeScreenTab({
  faq, setFaq, social, setSocial,
  hideWatermark, onHideWatermarkChange,
  isAdmin, planStatus,
  showFaq, setShowFaq, showSocial, setShowSocial,
  quickReplies, setQuickReplies, forwardEmail, setForwardEmail,
}: {
  faq: FaqItem[]; setFaq: (v: FaqItem[]) => void;
  social: SocialLink[]; setSocial: (v: SocialLink[]) => void;
  hideWatermark?: boolean; onHideWatermarkChange?: (v: boolean) => void;
  isAdmin: boolean; planStatus: PlanStatus | null;
  showFaq: boolean; setShowFaq: (v: boolean) => void;
  showSocial: boolean; setShowSocial: (v: boolean) => void;
  quickReplies: string[]; setQuickReplies: (v: string[]) => void;
  forwardEmail: string; setForwardEmail: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <FieldGroup>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-white/80">Show FAQ Section</p>
            <p className="text-[10px] text-white/30">Display FAQ questions on home screen</p>
          </div>
          <Switch checked={showFaq} onCheckedChange={setShowFaq} />
        </div>
      </FieldGroup>

      <FieldGroup>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-white/80">Show Social Links</p>
            <p className="text-[10px] text-white/30">Display social buttons on home screen</p>
          </div>
          <Switch checked={showSocial} onCheckedChange={setShowSocial} />
        </div>
      </FieldGroup>

      <FieldGroup>
        <div className="flex items-center justify-between">
          <FieldLabel icon={MessageSquare}>Quick Reply Chips</FieldLabel>
          {quickReplies.length < 6 && (
            <button onClick={() => setQuickReplies([...quickReplies, ""])} className="text-[10px] text-[#4ade80] font-semibold hover:underline">+ Add</button>
          )}
        </div>
        <p className="text-[10px] text-white/30">Suggestion buttons visitors can tap to quickly send a message</p>
        {quickReplies.map((chip, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={chip}
              onChange={e => { const n = [...quickReplies]; n[i] = e.target.value; setQuickReplies(n); }}
              placeholder={`e.g. "What's your pricing?"`}
              className="text-xs h-8 bg-[#0c0c0c] border-white/[0.06] flex-1"
              maxLength={100}
            />
            <button onClick={() => setQuickReplies(quickReplies.filter((_, j) => j !== i))} className="text-red-400/60 hover:text-red-400 shrink-0"><Trash2 className="h-3 w-3" /></button>
          </div>
        ))}
        {quickReplies.length === 0 && <p className="text-[10px] text-white/25 italic text-center py-1">No quick replies yet</p>}
      </FieldGroup>

      <FieldGroup>
        <div>
          <FieldLabel>Forward to Email</FieldLabel>
          <p className="text-[10px] text-white/30 mb-1.5">Receive chat transcripts at this email address</p>
          <Input value={forwardEmail} onChange={e => setForwardEmail(e.target.value)} placeholder="support@company.com" className="text-xs h-9 bg-[#0c0c0c] border-white/[0.06] focus:border-[#4ade80]/50 rounded-lg" />
        </div>
      </FieldGroup>

      <FieldGroup>
        <div className="flex items-center justify-between">
          <FieldLabel icon={HelpCircle}>FAQ Questions</FieldLabel>
          {faq.length < 10 && (
            <button onClick={() => setFaq([...faq, { q: "", a: "" }])} className="text-[10px] text-[#4ade80] font-semibold hover:underline">+ Add</button>
          )}
        </div>
        {faq.map((item, i) => (
          <div key={i} className="bg-[#0c0c0c] rounded-lg p-2.5 space-y-1.5 border border-white/[0.04]">
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-[#4ade80] font-bold shrink-0 w-5">Q{i+1}</span>
              <Input value={item.q} onChange={e => { const n = [...faq]; n[i] = { ...n[i], q: e.target.value }; setFaq(n); }} placeholder="Question" className="text-xs h-7 bg-transparent border-white/[0.06]" />
              <button onClick={() => setFaq(faq.filter((_, j) => j !== i))} className="text-red-400/60 hover:text-red-400 shrink-0"><Trash2 className="h-3 w-3" /></button>
            </div>
            <Input value={item.a} onChange={e => { const n = [...faq]; n[i] = { ...n[i], a: e.target.value }; setFaq(n); }} placeholder="Answer" className="text-xs h-7 ml-7 bg-transparent border-white/[0.06]" />
          </div>
        ))}
        {faq.length === 0 && <p className="text-[10px] text-white/25 italic text-center py-2">No FAQ questions added yet</p>}
      </FieldGroup>

      <FieldGroup>
        <div className="flex items-center justify-between">
          <FieldLabel icon={Link2}>Social Links</FieldLabel>
          <div className="flex items-center gap-2">
            {social.length > 0 && <span className="text-[9px] text-white/30">{social.length}/{SOCIAL_PLATFORMS.length}</span>}
            {social.length < SOCIAL_PLATFORMS.length && (
              <button onClick={() => {
                const used = social.map(s => s.platform);
                const next = SOCIAL_PLATFORMS.find(p => !used.includes(p)) || "website";
                setSocial([...social, { platform: next, url: "" }]);
              }} className="text-[10px] text-[#4ade80] font-semibold hover:underline">+ Add</button>
            )}
          </div>
        </div>
        {social.map((link, i) => {
          const meta = PLATFORM_META[link.platform] || { icon: "🔗", placeholder: "https://...", prefix: "" };
          return (
            <div key={i} className="bg-[#0c0c0c] rounded-lg p-2.5 space-y-1.5 border border-white/[0.04]">
              <div className="flex items-center gap-2">
                <span className="text-sm shrink-0">{meta.icon}</span>
                <select
                  value={link.platform}
                  onChange={e => { const n = [...social]; n[i] = { ...n[i], platform: e.target.value }; setSocial(n); }}
                  className="bg-[#0a0a0a] border border-white/[0.06] rounded-lg text-[11px] px-2 py-1 outline-none shrink-0 w-24 text-white"
                >
                  {SOCIAL_PLATFORMS.map(p => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
                <Input
                  value={link.url}
                  onChange={e => { const n = [...social]; n[i] = { ...n[i], url: e.target.value }; setSocial(n); }}
                  placeholder={meta.placeholder}
                  className="text-xs h-7 flex-1 bg-transparent border-white/[0.06]"
                />
                <button onClick={() => setSocial(social.filter((_, j) => j !== i))} className="text-red-400/60 hover:text-red-400 shrink-0"><Trash2 className="h-3 w-3" /></button>
              </div>
              {link.url && !link.url.includes("://") && !link.url.includes("@") && link.platform !== "email" && (
                <p className="text-[9px] text-white/25 pl-7">Will be saved as: https://{link.url.startsWith(meta.prefix) ? link.url : (link.url.includes(".") ? link.url : meta.prefix + link.url.replace(/^@/, ""))}</p>
              )}
            </div>
          );
        })}
        {social.length === 0 && (
          <div className="text-center py-3">
            <p className="text-[10px] text-white/25 italic">No social links added</p>
            <p className="text-[9px] text-white/20 mt-0.5">Add links to show social buttons on your widget</p>
          </div>
        )}
      </FieldGroup>

      {hideWatermark !== undefined && (() => {
        const canRemove = isAdmin || (planStatus && !planStatus.limits.watermark);
        return (
          <FieldGroup>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium flex items-center gap-1.5 text-white/80">
                  Remove Watermark
                  {!canRemove && <Lock className="h-3 w-3 text-yellow-500" />}
                </p>
                <p className="text-[10px] text-white/30">
                  {canRemove ? 'Hide "Powered by Lifegram" branding' : "Upgrade to Standard or Pro to unlock"}
                </p>
              </div>
              <Switch
                checked={hideWatermark && !!canRemove}
                onCheckedChange={(v) => { if (canRemove) onHideWatermarkChange?.(v); else toast.error("Upgrade to Standard or Pro plan to remove watermark"); }}
                disabled={!canRemove}
              />
            </div>
          </FieldGroup>
        );
      })()}
    </div>
  );
}

function WidgetButtonTab({
  position, setPosition, bubbleIcon, setBubbleIcon,
}: {
  position: "left" | "right"; setPosition: (v: "left" | "right") => void;
  bubbleIcon: string; setBubbleIcon: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <FieldGroup>
        <div>
          <FieldLabel icon={Monitor}>Position</FieldLabel>
          <p className="text-[10px] text-white/30 mb-2">Where the chat button appears on your website</p>
          <div className="flex gap-2">
            {(["left", "right"] as const).map(p => (
              <button key={p} onClick={() => setPosition(p)} className={cn(
                "flex-1 py-2.5 px-4 rounded-xl text-xs font-medium border-2 transition-all capitalize flex items-center justify-center gap-2",
                position === p
                  ? "bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/40"
                  : "bg-[#0c0c0c] text-white/40 border-white/[0.06] hover:border-white/10"
              )}>
                <div className={cn("w-10 h-6 rounded border border-current/30 relative", position === p ? "bg-[#4ade80]/5" : "bg-white/5")}>
                  <div className={cn("absolute bottom-0.5 w-2 h-2 rounded-full", position === p ? "bg-[#4ade80]" : "bg-white/30", p === "left" ? "left-0.5" : "right-0.5")} />
                </div>
                {p}
              </button>
            ))}
          </div>
        </div>
      </FieldGroup>

      <FieldGroup>
        <div>
          <FieldLabel>Bubble Icon</FieldLabel>
          <p className="text-[10px] text-white/30 mb-2">Icon shown inside the floating chat button</p>
          <div className="grid grid-cols-4 gap-2">
            {BUBBLE_ICONS.map(bi => (
              <button key={bi.id} onClick={() => setBubbleIcon(bi.id)} className={cn(
                "py-2.5 px-1.5 rounded-xl text-[10px] font-medium border-2 transition-all flex flex-col items-center gap-1",
                bubbleIcon === bi.id
                  ? "bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/40"
                  : "bg-[#0c0c0c] text-white/40 border-white/[0.06] hover:border-white/10"
              )}>
                <bi.icon className="h-4 w-4" />{bi.label}
              </button>
            ))}
          </div>
        </div>
      </FieldGroup>
    </div>
  );
}

function AiTab({
  aiEnabled, setAiEnabled, aiModel, setAiModel, aiPrompt, setAiPrompt,
  trainSiteUrl, setTrainSiteUrl, trainedPages, trainedChars,
  training, onTrain, onClearTraining,
}: {
  aiEnabled: boolean; setAiEnabled: (v: boolean) => void;
  aiModel: string; setAiModel: (v: string) => void;
  aiPrompt: string; setAiPrompt: (v: string) => void;
  trainSiteUrl: string; setTrainSiteUrl: (v: string) => void;
  trainedPages: string[]; trainedChars: number;
  training: boolean; onTrain: () => void; onClearTraining: () => void;
}) {
  return (
    <div className="space-y-3">
      <FieldGroup>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-medium text-white/80 flex items-center gap-1.5"><Bot className="h-3.5 w-3.5 text-[#4ade80]" /> Enable AI Replies</p>
            <p className="text-[10px] text-white/30">Auto-respond to visitors using AI</p>
          </div>
          <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
        </div>
      </FieldGroup>

      {aiEnabled && (
        <>
          <FieldGroup>
            <div>
              <FieldLabel>AI Model</FieldLabel>
              <select
                value={aiModel}
                onChange={e => setAiModel(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-[#0c0c0c] border border-white/[0.06] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4ade80]/50 text-white"
              >
                <optgroup label="OpenAI">
                  <option value="o4-mini">o4 Mini</option>
                  <option value="o3-mini">o3 Mini</option>
                  <option value="gpt-4.1">GPT-4.1</option>
                  <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                  <option value="gpt-4.1-nano">GPT-4.1 Nano</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                </optgroup>
                <optgroup label="Anthropic">
                  <option value="claude-sonnet-4-20250514">Claude Sonnet</option>
                  <option value="claude-3-5-haiku-20241022">Claude Haiku</option>
                </optgroup>
                <optgroup label="Google">
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                </optgroup>
              </select>
            </div>

            <div>
              <FieldLabel>System Prompt</FieldLabel>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="Instructions for the AI..."
                rows={3}
                className="w-full px-3 py-2 text-xs bg-[#0c0c0c] border border-white/[0.06] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4ade80]/50 resize-none text-white placeholder:text-white/20"
              />
            </div>

            <div className="bg-[#0c0c0c] border border-white/[0.04] rounded-lg p-2.5">
              <p className="text-[10px] text-white/30">
                Requires a matching API key saved in AI Chat settings. The AI model's provider key must be configured.
              </p>
            </div>
          </FieldGroup>

          <FieldGroup>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3 text-[#4ade80]" />
                <FieldLabel>Train AI from Website</FieldLabel>
              </div>
              {trainedChars > 0 && (
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-white/40 border-white/10">
                  {trainedChars.toLocaleString()} chars
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-white/30">
              Enter your website URL — we'll automatically crawl and scrape all pages to train the AI.
            </p>

            <Input
              value={trainSiteUrl}
              onChange={e => setTrainSiteUrl(e.target.value)}
              placeholder="https://yoursite.com"
              className="text-xs h-9 bg-[#0c0c0c] border-white/[0.06] focus:border-[#4ade80]/50 rounded-lg"
              onKeyDown={e => { if (e.key === "Enter") onTrain(); }}
              disabled={training}
            />

            <div className="flex gap-1.5">
              <Button onClick={onTrain} disabled={training || !trainSiteUrl.trim()} size="sm" className="flex-1 gap-1 text-[11px] h-8 bg-[#4ade80] text-black hover:bg-[#22c55e]">
                {training ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {training ? "Crawling site..." : "Crawl & Train"}
              </Button>
              {trainedChars > 0 && (
                <Button onClick={onClearTraining} size="sm" variant="ghost" className="text-[11px] h-8 text-white/40 hover:text-red-400">
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>

            {trainedPages.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-[10px] text-white/40 font-medium">{trainedPages.length} page(s) trained</p>
                <div className="max-h-24 overflow-y-auto space-y-0.5">
                  {trainedPages.map((url, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[9px] text-white/30">
                      <Globe className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{url}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </FieldGroup>
        </>
      )}
    </div>
  );
}

function TeamTab({
  widget, collabs, collabsKey, inviteCodeMap, inviting,
  loadCollabs, generateInvite, removeCollab, shareText,
}: {
  widget: Widget;
  collabs: { id: number; telegram_id: string; role: string; invite_code: string; status: string; created_at: string; first_name?: string; username?: string }[];
  collabsKey: string | null;
  inviteCodeMap: Record<string, string>;
  inviting: boolean;
  loadCollabs: (wk: string) => void;
  generateInvite: (wk: string) => void;
  removeCollab: (id: number) => void;
  shareText: (text: string) => void;
}) {
  return (
    <div className="space-y-3">
      <FieldGroup>
        <p className="text-[10px] text-white/30">
          {widget.role === "agent" ? "Team members with access to this widget" : "Invite team members to help manage this widget's chats"}
        </p>
        {collabsKey !== widget.widget_key ? (
          <Button size="sm" variant="outline" className="w-full gap-1 text-[11px] h-9 border-white/[0.06] hover:border-[#4ade80]/40 hover:text-[#4ade80]" onClick={() => loadCollabs(widget.widget_key)}>
            <Users className="h-3 w-3" /> {widget.role === "agent" ? "View Team" : "Manage Collaborators"}
          </Button>
        ) : (
          <div className="space-y-2">
            {widget.role !== "agent" && (
              <Button size="sm" className="w-full gap-1 text-[11px] h-9 bg-[#4ade80] text-black hover:bg-[#22c55e]" onClick={() => generateInvite(widget.widget_key)} disabled={inviting}>
                {inviting ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                Generate Invite Code
              </Button>
            )}
            {inviteCodeMap[widget.widget_key] && widget.role !== "agent" && (
              <div className="bg-[#0c0c0c] rounded-lg p-2.5 space-y-2 border border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <code className="text-[10px] font-mono flex-1 break-all text-[#4ade80]">{inviteCodeMap[widget.widget_key]}</code>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { copyToClipboard(inviteCodeMap[widget.widget_key]); toast.success("Copied!"); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  size="sm" variant="outline" className="w-full h-7 text-[10px] gap-1 border-white/[0.06]"
                  onClick={() => {
                    shareText(`Join my Lifegram widget "${widget.site_name || "Widget"}" as a collaborator!\n\nInvite code: ${inviteCodeMap[widget.widget_key]}\n\nOpen @lifegrambot → Widget Settings → Join Widget and paste the code.`);
                    toast.success("Sharing…");
                  }}
                >
                  <Share2 className="h-3 w-3" /> Share Invite
                </Button>
              </div>
            )}
            {collabs.length === 0 ? (
              <p className="text-[10px] text-white/25 text-center py-3 italic">No collaborators yet</p>
            ) : (
              <div className="space-y-1.5">
                {collabs.map(c => (
                  <div key={c.id} className="flex items-center gap-2 bg-[#0c0c0c] rounded-lg px-2.5 py-2 border border-white/[0.04]">
                    <div className="w-7 h-7 rounded-full bg-[#4ade80]/10 flex items-center justify-center text-[10px] font-bold text-[#4ade80]">
                      {(c.first_name || c.telegram_id || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate text-white/80">{c.first_name || c.telegram_id || "Pending"}</p>
                      <p className="text-[9px] text-white/30">{c.status === "pending" ? "Invite pending" : c.role}</p>
                    </div>
                    <Badge variant="outline" className="text-[8px] px-1 py-0 border-white/10">{c.status}</Badge>
                    {widget.role !== "agent" && (
                      <button onClick={() => removeCollab(c.id)} className="text-white/20 hover:text-red-400 transition-colors">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </FieldGroup>
    </div>
  );
}

export function WidgetSettings() {
  const { profile, shareText } = useTelegram();
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchasingBoost, setPurchasingBoost] = useState<string | null>(null);
  const [boostQuantities, setBoostQuantities] = useState<Record<string, number>>({});
  const [boostCryptoModal, setBoostCryptoModal] = useState<{ boostKey: string; boostDef: BoostDef } | null>(null);
  const [boostCryptoPayment, setBoostCryptoPayment] = useState<{
    track_id: string; address: string; pay_amount: number;
    pay_currency: string; qr_code: string | null; expired_at: number;
  } | null>(null);
  const [boostCryptoStatus, setBoostCryptoStatus] = useState("pending");
  const [cryptoModal, setCryptoModal] = useState<{ plan: string; planInfo: PlanInfo } | null>(null);
  const [cryptoCurrencies, setCryptoCurrencies] = useState<{ symbol: string; networks: string[] }[]>([]);
  const [selectedCoin, setSelectedCoin] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [cryptoPayment, setCryptoPayment] = useState<{
    track_id: string; address: string; pay_amount: number;
    pay_currency: string; qr_code: string | null; expired_at: number;
  } | null>(null);
  const [cryptoStatus, setCryptoStatus] = useState<string>("pending");
  const [addressCopied, setAddressCopied] = useState(false);
  type ActiveWidgetPayment = {
    id: number; plan: string; order_id: string; track_id: string; amount_usd: number;
    pay_currency: string; pay_amount: number; address: string; status: string;
    qr_code?: string; expired_at: number; created_at: string;
  };
  const [activeWidgetPayments, setActiveWidgetPayments] = useState<ActiveWidgetPayment[]>([]);
  const [expandedWidgetPay, setExpandedWidgetPay] = useState<number | null>(null);
  const [checkingWidgetPay, setCheckingWidgetPay] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [newBtnColor, setNewBtnColor] = useState("");
  const [newGreeting, setNewGreeting] = useState("Hi there! How can we help you?");
  const [newPosition, setNewPosition] = useState<"left" | "right">("right");
  const [newLogoText, setNewLogoText] = useState("");
  const [newBubbleIcon, setNewBubbleIcon] = useState("chat");
  const [newFaq, setNewFaq] = useState<FaqItem[]>([]);
  const [newSocial, setNewSocial] = useState<SocialLink[]>([]);
  const [newDomain, setNewDomain] = useState("");
  const [newAvatarId, setNewAvatarId] = useState(0);
  const [newCalLink, setNewCalLink] = useState("");
  const [newTab, setNewTab] = useState<SettingsTab>("general");

  const [embedKey, setEmbedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#6366f1");
  const [editBtnColor, setEditBtnColor] = useState("");
  const [editGreeting, setEditGreeting] = useState("");
  const [editPosition, setEditPosition] = useState<"left" | "right">("right");
  const [editLogoText, setEditLogoText] = useState("");
  const [editBubbleIcon, setEditBubbleIcon] = useState("chat");
  const [editFaq, setEditFaq] = useState<FaqItem[]>([]);
  const [editSocial, setEditSocial] = useState<SocialLink[]>([]);
  const [editDomain, setEditDomain] = useState("");
  const [editAvatarId, setEditAvatarId] = useState(0);
  const [editCalLink, setEditCalLink] = useState("");
  const [editHideWatermark, setEditHideWatermark] = useState(false);
  const [editAiEnabled, setEditAiEnabled] = useState(false);
  const [editAiModel, setEditAiModel] = useState("gpt-4o-mini");
  const [editAiPrompt, setEditAiPrompt] = useState("");
  const [trainSiteUrl, setTrainSiteUrl] = useState("");
  const [trainedPages, setTrainedPages] = useState<string[]>([]);
  const [training, setTraining] = useState(false);
  const [trainedChars, setTrainedChars] = useState(0);
  const [editTab, setEditTab] = useState<SettingsTab>("general");

  type Collaborator = { id: number; telegram_id: string; role: string; invite_code: string; status: string; created_at: string; first_name?: string; username?: string };
  const [collabs, setCollabs] = useState<Collaborator[]>([]);
  const [collabsKey, setCollabsKey] = useState<string | null>(null);
  const [inviteCodeMap, setInviteCodeMap] = useState<Record<string, string>>({});
  const [inviting, setInviting] = useState(false);
  const [acceptCode, setAcceptCode] = useState("");
  const [accepting, setAccepting] = useState(false);

  const loadCollabs = (wk: string) => {
    setCollabsKey(wk);
    fetch(`${API_BASE}/widget/collaborators/${wk}`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setCollabs(d))
      .catch(() => {});
  };

  const generateInvite = (wk: string) => {
    setInviting(true);
    fetch(`${API_BASE}/widget/invite/${wk}`, { method: "POST", headers })
      .then(r => r.json())
      .then(d => { if (d.invite_code) { setInviteCodeMap(prev => ({ ...prev, [wk]: d.invite_code })); toast.success("Invite code generated!"); } else { toast.error(d.error || "Failed"); } })
      .catch(() => toast.error("Failed"))
      .finally(() => setInviting(false));
  };

  const removeCollab = (id: number) => {
    fetch(`${API_BASE}/widget/collaborators/${id}`, { method: "DELETE", headers })
      .then(r => r.json())
      .then(d => { if (d.ok) { setCollabs(c => c.filter(x => x.id !== id)); toast.success("Removed"); } else { toast.error(d.error || "Failed"); } })
      .catch(() => toast.error("Failed"));
  };

  const acceptWidgetInvite = async () => {
    if (!acceptCode.trim()) { toast.error("Enter an invite code"); return; }
    setAccepting(true);
    try {
      const r = await fetch(`${API_BASE}/widget/invite/accept`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ invite_code: acceptCode.trim() }),
      });
      const d = await r.json();
      if (d.ok) { toast.success("Joined as collaborator!"); setAcceptCode(""); loadWidgets(); }
      else toast.error(d.error || "Failed");
    } catch { toast.error("Network error"); }
    finally { setAccepting(false); }
  };

  const loadWidgets = () => {
    setLoading(true);
    fetch(`${API_BASE}/widget/my-widgets`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setWidgets(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const loadPlanStatus = () => {
    fetch(`${API_BASE}/widget/plan/status`, { headers })
      .then(r => r.json())
      .then(d => d.ok && setPlanStatus(d))
      .catch(() => {});
  };

  const loadActiveWidgetPayments = () => {
    fetch(`${API_BASE}/widget/payments/active`, { headers })
      .then(r => r.json())
      .then((d: any) => {
        if (d.ok && Array.isArray(d.payments)) setActiveWidgetPayments(d.payments);
      })
      .catch(() => {});
  };

  const checkWidgetPaymentStatus = async (trackId: string, plan: string) => {
    setCheckingWidgetPay(trackId);
    try {
      const endpoint = plan.startsWith("boost:")
        ? `${API_BASE}/widget/boost/crypto-status/${trackId}`
        : `${API_BASE}/widget/plan/crypto-status/${trackId}`;
      const res = await fetch(endpoint, { headers });
      const d = await res.json() as { ok: boolean; status: string };
      if (d.ok) {
        if (d.status === "paid") {
          toast.success("Payment confirmed!");
          loadPlanStatus(); loadActiveWidgetPayments();
        } else if (d.status === "expired" || d.status === "failed") {
          toast.info(`Payment ${d.status}`);
          loadActiveWidgetPayments();
        } else if (d.status === "confirming") {
          toast.info("Confirming on-chain...");
        } else {
          toast.info(`Status: ${d.status}`);
        }
      }
    } catch { toast.error("Could not check status"); }
    finally { setCheckingWidgetPay(null); }
  };

  useEffect(() => { loadWidgets(); loadPlanStatus(); loadActiveWidgetPayments(); }, []);

  const purchasePlan = async (plan: string) => {
    setPurchasing(plan);
    try {
      const res = await fetch(`${API_BASE}/widget/plan/purchase`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const d = await res.json() as any;
      if (d.ok && d.invoice_link) {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openInvoice) {
          tg.openInvoice(d.invoice_link, (status: string) => {
            if (status === "paid") {
              toast.success("Plan activated!");
              setTimeout(() => { loadPlanStatus(); loadWidgets(); }, 1500);
            } else if (status === "cancelled") {
              toast.info("Payment cancelled");
            }
          });
        } else {
          window.open(d.invoice_link, "_blank");
        }
      } else {
        toast.error(d.error || "Failed to create invoice");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setPurchasing(null);
    }
  };

  const openCryptoModal = async (planKey: string, planInfo: PlanInfo) => {
    setCryptoModal({ plan: planKey, planInfo });
    setSelectedCoin(""); setSelectedNetwork(""); setCryptoPayment(null); setCryptoStatus("pending");
    if (cryptoCurrencies.length === 0) {
      try {
        const res = await fetch(`${API_BASE}/donations/currencies`, { headers });
        const d = await res.json() as any;
        if (d.coins) setCryptoCurrencies(d.coins);
      } catch { toast.error("Failed to load currencies"); }
    }
  };

  const startCryptoPayment = async () => {
    if (!cryptoModal || !selectedCoin) return;
    setCryptoLoading(true);
    try {
      const body: Record<string, string> = { plan: cryptoModal.plan, pay_currency: selectedCoin };
      if (selectedNetwork) body.network = selectedNetwork;
      const res = await fetch(`${API_BASE}/widget/plan/purchase-crypto`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json() as any;
      if (d.ok) {
        setCryptoPayment(d);
        setCryptoStatus("pending");
      } else {
        toast.error(d.error || "Failed to create payment");
      }
    } catch { toast.error("Network error"); }
    finally { setCryptoLoading(false); }
  };

  const pollCryptoStatus = useCallback(async () => {
    if (!cryptoPayment) return;
    try {
      const res = await fetch(`${API_BASE}/widget/plan/crypto-status/${cryptoPayment.track_id}`, { headers });
      const d = await res.json() as any;
      if (d.ok) {
        setCryptoStatus(d.status);
        if (d.status === "paid") {
          toast.success("Plan activated!");
          setTimeout(() => { loadPlanStatus(); loadWidgets(); loadActiveWidgetPayments(); setCryptoModal(null); setCryptoPayment(null); }, 1500);
        }
      }
    } catch {}
  }, [cryptoPayment, headers]);

  useEffect(() => {
    if (!cryptoPayment || cryptoStatus === "paid" || cryptoStatus === "expired" || cryptoStatus === "failed") return;
    const interval = setInterval(pollCryptoStatus, 5000);
    return () => clearInterval(interval);
  }, [cryptoPayment, cryptoStatus, pollCryptoStatus]);

  const getBoostQty = (key: string, boost: BoostDef) => boostQuantities[key] ?? boost.minUnits;

  const purchaseBoostStars = async (boostKey: string) => {
    const boost = planStatus?.boostCatalog[boostKey];
    if (!boost) return;
    const qty = getBoostQty(boostKey, boost);
    setPurchasingBoost(boostKey);
    try {
      const res = await fetch(`${API_BASE}/widget/boost/purchase`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ boost_key: boostKey, quantity: qty }),
      });
      const d = await res.json() as any;
      if (d.ok && d.invoice_link) {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openInvoice) {
          tg.openInvoice(d.invoice_link, (status: string) => {
            if (status === "paid") {
              toast.success("Boost activated!");
              setTimeout(() => loadPlanStatus(), 1500);
            } else if (status === "cancelled") {
              toast.info("Payment cancelled");
            }
          });
        } else {
          window.open(d.invoice_link, "_blank");
        }
      } else {
        toast.error(d.error || "Failed to create invoice");
      }
    } catch { toast.error("Network error"); }
    finally { setPurchasingBoost(null); }
  };

  const openBoostCryptoModal = async (boostKey: string, boostDef: BoostDef) => {
    setBoostCryptoModal({ boostKey, boostDef });
    setBoostCryptoPayment(null); setBoostCryptoStatus("pending");
    setSelectedCoin(""); setSelectedNetwork("");
    if (cryptoCurrencies.length === 0) {
      try {
        const res = await fetch(`${API_BASE}/donations/currencies`, { headers });
        const d = await res.json() as any;
        if (d.coins) setCryptoCurrencies(d.coins);
      } catch { toast.error("Failed to load currencies"); }
    }
  };

  const startBoostCryptoPayment = async () => {
    if (!boostCryptoModal || !selectedCoin) return;
    setCryptoLoading(true);
    const qty = getBoostQty(boostCryptoModal.boostKey, boostCryptoModal.boostDef);
    try {
      const body: Record<string, string | number> = { boost_key: boostCryptoModal.boostKey, pay_currency: selectedCoin, quantity: qty };
      if (selectedNetwork) body.network = selectedNetwork;
      const res = await fetch(`${API_BASE}/widget/boost/purchase-crypto`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json() as any;
      if (d.ok) {
        setBoostCryptoPayment(d);
        setBoostCryptoStatus("pending");
      } else { toast.error(d.error || "Failed to create payment"); }
    } catch { toast.error("Network error"); }
    finally { setCryptoLoading(false); }
  };

  useEffect(() => {
    if (!boostCryptoPayment || boostCryptoStatus === "paid" || boostCryptoStatus === "expired" || boostCryptoStatus === "failed") return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/widget/boost/crypto-status/${boostCryptoPayment.track_id}`, { headers });
        if (!res.ok) { toast.error("Failed to check payment status"); return; }
        const d = await res.json() as { ok: boolean; status: string };
        if (d.ok) {
          setBoostCryptoStatus(d.status);
          if (d.status === "paid") {
            toast.success("Boost activated!");
            setTimeout(() => { loadPlanStatus(); loadActiveWidgetPayments(); setBoostCryptoModal(null); setBoostCryptoPayment(null); }, 1500);
          }
        }
      } catch { toast.error("Network error checking payment"); }
    }, 5000);
    return () => clearInterval(interval);
  }, [boostCryptoPayment, boostCryptoStatus]);

  const isAdmin = planStatus?.isAdmin ?? false;

  const createWidget = async () => {
    if (!isAdmin && !newDomain.trim()) { toast.error("Domain is required"); return; }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/widget/create`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          site_name: newName.trim(), color: newColor, greeting: newGreeting.trim(),
          position: newPosition, logo_text: newLogoText.trim(), bubble_icon: newBubbleIcon,
          btn_color: newBtnColor, faq_items: newFaq.filter(f => f.q.trim() && f.a.trim()),
          social_links: newSocial.filter(s => s.url.trim()), allowed_domains: newDomain.trim(),
          avatar_id: newAvatarId, cal_link: newCalLink.trim(),
        }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success("Widget created!");
        setShowCreate(false);
        setNewName(""); setNewGreeting("Hi there! How can we help you?");
        setNewFaq([]); setNewSocial([]); setNewBtnColor(""); setNewDomain("");
        setNewAvatarId(0); setNewCalLink(""); setNewTab("general");
        loadWidgets();
      } else {
        toast.error(d.error || "Failed to create widget");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setCreating(false);
    }
  };

  const deleteWidget = async (key: string) => {
    if (!confirm("Delete this widget and all its conversations?")) return;
    try {
      const res = await fetch(`${API_BASE}/widget/${key}`, { method: "DELETE", headers });
      const d = await res.json();
      if (d.ok) {
        toast.success("Widget deleted");
        setWidgets(w => w.filter(x => x.widget_key !== key));
        if (embedKey === key) setEmbedKey(null);
        if (editKey === key) setEditKey(null);
      } else {
        toast.error(d.error || "Failed");
      }
    } catch {
      toast.error("Network error");
    }
  };

  const openEdit = (w: Widget) => {
    if (editKey === w.widget_key) { setEditKey(null); return; }
    setEditKey(w.widget_key);
    setEditTab("general");
    setEditName(w.site_name);
    setEditColor(w.color);
    setEditBtnColor(w.btn_color || "");
    setEditGreeting(w.greeting);
    setEditPosition((w.position as "left" | "right") || "right");
    setEditLogoText(w.logo_text || "");
    setEditBubbleIcon(w.bubble_icon || "chat");
    setEditFaq(parseFaq(w.faq_items));
    setEditSocial(parseSocial(w.social_links));
    setEditDomain(w.allowed_domains || "");
    setEditAvatarId((w as any).avatar_id || 0);
    setEditCalLink((w as any).cal_link || "");
    setEditHideWatermark(w.hide_watermark === 1);
    setEditAiEnabled((w as any).ai_enabled === 1);
    setEditAiModel((w as any).ai_model || "gpt-4o-mini");
    setEditAiPrompt((w as any).ai_system_prompt || "You are a helpful customer support assistant. Be concise, friendly, and professional.");
    try {
      const parsed = JSON.parse((w as any).ai_training_urls || "[]");
      setTrainedPages(Array.isArray(parsed) ? parsed : []);
    } catch { setTrainedPages([]); }
    setTrainedChars(((w as any).ai_training_data || "").length);
    setTrainSiteUrl("");
  };

  const saveEdit = async (key: string) => {
    if (!isAdmin && !editDomain.trim()) { toast.error("Domain is required"); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/widget/${key}/update`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          site_name: editName, color: editColor, greeting: editGreeting,
          position: editPosition, logo_text: editLogoText, bubble_icon: editBubbleIcon,
          btn_color: editBtnColor, allowed_domains: editDomain,
          avatar_id: editAvatarId, cal_link: editCalLink.trim(),
          hide_watermark: editHideWatermark,
          ai_enabled: editAiEnabled,
          ai_model: editAiModel,
          ai_system_prompt: editAiPrompt,
          faq_items: editFaq.filter(f => f.q.trim() && f.a.trim()),
          social_links: editSocial.filter(s => s.url.trim()),
        }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success("Widget updated!");
        loadWidgets();
      } else {
        toast.error(d.error || "Failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSaving(false);
    }
  };

  const getEmbedCode = (key: string) => {
    return `<script src="https://mini.susagar.sbs/api/w/embed.js?key=${key}" data-key="${key}" async><\/script>`;
  };

  const copyEmbed = (key: string) => {
    copyToClipboard(getEmbedCode(key));
    setCopied(true);
    toast.success("Embed code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const trainWidget = async (key: string) => {
    const url = trainSiteUrl.trim();
    if (!url || !/^https?:\/\/.+/.test(url)) { toast.error("Enter a valid website URL"); return; }
    setTraining(true);
    try {
      const res = await fetch(`${API_BASE}/widget/${key}/train`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const d = await res.json() as any;
      if (d.ok) {
        const succeeded = d.results?.filter((r: any) => !r.error) || [];
        const failed = d.results?.filter((r: any) => r.error) || [];
        setTrainedPages(succeeded.map((r: any) => r.url));
        setTrainedChars(d.totalChars || 0);
        if (failed.length > 0) {
          toast.success(`Crawled ${succeeded.length} pages (${failed.length} failed) — ${d.totalChars?.toLocaleString()} chars`);
        } else {
          toast.success(`Crawled ${d.pagesCrawled} pages — ${d.totalChars?.toLocaleString()} chars scraped`);
        }
        loadWidgets();
      } else {
        toast.error(d.error || "Training failed");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setTraining(false);
    }
  };

  const clearTraining = async (key: string) => {
    try {
      const res = await fetch(`${API_BASE}/widget/${key}/train`, { method: "DELETE", headers });
      const d = await res.json() as any;
      if (d.ok) {
        setTrainedPages([]);
        setTrainedChars(0);
        setTrainSiteUrl("");
        toast.success("Training data cleared");
        loadWidgets();
      }
    } catch { toast.error("Network error"); }
  };

  const renderEditTabContent = (w: Widget) => {
    switch (editTab) {
      case "general":
        return (
          <GeneralTab
            name={editName} setName={setEditName} domain={editDomain} setDomain={setEditDomain}
            greeting={editGreeting} setGreeting={setEditGreeting} color={editColor} setColor={setEditColor}
            avatarId={editAvatarId} setAvatarId={setEditAvatarId} isAdmin={isAdmin}
          />
        );
      case "style":
        return (
          <StyleTab
            btnColor={editBtnColor} setBtnColor={setEditBtnColor}
            logoText={editLogoText} setLogoText={setEditLogoText}
            calLink={editCalLink} setCalLink={setEditCalLink}
          />
        );
      case "home":
        return (
          <HomeScreenTab
            faq={editFaq} setFaq={setEditFaq} social={editSocial} setSocial={setEditSocial}
            hideWatermark={editHideWatermark} onHideWatermarkChange={setEditHideWatermark}
            isAdmin={isAdmin} planStatus={planStatus}
          />
        );
      case "button":
        return (
          <WidgetButtonTab
            position={editPosition} setPosition={setEditPosition}
            bubbleIcon={editBubbleIcon} setBubbleIcon={setEditBubbleIcon}
          />
        );
      case "ai":
        return (
          <AiTab
            aiEnabled={editAiEnabled} setAiEnabled={setEditAiEnabled}
            aiModel={editAiModel} setAiModel={setEditAiModel}
            aiPrompt={editAiPrompt} setAiPrompt={setEditAiPrompt}
            trainSiteUrl={trainSiteUrl} setTrainSiteUrl={setTrainSiteUrl}
            trainedPages={trainedPages} trainedChars={trainedChars}
            training={training}
            onTrain={() => trainWidget(w.widget_key)}
            onClearTraining={() => clearTraining(w.widget_key)}
          />
        );
      case "team":
        return (
          <TeamTab
            widget={w} collabs={collabs} collabsKey={collabsKey}
            inviteCodeMap={inviteCodeMap} inviting={inviting}
            loadCollabs={loadCollabs} generateInvite={generateInvite}
            removeCollab={removeCollab} shareText={shareText}
          />
        );
    }
  };

  const renderCreateTabContent = () => {
    switch (newTab) {
      case "general":
        return (
          <GeneralTab
            name={newName} setName={setNewName} domain={newDomain} setDomain={setNewDomain}
            greeting={newGreeting} setGreeting={setNewGreeting} color={newColor} setColor={setNewColor}
            avatarId={newAvatarId} setAvatarId={setNewAvatarId} isAdmin={isAdmin}
          />
        );
      case "style":
        return (
          <StyleTab
            btnColor={newBtnColor} setBtnColor={setNewBtnColor}
            logoText={newLogoText} setLogoText={setNewLogoText}
            calLink={newCalLink} setCalLink={setNewCalLink}
          />
        );
      case "home":
        return (
          <HomeScreenTab
            faq={newFaq} setFaq={setNewFaq} social={newSocial} setSocial={setNewSocial}
            isAdmin={isAdmin} planStatus={planStatus}
          />
        );
      case "button":
        return (
          <WidgetButtonTab
            position={newPosition} setPosition={setNewPosition}
            bubbleIcon={newBubbleIcon} setBubbleIcon={setNewBubbleIcon}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Layout title="Live Chat Widget">
      <div className="h-full overflow-y-auto p-4 space-y-4">
        <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-xl bg-[#4ade80]/10 flex items-center justify-center">
              <Globe className="h-4 w-4 text-[#4ade80]" />
            </div>
            <h2 className="font-semibold text-sm">Website Live Chat</h2>
          </div>
          <p className="text-xs text-white/40 leading-relaxed">
            Add a live chat widget to any website. Visitors can start conversations, and you'll respond from here.
          </p>
          <a href="https://mini.susagar.sbs/api/w/docs" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-[#4ade80] font-medium hover:underline">
            <ExternalLink className="h-3 w-3" /> Setup Guide
          </a>
        </div>

        <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-white/40" />
            <h3 className="text-sm font-semibold">Join a Widget</h3>
          </div>
          <p className="text-[10px] text-white/30">Enter an invite code from a widget owner to join as an agent.</p>
          <div className="flex gap-2">
            <input
              value={acceptCode} onChange={e => setAcceptCode(e.target.value)}
              placeholder="Invite code"
              className="flex-1 h-9 px-3 text-xs bg-[#0c0c0c] border border-white/[0.06] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#4ade80]/50 text-white placeholder:text-white/20"
            />
            <Button size="sm" className="h-9 text-xs gap-1 bg-[#4ade80] text-black hover:bg-[#22c55e]" onClick={acceptWidgetInvite} disabled={accepting}>
              {accepting ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
              Join
            </Button>
          </div>
        </div>

        {planStatus && !planStatus.isAdmin && (
          <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => { const Icon = PLAN_ICONS[planStatus.plan] || Star; return <Icon className="h-4 w-4 text-[#4ade80]" />; })()}
                <h3 className="text-sm font-semibold">Your Plan</h3>
                <Badge className="text-[10px] capitalize bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/20">{planStatus.plan}</Badge>
              </div>
              {planStatus.subscription?.expires_at && (
                <span className="text-[10px] text-white/30">
                  Expires {new Date(planStatus.subscription.expires_at).toLocaleDateString()}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[10px] text-white/40 mb-1">
                  <span>Widgets</span>
                  <span className={planStatus.usage.widgets >= planStatus.limits.widgets ? "text-red-400 font-semibold" : ""}>{planStatus.usage.widgets}/{planStatus.limits.widgets}</span>
                </div>
                <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", planStatus.usage.widgets >= planStatus.limits.widgets ? "bg-red-500" : planStatus.usage.widgets >= planStatus.limits.widgets * 0.8 ? "bg-yellow-500" : "bg-[#4ade80]/40")} style={{ width: `${Math.min(100, (planStatus.usage.widgets / planStatus.limits.widgets) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-white/40 mb-1">
                  <span>Messages today</span>
                  <span className={planStatus.limits.msgsPerDay > 0 && planStatus.usage.dailyMessages >= planStatus.limits.msgsPerDay ? "text-red-400 font-semibold" : ""}>{planStatus.usage.dailyMessages}/{planStatus.limits.msgsPerDay === -1 ? "∞" : planStatus.limits.msgsPerDay}</span>
                </div>
                {planStatus.limits.msgsPerDay > 0 && (
                  <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", planStatus.usage.dailyMessages >= planStatus.limits.msgsPerDay ? "bg-red-500" : planStatus.usage.dailyMessages >= planStatus.limits.msgsPerDay * 0.8 ? "bg-yellow-500" : "bg-[#4ade80]/40")} style={{ width: `${Math.min(100, (planStatus.usage.dailyMessages / planStatus.limits.msgsPerDay) * 100)}%` }} />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(["free", "standard", "pro"] as const).map(planKey => {
                const p = planStatus.plans[planKey];
                if (!p) return null;
                const isCurrent = planStatus.plan === planKey;
                const planTier: Record<string, number> = { free: 0, standard: 1, pro: 2 };
                const isDowngrade = (planTier[planKey] ?? 0) < (planTier[planStatus.plan] ?? 0);
                const isUpgrade = !isCurrent && !isDowngrade && p.price > 0;
                const Icon = PLAN_ICONS[planKey] || Star;
                return (
                  <div
                    key={planKey}
                    className={cn(
                      "rounded-xl border-2 p-2.5 text-center space-y-1.5 transition-all",
                      isCurrent ? "border-[#4ade80]/40 bg-[#4ade80]/5" : "border-white/[0.06] bg-[#0c0c0c] hover:border-white/10"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 mx-auto", isCurrent ? "text-[#4ade80]" : "text-white/30")} />
                    <p className="text-[11px] font-semibold">{p.label}</p>
                    <p className="text-[10px] text-white/40">
                      {p.price === 0 ? "Free" : `${p.price} ⭐/mo`}
                    </p>
                    <div className="text-[9px] text-white/30 space-y-0.5">
                      <p>{p.widgets} widget{p.widgets > 1 ? "s" : ""}</p>
                      <p>{p.msgsPerDay === -1 ? "Unlimited" : p.msgsPerDay} msgs/day</p>
                      {p.ai && <p className="text-[#4ade80]/60">AI auto-reply</p>}
                      {!p.watermark && <p className="text-[#4ade80]/60">No watermark</p>}
                      {(p as any).maxCrawlPages > 0 && <p className="text-[#4ade80]/60">{(p as any).maxCrawlPages} crawl pages</p>}
                    </div>
                    {isCurrent ? (
                      <Badge variant="outline" className="text-[9px] px-2 py-0 border-[#4ade80]/30 text-[#4ade80]">Current</Badge>
                    ) : isUpgrade ? (
                      <div className="space-y-1">
                        <Button
                          size="sm"
                          className="w-full h-6 text-[10px] gap-1 bg-[#4ade80] text-black hover:bg-[#22c55e]"
                          disabled={purchasing === planKey}
                          onClick={() => purchasePlan(planKey)}
                        >
                          {purchasing === planKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
                          {p.price} Stars
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-6 text-[10px] gap-1 border-white/[0.06]"
                          onClick={() => openCryptoModal(planKey, p)}
                        >
                          <Bitcoin className="h-3 w-3" />
                          ${p.priceUsd} Crypto
                        </Button>
                      </div>
                    ) : isDowngrade && planKey !== "free" ? (
                      <Badge variant="outline" className="text-[9px] px-2 py-0 opacity-40">Included</Badge>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeWidgetPayments.length > 0 && (
          <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
              <h3 className="text-sm font-semibold">Pending Payments</h3>
              <Badge variant="outline" className="text-[9px] text-yellow-400 border-yellow-500/30">
                {activeWidgetPayments.length}
              </Badge>
            </div>
            <p className="text-[10px] text-white/30">
              Send crypto to the address below before the timer expires.
            </p>
            <div className="space-y-2">
              {activeWidgetPayments.map(ap => {
                const isExpanded = expandedWidgetPay === ap.id;
                const label = ap.plan.startsWith("boost:") ? `Boost: ${ap.plan.replace("boost:", "")}` : `${ap.plan.charAt(0).toUpperCase() + ap.plan.slice(1)} Plan`;
                const secsLeft = Math.max(0, ap.expired_at - Math.floor(Date.now() / 1000));
                return (
                  <div key={ap.id} className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#0c0c0c]">
                    <button
                      onClick={() => setExpandedWidgetPay(isExpanded ? null : ap.id)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-white/[0.02] transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-xs">{label}</span>
                          <span className="text-[10px] px-1.5 py-px rounded-full border border-white/[0.06] text-white/40">
                            {ap.pay_currency}
                          </span>
                          <Badge variant="outline" className={`text-[9px] ${ap.status === "confirming" ? "text-yellow-400 border-yellow-500/30" : "text-white/40"}`}>
                            {ap.status === "confirming" ? "Confirming" : "Pending"}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-white/30 mt-0.5">
                          {ap.pay_amount} {ap.pay_currency} · ${ap.amount_usd} USD ·
                          <span className={secsLeft === 0 ? " text-destructive" : ""}>
                            {secsLeft === 0 ? " Expired" : ` ${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, "0")} left`}
                          </span>
                        </p>
                      </div>
                      <ChevronDown className={`h-3.5 w-3.5 text-white/30 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>

                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3 border-t border-white/[0.04] pt-3">
                        {ap.qr_code && (
                          <div className="flex justify-center">
                            <img src={ap.qr_code} alt="Payment QR" className="h-[80px] w-[80px] rounded-xl border border-white/[0.06] bg-white" />
                          </div>
                        )}
                        <div className="bg-[#141414] rounded-xl p-3 text-center">
                          <p className="text-[10px] text-white/30">Send exactly</p>
                          <p className="text-lg font-bold font-mono">{ap.pay_amount} {ap.pay_currency}</p>
                          <p className="text-[10px] text-white/30">${ap.amount_usd} USD</p>
                        </div>
                        <div className="bg-[#141414] rounded-xl p-3">
                          <p className="text-[10px] text-white/30 mb-1">Wallet address</p>
                          <p className="text-[11px] font-mono break-all text-white/80">{ap.address}</p>
                          <Button
                            size="sm" variant="outline"
                            className="w-full mt-2 h-7 text-[10px] gap-1 border-white/[0.06]"
                            onClick={() => copyToClipboard(ap.address).then(() => toast.success("Copied!"))}
                          >
                            <Copy className="h-3 w-3" /> Copy Address
                          </Button>
                        </div>
                        <Button
                          size="sm" className="w-full h-8 text-[10px] gap-1 bg-[#4ade80] text-black hover:bg-[#22c55e]"
                          disabled={checkingWidgetPay === ap.track_id}
                          onClick={() => checkWidgetPaymentStatus(ap.track_id, ap.plan)}
                        >
                          {checkingWidgetPay === ap.track_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                          I've Paid — Check Status
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {planStatus && !planStatus.isAdmin && planStatus.plan !== "free" && planStatus.boostCatalog && (
          <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <h3 className="text-sm font-semibold">Add-ons</h3>
              <Badge variant="outline" className="text-[9px] border-white/10">30 days</Badge>
            </div>
            <p className="text-[10px] text-white/30">Stackable — buy multiple times for bigger boosts.</p>
            <div className="space-y-2">
              {Object.entries(planStatus.boostCatalog).map(([key, boost]) => {
                const qty = getBoostQty(key, boost);
                const totalStars = Math.ceil(qty * boost.starsPerUnit);
                const totalUsd = (qty * boost.usdPerUnit).toFixed(2);
                return (
                  <div key={key} className="bg-[#0c0c0c] rounded-xl px-3 py-2.5 space-y-1.5 border border-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[11px] font-medium">+{qty} {boost.label}</p>
                        {planStatus.boosts[boost.type] ? (
                          <p className="text-[9px] text-[#4ade80]">Current boost: +{planStatus.boosts[boost.type]}</p>
                        ) : null}
                      </div>
                      <p className="text-[10px] text-white/30">{boost.example}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={boost.minUnits}
                        max={boost.maxUnits}
                        step={boost.unitStep}
                        value={qty}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!isNaN(v)) setBoostQuantities(prev => ({ ...prev, [key]: Math.max(boost.minUnits, Math.min(v, boost.maxUnits)) }));
                        }}
                        className="h-7 w-20 text-[11px] text-center bg-[#141414] border-white/[0.06]"
                      />
                      <Button
                        size="sm" className="h-7 text-[10px] gap-1 px-2 flex-1 bg-[#4ade80] text-black hover:bg-[#22c55e]"
                        disabled={purchasingBoost === key}
                        onClick={() => purchaseBoostStars(key)}
                      >
                        {purchasingBoost === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
                        {totalStars} Stars
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2 border-white/[0.06]"
                        onClick={() => openBoostCryptoModal(key, boost)}
                      >
                        <Bitcoin className="h-3 w-3" />
                        ${totalUsd}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!showCreate && (() => {
          const atLimit = !isAdmin && planStatus && planStatus.usage.widgets >= planStatus.limits.widgets;
          const msgsExhausted = !isAdmin && planStatus && planStatus.limits.msgsPerDay > 0 && planStatus.usage.dailyMessages >= planStatus.limits.msgsPerDay;
          return (
            <div className="space-y-2">
              {msgsExhausted && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2">
                  <Shield className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-400">Daily message limit reached</p>
                    <p className="text-[10px] text-red-400/60 mt-0.5">Your widgets have stopped accepting new messages for today. Upgrade your plan or wait until tomorrow.</p>
                  </div>
                </div>
              )}
              {atLimit ? (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-start gap-2">
                  <Shield className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-yellow-400">Widget limit reached ({planStatus!.usage.widgets}/{planStatus!.limits.widgets})</p>
                    <p className="text-[10px] text-yellow-400/60 mt-0.5">Upgrade your plan to create more widgets.</p>
                  </div>
                </div>
              ) : (
                <Button onClick={() => setShowCreate(true)} className="w-full gap-2 bg-[#4ade80] text-black hover:bg-[#22c55e] h-10 font-semibold" size="sm">
                  <Plus className="h-4 w-4" /> Create Widget
                </Button>
              )}
            </div>
          );
        })()}

        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-[#111] border border-white/[0.06] rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Plus className="h-4 w-4 text-[#4ade80]" /> New Widget
                  </h3>
                  <button onClick={() => setShowCreate(false)} className="text-white/30 hover:text-white/60">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <SettingsTabBar tabs={CREATE_TABS} active={newTab} onChange={setNewTab} />
                <div className="min-h-[120px]">{renderCreateTabContent()}</div>
                <Button onClick={createWidget} disabled={creating || !newName.trim() || (!isAdmin && !newDomain.trim())} size="sm" className="w-full gap-1 bg-[#4ade80] text-black hover:bg-[#22c55e] h-10 font-semibold">
                  {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  Create Widget
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-5 w-5 animate-spin text-white/20" /></div>
        ) : widgets.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="h-6 w-6 text-white/15" />
            </div>
            <p className="text-sm text-white/40">No widgets yet</p>
            <p className="text-xs text-white/20 mt-1">Create one to add live chat to your website</p>
          </div>
        ) : (
          <div className="space-y-3">
            {widgets.map((w) => {
              const overLimit = (() => {
                if (isAdmin || !planStatus) return false;
                if (!w.active) return false;
                const activeByIdAsc = [...widgets].filter(x => x.active).sort((a, b) => a.id - b.id);
                const rank = activeByIdAsc.findIndex(x => x.id === w.id);
                return rank >= planStatus.limits.widgets;
              })();
              return (
              <motion.div key={w.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("bg-[#111] border rounded-2xl overflow-hidden", overLimit ? "border-red-500/30 opacity-60" : "border-white/[0.06]")}>
                <div className="p-4">
                  {overLimit && (
                    <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <Shield className="h-3 w-3 text-red-400 shrink-0" />
                      <p className="text-[10px] text-red-400">Over plan limit — this widget is disabled. Upgrade to reactivate.</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: overLimit ? "#333" : w.color }}>
                      <MessageSquare className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{w.site_name || "Unnamed Widget"}</p>
                      <p className="text-[10px] text-white/30 truncate flex items-center gap-1">
                        <Shield className="h-2.5 w-2.5" /> {w.allowed_domains || "No domain set"}
                      </p>
                    </div>
                    {w.role === "agent" && (
                      <Badge variant="outline" className="text-[9px] shrink-0 border-blue-500/30 text-blue-400">Agent</Badge>
                    )}
                    <Badge variant={overLimit ? "destructive" : "outline"} className={cn("text-[10px] shrink-0", !overLimit && w.active ? "border-[#4ade80]/30 text-[#4ade80] bg-[#4ade80]/5" : !overLimit ? "border-white/10 text-white/40" : "")}>
                      {overLimit ? "Disabled" : w.active ? "Active" : "Paused"}
                    </Badge>
                  </div>

                  <div className="flex gap-1.5">
                    {w.role !== "agent" && (
                      <Button size="sm" variant="outline" className="flex-1 text-[10px] gap-1 h-8 border-white/[0.06] hover:border-[#4ade80]/30 hover:text-[#4ade80]" onClick={() => setEmbedKey(embedKey === w.widget_key ? null : w.widget_key)}>
                        <Code className="h-3 w-3" /> Embed
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className={cn("flex-1 text-[10px] gap-1 h-8", editKey === w.widget_key ? "bg-[#4ade80]/10 border-[#4ade80]/30 text-[#4ade80]" : "border-white/[0.06] hover:border-[#4ade80]/30 hover:text-[#4ade80]")} onClick={() => openEdit(w)}>
                      <Settings className="h-3 w-3" /> {w.role === "agent" ? "View" : "Edit"}
                    </Button>
                    {w.role !== "agent" && (
                      <Button size="sm" variant="ghost" className="text-[10px] text-red-400/60 h-8 hover:text-red-400 hover:bg-red-400/10" onClick={() => deleteWidget(w.widget_key)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {embedKey === w.widget_key && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-white/[0.04] pt-3">
                        <p className="text-[11px] text-white/40 mb-2">
                          Paste before <code className="bg-white/[0.04] px-1.5 py-0.5 rounded text-[10px] text-[#4ade80]">&lt;/body&gt;</code>:
                        </p>
                        <div className="bg-[#0c0c0c] rounded-xl p-3 relative border border-white/[0.04]">
                          <code className="text-[10px] break-all font-mono text-white/70 leading-relaxed block">{getEmbedCode(w.widget_key)}</code>
                          <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-7 w-7 p-0" onClick={() => copyEmbed(w.widget_key)}>
                            {copied ? <CheckCircle className="h-3.5 w-3.5 text-[#4ade80]" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {editKey === w.widget_key && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-white/[0.04] pt-3 space-y-3">
                        {w.role === "agent" && (
                          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                            <Eye className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                            <p className="text-[10px] text-blue-400">Read-only — you are a collaborator. Only the owner can change settings.</p>
                          </div>
                        )}
                        <SettingsTabBar
                          tabs={w.role === "agent" ? AGENT_TABS : EDIT_TABS}
                          active={editTab}
                          onChange={setEditTab}
                        />
                        <div className={cn("min-h-[100px]", w.role === "agent" && editTab !== "team" ? "pointer-events-none opacity-60" : "")}>
                          {renderEditTabContent(w)}
                        </div>

                        {w.role !== "agent" && (
                          <Button onClick={() => saveEdit(w.widget_key)} disabled={saving || (!isAdmin && !editDomain.trim())} size="sm" className="w-full gap-1 bg-[#4ade80] text-black hover:bg-[#22c55e] h-10 font-semibold">
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                            Save All Changes
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {cryptoModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !cryptoPayment) { setCryptoModal(null); } }}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-[#111] border border-white/[0.06] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <Bitcoin className="h-4 w-4 text-yellow-400" />
                  <h3 className="text-sm font-semibold">
                    {cryptoPayment ? "Complete Payment" : `Pay with Crypto — ${cryptoModal.planInfo.label}`}
                  </h3>
                </div>
                {!cryptoPayment && (
                  <button onClick={() => setCryptoModal(null)} className="text-white/30 hover:text-white/60">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="p-4 space-y-4">
                {!cryptoPayment ? (
                  <>
                    <div className="bg-[#0c0c0c] rounded-xl p-3 text-center border border-white/[0.04]">
                      <p className="text-lg font-bold">${cryptoModal.planInfo.priceUsd} USD</p>
                      <p className="text-xs text-white/30">{cryptoModal.planInfo.label} Plan — 30 days</p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-white/40 mb-2 block">Select Currency</label>
                      <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                        {cryptoCurrencies.map(c => (
                          <button
                            key={c.symbol}
                            onClick={() => { setSelectedCoin(c.symbol); setSelectedNetwork(c.networks.length === 1 ? c.networks[0] : ""); }}
                            className={cn(
                              "rounded-lg border-2 p-2 text-center text-[11px] font-medium transition-all",
                              selectedCoin === c.symbol ? "border-[#4ade80]/40 bg-[#4ade80]/5 text-[#4ade80]" : "border-white/[0.06] bg-[#0c0c0c] text-white/40 hover:border-white/10"
                            )}
                          >{c.symbol}</button>
                        ))}
                      </div>
                    </div>

                    {selectedCoin && (() => {
                      const coin = cryptoCurrencies.find(c => c.symbol === selectedCoin);
                      if (!coin || coin.networks.length <= 1) return null;
                      return (
                        <div>
                          <label className="text-xs font-medium text-white/40 mb-2 block">Select Network</label>
                          <div className="flex flex-wrap gap-1.5">
                            {coin.networks.map(net => (
                              <button
                                key={net}
                                onClick={() => setSelectedNetwork(net)}
                                className={cn(
                                  "rounded-lg border-2 px-3 py-1.5 text-[11px] font-medium transition-all",
                                  selectedNetwork === net ? "border-[#4ade80]/40 bg-[#4ade80]/5 text-[#4ade80]" : "border-white/[0.06] text-white/40 hover:border-white/10"
                                )}
                              >{net}</button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <Button
                      onClick={startCryptoPayment}
                      disabled={!selectedCoin || cryptoLoading || (cryptoCurrencies.find(c => c.symbol === selectedCoin)?.networks?.length ?? 0) > 1 && !selectedNetwork}
                      className="w-full gap-2 bg-[#4ade80] text-black hover:bg-[#22c55e]"
                    >
                      {cryptoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bitcoin className="h-4 w-4" />}
                      Generate Payment Address
                    </Button>
                  </>
                ) : (
                  <>
                    <div className={cn(
                      "rounded-xl border-2 p-3 text-center",
                      cryptoStatus === "paid" ? "border-[#4ade80]/30 bg-[#4ade80]/10" :
                      cryptoStatus === "expired" || cryptoStatus === "failed" ? "border-red-500/30 bg-red-500/10" :
                      cryptoStatus === "confirming" ? "border-yellow-500/30 bg-yellow-500/10" :
                      "border-white/[0.06] bg-[#0c0c0c]"
                    )}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1">
                        {cryptoStatus === "paid" ? "Payment Confirmed!" :
                         cryptoStatus === "confirming" ? "Confirming..." :
                         cryptoStatus === "expired" ? "Payment Expired" :
                         cryptoStatus === "failed" ? "Payment Failed" :
                         "Awaiting Payment"}
                      </p>
                      {cryptoStatus === "pending" && (
                        <div className="flex items-center justify-center gap-1 text-white/30">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-[10px]">Checking every 5 seconds</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="bg-[#0c0c0c] rounded-xl p-3 text-center border border-white/[0.04]">
                        <p className="text-xs text-white/30 mb-1">Send exactly</p>
                        <p className="text-lg font-bold font-mono">{cryptoPayment.pay_amount} {cryptoPayment.pay_currency}</p>
                      </div>

                      <div className="bg-[#0c0c0c] rounded-xl p-3 border border-white/[0.04]">
                        <p className="text-xs text-white/30 mb-1">To address</p>
                        <p className="text-[11px] font-mono break-all text-white/80">{cryptoPayment.address}</p>
                        <Button
                          size="sm" variant="outline"
                          className="w-full mt-2 h-7 text-[10px] gap-1 border-white/[0.06]"
                          onClick={() => {
                            copyToClipboard(cryptoPayment.address);
                            setAddressCopied(true);
                            setTimeout(() => setAddressCopied(false), 2000);
                          }}
                        >
                          {addressCopied ? <CheckCircle className="h-3 w-3 text-[#4ade80]" /> : <Copy className="h-3 w-3" />}
                          {addressCopied ? "Copied!" : "Copy Address"}
                        </Button>
                      </div>

                      {cryptoPayment.expired_at > 0 && (
                        <p className="text-[10px] text-white/30 text-center">
                          Expires in ~{Math.max(0, Math.round((cryptoPayment.expired_at - Date.now() / 1000) / 60))} minutes
                        </p>
                      )}
                    </div>

                    {(cryptoStatus === "expired" || cryptoStatus === "failed") && (
                      <Button variant="outline" className="w-full gap-2 border-white/[0.06]" onClick={() => { setCryptoPayment(null); setCryptoStatus("pending"); }}>
                        Try Again
                      </Button>
                    )}
                    {cryptoStatus === "paid" && (
                      <Button className="w-full gap-2 bg-[#4ade80] text-black hover:bg-[#22c55e]" onClick={() => { setCryptoModal(null); setCryptoPayment(null); }}>
                        <CheckCircle className="h-4 w-4" /> Done
                      </Button>
                    )}
                    {cryptoStatus !== "paid" && cryptoStatus !== "expired" && cryptoStatus !== "failed" && (
                      <Button variant="outline" className="w-full text-[11px] border-white/[0.06]" onClick={() => { setCryptoModal(null); setCryptoPayment(null); }}>
                        Cancel
                      </Button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {boostCryptoModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !boostCryptoPayment) { setBoostCryptoModal(null); } }}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-[#111] border border-white/[0.06] rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                  <h3 className="text-sm font-semibold">
                    {boostCryptoPayment ? "Complete Payment" : `Buy Boost — ${boostCryptoModal.boostDef.label}`}
                  </h3>
                </div>
                {!boostCryptoPayment && (
                  <button onClick={() => setBoostCryptoModal(null)} className="text-white/30 hover:text-white/60">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="p-4 space-y-4">
                {!boostCryptoPayment ? (
                  <>
                    <div className="bg-[#0c0c0c] rounded-xl p-3 text-center border border-white/[0.04]">
                      <p className="text-lg font-bold">${(getBoostQty(boostCryptoModal.boostKey, boostCryptoModal.boostDef) * boostCryptoModal.boostDef.usdPerUnit).toFixed(2)} USD</p>
                      <p className="text-xs text-white/30">+{getBoostQty(boostCryptoModal.boostKey, boostCryptoModal.boostDef)} {boostCryptoModal.boostDef.label} — 30 days</p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-white/40 mb-2 block">Select Currency</label>
                      <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                        {cryptoCurrencies.map(c => (
                          <button
                            key={c.symbol}
                            onClick={() => { setSelectedCoin(c.symbol); setSelectedNetwork(c.networks.length === 1 ? c.networks[0] : ""); }}
                            className={cn(
                              "rounded-lg border-2 p-2 text-center text-[11px] font-medium transition-all",
                              selectedCoin === c.symbol ? "border-[#4ade80]/40 bg-[#4ade80]/5 text-[#4ade80]" : "border-white/[0.06] bg-[#0c0c0c] text-white/40 hover:border-white/10"
                            )}
                          >{c.symbol}</button>
                        ))}
                      </div>
                    </div>

                    {selectedCoin && (() => {
                      const coin = cryptoCurrencies.find(c => c.symbol === selectedCoin);
                      if (!coin || coin.networks.length <= 1) return null;
                      return (
                        <div>
                          <label className="text-xs font-medium text-white/40 mb-2 block">Select Network</label>
                          <div className="flex flex-wrap gap-1.5">
                            {coin.networks.map(net => (
                              <button
                                key={net}
                                onClick={() => setSelectedNetwork(net)}
                                className={cn(
                                  "rounded-lg border-2 px-3 py-1.5 text-[11px] font-medium transition-all",
                                  selectedNetwork === net ? "border-[#4ade80]/40 bg-[#4ade80]/5 text-[#4ade80]" : "border-white/[0.06] text-white/40 hover:border-white/10"
                                )}
                              >{net}</button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <Button
                      onClick={startBoostCryptoPayment}
                      disabled={!selectedCoin || cryptoLoading || (cryptoCurrencies.find(c => c.symbol === selectedCoin)?.networks?.length ?? 0) > 1 && !selectedNetwork}
                      className="w-full gap-2 bg-[#4ade80] text-black hover:bg-[#22c55e]"
                    >
                      {cryptoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bitcoin className="h-4 w-4" />}
                      Generate Payment Address
                    </Button>
                  </>
                ) : (
                  <>
                    <div className={cn(
                      "rounded-xl border-2 p-3 text-center",
                      boostCryptoStatus === "paid" ? "border-[#4ade80]/30 bg-[#4ade80]/10" :
                      boostCryptoStatus === "expired" || boostCryptoStatus === "failed" ? "border-red-500/30 bg-red-500/10" :
                      boostCryptoStatus === "confirming" ? "border-yellow-500/30 bg-yellow-500/10" :
                      "border-white/[0.06] bg-[#0c0c0c]"
                    )}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1">
                        {boostCryptoStatus === "paid" ? "Payment Confirmed!" :
                         boostCryptoStatus === "confirming" ? "Confirming..." :
                         boostCryptoStatus === "expired" ? "Payment Expired" :
                         boostCryptoStatus === "failed" ? "Payment Failed" :
                         "Awaiting Payment"}
                      </p>
                      {boostCryptoStatus === "pending" && (
                        <div className="flex items-center justify-center gap-1 text-white/30">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-[10px]">Checking every 5 seconds</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="bg-[#0c0c0c] rounded-xl p-3 text-center border border-white/[0.04]">
                        <p className="text-xs text-white/30 mb-1">Send exactly</p>
                        <p className="text-lg font-bold font-mono">{boostCryptoPayment.pay_amount} {boostCryptoPayment.pay_currency}</p>
                      </div>
                      <div className="bg-[#0c0c0c] rounded-xl p-3 border border-white/[0.04]">
                        <p className="text-xs text-white/30 mb-1">To address</p>
                        <p className="text-[11px] font-mono break-all text-white/80">{boostCryptoPayment.address}</p>
                        <Button
                          size="sm" variant="outline"
                          className="w-full mt-2 h-7 text-[10px] gap-1 border-white/[0.06]"
                          onClick={() => copyToClipboard(boostCryptoPayment.address).then(() => toast.success("Copied!"))}
                        >
                          <Copy className="h-3 w-3" /> Copy Address
                        </Button>
                      </div>
                    </div>

                    {(boostCryptoStatus === "expired" || boostCryptoStatus === "failed") && (
                      <Button variant="outline" className="w-full gap-2 border-white/[0.06]" onClick={() => { setBoostCryptoPayment(null); setBoostCryptoStatus("pending"); }}>
                        Try Again
                      </Button>
                    )}
                    {boostCryptoStatus === "paid" && (
                      <Button className="w-full gap-2 bg-[#4ade80] text-black hover:bg-[#22c55e]" onClick={() => { setBoostCryptoModal(null); setBoostCryptoPayment(null); }}>
                        <CheckCircle className="h-4 w-4" /> Done
                      </Button>
                    )}
                    {boostCryptoStatus !== "paid" && boostCryptoStatus !== "expired" && boostCryptoStatus !== "failed" && (
                      <Button variant="outline" className="w-full text-[11px] border-white/[0.06]" onClick={() => { setBoostCryptoModal(null); setBoostCryptoPayment(null); }}>
                        Cancel
                      </Button>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
