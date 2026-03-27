import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth, useTelegram } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Loader2, Code, Globe, Palette, MessageSquare, CheckCircle, HelpCircle, Headphones, Radio, ExternalLink, Settings, ChevronDown, ChevronUp, Link2, Shield, Sparkles, Star, Zap, Crown, Bitcoin, X } from "lucide-react";
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
};
type BoostDef = { label: string; stars: number; usd: number; type: string; amount: number };
type PlanStatus = {
  plan: string; limits: PlanInfo; baseLimits: PlanInfo;
  usage: { widgets: number; dailyMessages: number };
  subscription: { plan: string; expires_at: string; stars_paid: number } | null;
  plans: Record<string, PlanInfo>; isAdmin: boolean;
  boosts: Record<string, number>;
  boostCatalog: Record<string, BoostDef>;
};

const PLAN_ICONS: Record<string, typeof Star> = { free: Star, standard: Zap, pro: Crown };

export function WidgetSettings() {
  const { profile } = useTelegram();
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [planStatus, setPlanStatus] = useState<PlanStatus | null>(null);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [purchasingBoost, setPurchasingBoost] = useState<string | null>(null);
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
  const [trainingUrls, setTrainingUrls] = useState<string[]>([]);
  const [newTrainUrl, setNewTrainUrl] = useState("");
  const [training, setTraining] = useState(false);
  const [trainedChars, setTrainedChars] = useState(0);

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

  useEffect(() => { loadWidgets(); loadPlanStatus(); }, []);

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
          setTimeout(() => { loadPlanStatus(); loadWidgets(); setCryptoModal(null); setCryptoPayment(null); }, 1500);
        }
      }
    } catch {}
  }, [cryptoPayment, headers]);

  useEffect(() => {
    if (!cryptoPayment || cryptoStatus === "paid" || cryptoStatus === "expired" || cryptoStatus === "failed") return;
    const interval = setInterval(pollCryptoStatus, 5000);
    return () => clearInterval(interval);
  }, [cryptoPayment, cryptoStatus, pollCryptoStatus]);

  const purchaseBoostStars = async (boostKey: string) => {
    setPurchasingBoost(boostKey);
    try {
      const res = await fetch(`${API_BASE}/widget/boost/purchase`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ boost_key: boostKey }),
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
    try {
      const body: Record<string, string> = { boost_key: boostCryptoModal.boostKey, pay_currency: selectedCoin };
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
            setTimeout(() => { loadPlanStatus(); setBoostCryptoModal(null); setBoostCryptoPayment(null); }, 1500);
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
        setNewAvatarId(0); setNewCalLink("");
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
      setTrainingUrls(Array.isArray(parsed) ? parsed : []);
    } catch { setTrainingUrls([]); }
    setTrainedChars(((w as any).ai_training_data || "").length);
    setNewTrainUrl("");
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
    navigator.clipboard.writeText(getEmbedCode(key));
    setCopied(true);
    toast.success("Embed code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const trainWidget = async (key: string) => {
    const allUrls = [...trainingUrls];
    if (newTrainUrl.trim() && /^https?:\/\/.+/.test(newTrainUrl.trim())) {
      allUrls.push(newTrainUrl.trim());
    }
    if (allUrls.length === 0) { toast.error("Add at least one URL"); return; }
    setTraining(true);
    try {
      const res = await fetch(`${API_BASE}/widget/${key}/train`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ urls: allUrls }),
      });
      const d = await res.json() as any;
      if (d.ok) {
        setTrainingUrls(allUrls.filter(u => d.results?.find((r: any) => r.url === u && !r.error)));
        setNewTrainUrl("");
        setTrainedChars(d.totalChars || 0);
        const failed = d.results?.filter((r: any) => r.error) || [];
        if (failed.length > 0) {
          toast.success(`Trained! ${failed.length} URL(s) failed.`);
        } else {
          toast.success(`Trained on ${d.results?.length} page(s) — ${d.totalChars?.toLocaleString()} chars scraped`);
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
        setTrainingUrls([]);
        setTrainedChars(0);
        toast.success("Training data cleared");
        loadWidgets();
      }
    } catch { toast.error("Network error"); }
  };

  const FaqEditor = ({ items, setItems }: { items: FaqItem[]; setItems: (v: FaqItem[]) => void }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1"><HelpCircle className="h-3 w-3" /> FAQ Questions</label>
        {items.length < 10 && (
          <button onClick={() => setItems([...items, { q: "", a: "" }])} className="text-[11px] text-white/60 font-medium hover:underline">+ Add</button>
        )}
      </div>
      {items.map((faq, i) => (
        <div key={i} className="bg-muted rounded-xl p-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-bold shrink-0">Q{i+1}</span>
            <Input value={faq.q} onChange={e => { const n = [...items]; n[i] = { ...n[i], q: e.target.value }; setItems(n); }} placeholder="Question" className="text-xs h-7" />
            <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-destructive shrink-0"><Trash2 className="h-3 w-3" /></button>
          </div>
          <Input value={faq.a} onChange={e => { const n = [...items]; n[i] = { ...n[i], a: e.target.value }; setItems(n); }} placeholder="Answer" className="text-xs h-7 ml-5" />
        </div>
      ))}
      {items.length === 0 && <p className="text-[10px] text-muted-foreground italic pl-1">No FAQ questions</p>}
    </div>
  );

  const SocialEditor = ({ items, setItems }: { items: SocialLink[]; setItems: (v: SocialLink[]) => void }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-muted-foreground font-medium flex items-center gap-1"><Link2 className="h-3 w-3" /> Social Links</label>
        {items.length < 8 && (
          <button onClick={() => setItems([...items, { platform: "whatsapp", url: "" }])} className="text-[11px] text-white/60 font-medium hover:underline">+ Add</button>
        )}
      </div>
      {items.map((link, i) => (
        <div key={i} className="bg-muted rounded-xl p-2.5 flex items-center gap-2">
          <select
            value={link.platform}
            onChange={e => { const n = [...items]; n[i] = { ...n[i], platform: e.target.value }; setItems(n); }}
            className="bg-background border border-border rounded-lg text-[11px] px-2 py-1 outline-none shrink-0 w-24"
          >
            {SOCIAL_PLATFORMS.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
          <Input value={link.url} onChange={e => { const n = [...items]; n[i] = { ...n[i], url: e.target.value }; setItems(n); }} placeholder="https://..." className="text-xs h-7 flex-1" />
          <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-destructive shrink-0"><Trash2 className="h-3 w-3" /></button>
        </div>
      ))}
      {items.length === 0 && <p className="text-[10px] text-muted-foreground italic pl-1">No social links</p>}
    </div>
  );

  const ColorPicker = ({ label, value, onChange, presets }: { label: string; value: string; onChange: (v: string) => void; presets: string[] }) => (
    <div>
      <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block flex items-center gap-1"><Palette className="h-3 w-3" /> {label}</label>
      <div className="flex gap-1.5 flex-wrap">
        {presets.map(c => (
          <button key={c} onClick={() => onChange(c)} className={cn("w-6 h-6 rounded-full transition-all", value === c ? "ring-2 ring-offset-1 ring-primary scale-110" : "hover:scale-105")} style={{ background: c }} />
        ))}
      </div>
    </div>
  );

  const BtnColorPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div>
      <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">Button Color <span className="opacity-60">(optional)</span></label>
      <div className="flex gap-1.5 flex-wrap items-center">
        <button onClick={() => onChange("")} className={cn("w-6 h-6 rounded-full border border-dashed text-[8px] text-muted-foreground flex items-center justify-center", !value ? "ring-2 ring-offset-1 ring-primary scale-110 border-primary" : "border-border hover:scale-105")}>A</button>
        {BTN_COLOR_PRESETS.map(c => (
          <button key={c} onClick={() => onChange(c)} className={cn("w-6 h-6 rounded-full transition-all", value === c ? "ring-2 ring-offset-1 ring-primary scale-110" : "hover:scale-105")} style={{ background: c }} />
        ))}
      </div>
    </div>
  );

  const SettingsForm = ({
    name, setName, color, setColor, btnColor, setBtnColor, greeting, setGreeting,
    position, setPosition, logoText, setLogoText, bubbleIcon, setBubbleIcon,
    faq, setFaq, social, setSocial, domain, setDomain,
    avatarId, setAvatarId, calLink, setCalLink,
    hideWatermark, onHideWatermarkChange,
  }: {
    name: string; setName: (v: string) => void; color: string; setColor: (v: string) => void;
    btnColor: string; setBtnColor: (v: string) => void; greeting: string; setGreeting: (v: string) => void;
    position: "left" | "right"; setPosition: (v: "left" | "right") => void;
    logoText: string; setLogoText: (v: string) => void; bubbleIcon: string; setBubbleIcon: (v: string) => void;
    faq: FaqItem[]; setFaq: (v: FaqItem[]) => void; social: SocialLink[]; setSocial: (v: SocialLink[]) => void;
    domain: string; setDomain: (v: string) => void;
    avatarId: number; setAvatarId: (v: number) => void; calLink: string; setCalLink: (v: string) => void;
    hideWatermark?: boolean; onHideWatermarkChange?: (v: boolean) => void;
  }) => (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] text-muted-foreground font-medium mb-1 block flex items-center gap-1"><Globe className="h-3 w-3" /> Site Name</label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Website" className="text-xs h-8" />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground font-medium mb-1 block flex items-center gap-1"><Shield className="h-3 w-3" /> Allowed Domain(s) {!isAdmin && <span className="text-destructive">*</span>}</label>
        <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder={isAdmin ? "Optional for admin" : "example.com, sub.example.com"} className="text-xs h-8" />
        <p className="text-[10px] text-muted-foreground mt-1">{isAdmin ? "Optional. Leave empty to allow all domains." : "Comma-separated. Widget only loads on these domains."}</p>
      </div>
      <ColorPicker label="Theme Color" value={color} onChange={setColor} presets={COLOR_PRESETS} />
      <BtnColorPicker value={btnColor} onChange={setBtnColor} />
      <div>
        <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Greeting Message</label>
        <Input value={greeting} onChange={e => setGreeting(e.target.value)} className="text-xs h-8" />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">Position</label>
        <div className="flex gap-2">
          {(["left", "right"] as const).map(p => (
            <button key={p} onClick={() => setPosition(p)} className={cn("flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition-all capitalize", position === p ? "bg-white/15 text-white border-white/30" : "bg-muted text-muted-foreground border-border hover:border-white/30")}>{p}</button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">Bubble Icon</label>
        <div className="flex gap-1.5">
          {BUBBLE_ICONS.map(bi => (
            <button key={bi.id} onClick={() => setBubbleIcon(bi.id)} className={cn("flex-1 py-1.5 px-1.5 rounded-lg text-[10px] font-medium border transition-all flex flex-col items-center gap-0.5", bubbleIcon === bi.id ? "bg-white/15 text-white border-white/30" : "bg-muted text-muted-foreground border-border hover:border-white/30")}>
              <bi.icon className="h-3.5 w-3.5" />{bi.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Logo Text <span className="opacity-60">(2 letters)</span></label>
        <Input value={logoText} onChange={e => setLogoText(e.target.value.slice(0, 2))} placeholder="LG" className="text-xs h-8 w-24" maxLength={2} />
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">Avatar</label>
        <div className="flex gap-1.5 flex-wrap items-center">
          <button onClick={() => setAvatarId(0)} className={cn("w-8 h-8 rounded-full border border-dashed text-[8px] text-muted-foreground flex items-center justify-center", avatarId === 0 ? "ring-2 ring-offset-1 ring-primary scale-110 border-primary" : "border-border hover:scale-105")}>Off</button>
          {Array.from({length: 15}, (_, i) => i + 1).map(id => (
            <button key={id} onClick={() => setAvatarId(id)} className={cn("w-8 h-8 rounded-full overflow-hidden transition-all", avatarId === id ? "ring-2 ring-offset-1 ring-primary scale-110" : "hover:scale-105")}>
              <NotionAvatar avatarId={id} size={32} />
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Replaces logo text in widget header</p>
      </div>
      <div>
        <label className="text-[11px] text-muted-foreground font-medium mb-1 block flex items-center gap-1"><Link2 className="h-3 w-3" /> Cal.com Link <span className="opacity-60">(optional)</span></label>
        <Input value={calLink} onChange={e => setCalLink(e.target.value)} placeholder="https://cal.com/your-name/30min" className="text-xs h-8" />
        <p className="text-[10px] text-muted-foreground mt-1">Adds a "Book a meeting" button in the widget</p>
      </div>
      <SocialEditor items={social} setItems={setSocial} />
      <FaqEditor items={faq} setItems={setFaq} />
      {hideWatermark !== undefined && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
          <div>
            <p className="text-[11px] font-medium">Remove Watermark</p>
            <p className="text-[10px] text-muted-foreground">Hide "Powered by Lifegram" branding</p>
          </div>
          <button
            onClick={() => onHideWatermarkChange?.(!hideWatermark)}
            className={cn("w-10 h-5 rounded-full transition-colors relative", hideWatermark ? "bg-white/40" : "bg-border")}
          >
            <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", hideWatermark ? "translate-x-5" : "translate-x-0.5")} />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Layout title="Live Chat Widget">
      <div className="h-full overflow-y-auto p-4 space-y-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-5 w-5 text-white/60" />
            <h2 className="font-semibold text-sm">Website Live Chat</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Add a live chat widget to any website. Visitors can start conversations, and you'll respond from here.
          </p>
          <a href="https://mini.susagar.sbs/api/w/docs" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-white/60 font-medium hover:underline">
            <ExternalLink className="h-3 w-3" /> Setup Guide
          </a>
        </div>

        {planStatus && !planStatus.isAdmin && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => { const Icon = PLAN_ICONS[planStatus.plan] || Star; return <Icon className="h-4 w-4 text-white/60" />; })()}
                <h3 className="text-sm font-semibold">Your Plan</h3>
                <Badge className="text-[10px] capitalize">{planStatus.plan}</Badge>
              </div>
              {planStatus.subscription?.expires_at && (
                <span className="text-[10px] text-muted-foreground">
                  Expires {new Date(planStatus.subscription.expires_at).toLocaleDateString()}
                </span>
              )}
            </div>

            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Widgets</span>
                  <span className={planStatus.usage.widgets >= planStatus.limits.widgets ? "text-red-400 font-semibold" : ""}>{planStatus.usage.widgets}/{planStatus.limits.widgets}</span>
                </div>
                <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", planStatus.usage.widgets >= planStatus.limits.widgets ? "bg-red-500" : planStatus.usage.widgets >= planStatus.limits.widgets * 0.8 ? "bg-yellow-500" : "bg-white/30")} style={{ width: `${Math.min(100, (planStatus.usage.widgets / planStatus.limits.widgets) * 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Messages today</span>
                  <span className={planStatus.limits.msgsPerDay > 0 && planStatus.usage.dailyMessages >= planStatus.limits.msgsPerDay ? "text-red-400 font-semibold" : ""}>{planStatus.usage.dailyMessages}/{planStatus.limits.msgsPerDay === -1 ? "∞" : planStatus.limits.msgsPerDay}</span>
                </div>
                {planStatus.limits.msgsPerDay > 0 && (
                  <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", planStatus.usage.dailyMessages >= planStatus.limits.msgsPerDay ? "bg-red-500" : planStatus.usage.dailyMessages >= planStatus.limits.msgsPerDay * 0.8 ? "bg-yellow-500" : "bg-white/30")} style={{ width: `${Math.min(100, (planStatus.usage.dailyMessages / planStatus.limits.msgsPerDay) * 100)}%` }} />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(["free", "standard", "pro"] as const).map(planKey => {
                const p = planStatus.plans[planKey];
                if (!p) return null;
                const isCurrent = planStatus.plan === planKey;
                const Icon = PLAN_ICONS[planKey] || Star;
                return (
                  <div
                    key={planKey}
                    className={cn(
                      "rounded-xl border p-2.5 text-center space-y-1.5 transition-all",
                      isCurrent ? "border-white/30 bg-white/5" : "border-border bg-muted/30 hover:border-white/20"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 mx-auto", isCurrent ? "text-white" : "text-white/40")} />
                    <p className="text-[11px] font-semibold">{p.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.price === 0 ? "Free" : `${p.price} ⭐/mo`}
                    </p>
                    <div className="text-[9px] text-muted-foreground space-y-0.5">
                      <p>{p.widgets} widget{p.widgets > 1 ? "s" : ""}</p>
                      <p>{p.msgsPerDay === -1 ? "Unlimited" : p.msgsPerDay} msgs/day</p>
                      {p.ai && <p className="text-white/50">AI auto-reply</p>}
                      {!p.watermark && <p className="text-white/50">No watermark</p>}
                      {p.trainUrls > 0 && <p className="text-white/50">{p.trainUrls} training URLs</p>}
                    </div>
                    {isCurrent ? (
                      <Badge variant="outline" className="text-[9px] px-2 py-0">Current</Badge>
                    ) : p.price > 0 ? (
                      <div className="space-y-1">
                        <Button
                          size="sm"
                          className="w-full h-6 text-[10px] gap-1"
                          disabled={purchasing === planKey}
                          onClick={() => purchasePlan(planKey)}
                        >
                          {purchasing === planKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
                          {p.price} Stars
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full h-6 text-[10px] gap-1"
                          onClick={() => openCryptoModal(planKey, p)}
                        >
                          <Bitcoin className="h-3 w-3" />
                          ${p.priceUsd} Crypto
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {planStatus && !planStatus.isAdmin && planStatus.plan !== "free" && planStatus.boostCatalog && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <h3 className="text-sm font-semibold">Add-ons</h3>
              <Badge variant="outline" className="text-[9px]">Permanent</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground">Increase your limits permanently. Stackable — buy multiple times for bigger boosts.</p>
            <div className="space-y-1.5">
              {Object.entries(planStatus.boostCatalog).map(([key, boost]) => (
                <div key={key} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-[11px] font-medium">{boost.label}</p>
                    {planStatus.boosts[boost.type] ? (
                      <p className="text-[9px] text-green-400">Active: +{planStatus.boosts[boost.type]} total</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm" className="h-6 text-[10px] gap-1 px-2"
                      disabled={purchasingBoost === key}
                      onClick={() => purchaseBoostStars(key)}
                    >
                      {purchasingBoost === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
                      {boost.stars}
                    </Button>
                    <Button
                      size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2"
                      onClick={() => openBoostCryptoModal(key, boost)}
                    >
                      <Bitcoin className="h-3 w-3" />
                      ${boost.usd}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!showCreate && (() => {
          const atLimit = !isAdmin && planStatus && planStatus.usage.widgets >= planStatus.limits.widgets;
          const msgsExhausted = !isAdmin && planStatus && planStatus.limits.msgsPerDay > 0 && planStatus.usage.dailyMessages >= planStatus.limits.msgsPerDay;
          return (
            <div className="space-y-2">
              {msgsExhausted && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                  <Shield className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-red-400">Daily message limit reached</p>
                    <p className="text-[10px] text-red-400/70 mt-0.5">Your widgets have stopped accepting new messages for today. Upgrade your plan or wait until tomorrow.</p>
                  </div>
                </div>
              )}
              {atLimit ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-start gap-2">
                  <Shield className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-yellow-400">Widget limit reached ({planStatus!.usage.widgets}/{planStatus!.limits.widgets})</p>
                    <p className="text-[10px] text-yellow-400/70 mt-0.5">Upgrade your plan to create more widgets.</p>
                  </div>
                </div>
              ) : (
                <Button onClick={() => setShowCreate(true)} className="w-full gap-2" size="sm">
                  <Plus className="h-4 w-4" /> Create Widget
                </Button>
              )}
            </div>
          );
        })()}

        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-semibold">New Widget</h3>
                <SettingsForm
                  name={newName} setName={setNewName} color={newColor} setColor={setNewColor}
                  btnColor={newBtnColor} setBtnColor={setNewBtnColor} greeting={newGreeting} setGreeting={setNewGreeting}
                  position={newPosition} setPosition={setNewPosition} logoText={newLogoText} setLogoText={setNewLogoText}
                  bubbleIcon={newBubbleIcon} setBubbleIcon={setNewBubbleIcon}
                  faq={newFaq} setFaq={setNewFaq} social={newSocial} setSocial={setNewSocial}
                  domain={newDomain} setDomain={setNewDomain}
                  avatarId={newAvatarId} setAvatarId={setNewAvatarId} calLink={newCalLink} setCalLink={setNewCalLink}
                />
                <div className="flex gap-2 pt-1">
                  <Button onClick={() => setShowCreate(false)} variant="outline" size="sm" className="flex-1">Cancel</Button>
                  <Button onClick={createWidget} disabled={creating || !newName.trim() || (!isAdmin && !newDomain.trim())} size="sm" className="flex-1 gap-1">
                    {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Create
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : widgets.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No widgets yet</p>
            <p className="text-xs mt-1">Create one to add live chat to your website</p>
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
              <motion.div key={w.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("bg-card border rounded-2xl overflow-hidden", overLimit ? "border-red-500/40 opacity-60" : "border-border")}>
                <div className="p-4">
                  {overLimit && (
                    <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
                      <Shield className="h-3 w-3 text-red-400 shrink-0" />
                      <p className="text-[10px] text-red-400">Over plan limit — this widget is disabled. Upgrade to reactivate.</p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: overLimit ? "#555" : w.color }}>
                      <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{w.site_name || "Unnamed Widget"}</p>
                      <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                        <Shield className="h-2.5 w-2.5" /> {w.allowed_domains || "No domain set"}
                      </p>
                    </div>
                    <Badge variant={overLimit ? "destructive" : w.active ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {overLimit ? "Disabled" : w.active ? "Active" : "Paused"}
                    </Badge>
                  </div>

                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="flex-1 text-[10px] gap-1 h-8" onClick={() => setEmbedKey(embedKey === w.widget_key ? null : w.widget_key)}>
                      <Code className="h-3 w-3" /> Embed
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-[10px] gap-1 h-8" onClick={() => openEdit(w)}>
                      <Settings className="h-3 w-3" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-[10px] text-destructive h-8" onClick={() => deleteWidget(w.widget_key)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {embedKey === w.widget_key && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-border pt-3">
                        <p className="text-[11px] text-muted-foreground mb-2">
                          Paste before <code className="bg-muted px-1 rounded text-[10px]">&lt;/body&gt;</code>:
                        </p>
                        <div className="bg-muted rounded-xl p-3 relative">
                          <code className="text-[10px] break-all font-mono text-foreground leading-relaxed block">{getEmbedCode(w.widget_key)}</code>
                          <Button size="sm" variant="ghost" className="absolute top-1 right-1 h-7 w-7 p-0" onClick={() => copyEmbed(w.widget_key)}>
                            {copied ? <CheckCircle className="h-3.5 w-3.5 text-white/60" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {editKey === w.widget_key && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t border-border pt-3">
                        <SettingsForm
                          name={editName} setName={setEditName} color={editColor} setColor={setEditColor}
                          btnColor={editBtnColor} setBtnColor={setEditBtnColor} greeting={editGreeting} setGreeting={setEditGreeting}
                          position={editPosition} setPosition={setEditPosition} logoText={editLogoText} setLogoText={setEditLogoText}
                          bubbleIcon={editBubbleIcon} setBubbleIcon={setEditBubbleIcon}
                          faq={editFaq} setFaq={setEditFaq} social={editSocial} setSocial={setEditSocial}
                          domain={editDomain} setDomain={setEditDomain}
                          avatarId={editAvatarId} setAvatarId={setEditAvatarId} calLink={editCalLink} setCalLink={setEditCalLink}
                          hideWatermark={editHideWatermark} onHideWatermarkChange={setEditHideWatermark}
                        />

                        <div className="space-y-3 mt-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            <Sparkles className="h-3.5 w-3.5" /> AI Auto-Reply
                          </div>
                          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border">
                            <div>
                              <p className="text-[11px] font-medium">Enable AI Replies</p>
                              <p className="text-[10px] text-muted-foreground">Auto-respond to visitors using AI</p>
                            </div>
                            <button
                              onClick={() => setEditAiEnabled(!editAiEnabled)}
                              className={cn("w-10 h-5 rounded-full transition-colors relative", editAiEnabled ? "bg-white/40" : "bg-border")}
                            >
                              <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", editAiEnabled ? "translate-x-5" : "translate-x-0.5")} />
                            </button>
                          </div>
                          {editAiEnabled && (
                            <>
                              <div>
                                <label className="text-[11px] text-muted-foreground mb-1 block">AI Model</label>
                                <select
                                  value={editAiModel}
                                  onChange={e => setEditAiModel(e.target.value)}
                                  className="w-full h-9 px-3 text-xs bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                  <optgroup label="OpenAI">
                                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                                    <option value="gpt-4o">GPT-4o</option>
                                  </optgroup>
                                  <optgroup label="Anthropic">
                                    <option value="claude-sonnet-4-20250514">Claude Sonnet</option>
                                    <option value="claude-3-5-haiku-20241022">Claude Haiku</option>
                                  </optgroup>
                                  <optgroup label="Google">
                                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                  </optgroup>
                                </select>
                              </div>
                              <div>
                                <label className="text-[11px] text-muted-foreground mb-1 block">System Prompt</label>
                                <textarea
                                  value={editAiPrompt}
                                  onChange={e => setEditAiPrompt(e.target.value)}
                                  placeholder="Instructions for the AI..."
                                  rows={3}
                                  className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                                />
                              </div>
                              <div className="bg-white/5 border border-white/10 rounded-lg p-2">
                                <p className="text-[10px] text-white/40">
                                  Requires a matching API key saved in AI Chat settings. The AI model's provider key must be configured.
                                </p>
                              </div>

                              <div className="border-t border-white/10 pt-3 mt-1 space-y-2">
                                <div className="flex items-center gap-1.5">
                                  <Globe className="h-3 w-3 text-white/50" />
                                  <label className="text-[11px] font-semibold text-white/70">Train AI from Website</label>
                                  {trainedChars > 0 && (
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-white/40 border-white/15 ml-auto">
                                      {trainedChars.toLocaleString()} chars
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-white/40">
                                  Add website URLs to scrape content. The AI will use this knowledge to answer visitor questions. Max 5 URLs.
                                </p>

                                {trainingUrls.map((url, i) => (
                                  <div key={i} className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1.5">
                                    <Globe className="h-3 w-3 text-white/30 shrink-0" />
                                    <span className="text-[10px] text-white/60 truncate flex-1">{url}</span>
                                    <button onClick={() => setTrainingUrls(trainingUrls.filter((_, j) => j !== i))} className="text-white/30 hover:text-white/60 shrink-0">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}

                                {trainingUrls.length < 5 && (
                                  <div className="flex gap-1.5">
                                    <Input
                                      value={newTrainUrl}
                                      onChange={e => setNewTrainUrl(e.target.value)}
                                      placeholder="https://example.com/about"
                                      className="text-xs h-8 flex-1"
                                      onKeyDown={e => {
                                        if (e.key === "Enter" && newTrainUrl.trim()) {
                                          if (/^https?:\/\/.+/.test(newTrainUrl.trim())) {
                                            setTrainingUrls([...trainingUrls, newTrainUrl.trim()]);
                                            setNewTrainUrl("");
                                          } else {
                                            toast.error("Enter a valid URL starting with http:// or https://");
                                          }
                                        }
                                      }}
                                    />
                                    <button
                                      onClick={() => {
                                        if (newTrainUrl.trim() && /^https?:\/\/.+/.test(newTrainUrl.trim())) {
                                          setTrainingUrls([...trainingUrls, newTrainUrl.trim()]);
                                          setNewTrainUrl("");
                                        } else if (newTrainUrl.trim()) {
                                          toast.error("Enter a valid URL");
                                        }
                                      }}
                                      className="h-8 px-2 rounded-lg bg-white/10 text-white/60 text-[10px] hover:bg-white/15"
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}

                                <div className="flex gap-1.5">
                                  <Button
                                    onClick={() => trainWidget(w.widget_key)}
                                    disabled={training || (trainingUrls.length === 0 && !newTrainUrl.trim())}
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 gap-1 text-[11px] h-7"
                                  >
                                    {training ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                                    {training ? "Scraping..." : "Train AI"}
                                  </Button>
                                  {trainedChars > 0 && (
                                    <Button
                                      onClick={() => clearTraining(w.widget_key)}
                                      size="sm"
                                      variant="ghost"
                                      className="text-[11px] h-7 text-white/40 hover:text-white/60"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        <Button onClick={() => saveEdit(w.widget_key)} disabled={saving || (!isAdmin && !editDomain.trim())} size="sm" className="w-full gap-1 mt-3">
                          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                          Save All Changes
                        </Button>
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
            className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !cryptoPayment) { setCryptoModal(null); } }}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Bitcoin className="h-4 w-4 text-yellow-400" />
                  <h3 className="text-sm font-semibold">
                    {cryptoPayment ? "Complete Payment" : `Pay with Crypto — ${cryptoModal.planInfo.label}`}
                  </h3>
                </div>
                {!cryptoPayment && (
                  <button onClick={() => setCryptoModal(null)} className="text-muted-foreground hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="p-4 space-y-4">
                {!cryptoPayment ? (
                  <>
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold">${cryptoModal.planInfo.priceUsd} USD</p>
                      <p className="text-xs text-muted-foreground">{cryptoModal.planInfo.label} Plan — 30 days</p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-2 block">Select Currency</label>
                      <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                        {cryptoCurrencies.map(c => (
                          <button
                            key={c.symbol}
                            onClick={() => { setSelectedCoin(c.symbol); setSelectedNetwork(c.networks.length === 1 ? c.networks[0] : ""); }}
                            className={cn(
                              "rounded-lg border p-2 text-center text-[11px] font-medium transition-all",
                              selectedCoin === c.symbol ? "border-white/40 bg-white/10 text-white" : "border-border bg-muted/20 text-muted-foreground hover:border-white/20"
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
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">Select Network</label>
                          <div className="flex flex-wrap gap-1.5">
                            {coin.networks.map(net => (
                              <button
                                key={net}
                                onClick={() => setSelectedNetwork(net)}
                                className={cn(
                                  "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-all",
                                  selectedNetwork === net ? "border-white/40 bg-white/10 text-white" : "border-border text-muted-foreground hover:border-white/20"
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
                      className="w-full gap-2"
                    >
                      {cryptoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bitcoin className="h-4 w-4" />}
                      Generate Payment Address
                    </Button>
                  </>
                ) : (
                  <>
                    <div className={cn(
                      "rounded-xl border p-3 text-center",
                      cryptoStatus === "paid" ? "border-green-500/30 bg-green-500/10" :
                      cryptoStatus === "expired" || cryptoStatus === "failed" ? "border-red-500/30 bg-red-500/10" :
                      cryptoStatus === "confirming" ? "border-yellow-500/30 bg-yellow-500/10" :
                      "border-border bg-muted/30"
                    )}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1">
                        {cryptoStatus === "paid" ? "Payment Confirmed!" :
                         cryptoStatus === "confirming" ? "Confirming..." :
                         cryptoStatus === "expired" ? "Payment Expired" :
                         cryptoStatus === "failed" ? "Payment Failed" :
                         "Awaiting Payment"}
                      </p>
                      {cryptoStatus === "pending" && (
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-[10px]">Checking every 5 seconds</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="bg-muted/30 rounded-xl p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Send exactly</p>
                        <p className="text-lg font-bold font-mono">{cryptoPayment.pay_amount} {cryptoPayment.pay_currency}</p>
                      </div>

                      <div className="bg-muted/30 rounded-xl p-3">
                        <p className="text-xs text-muted-foreground mb-1">To address</p>
                        <p className="text-[11px] font-mono break-all text-white/90">{cryptoPayment.address}</p>
                        <Button
                          size="sm" variant="outline"
                          className="w-full mt-2 h-7 text-[10px] gap-1"
                          onClick={() => {
                            navigator.clipboard.writeText(cryptoPayment.address);
                            setAddressCopied(true);
                            setTimeout(() => setAddressCopied(false), 2000);
                          }}
                        >
                          {addressCopied ? <CheckCircle className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                          {addressCopied ? "Copied!" : "Copy Address"}
                        </Button>
                      </div>

                      {cryptoPayment.expired_at > 0 && (
                        <p className="text-[10px] text-muted-foreground text-center">
                          Expires in ~{Math.max(0, Math.round((cryptoPayment.expired_at - Date.now() / 1000) / 60))} minutes
                        </p>
                      )}
                    </div>

                    {(cryptoStatus === "expired" || cryptoStatus === "failed") && (
                      <Button variant="outline" className="w-full gap-2" onClick={() => { setCryptoPayment(null); setCryptoStatus("pending"); }}>
                        Try Again
                      </Button>
                    )}
                    {cryptoStatus === "paid" && (
                      <Button className="w-full gap-2" onClick={() => { setCryptoModal(null); setCryptoPayment(null); }}>
                        <CheckCircle className="h-4 w-4" /> Done
                      </Button>
                    )}
                    {cryptoStatus !== "paid" && cryptoStatus !== "expired" && cryptoStatus !== "failed" && (
                      <Button variant="outline" className="w-full text-[11px]" onClick={() => { setCryptoModal(null); setCryptoPayment(null); }}>
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
            className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget && !boostCryptoPayment) { setBoostCryptoModal(null); } }}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-400" />
                  <h3 className="text-sm font-semibold">
                    {boostCryptoPayment ? "Complete Payment" : `Buy Boost — ${boostCryptoModal.boostDef.label}`}
                  </h3>
                </div>
                {!boostCryptoPayment && (
                  <button onClick={() => setBoostCryptoModal(null)} className="text-muted-foreground hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="p-4 space-y-4">
                {!boostCryptoPayment ? (
                  <>
                    <div className="bg-muted/30 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold">${boostCryptoModal.boostDef.usd} USD</p>
                      <p className="text-xs text-muted-foreground">{boostCryptoModal.boostDef.label} — Permanent</p>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-2 block">Select Currency</label>
                      <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                        {cryptoCurrencies.map(c => (
                          <button
                            key={c.symbol}
                            onClick={() => { setSelectedCoin(c.symbol); setSelectedNetwork(c.networks.length === 1 ? c.networks[0] : ""); }}
                            className={cn(
                              "rounded-lg border p-2 text-center text-[11px] font-medium transition-all",
                              selectedCoin === c.symbol ? "border-white/40 bg-white/10 text-white" : "border-border bg-muted/20 text-muted-foreground hover:border-white/20"
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
                          <label className="text-xs font-medium text-muted-foreground mb-2 block">Select Network</label>
                          <div className="flex flex-wrap gap-1.5">
                            {coin.networks.map(net => (
                              <button
                                key={net}
                                onClick={() => setSelectedNetwork(net)}
                                className={cn(
                                  "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-all",
                                  selectedNetwork === net ? "border-white/40 bg-white/10 text-white" : "border-border text-muted-foreground hover:border-white/20"
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
                      className="w-full gap-2"
                    >
                      {cryptoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bitcoin className="h-4 w-4" />}
                      Generate Payment Address
                    </Button>
                  </>
                ) : (
                  <>
                    <div className={cn(
                      "rounded-xl border p-3 text-center",
                      boostCryptoStatus === "paid" ? "border-green-500/30 bg-green-500/10" :
                      boostCryptoStatus === "expired" || boostCryptoStatus === "failed" ? "border-red-500/30 bg-red-500/10" :
                      boostCryptoStatus === "confirming" ? "border-yellow-500/30 bg-yellow-500/10" :
                      "border-border bg-muted/30"
                    )}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1">
                        {boostCryptoStatus === "paid" ? "Payment Confirmed!" :
                         boostCryptoStatus === "confirming" ? "Confirming..." :
                         boostCryptoStatus === "expired" ? "Payment Expired" :
                         boostCryptoStatus === "failed" ? "Payment Failed" :
                         "Awaiting Payment"}
                      </p>
                      {boostCryptoStatus === "pending" && (
                        <div className="flex items-center justify-center gap-1 text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span className="text-[10px]">Checking every 5 seconds</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="bg-muted/30 rounded-xl p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Send exactly</p>
                        <p className="text-lg font-bold font-mono">{boostCryptoPayment.pay_amount} {boostCryptoPayment.pay_currency}</p>
                      </div>
                      <div className="bg-muted/30 rounded-xl p-3">
                        <p className="text-xs text-muted-foreground mb-1">To address</p>
                        <p className="text-[11px] font-mono break-all text-white/90">{boostCryptoPayment.address}</p>
                        <Button
                          size="sm" variant="outline"
                          className="w-full mt-2 h-7 text-[10px] gap-1"
                          onClick={() => navigator.clipboard.writeText(boostCryptoPayment.address).then(() => toast.success("Copied!"))}
                        >
                          <Copy className="h-3 w-3" /> Copy Address
                        </Button>
                      </div>
                    </div>

                    {(boostCryptoStatus === "expired" || boostCryptoStatus === "failed") && (
                      <Button variant="outline" className="w-full gap-2" onClick={() => { setBoostCryptoPayment(null); setBoostCryptoStatus("pending"); }}>
                        Try Again
                      </Button>
                    )}
                    {boostCryptoStatus === "paid" && (
                      <Button className="w-full gap-2" onClick={() => { setBoostCryptoModal(null); setBoostCryptoPayment(null); }}>
                        <CheckCircle className="h-4 w-4" /> Done
                      </Button>
                    )}
                    {boostCryptoStatus !== "paid" && boostCryptoStatus !== "expired" && boostCryptoStatus !== "failed" && (
                      <Button variant="outline" className="w-full text-[11px]" onClick={() => { setBoostCryptoModal(null); setBoostCryptoPayment(null); }}>
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
