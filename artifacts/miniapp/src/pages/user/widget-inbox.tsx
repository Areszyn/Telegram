import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowLeft, Send, Loader2, MessageSquare, Mail, User as UserIcon } from "lucide-react";
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
};

type Msg = {
  id: number;
  session_id: number;
  sender_type: string;
  text: string;
  read: number;
  created_at: string;
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
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

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
              {s.site_name && (
                <Badge variant="outline" className="text-[9px] mt-1 px-1.5 py-0">{s.site_name}</Badge>
              )}
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
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(0);

  const scrollBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const afterParam = initial ? "" : `?after=${lastIdRef.current}`;
      const url = `${API_BASE}/widget/chat-messages/${session.id}${afterParam}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return;
      const data: Msg[] = await res.json();
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

  useEffect(() => {
    lastIdRef.current = 0;
    setMessages([]);
    setLoading(true);
    fetchMessages(true);
    const interval = setInterval(() => fetchMessages(false), 2500);
    return () => clearInterval(interval);
  }, [fetchMessages]);

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
          <p className="text-[10px] text-muted-foreground truncate">{session.visitor_email}</p>
        </div>
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
          return (
            <div key={msg.id} className={cn("flex", isOwner ? "justify-end" : "justify-start")}>
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
                <p className={cn(
                  "text-[10px] mt-0.5 text-right",
                  isOwner ? "text-primary-foreground/60" : "text-muted-foreground"
                )}>
                  {fmtTime(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex-none border-t border-border bg-background px-3 py-2 pb-safe">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
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
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  if (selectedSession) {
    return (
      <Layout>
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
