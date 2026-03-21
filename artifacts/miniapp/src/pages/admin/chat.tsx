import { useEffect, useRef, useState } from "react";
import { useRoute, Link } from "wouter";
import { useGetMessages, useSendMessage, getGetMessagesQueryKey } from "@workspace/api-client-react";
import { useApiAuth } from "@/lib/telegram-context";
import { MessageBubble } from "@/components/message-bubble";
import { ChatInput } from "@/components/chat-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ShieldBan, CheckCircle2, X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/miniapp", "") + "/api";

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

  const { data: messages, isLoading } = useGetMessages(userId ?? "", {
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

  if (!userId) return null;

  const handleSend = async (text: string) => {
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
    sendMut.mutate({ data: { text, targetUserId: parseInt(userId, 10) } });
  };

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-2 bg-background border-b border-border">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link href="/admin"><ChevronLeft className="h-5 w-5" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-none">User #{userId}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Type <code className="text-xs bg-muted px-1 rounded">ban</code>, <code className="text-xs bg-muted px-1 rounded">warn</code>, or <code className="text-xs bg-muted px-1 rounded">unban</code> to moderate
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
          <Link href={`/admin/moderation`}><ShieldBan className="h-4 w-4 text-muted-foreground" /></Link>
        </Button>
      </div>

      {/* Moderation toast */}
      <AnimatePresence>
        {modResult && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className={`mx-3 mt-2 ${modResult.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5"}`}>
              <CardContent className="flex items-center gap-2 p-3">
                {modResult.ok
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  : <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
                <p className={`flex-1 text-xs font-medium ${modResult.ok ? "text-emerald-700" : "text-destructive"}`}>
                  {modResult.ok ? modResult.summary : modResult.error ?? modResult.summary}
                </p>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setModResult(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
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
            {messages?.map(msg => (
              <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_type === "admin"} />
            ))}
            {messages?.length === 0 && (
              <p className="text-center text-sm text-muted-foreground my-auto">No messages yet.</p>
            )}
          </div>
        )}
      </div>

      <Separator />
      <ChatInput onSend={handleSend} isLoading={sendMut.isPending || modPending} />
    </div>
  );
}
