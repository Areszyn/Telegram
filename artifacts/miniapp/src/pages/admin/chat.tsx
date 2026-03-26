import { useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetMessages, useSendMessage, getGetMessagesQueryKey } from "@workspace/api-client-react";
import { useApiAuth } from "@/lib/telegram-context";
import { MessageBubble } from "@/components/message-bubble";
import { ChatInput } from "@/components/chat-input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ShieldBan, Info, Globe, Monitor, Clock, Cookie, X } from "lucide-react";
import { toLocaleIST } from "@/lib/date";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import { API_BASE } from "@/lib/api";

const MOD_PATTERN = /^\/?(ban(\s+(global|app|bot))?(\s+\S+.*)?|warn(\s+\S+.*)?|restrict(\s+\S+.*)?|unban)$/i;

type ModResult = { ok: boolean; summary: string; action: string; scope: string; error?: string };

type UserMeta = {
  telegram_id: string;
  ip_address?: string;
  country_code?: string;
  city?: string;
  user_agent?: string;
  platform?: string;
  language?: string;
  timezone?: string;
  screen?: string;
  cookie_consent?: string;
  first_seen?: string;
  last_seen?: string;
};

function parseUA(ua?: string) {
  if (!ua) return "Unknown";
  if (/iPhone|iPad/.test(ua)) return ua.match(/iPhone OS ([\d_]+)/)?.[0]?.replace(/_/g, ".") ? `iOS ${ua.match(/iPhone OS ([\d_]+)/)?.[1]?.replace(/_/g, ".")}` : "iOS";
  if (/Android/.test(ua)) return `Android ${ua.match(/Android ([\d.]+)/)?.[1] ?? ""}`;
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return ua.slice(0, 40);
}

function parseBrowser(ua?: string) {
  if (!ua) return "Unknown";
  if (/Edg\//.test(ua)) return "Edge";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  if (/Telegram/.test(ua)) return "Telegram WebApp";
  return "Browser";
}

function consentBadge(c?: string) {
  if (c === "accepted")  return <Badge variant="outline" className="text-white/60 border-white/20 text-[10px]">Accepted</Badge>;
  if (c === "declined")  return <Badge variant="outline" className="text-muted-foreground text-[10px]">Declined</Badge>;
  return <Badge variant="outline" className="text-white/40 border-white/15 text-[10px]">Pending</Badge>;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-xs text-foreground break-all">{value}</p>
      </div>
    </div>
  );
}

export function AdminChat() {
  const [, params] = useRoute("/admin/chat/:userId");
  const userId = params?.userId;

  const reqOpts = useApiAuth();
  const headers = reqOpts.headers as Record<string, string>;
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [modPending, setModPending] = useState(false);
  const [showInfo, setShowInfo]     = useState(false);
  const [meta, setMeta]             = useState<UserMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  const { data: messages, isLoading } = useGetMessages(userId ?? "", {
    request: reqOpts,
    query: { queryKey: getGetMessagesQueryKey(userId ?? ""), enabled: !!userId, refetchInterval: 1500, staleTime: 0 },
  });

  const sendMut = useSendMessage({
    request: reqOpts,
    mutation: {
      onMutate: async (vars: { data?: { text?: string } }) => {
        if (!userId) return;
        await queryClient.cancelQueries({ queryKey: getGetMessagesQueryKey(userId) });
        const prev = queryClient.getQueryData(getGetMessagesQueryKey(userId));
        queryClient.setQueryData(getGetMessagesQueryKey(userId), (old: unknown) => [
          ...(Array.isArray(old) ? old : []),
          {
            id: `opt-admin-${Date.now()}`,
            text: vars.data?.text ?? null,
            sender_type: "admin",
            created_at: new Date().toISOString(),
            media_type: "text",
            media_url: null,
            telegram_file_id: null,
          },
        ]);
        return { prev };
      },
      onError: (_err: unknown, _vars: unknown, ctx: { prev: unknown } | undefined) => {
        if (ctx?.prev !== undefined && userId) {
          queryClient.setQueryData(getGetMessagesQueryKey(userId), ctx.prev);
        }
      },
      onSuccess: () => {
        if (userId) queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey(userId) });
      },
    },
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Load user metadata when info panel is opened
  useEffect(() => {
    if (!showInfo || !userId || meta) return;
    setMetaLoading(true);

    // Fetch user metadata — the userId here is the DB id; we need telegram_id from messages
    // We'll use a direct fetch to the admin/user-metadata endpoint with the user's db id
    // We need the telegram_id — get it from /messages endpoint data or a separate call
    fetch(`${API_BASE}/admin/user-metadata/${userId}`, { headers })
      .then(r => r.json())
      .then(d => setMeta(d ?? null))
      .catch(() => setMeta(null))
      .finally(() => setMetaLoading(false));
  }, [showInfo, userId]);

  if (!userId) return null;

  const handleSend = async (text: string) => {
    if (MOD_PATTERN.test(text.trim())) {
      setModPending(true);
      const toastId = toast.loading("Applying moderation action…");
      try {
        const res = await fetch(`${API_BASE}/moderation/chat-action`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim(), targetUserId: userId }),
        });
        const data: ModResult = await res.json();
        if (data.ok) {
          toast.success(data.summary, { id: toastId });
        } else {
          toast.error(data.error ?? data.summary, { id: toastId });
        }
      } catch {
        toast.error("Network error — moderation action failed", { id: toastId });
      } finally {
        setModPending(false);
      }
      return;
    }
    sendMut.mutate({ data: { text, targetUserId: parseInt(userId, 10) } });
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-2 bg-background border-b border-border shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link href="/admin"><ChevronLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-none">User #{userId}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Type <code className="text-xs bg-muted px-1 rounded">ban</code>,{" "}
            <code className="text-xs bg-muted px-1 rounded">warn [reason]</code>, or{" "}
            <code className="text-xs bg-muted px-1 rounded">unban</code> to moderate
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={`h-8 w-8 shrink-0 ${showInfo ? "bg-primary/10 text-primary" : ""}`}
          onClick={() => setShowInfo(v => !v)}
          title="User info"
        >
          <Info className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link href="/admin/moderation"><ShieldBan className="h-4 w-4 text-muted-foreground" /></Link>
        </Button>
      </div>

      {/* User info panel */}
      <AnimatePresence>
        {showInfo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden shrink-0"
          >
            <div className="bg-muted/30 border-b border-border px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User Intelligence</p>
                <button onClick={() => setShowInfo(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
              {metaLoading ? (
                <div className="space-y-1.5">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
                </div>
              ) : !meta ? (
                <p className="text-xs text-muted-foreground italic">No device data collected yet. User hasn't opened the Mini App.</p>
              ) : (
                <div className="grid grid-cols-2 gap-x-4">
                  <div>
                    <InfoRow icon={Globe} label="IP Address"   value={meta.ip_address} />
                    <InfoRow icon={Globe} label="Country"      value={meta.country_code ? `${meta.country_code}${meta.city ? ` · ${meta.city}` : ""}` : null} />
                    <InfoRow icon={Globe} label="Language"     value={meta.language} />
                    <InfoRow icon={Clock} label="Timezone"     value={meta.timezone} />
                  </div>
                  <div>
                    <InfoRow icon={Monitor} label="OS"         value={parseUA(meta.user_agent ?? undefined)} />
                    <InfoRow icon={Monitor} label="Browser"    value={parseBrowser(meta.user_agent ?? undefined)} />
                    <InfoRow icon={Monitor} label="Screen"     value={meta.screen} />
                    <InfoRow icon={Cookie} label="Cookies"     value={meta.cookie_consent} />
                  </div>
                  <div className="col-span-2 mt-1">
                    <InfoRow icon={Clock} label="First seen"   value={meta.first_seen ? toLocaleIST(meta.first_seen) : null} />
                    <InfoRow icon={Clock} label="Last seen"    value={meta.last_seen  ? toLocaleIST(meta.last_seen)  : null} />
                    {meta.user_agent && (
                      <div className="mt-1 p-2 bg-muted/50 rounded-lg">
                        <p className="text-[9px] text-muted-foreground font-mono break-all">{meta.user_agent}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <Skeleton className={`h-10 rounded-2xl ${i % 2 === 0 ? "w-48" : "w-56"}`} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col justify-end min-h-full">
            {messages?.map((msg: any) => (
              <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_type === "admin"} />
            ))}
            {messages?.length === 0 && (
              <p className="text-center text-sm text-muted-foreground my-auto">No messages yet.</p>
            )}
          </div>
        )}
      </div>

      <Separator />
      <ChatInput
        onSend={handleSend}
        isLoading={sendMut.isPending || modPending}
        targetUserId={userId ? parseInt(userId, 10) : undefined}
        onMediaSent={() => {
          if (userId) queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey(userId) });
        }}
      />
    </div>
  );
}
