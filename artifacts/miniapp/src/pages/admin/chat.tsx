import { useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetMessages, useSendMessage, getGetMessagesQueryKey } from "@workspace/api-client-react";
import { useApiAuth } from "@/lib/telegram-context";
import { MessageBubble } from "@/components/message-bubble";
import { ChatInput } from "@/components/chat-input";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ChevronLeft, ShieldBan, CheckCircle2, X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/miniapp", "") + "/api";

// Matches: ban [scope?] reason | warn reason | restrict reason | unban
const MOD_PATTERN = /^(ban(\s+(global|app|bot))?\s+\S+.*|warn\s+\S+.*|restrict\s+\S+.*|unban)$/i;

type ModResult = { ok: boolean; summary: string; action: string; scope: string; error?: string };

export function AdminChat() {
  const [, params] = useRoute("/admin/chat/:userId");
  const userId = params?.userId;

  const reqOpts = useApiAuth();
  const headers = reqOpts.headers as Record<string, string>;
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [modResult, setModResult] = useState<ModResult | null>(null);
  const [modPending, setModPending] = useState(false);

  const { data: messages, isLoading } = useGetMessages(userId || "", {
    request: reqOpts,
    query: { enabled: !!userId, refetchInterval: 3000 },
  });

  const sendMut = useSendMessage({
    request: reqOpts,
    mutation: {
      onSuccess: () => {
        if (userId) queryClient.invalidateQueries({ queryKey: getGetMessagesQueryKey(userId) });
      },
    },
  });

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!userId) return;

    // Detect moderation command
    if (MOD_PATTERN.test(text.trim())) {
      setModPending(true);
      setModResult(null);
      try {
        const res = await fetch(`${API_BASE}/moderation/chat-action`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim(), targetUserId: userId }),
        });
        const data: ModResult = await res.json();
        setModResult(data);
        setTimeout(() => setModResult(null), 5000);
      } catch {
        setModResult({ ok: false, summary: "Request failed", action: "", scope: "", error: "Network error" });
      } finally {
        setModPending(false);
      }
      return;
    }

    // Normal message
    sendMut.mutate({ data: { text, targetUserId: parseInt(userId, 10) } });
  };

  if (!userId) return null;

  return (
    <div className="flex flex-col h-screen min-h-safe bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="flex-none pt-safe px-2 py-2 bg-card border-b border-border/50 z-10 shadow-sm flex items-center gap-2">
        <Link href="/admin" className="p-2 hover:bg-white/5 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-primary" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-semibold leading-tight">Chat #{userId}</h1>
          <span className="text-[12px] text-muted-foreground">Type: ban/warn/restrict/unban to moderate</span>
        </div>
        <Link href={`/admin/moderation?userId=${userId}`}
          className="p-2 hover:bg-white/5 rounded-full transition-colors" title="Moderation">
          <ShieldBan className="w-5 h-5 text-muted-foreground" />
        </Link>
      </header>

      {/* Moderation action toast */}
      <AnimatePresence>
        {modResult && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className={`mx-4 mt-2 rounded-xl p-3 flex items-start gap-3 border ${modResult.ok ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            {modResult.ok
              ? <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              : <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <p className={`text-sm font-semibold ${modResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                {modResult.ok ? `✅ ${modResult.summary}` : `❌ ${modResult.error ?? modResult.summary}`}
              </p>
            </div>
            <button onClick={() => setModResult(null)} className="p-0.5 rounded hover:bg-white/10">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto p-4 scroll-smooth" ref={scrollRef}>
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col justify-end min-h-full">
            {messages?.map(msg => (
              <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_type === "admin"} />
            ))}
            {messages?.length === 0 && (
              <div className="text-center text-muted-foreground my-auto text-sm">No messages yet.</div>
            )}
          </div>
        )}
      </main>

      <ChatInput onSend={handleSend} isLoading={sendMut.isPending || modPending} />
    </div>
  );
}
