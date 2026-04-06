import { useState, useEffect } from "react";
import { useApiAuth } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Layout } from "@/components/layout";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Bot, RefreshCw, Loader2, Zap, ZapOff, MessageSquare,
  Settings2, ExternalLink, ChevronDown, ChevronUp, Save,
} from "lucide-react";

type ManagedBot = {
  id: number; bot_user_id: string; bot_username: string; bot_first_name: string;
  status: string; forward_to_owner: number; auto_reply: string | null;
  bot_description: string | null; webhook_url: string | null;
  created_at: string; updated_at: string;
};

function useApiFetch() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  return async (path: string, body?: Record<string, unknown>, method?: string) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: method ?? (body !== undefined ? "POST" : "GET"),
      headers: { ...headers, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data;
  };
}

function Btn({
  onClick, loading, disabled, children, variant = "default", className,
}: {
  onClick: () => void; loading?: boolean; disabled?: boolean;
  children: React.ReactNode; variant?: "default" | "ghost" | "outline";
  className?: string;
}) {
  const base = "inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-medium transition-all disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost: "hover:bg-muted text-foreground",
    outline: "border border-border hover:bg-muted text-foreground",
  };
  return (
    <button onClick={onClick} disabled={disabled || loading} className={cn(base, variants[variant], className)}>
      {loading && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
      {children}
    </button>
  );
}

function Inp({
  value, onChange, placeholder, className,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm",
        "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30",
        className,
      )}
    />
  );
}

function BotCard({ bot, onRefresh }: { bot: ManagedBot; onRefresh: () => void }) {
  const apiFetch = useApiFetch();
  const [expanded, setExpanded] = useState(false);
  const [forwardToOwner, setForwardToOwner] = useState(!!bot.forward_to_owner);
  const [autoReply, setAutoReply] = useState(bot.auto_reply ?? "");
  const [description, setDescription] = useState(bot.bot_description ?? "");
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const isActive = !!bot.webhook_url;

  const saveConfig = async () => {
    setSaving(true);
    try {
      await apiFetch("/my-bots/configure", {
        bot_user_id: bot.bot_user_id,
        forward_to_owner: forwardToOwner,
        auto_reply: autoReply || null,
        bot_description: description || null,
      });
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setSaving(false); }
  };

  const activateBot = async () => {
    setActivating(true);
    try {
      await apiFetch("/my-bots/setup-webhook", { bot_user_id: bot.bot_user_id });
      toast.success("Bot activated — it will now receive messages");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setActivating(false); }
  };

  const deactivateBot = async () => {
    setDeactivating(true);
    try {
      await apiFetch("/my-bots/remove-webhook", { bot_user_id: bot.bot_user_id });
      toast.success("Bot deactivated");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setDeactivating(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className={cn(
          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
          isActive ? "bg-green-500/10 text-green-500" : "bg-muted text-muted-foreground",
        )}>
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">
            {bot.bot_first_name || "Unnamed Bot"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {bot.bot_username ? `@${bot.bot_username}` : `ID: ${bot.bot_user_id}`}
            {" · "}
            <span className={isActive ? "text-green-500" : "text-muted-foreground"}>
              {isActive ? "Active" : "Inactive"}
            </span>
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-border pt-3">
          <div className="flex gap-2">
            {!isActive ? (
              <Btn onClick={activateBot} loading={activating} className="flex-1">
                <Zap className="h-3.5 w-3.5 mr-1.5" /> Activate Bot
              </Btn>
            ) : (
              <Btn onClick={deactivateBot} loading={deactivating} variant="outline" className="flex-1">
                <ZapOff className="h-3.5 w-3.5 mr-1.5" /> Deactivate
              </Btn>
            )}
            {bot.bot_username && (
              <Btn
                onClick={() => window.open(`https://t.me/${bot.bot_username}`, "_blank")}
                variant="ghost"
                className="shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Btn>
            )}
          </div>

          <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs font-semibold">Bot Settings</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forwardToOwner}
                  onChange={(e) => setForwardToOwner(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="text-xs">Forward messages to me via @lifegrambot</span>
              </label>
              <p className="text-[10px] text-muted-foreground pl-6">
                When someone messages your bot, you'll get a notification through Lifegram.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3 text-muted-foreground" />
                <p className="text-[11px] font-medium">Auto-Reply Message</p>
              </div>
              <Inp
                value={autoReply}
                onChange={setAutoReply}
                placeholder="e.g. Thanks for messaging! I'll get back to you soon."
              />
              <p className="text-[10px] text-muted-foreground">
                Automatically sent when someone messages your bot. Leave empty to disable.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-medium">Bot Description</p>
              <Inp
                value={description}
                onChange={setDescription}
                placeholder="What does this bot do?"
              />
              <p className="text-[10px] text-muted-foreground">
                Shown in your bot's profile page on Telegram.
              </p>
            </div>

            <Btn onClick={saveConfig} loading={saving} className="w-full">
              <Save className="h-3.5 w-3.5 mr-1.5" /> Save Settings
            </Btn>
          </div>

          <div className="text-[10px] text-muted-foreground space-y-0.5 px-1">
            <p>Bot ID: {bot.bot_user_id}</p>
            <p>Created: {bot.created_at?.slice(0, 10)}</p>
            {bot.webhook_url && <p>Webhook: Active</p>}
          </div>
        </div>
      )}
    </div>
  );
}

export function MyBots() {
  const apiFetch = useApiFetch();
  const [bots, setBots] = useState<ManagedBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestedUser, setSuggestedUser] = useState("");
  const [suggestedName, setSuggestedName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const fetchBots = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/my-bots");
      setBots(data.bots ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load bots");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchBots(); }, []);

  const createBot = async () => {
    setCreating(true);
    try {
      const data = await apiFetch("/my-bots/create-link", {
        suggested_username: suggestedUser || undefined,
        suggested_name: suggestedName || undefined,
      });
      if (data.link) {
        window.open(data.link, "_blank");
        toast.success("Opening bot creation — come back here after creating it");
        setSuggestedUser("");
        setSuggestedName("");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setCreating(false); }
  };

  return (
    <Layout title="My Bots" backTo="/account">
      <div className="h-full overflow-y-auto px-3 py-4 space-y-3">
        <div className="text-center space-y-1 px-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-base font-bold">My Bots</h2>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Create bots managed by Lifegram. Set up auto-replies, message forwarding, and more.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-semibold">Create New Bot</p>
            </div>
            {showCreate ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>

          {showCreate && (
            <div className="px-3.5 pb-3.5 space-y-2.5 border-t border-border pt-3">
              <p className="text-[11px] text-muted-foreground">
                Create a new Telegram bot managed by @lifegrambot. After creation, it'll appear here automatically.
              </p>
              <Inp value={suggestedUser} onChange={setSuggestedUser} placeholder="Bot username (optional)" />
              <Inp value={suggestedName} onChange={setSuggestedName} placeholder="Bot display name (optional)" />
              <Btn onClick={createBot} loading={creating} className="w-full">
                Create Bot
              </Btn>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-muted-foreground">
            {bots.length} {bots.length === 1 ? "bot" : "bots"}
          </p>
          <button onClick={fetchBots} disabled={loading} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <RefreshCw className={cn("h-3.5 w-3.5 text-muted-foreground", loading && "animate-spin")} />
          </button>
        </div>

        {loading && bots.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && bots.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <Bot className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No bots yet. Create your first one above!</p>
          </div>
        )}

        {bots.map(bot => (
          <BotCard key={bot.id} bot={bot} onRefresh={fetchBots} />
        ))}

        <div className="rounded-xl bg-muted/30 border border-border p-3 space-y-1.5">
          <p className="text-xs font-semibold">How it works</p>
          <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
            <li>Create a bot — it's registered under @lifegrambot as the manager</li>
            <li>Activate it to start receiving messages</li>
            <li>Enable forwarding to get messages delivered to you via Lifegram</li>
            <li>Set an auto-reply so users get an immediate response</li>
            <li>Your bot will appear here after creation — just refresh the page</li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
