import { useState, useEffect } from "react";
import { useApiAuth, useTelegram } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Layout } from "@/components/layout";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import {
  Bot, RefreshCw, Loader2, Zap, ZapOff, MessageSquare,
  Settings2, ExternalLink, ChevronDown, ChevronUp, Save,
  Key, Copy, RotateCcw, Eye, EyeOff, Shield, Send,
  Cpu, Globe, Sparkles,
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

function BotCard({ bot, onRefresh }: { bot: ManagedBot; onRefresh: () => void }) {
  const apiFetch = useApiFetch();
  const { openTelegramLink } = useTelegram();
  const [expanded, setExpanded] = useState(false);
  const [forwardToOwner, setForwardToOwner] = useState(!!bot.forward_to_owner);
  const [autoReply, setAutoReply] = useState(bot.auto_reply ?? "");
  const [description, setDescription] = useState(bot.bot_description ?? "");
  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [token, setToken] = useState("");
  const [loadingToken, setLoadingToken] = useState(false);
  const [rotatingToken, setRotatingToken] = useState(false);

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

  const fetchToken = async () => {
    if (token) { setShowToken(!showToken); return; }
    setLoadingToken(true);
    try {
      const data = await apiFetch("/my-bots/get-token", { bot_user_id: bot.bot_user_id });
      setToken(data.token);
      setShowToken(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to fetch token");
    } finally { setLoadingToken(false); }
  };

  const copyToken = async () => {
    if (!token) return;
    await copyToClipboard(token);
    toast.success("Bot token copied!");
  };

  const rotateToken = async () => {
    if (!confirm("Rotate token? The old token will be permanently invalidated. Any integrations using it will stop working.")) return;
    setRotatingToken(true);
    try {
      const data = await apiFetch("/my-bots/rotate-token", { bot_user_id: bot.bot_user_id });
      setToken(data.token);
      setShowToken(true);
      toast.success("Token rotated — old token is now invalid");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setRotatingToken(false); }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-white/5 transition-colors"
      >
        <div className={cn(
          "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
          isActive ? "bg-green-500/15 text-green-400" : "bg-white/5 text-white/40",
        )}>
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white/90 truncate">
            {bot.bot_first_name || "Unnamed Bot"}
          </p>
          <p className="text-[11px] text-white/50">
            {bot.bot_username ? `@${bot.bot_username}` : `ID: ${bot.bot_user_id}`}
            {" · "}
            <span className={isActive ? "text-green-400" : "text-white/40"}>
              {isActive ? "Active" : "Inactive"}
            </span>
          </p>
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 text-white/40 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-white/40 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-white/10 pt-3">
          <div className="flex gap-2">
            {!isActive ? (
              <button onClick={activateBot} disabled={activating}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium bg-green-500/15 text-green-400 hover:bg-green-500/25 border border-green-500/20 transition-colors disabled:opacity-50">
                {activating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                Activate Bot
              </button>
            ) : (
              <button onClick={deactivateBot} disabled={deactivating}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium bg-white/5 text-white/60 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50">
                {deactivating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ZapOff className="h-3.5 w-3.5" />}
                Deactivate
              </button>
            )}
            {bot.bot_username && (
              <button
                onClick={() => openTelegramLink(`https://t.me/${bot.bot_username}`)}
                className="shrink-0 inline-flex items-center justify-center rounded-xl px-3 py-2.5 text-xs text-white/60 hover:bg-white/5 border border-white/10 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <Key className="h-3.5 w-3.5 text-yellow-400" />
              <p className="text-xs font-semibold text-white/90">Bot Token</p>
            </div>

            {showToken && token ? (
              <div className="space-y-2">
                <div className="bg-black/40 rounded-lg px-3 py-2 border border-white/10">
                  <code className="text-[10px] text-white/70 break-all font-mono leading-relaxed">{token}</code>
                </div>
                <div className="flex gap-2">
                  <button onClick={copyToken}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium bg-white/10 text-white/70 hover:bg-white/15 border border-white/10 transition-colors">
                    <Copy className="h-3 w-3" /> Copy Token
                  </button>
                  <button onClick={rotateToken} disabled={rotatingToken}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50">
                    {rotatingToken ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Rotate
                  </button>
                  <button onClick={() => setShowToken(false)}
                    className="inline-flex items-center justify-center rounded-lg px-2.5 py-1.5 text-[11px] text-white/40 hover:bg-white/5 transition-colors">
                    <EyeOff className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={fetchToken} disabled={loadingToken}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium bg-white/5 text-white/60 hover:bg-white/10 border border-white/10 transition-colors disabled:opacity-50">
                {loadingToken ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
                Reveal Bot Token
              </button>
            )}

            <p className="text-[10px] text-white/30">
              Use this token to control your bot via the Telegram Bot API. Keep it secret.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <Settings2 className="h-3.5 w-3.5 text-white/50" />
              <p className="text-xs font-semibold text-white/90">Bot Settings</p>
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={forwardToOwner}
                onChange={(e) => setForwardToOwner(e.target.checked)}
                className="mt-0.5 rounded border-white/20 bg-white/5 accent-primary"
              />
              <div>
                <span className="text-xs text-white/80">Forward messages to me</span>
                <p className="text-[10px] text-white/40 mt-0.5">
                  Messages sent to your bot are forwarded to your Lifegram chat.
                </p>
              </div>
            </label>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3 text-white/40" />
                <p className="text-[11px] font-medium text-white/70">Auto-Reply Message</p>
              </div>
              <textarea
                value={autoReply}
                onChange={(e) => setAutoReply(e.target.value)}
                placeholder="e.g. Thanks for messaging! I'll get back to you soon."
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none"
              />
              <p className="text-[10px] text-white/30">
                Sent immediately when someone contacts your bot. Leave empty to disable.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-white/70">Bot Description</p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this bot do?"
                rows={2}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 resize-none"
              />
              <p className="text-[10px] text-white/30">
                Shown in your bot's profile on Telegram. Synced automatically.
              </p>
            </div>

            <button onClick={saveConfig} disabled={saving}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20 transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save Settings
            </button>
          </div>

          <div className="text-[10px] text-white/30 space-y-0.5 px-1">
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
  const { openTelegramLink } = useTelegram();
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
        openTelegramLink(data.link);
        toast.success("Opening bot creation — come back and refresh after creating it");
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
        <div className="text-center space-y-1.5 px-2">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-2 border border-white/10">
            <Bot className="h-7 w-7 text-blue-400" />
          </div>
          <h2 className="text-base font-bold text-white/90">Managed Bots</h2>
          <p className="text-xs text-white/50 max-w-xs mx-auto leading-relaxed">
            Create and control bots on your behalf. Orchestrate AI agents, business accounts, and custom tools — all from one place.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5 text-center">
            <Cpu className="h-4 w-4 text-blue-400 mx-auto mb-1" />
            <p className="text-[10px] text-white/50">AI Agents</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5 text-center">
            <Globe className="h-4 w-4 text-green-400 mx-auto mb-1" />
            <p className="text-[10px] text-white/50">Business Bots</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] border border-white/10 p-2.5 text-center">
            <Sparkles className="h-4 w-4 text-purple-400 mx-auto mb-1" />
            <p className="text-[10px] text-white/50">Custom Tools</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="w-full flex items-center justify-between p-3.5 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <Bot className="h-4.5 w-4.5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white/90">Create New Bot</p>
                <p className="text-[10px] text-white/40">One tap — we handle the rest</p>
              </div>
            </div>
            {showCreate ? <ChevronUp className="h-4 w-4 text-white/40" /> : <ChevronDown className="h-4 w-4 text-white/40" />}
          </button>

          {showCreate && (
            <div className="px-3.5 pb-3.5 space-y-2.5 border-t border-white/10 pt-3">
              <p className="text-[11px] text-white/50 leading-relaxed">
                Create a bot managed by @lifegrambot. You'll get full control — auto-replies, message forwarding, and access to its API token to build anything.
              </p>
              <div className="space-y-1">
                <input
                  value={suggestedName}
                  onChange={(e) => setSuggestedName(e.target.value)}
                  placeholder="Bot display name"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
                />
                {!suggestedName.trim() && <p className="text-[10px] text-red-400/60 px-1">Required</p>}
              </div>
              <div className="space-y-1">
                <input
                  value={suggestedUser}
                  onChange={(e) => setSuggestedUser(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="Bot username (must end with 'bot')"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/20"
                />
                {!suggestedUser.trim() && <p className="text-[10px] text-red-400/60 px-1">Required</p>}
                {suggestedUser.trim() && !suggestedUser.trim().endsWith("bot") && (
                  <p className="text-[10px] text-yellow-400/60 px-1">Username must end with "bot"</p>
                )}
              </div>
              <button onClick={createBot} disabled={creating || !suggestedName.trim() || !suggestedUser.trim() || !suggestedUser.trim().endsWith("bot")}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Create Bot
              </button>
              <p className="text-[10px] text-white/30 text-center">
                Opens Telegram to confirm — your bot appears here automatically after creation
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-semibold text-white/50">
            {bots.length} {bots.length === 1 ? "bot" : "bots"}
          </p>
          <button onClick={fetchBots} disabled={loading} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
            <RefreshCw className={cn("h-3.5 w-3.5 text-white/40", loading && "animate-spin")} />
          </button>
        </div>

        {loading && bots.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-white/40" />
          </div>
        )}

        {!loading && bots.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <Bot className="h-8 w-8 mx-auto text-white/20" />
            <p className="text-xs text-white/40">No managed bots yet</p>
            <p className="text-[10px] text-white/30">Create one above to get started</p>
          </div>
        )}

        {bots.map(bot => (
          <BotCard key={bot.id} bot={bot} onRefresh={fetchBots} />
        ))}

        <div className="rounded-xl bg-white/[0.02] border border-white/10 p-3.5 space-y-2">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-white/40" />
            <p className="text-xs font-semibold text-white/70">What are Managed Bots?</p>
          </div>
          <ul className="text-[11px] text-white/40 space-y-1.5 leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="text-white/20 mt-1">•</span>
              <span>Manager bots bootstrap and control other bots on your behalf — easily orchestrating AI agents, business accounts, and custom tools</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white/20 mt-1">•</span>
              <span>Create a bot in one tap and instantly fetch its token to start piloting it</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white/20 mt-1">•</span>
              <span>Configure auto-replies and message forwarding, or use the token to build your own integrations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-white/20 mt-1">•</span>
              <span>Rotate tokens anytime for security — the old token is instantly invalidated</span>
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  );
}
