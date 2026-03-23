import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth, useTelegram } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Send, Loader2, ArrowLeft, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type LiveMsg = {
  id: number;
  from_id: string;
  to_id: string;
  text: string;
  read: number;
  created_at: string;
};

type Conversation = {
  partner_id: string;
  first_name: string;
  username: string | null;
  last_text: string;
  last_at: string;
  unread: number;
};

function ConversationList({
  onSelect,
  headers,
}: {
  onSelect: (conv: Conversation) => void;
  headers: Record<string, string>;
}) {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConvos = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/live-chat/conversations`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConvos(data);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchConvos();
    const interval = setInterval(fetchConvos, 3000);
    return () => clearInterval(interval);
  }, [fetchConvos]);

  const formatTime = (iso: string) => {
    const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (convos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
        <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">No live chat conversations</p>
        <p className="text-xs mt-1">Users will appear here when they message</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {convos.map(cv => (
        <button
          key={cv.partner_id}
          onClick={() => onSelect(cv)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
        >
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-sm font-semibold text-primary">
            {(cv.first_name || "U")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium truncate">
                {cv.first_name}
                {cv.username && <span className="text-muted-foreground font-normal"> @{cv.username}</span>}
              </p>
              <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{formatTime(cv.last_at)}</span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <p className="text-xs text-muted-foreground truncate">{cv.last_text}</p>
              {cv.unread > 0 && (
                <Badge className="text-[9px] h-4 min-w-4 px-1 bg-primary shrink-0 ml-2">
                  {cv.unread}
                </Badge>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function ChatView({
  conversation,
  onBack,
  headers,
  myId,
}: {
  conversation: Conversation;
  onBack: () => void;
  headers: Record<string, string>;
  myId: string;
}) {
  const [messages, setMessages] = useState<LiveMsg[]>([]);
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
      const afterParam = initial ? "" : `&after=${lastIdRef.current}`;
      const url = `${API_BASE}/live-chat/messages?with=${conversation.partner_id}&limit=100${afterParam}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return;
      const data: LiveMsg[] = await res.json();
      if (data.length > 0) {
        if (initial) {
          setMessages(data);
        } else {
          setMessages(prev => {
            const real = prev.filter(m => m.id < 1e12);
            return [...real, ...data];
          });
        }
        lastIdRef.current = data[data.length - 1].id;
        scrollBottom();
      }
    } catch {} finally {
      if (initial) setLoading(false);
    }
  }, [headers, conversation.partner_id, scrollBottom]);

  useEffect(() => {
    lastIdRef.current = 0;
    setMessages([]);
    setLoading(true);
    fetchMessages(true);
    const interval = setInterval(() => fetchMessages(false), 2000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText("");
    const optimistic: LiveMsg = {
      id: Date.now(),
      from_id: myId,
      to_id: conversation.partner_id,
      text: trimmed,
      read: 0,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    scrollBottom();

    try {
      const res = await fetch(`${API_BASE}/live-chat/send`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, to_id: conversation.partner_id }),
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

  const formatTime = (iso: string) => {
    const d = new Date(iso + (iso.endsWith("Z") ? "" : "Z"));
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none flex items-center gap-2 px-3 py-2 border-b border-border bg-background">
        <button onClick={onBack} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
          {(conversation.first_name || "U")[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{conversation.first_name}</p>
          <p className="text-[10px] text-muted-foreground">ID: {conversation.partner_id}</p>
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
          const isMe = msg.from_id === myId;
          return (
            <div key={msg.id} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                isMe
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "bg-muted rounded-bl-md"
              )}>
                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                <p className={cn(
                  "text-[10px] mt-0.5 text-right",
                  isMe ? "text-primary-foreground/60" : "text-muted-foreground"
                )}>
                  {formatTime(msg.created_at)}
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
            placeholder="Type a message..."
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

export function AdminLiveChat() {
  const { profile } = useTelegram();
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  const myId = profile?.telegram_id || "";

  if (selectedConvo) {
    return (
      <Layout>
        <ChatView
          conversation={selectedConvo}
          onBack={() => setSelectedConvo(null)}
          headers={headers}
          myId={myId}
        />
      </Layout>
    );
  }

  return (
    <Layout title="Live Chat">
      <div className="h-full overflow-y-auto">
        <ConversationList onSelect={setSelectedConvo} headers={headers} />
      </div>
    </Layout>
  );
}
