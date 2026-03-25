import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth, useTelegram } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Loader2, Code, Globe, Palette, MessageSquare, CheckCircle, HelpCircle, Headphones, Radio, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const BUBBLE_ICONS = [
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "help", label: "Help", icon: HelpCircle },
  { id: "wave", label: "Wave", icon: Radio },
  { id: "headset", label: "Headset", icon: Headphones },
] as const;

type Widget = {
  id: number;
  widget_key: string;
  site_name: string;
  color: string;
  greeting: string;
  position: string;
  logo_text: string;
  bubble_icon: string;
  active: number;
  created_at: string;
};

const COLOR_PRESETS = [
  "#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#ec4899", "#8b5cf6", "#14b8a6", "#f97316", "#06b6d4",
];

export function WidgetSettings() {
  const { profile } = useTelegram();
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [newGreeting, setNewGreeting] = useState("Hi there! How can we help you?");
  const [newPosition, setNewPosition] = useState<"left" | "right">("right");
  const [newLogoText, setNewLogoText] = useState("");
  const [newBubbleIcon, setNewBubbleIcon] = useState("chat");
  const [embedKey, setEmbedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        body: JSON.stringify({ site_name: newName.trim(), color: newColor, greeting: newGreeting.trim(), position: newPosition, logo_text: newLogoText.trim(), bubble_icon: newBubbleIcon }),
      });
      const d = await res.json();
      if (d.ok) {
        toast.success("Widget created!");
        setShowCreate(false);
        setNewName("");
        setNewGreeting("Hi there! How can we help you?");
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

  const getEmbedCode = (key: string) => {
    return `<script src="https://mini.susagar.sbs/api/w/embed.js?key=${key}" data-key="${key}" async><\/script>`;
  };

  const copyEmbed = (key: string) => {
    navigator.clipboard.writeText(getEmbedCode(key));
    setCopied(true);
    toast.success("Embed code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

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
                  <label className="text-[11px] text-muted-foreground font-medium mb-1.5 block">Color</label>
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
                      <Code className="h-3 w-3" /> Embed Code
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
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
