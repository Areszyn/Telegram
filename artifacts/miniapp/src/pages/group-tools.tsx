import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useTelegram, useApiAuth } from "@/lib/telegram-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Users, Radio, ShieldX, VolumeX, Loader2, RefreshCw,
  Crown, ChevronDown, ChevronUp, AlertTriangle, Bot,
  Shield, MessageSquarePlus, ArrowRight,
} from "lucide-react";

import { API_BASE } from "@/lib/api";

type GroupChat = {
  chat_id: string;
  title: string;
  chat_type: string;
  member_count: number;
  bot_is_admin?: boolean | number;
};

type PremiumStatus = {
  active: boolean;
  subscription: { expires_at?: string } | null;
};

function usePremiumFetch() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  return async (path: string, body?: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: body !== undefined ? "POST" : "GET",
      headers: { ...headers, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data;
  };
}

function GroupCard({
  group,
  actionLoading,
  onTagAll,
  onBanAll,
  onSilentBan,
}: {
  group: GroupChat;
  actionLoading: string | null;
  onTagAll: () => void;
  onBanAll: () => void;
  onSilentBan: () => void;
}) {
  const [confirmBan, setConfirmBan] = useState(false);
  const [confirmSilent, setConfirmSilent] = useState(false);
  const isTagging = actionLoading === `tag-${group.chat_id}`;
  const isBanning = actionLoading === `ban-${group.chat_id}`;
  const isSilent = actionLoading === `silent-${group.chat_id}`;
  const anyLoading = isTagging || isBanning || isSilent;
  const isAdmin = group.bot_is_admin === true || group.bot_is_admin === 1;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{group.title || `Chat ${group.chat_id}`}</p>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{group.chat_id}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] text-muted-foreground capitalize">{group.chat_type}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">{group.member_count} members</span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isAdmin ? (
            <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Bot admin
            </span>
          ) : (
            <span className="text-[10px] text-yellow-600 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              Not admin
            </span>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
          <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 mt-0.5 shrink-0" />
          <p className="text-[10px] text-yellow-700 dark:text-yellow-400 leading-relaxed">
            Make the bot an admin in this group to enable tools.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={onTagAll}
          disabled={anyLoading || !isAdmin}
          className={cn(
            "flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all",
            "border-blue-200 bg-blue-50/50 hover:bg-blue-100/50 dark:border-blue-800 dark:bg-blue-950/30 dark:hover:bg-blue-900/30",
            (anyLoading || !isAdmin) && "opacity-40 cursor-not-allowed",
          )}
        >
          {isTagging ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <Radio className="h-4 w-4 text-blue-600" />}
          <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-400">Tag All</span>
        </button>

        <button
          onClick={() => {
            if (!confirmBan) { setConfirmBan(true); toast("Tap again to confirm Ban All"); return; }
            setConfirmBan(false);
            onBanAll();
          }}
          disabled={anyLoading || !isAdmin}
          className={cn(
            "flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all",
            confirmBan
              ? "border-red-400 bg-red-100 dark:bg-red-950 animate-pulse"
              : "border-red-200 bg-red-50/50 hover:bg-red-100/50 dark:border-red-800 dark:bg-red-950/30 dark:hover:bg-red-900/30",
            (anyLoading || !isAdmin) && "opacity-40 cursor-not-allowed",
          )}
        >
          {isBanning ? <Loader2 className="h-4 w-4 animate-spin text-red-600" /> : <ShieldX className="h-4 w-4 text-red-600" />}
          <span className="text-[10px] font-semibold text-red-700 dark:text-red-400">
            {confirmBan ? "Confirm!" : "Ban All"}
          </span>
        </button>

        <button
          onClick={() => {
            if (!confirmSilent) { setConfirmSilent(true); toast("Tap again to confirm Silent Ban"); return; }
            setConfirmSilent(false);
            onSilentBan();
          }}
          disabled={anyLoading || !isAdmin}
          className={cn(
            "flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all",
            confirmSilent
              ? "border-orange-400 bg-orange-100 dark:bg-orange-950 animate-pulse"
              : "border-orange-200 bg-orange-50/50 hover:bg-orange-100/50 dark:border-orange-800 dark:bg-orange-950/30 dark:hover:bg-orange-900/30",
            (anyLoading || !isAdmin) && "opacity-40 cursor-not-allowed",
          )}
        >
          {isSilent ? <Loader2 className="h-4 w-4 animate-spin text-orange-600" /> : <VolumeX className="h-4 w-4 text-orange-600" />}
          <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-400">
            {confirmSilent ? "Confirm!" : "Silent Ban"}
          </span>
        </button>
      </div>
    </div>
  );
}

function PremiumBadge({ expiresAt }: { expiresAt?: string }) {
  const daysLeft = expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="flex items-center gap-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
      <Crown className="h-4 w-4 text-amber-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Premium Active</p>
        {daysLeft !== null && (
          <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70">{daysLeft} days remaining</p>
        )}
      </div>
    </div>
  );
}

function FeatureInfo() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
      >
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="text-[11px] text-muted-foreground flex-1">How these tools work</span>
        {open ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-3 pb-3 text-[11px] text-muted-foreground leading-relaxed space-y-2 border-t border-border pt-2">
          <p><strong className="text-foreground">Tag All</strong> — Mentions every tracked member in the group. Bot must be admin.</p>
          <p><strong className="text-foreground">Ban All</strong> — Bans every known user from the group. Your account and the admin are always skipped.</p>
          <p><strong className="text-foreground">Silent Ban</strong> — Same as Ban All but also deletes all message history. No visible command in the group — results are sent to your DM.</p>
        </div>
      )}
    </div>
  );
}

function HowToUse() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <MessageSquarePlus className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">How to use Group Tools</p>
      </div>

      <div className="space-y-2.5">
        <div className="flex gap-3 items-start">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-xs font-bold text-primary">1</span>
          </div>
          <div>
            <p className="text-xs font-semibold">Add the bot to your group</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              Open your Telegram group → Settings → Add Members → Search for <span className="font-mono text-foreground">@lifegrambot</span> and add it.
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-xs font-bold text-primary">2</span>
          </div>
          <div>
            <p className="text-xs font-semibold">Make the bot an admin</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              Go to group Settings → Administrators → Add Admin → Select <span className="font-mono text-foreground">@lifegrambot</span>. Grant it "Ban Users" and "Delete Messages" permissions.
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-xs font-bold text-primary">3</span>
          </div>
          <div>
            <p className="text-xs font-semibold">Get Premium (if not admin)</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              Group tools require a Premium subscription (250 Stars/month) for non-admin users.
            </p>
          </div>
        </div>

        <div className="flex gap-3 items-start">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-xs font-bold text-primary">4</span>
          </div>
          <div>
            <p className="text-xs font-semibold">Come back here</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
              Your groups will appear automatically. Use Tag All, Ban All, or Silent Ban directly from here.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GroupTools() {
  const { profile } = useTelegram();
  const apiFetch = usePremiumFetch();
  const isAdmin = profile?.is_admin === true;

  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatus | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = async (showToast = false) => {
    setLoading(true);
    setError(null);
    try {
      const [groupsData, premData] = await Promise.all([
        apiFetch("/premium/groups"),
        apiFetch("/premium/status"),
      ]);
      setGroups(groupsData.chats ?? []);
      setPremiumStatus({ active: premData.active, subscription: premData.subscription });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setError(msg);
      if (showToast) toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(false); }, []);

  const handleTagAll = async (chatId: string) => {
    setActionLoading(`tag-${chatId}`);
    try {
      const endpoint = isAdmin ? "/admin/chat/tag-all" : "/premium/tag-all";
      const data = await apiFetch(endpoint, { chat_id: chatId });
      const count = data.chunks_sent ?? data.messages_sent ?? 0;
      toast.success(`Tagged members in ${count} message(s)`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanAll = async (chatId: string) => {
    setActionLoading(`ban-${chatId}`);
    try {
      const endpoint = isAdmin ? "/admin/chat/ban-all" : "/premium/ban-all";
      const data = await apiFetch(endpoint, { chat_id: chatId, revoke_messages: false });
      toast.success(`Banned ${data.banned}/${data.total} members`);
      loadData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSilentBan = async (chatId: string) => {
    setActionLoading(`silent-${chatId}`);
    try {
      const endpoint = isAdmin ? "/admin/chat/silent-ban" : "/premium/silent-ban";
      const data = await apiFetch(endpoint, { chat_id: chatId });
      toast.success(`Silent ban: ${data.banned}/${data.total} banned, messages deleted`);
      loadData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const hasAccess = isAdmin || premiumStatus?.active;

  return (
    <Layout title="Group Tools">
      <div className="h-full overflow-y-auto px-4 py-4 space-y-3">

        {isAdmin ? (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
            <Crown className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs font-semibold text-primary">Admin Access</p>
          </div>
        ) : premiumStatus?.active ? (
          <PremiumBadge expiresAt={premiumStatus.subscription?.expires_at} />
        ) : premiumStatus !== null ? (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-semibold">Premium Required</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Group Tools require a Premium subscription. Unlock Tag All, Ban All, and Silent Ban for 250 Stars/month.
            </p>
            <button
              onClick={async () => {
                try {
                  const data = await apiFetch("/premium/create", {});
                  if (data.invoice_link) {
                    const tg = (window as any).Telegram?.WebApp;
                    tg?.openInvoice?.(data.invoice_link, (status: string) => {
                      if (status === "paid") {
                        toast.success("Premium activated!");
                        loadData();
                      }
                    });
                  }
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Get Premium — 250 Stars
            </button>
          </div>
        ) : null}

        {hasAccess && <FeatureInfo />}

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-6 space-y-3">
            <AlertTriangle className="h-8 w-8 text-red-400/60 mx-auto" />
            <p className="text-xs text-red-500">{error}</p>
            <button
              onClick={() => loadData(true)}
              className="text-xs text-primary font-medium hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && hasAccess && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">
                  {groups.length} group{groups.length !== 1 ? "s" : ""} available
                </span>
              </div>
              <button
                onClick={() => loadData(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>

            {groups.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-4">
                <HowToUse />
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map(g => (
                  <GroupCard
                    key={g.chat_id}
                    group={g}
                    actionLoading={actionLoading}
                    onTagAll={() => handleTagAll(g.chat_id)}
                    onBanAll={() => handleBanAll(g.chat_id)}
                    onSilentBan={() => handleSilentBan(g.chat_id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {!loading && !error && !hasAccess && premiumStatus !== null && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <HowToUse />
          </div>
        )}

        {!loading && !error && !hasAccess && premiumStatus === null && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <HowToUse />
          </div>
        )}
      </div>
    </Layout>
  );
}
