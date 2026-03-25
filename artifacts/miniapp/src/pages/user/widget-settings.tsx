import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth, useTelegram } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Loader2, Code, Globe, MessageSquare, CheckCircle, HelpCircle, Headphones, Radio, ExternalLink, ChevronDown, ChevronUp, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
  active: number;
  created_at: string;
};

const COLOR_PRESETS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#06b6d4",
];

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

export function WidgetSettings() {
  const { profile } = useTelegram();
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [newBtnColor, setNewBtnColor] = useState("");
  const [newGreeting, setNewGreeting] = useState("Hi there! How can we help you?");
  const [newPosition, setNewPosition] = useState<"left" | "right">("right");
  const [newLogoText, setNewLogoText] = useState("");
  const [newBubbleIcon, setNewBubbleIcon] = useState("chat");
  const [newFaq, setNewFaq] = useState<FaqItem[]>([]);
  const [newSocial, setNewSocial] = useState<SocialLink[]>([]);
  const [embedKey, setEmbedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editFaq, setEditFaq] = useState<FaqItem[]>([]);
  const [editSocial, setEditSocial] = useState<SocialLink[]>([]);
  const [editBtnColor, setEditBtnColor] = useState("");
  const [saving, setSaving] = useState(false);

  const loadWidgets = () => {
    setLoading(true);
    fetch(`${API_BASE}/widget/my-widgets`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setWidgets(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadWidgets(); }, []);

  const createWidget = async () => {
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/widget/create`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          site_name: newName.trim(), color: newColor, greeting: newGreeting.trim(),
          position: newPosition, logo_text: newLogoText.trim(), bubble_icon: newBubbleIcon,
          btn_color: newBtnColor, faq_items: newFaq.filter(f => f.q.trim() && f.a.trim()),
          social_links: newSocial.filter(s => s.url.trim()),
        }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success("Widget created!");
        setShowCreate(false);
        setNewName(""); setNewGreeting("Hi there! How can we help you?");
        setNewFaq([]); setNewSocial([]); setNewBtnColor("");
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

  const toggleActive = async (w: Widget) => {
    try {
      const res = await fetch(`${API_BASE}/widget/${w.widget_key}/update`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ active: !w.active }),
      });
      const d = await res.json();
      if (d.ok) {
        setWidgets(prev => prev.map(x => x.id === w.id ? { ...x, active: w.active ? 0 : 1 } : x));
      }
    } catch {}
  };

  const openEdit = (w: Widget) => {
    if (editKey === w.widget_key) { setEditKey(null); return; }
    setEditKey(w.widget_key);
    setEditFaq(parseFaq(w.faq_items));
    setEditSocial(parseSocial(w.social_links));
    setEditBtnColor(w.btn_color || "");
  };

  const saveExtras = async (key: string) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/widget/${key}/update`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          btn_color: editBtnColor,
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

  const FaqEditor = ({ items, setItems }: { items: FaqItem[]; setItems: (v: FaqItem[]) => void }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-muted-foreground font-medium">FAQ Questions</label>
        <button
          onClick={() => setItems([...items, { q: "", a: "" }])}
          className="text-[11px] text-primary font-medium hover:underline"
        >+ Add Question</button>
      </div>
      {items.map((faq, i) => (
        <div key={i} className="bg-muted rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-medium shrink-0">Q{i+1}</span>
            <Input
              value={faq.q}
              onChange={e => { const n = [...items]; n[i] = { ...n[i], q: e.target.value }; setItems(n); }}
              placeholder="Question"
              className="text-xs h-8"
            />
            <button
              onClick={() => setItems(items.filter((_, j) => j !== i))}
              className="text-destructive hover:text-destructive/80 shrink-0"
            ><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
          <Input
            value={faq.a}
            onChange={e => { const n = [...items]; n[i] = { ...n[i], a: e.target.value }; setItems(n); }}
            placeholder="Answer"
            className="text-xs h-8"
          />
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">No FAQ questions added</p>
      )}
    </div>
  );

  const SocialEditor = ({ items, setItems }: { items: SocialLink[]; setItems: (v: SocialLink[]) => void }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-muted-foreground font-medium">Social Media Links</label>
        <button
          onClick={() => setItems([...items, { platform: "whatsapp", url: "" }])}
          className="text-[11px] text-primary font-medium hover:underline"
        >+ Add Link</button>
      </div>
      {items.map((link, i) => (
        <div key={i} className="bg-muted rounded-xl p-3 flex items-center gap-2">
          <select
            value={link.platform}
            onChange={e => { const n = [...items]; n[i] = { ...n[i], platform: e.target.value }; setItems(n); }}
            className="bg-background border border-border rounded-lg text-xs px-2 py-1.5 outline-none shrink-0 w-28"
          >
            {SOCIAL_PLATFORMS.map(p => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
          <Input
            value={link.url}
            onChange={e => { const n = [...items]; n[i] = { ...n[i], url: e.target.value }; setItems(n); }}
            placeholder="https://..."
            className="text-xs h-8 flex-1"
          />
          <button
            onClick={() => setItems(items.filter((_, j) => j !== i))}
            className="text-destructive hover:text-destructive/80 shrink-0"
          ><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic">No social links added</p>
      )}
    </div>
  );

  const BtnColorPicker = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div>
      <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">Button Color <span className="opacity-60">(optional, overrides theme)</span></label>
      <div className="flex gap-2 flex-wrap items-center">
        <button
          onClick={() => onChange("")}
          className={cn(
            "w-7 h-7 rounded-full border-2 border-dashed transition-all flex items-center justify-center text-[9px] text-muted-foreground",
            !value ? "ring-2 ring-offset-2 ring-primary scale-110 border-primary" : "border-border hover:scale-105"
          )}
        >Auto</button>
        {["#25D366", "#E4405F", "#1877F2", "#000000", "#FF6B35", "#7C3AED", "#DC2626", "#059669"].map(c => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={cn(
              "w-7 h-7 rounded-full transition-all",
              value === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"
            )}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <Layout title="Live Chat Widget">
      <div className="h-full overflow-y-auto p-4 space-y-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-sm">Website Live Chat</h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Add a live chat widget to any website. Visitors can start conversations, and you'll respond from here in the Mini App.
          </p>
          <a
            href="https://mini.susagar.sbs/api/w/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> Setup Guide & Documentation
          </a>
        </div>

        {!showCreate && (
          <Button onClick={() => setShowCreate(true)} className="w-full gap-2" size="sm">
            <Plus className="h-4 w-4" /> Create Widget
          </Button>
        )}

        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <h3 className="text-sm font-semibold">New Widget</h3>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Site Name</label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="My Website" className="text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">Theme Color</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLOR_PRESETS.map(c => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={cn(
                          "w-7 h-7 rounded-full transition-all",
                          newColor === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "hover:scale-105"
                        )}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
                <BtnColorPicker value={newBtnColor} onChange={setNewBtnColor} />
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Greeting Message</label>
                  <Input value={newGreeting} onChange={e => setNewGreeting(e.target.value)} className="text-sm" />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">Position</label>
                  <div className="flex gap-2">
                    {(["left", "right"] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setNewPosition(p)}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-all capitalize",
                          newPosition === p
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">Bubble Icon</label>
                  <div className="flex gap-2">
                    {BUBBLE_ICONS.map(bi => (
                      <button
                        key={bi.id}
                        onClick={() => setNewBubbleIcon(bi.id)}
                        className={cn(
                          "flex-1 py-2 px-2 rounded-lg text-xs font-medium border transition-all flex flex-col items-center gap-1",
                          newBubbleIcon === bi.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                        )}
                      >
                        <bi.icon className="h-4 w-4" />
                        {bi.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground font-medium mb-1 block">Logo Text <span className="opacity-60">(optional, 2 letters)</span></label>
                  <Input value={newLogoText} onChange={e => setNewLogoText(e.target.value.slice(0, 2))} placeholder="LG" className="text-sm" maxLength={2} />
                </div>
                <SocialEditor items={newSocial} setItems={setNewSocial} />
                <FaqEditor items={newFaq} setItems={setNewFaq} />
                <div className="flex gap-2">
                  <Button onClick={() => setShowCreate(false)} variant="outline" size="sm" className="flex-1">Cancel</Button>
                  <Button onClick={createWidget} disabled={creating || !newName.trim()} size="sm" className="flex-1 gap-1">
                    {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Create
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : widgets.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No widgets yet</p>
            <p className="text-xs mt-1">Create one to add live chat to your website</p>
          </div>
        ) : (
          <div className="space-y-3">
            {widgets.map(w => (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: w.color }}>
                      <MessageSquare className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{w.site_name || "Unnamed Widget"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{w.widget_key}</p>
                    </div>
                    <Badge variant={w.active ? "default" : "secondary"} className="text-[10px] shrink-0">
                      {w.active ? "Active" : "Paused"}
                    </Badge>
                  </div>

                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" onClick={() => setEmbedKey(embedKey === w.widget_key ? null : w.widget_key)}>
                      <Code className="h-3 w-3" /> Embed
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-xs gap-1" onClick={() => openEdit(w)}>
                      <Settings className="h-3 w-3" /> Customize
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => toggleActive(w)}>
                      {w.active ? "Pause" : "Resume"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => deleteWidget(w.widget_key)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {embedKey === w.widget_key && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-border pt-3">
                        <p className="text-[11px] text-muted-foreground mb-2">
                          Paste this code before the closing <code className="bg-muted px-1 rounded text-[10px]">&lt;/body&gt;</code> tag:
                        </p>
                        <div className="bg-muted rounded-xl p-3 relative">
                          <code className="text-[11px] break-all font-mono text-foreground leading-relaxed block">
                            {getEmbedCode(w.widget_key)}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute top-1.5 right-1.5 h-7 w-7 p-0"
                            onClick={() => copyEmbed(w.widget_key)}
                          >
                            {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {editKey === w.widget_key && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                        <BtnColorPicker value={editBtnColor} onChange={setEditBtnColor} />
                        <SocialEditor items={editSocial} setItems={setEditSocial} />
                        <FaqEditor items={editFaq} setItems={setEditFaq} />
                        <Button
                          onClick={() => saveExtras(w.widget_key)}
                          disabled={saving}
                          size="sm"
                          className="w-full gap-1"
                        >
                          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                          Save Changes
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
