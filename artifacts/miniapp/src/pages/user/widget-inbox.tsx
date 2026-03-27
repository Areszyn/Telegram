import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth, useTelegram } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowLeft, Send, Loader2, MessageSquare, Mail, User as UserIcon, Star, Check, CheckCheck } from "lucide-react";
import { motion } from "framer-motion";

type Session = {
  id: number;
  session_key: string;
  widget_key: string;
  visitor_name: string;
  visitor_email: string;
  status: string;
  last_active: string;
  created_at: string;
  last_text?: string;
  last_msg_at?: string;
  unread?: number;
  site_name?: string;
  rating?: number;
  feedback?: string;
};

type Msg = {
  id: number;
  session_id: number;
  sender_type: string;
  text: string;
  read: number;
  read_at?: string;
  created_at: string;
};

type Reaction = {
  message_id: number;
  reactor_type: string;
  emoji: string;
};

function relTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return Math.floor(diff / 60) + "m";
  if (diff < 86400) return Math.floor(diff / 3600) + "h";
  return Math.floor(diff / 86400) + "d";
}

function fmtTime(iso: string) {
  const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👎"];

function ConversationList({ onSelect, headers }: { onSelect: (s: Session) => void; headers: Record<string, string> }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetch(`${API_BASE}/widget/all-conversations`, { headers })
      .then(r => r.json())
      .then(d => Array.isArray(d) && setSessions(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [headers]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <MessageSquare className="h-10 w-10 opacity-20" />
        <p className="text-sm">No widget conversations yet</p>
        <p className="text-xs">Visitors who use your chat widget will appear here</p>
      </div>
    );
  }

  return (
    <div>
      {sessions.map((s, i) => (
        <motion.div
          key={s.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
        >
          <button
            onClick={() => onSelect(s)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <UserIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium truncate">{s.visitor_name}</p>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                  {relTime(s.last_msg_at || s.last_active)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground truncate">{s.visitor_email}</span>
              </div>
              {s.last_text && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {s.last_text.length > 50 ? s.last_text.slice(0, 50) + "…" : s.last_text}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-0.5">
                {s.site_name && (
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">{s.site_name}</Badge>
                )}
                {s.rating && (
                  <span className="flex items-center gap-0.5 text-[10px] text-yellow-500">
                    <Star className="h-3 w-3 fill-yellow-500" />
                    {s.rating}/5
                  </span>
                )}
              </div>
            </div>
            {(s.unread ?? 0) > 0 && (
              <Badge className="bg-primary text-primary-foreground text-[10px] h-5 min-w-5 flex items-center justify-center shrink-0">
                {s.unread}
              </Badge>
            )}
          </button>
          {i < sessions.length - 1 && <Separator />}
        </motion.div>
      ))}
    </div>
  );
}

function ChatView({ session, onBack, headers }: { session: Session; onBack: () => void; headers: Record<string, string> }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [visitorTyping, setVisitorTyping] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reactionPicker, setReactionPicker] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const afterParam = initial ? "" : `?after=${lastIdRef.current}`;
      const url = `${API_BASE}/widget/chat-messages/${session.id}${afterParam}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return;
      const raw = await res.json();
      const data: Msg[] = raw.messages || raw;
      if (raw.reactions) setReactions(raw.reactions);
      if (raw.typing) setVisitorTyping(!!raw.typing.visitor);
      if (data.length > 0) {
        if (initial) {
          setMessages(data);
        } else {
          setMessages(prev => [...prev.filter(m => m.id < 1e12), ...data]);
        }
        lastIdRef.current = data[data.length - 1].id;
        scrollBottom();
      }
    } catch {} finally {
      if (initial) setLoading(false);
    }
  }, [headers, session.id, scrollBottom]);

  const markRead = useCallback(() => {
    fetch(`${API_BASE}/widget/read/${session.id}`, { method: "POST", headers }).catch(() => {});
  }, [headers, session.id]);

  useEffect(() => {
    lastIdRef.current = 0;
    setMessages([]);
    setLoading(true);
    fetchMessages(true);
    markRead();
    const interval = setInterval(() => { fetchMessages(false); markRead(); }, 2500);
    return () => clearInterval(interval);
  }, [fetchMessages, markRead]);

  const sendTypingIndicator = useCallback(() => {
    if (typingTimerRef.current) return;
    fetch(`${API_BASE}/widget/typing/${session.id}`, { method: "POST", headers }).catch(() => {});
    typingTimerRef.current = setTimeout(() => { typingTimerRef.current = null; }, 4000);
  }, [headers, session.id]);

  const sendReaction = useCallback(async (messageId: number, emoji: string) => {
    try {
      await fetch(`${API_BASE}/widget/react/${session.id}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, emoji }),
      });
      setReactions(prev => {
        const filtered = prev.filter(r => !(r.message_id === messageId && r.reactor_type === "owner"));
        return [...filtered, { message_id: messageId, reactor_type: "owner", emoji }];
      });
      setReactionPicker(null);
    } catch {
      toast.error("Failed to add reaction");
    }
  }, [headers, session.id]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText("");

    const optimistic: Msg = {
      id: Date.now(),
      session_id: session.id,
      sender_type: "owner",
      text: trimmed,
      read: 0,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    scrollBottom();

    try {
      const res = await fetch(`${API_BASE}/widget/reply/${session.id}`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        toast.error(err.error || "Failed to send");
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      }
    } catch {
      toast.error("Network error");
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
    } finally {
      setSending(false);
    }
  };

  const getReactionsForMsg = (msgId: number) => reactions.filter(r => r.message_id === msgId);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none flex items-center gap-2 px-3 py-2 border-b border-border bg-background">
        <button onClick={onBack} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
          {(session.visitor_name || "V")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{session.visitor_name}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {visitorTyping ? (
              <span className="text-primary animate-pulse">typing...</span>
            ) : (
              session.visitor_email
            )}
          </p>
        </div>
        {session.rating && (
          <span className="flex items-center gap-0.5 text-xs text-yellow-500">
            <Star className="h-3.5 w-3.5 fill-yellow-500" />
            {session.rating}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
        {loading && (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <p className="text-sm">No messages yet</p>
          </div>
        )}
        {messages.map(msg => {
          const isOwner = msg.sender_type === "owner";
          const isSystem = msg.sender_type === "system";
          const msgReactions = getReactionsForMsg(msg.id);
          return (
            <div key={msg.id} className={cn("flex", isOwner ? "justify-end" : "justify-start")}>
              <div className="relative group">
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                  isOwner
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : isSystem
                      ? "bg-muted/60 text-muted-foreground italic rounded-bl-md text-xs"
                      : "bg-muted rounded-bl-md"
                )}>
                  {!isOwner && !isSystem && (
                    <p className="text-[10px] font-semibold text-primary mb-0.5">{session.visitor_name}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  {msgReactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {msgReactions.map((r, i) => (
                        <span key={i} className="text-xs bg-black/10 rounded-full px-1.5 py-0.5">{r.emoji}</span>
                      ))}
                    </div>
                  )}
                  <div className={cn(
                    "flex items-center gap-1 text-[10px] mt-0.5",
                    isOwner ? "text-primary-foreground/60 justify-end" : "text-muted-foreground"
                  )}>
                    <span>{fmtTime(msg.created_at)}</span>
                    {isOwner && msg.read_at && <CheckCheck className="h-3 w-3 text-blue-400" />}
                    {isOwner && !msg.read_at && msg.read === 1 && <Check className="h-3 w-3" />}
                  </div>
                </div>
                {!isOwner && !isSystem && msg.id < 1e12 && (
                  <div className="relative">
                    <button
                      onClick={() => setReactionPicker(reactionPicker === msg.id ? null : msg.id)}
                      className="text-xs opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity mt-0.5"
                    >
                      😀
                    </button>
                    {reactionPicker === msg.id && (
                      <div className="absolute bottom-full left-0 z-10 flex gap-0.5 bg-popover border border-border rounded-full px-1.5 py-1 shadow-lg">
                        {EMOJIS.map(e => (
                          <button
                            key={e}
                            onClick={() => sendReaction(msg.id, e)}
                            className="text-sm hover:scale-125 transition-transform px-0.5"
                          >
                            {e}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {visitorTyping && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex-none border-t border-border bg-background px-3 py-2 pb-safe">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); sendTypingIndicator(); }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Type a reply..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-24"
            style={{ minHeight: "40px" }}
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WidgetInbox() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const { showBackButton, hideBackButton } = useTelegram();
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!selectedSession) return;
    showBackButton(() => setSelectedSession(null));
    return () => {
      showBackButton(() => {
        try { (window as any).Telegram?.WebApp?.close(); } catch (_) {}
      });
    };
  }, [selectedSession, showBackButton]);

  if (selectedSession) {
    return (
      <Layout title="Chat">
        <ChatView session={selectedSession} onBack={() => setSelectedSession(null)} headers={headers} />
      </Layout>
    );
  }

  return (
    <Layout title="Widget Inbox">
      <div className="h-full overflow-y-auto">
        <ConversationList onSelect={setSelectedSession} headers={headers} />
      </div>
    </Layout>
  );
}
