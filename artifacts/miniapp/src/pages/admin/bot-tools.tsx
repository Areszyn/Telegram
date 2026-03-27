import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Bot, ChevronDown, ChevronUp, Loader2, Send, Image, Trash2,
  Smile, Pin, PinOff, Star, Tag, ShieldCheck, Music2, Zap,
  Settings2, Radio, ShieldX, Users, Globe, RefreshCw,
  KeyRound, LogOut, MessageSquare, Info, Bell, Power, Edit2,
} from "lucide-react";

import { API_BASE } from "@/lib/api";

// ── Helpers ───────────────────────────────────────────────────────────────────

function useAdminFetch() {
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

function useAdminDelete() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  return async (path: string, body?: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "DELETE",
      headers: { ...headers, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
    return data;
  };
}

// ── Small primitives ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      {children}
    </div>
  );
}

function Inp({
  value, onChange, placeholder, type = "text", className,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        "w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm",
        "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30",
        className,
      )}
    />
  );
}

function Btn({
  onClick, loading, disabled, variant = "primary", children, className,
}: {
  onClick: () => void; loading?: boolean; disabled?: boolean;
  variant?: "primary" | "danger" | "ghost"; children: React.ReactNode; className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={cn(
        "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
        variant === "primary" && "bg-primary text-primary-foreground hover:opacity-90",
        variant === "danger"  && "bg-destructive text-destructive-foreground hover:opacity-90",
        variant === "ghost"   && "border border-border text-foreground hover:bg-muted",
        (loading || disabled) && "opacity-50 cursor-not-allowed",
        className,
      )}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

function Result({ data }: { data: unknown }) {
  if (!data) return null;
  return (
    <pre className="mt-2 rounded-xl bg-muted/50 border border-border p-3 text-[10px] leading-relaxed overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, description, children, defaultOpen = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-background hover:bg-muted/30 transition-colors text-left"
      >
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-none">{title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-2 space-y-3 border-t border-border bg-muted/10">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Feature sections ──────────────────────────────────────────────────────────

function BotSetup() {
  const apiFetch = useAdminFetch();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  const run = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/admin/bot/setup", {});
      setResult(data);
      toast.success("Bot set up — commands & description applied");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  };

  return (
    <Section icon={Settings2} title="Quick Setup" description="Set commands menu and description in one click" defaultOpen>
      <p className="text-xs text-muted-foreground">
        Registers /start /donate /history /help in Telegram's command menu and updates the bot's description and short bio.
      </p>
      <Btn onClick={run} loading={loading} className="w-full">
        <Zap className="h-3.5 w-3.5" />
        Apply Bot Setup
      </Btn>
      <Result data={result} />
    </Section>
  );
}

function BotProfile() {
  const apiFetch = useAdminFetch();
  const apiDelete = useAdminDelete();
  const [photo, setPhoto] = useState("");
  const [desc, setDesc] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  const setPhoto_ = async () => {
    if (!photo.trim()) return;
    setLoading(true);
    try {
      const data = await apiFetch("/admin/bot/profile-photo", { photo: photo.trim() });
      setResult(data); toast.success("Profile photo set");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const removePhoto = async () => {
    setLoading(true);
    try {
      const data = await apiDelete("/admin/bot/profile-photo");
      setResult(data); toast.success("Profile photo removed");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const updateDesc = async () => {
    if (!desc.trim() && !shortDesc.trim()) return;
    setLoading(true);
    try {
      const data = await apiFetch("/admin/bot/description", {
        ...(desc.trim() ? { description: desc.trim() } : {}),
        ...(shortDesc.trim() ? { short_description: shortDesc.trim() } : {}),
      });
      setResult(data); toast.success("Description updated");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <Section icon={Image} title="Bot Profile" description="Photo, description, short bio">
      <Field label="Profile photo (file_id or URL)">
        <div className="flex gap-2">
          <Inp value={photo} onChange={setPhoto} placeholder="https://... or Telegram file_id" className="flex-1" />
          <Btn onClick={setPhoto_} loading={loading} className="shrink-0">
            <Image className="h-3.5 w-3.5" />
          </Btn>
        </div>
      </Field>
      <Btn onClick={removePhoto} loading={loading} variant="ghost" className="w-full">
        <Trash2 className="h-3.5 w-3.5" />
        Remove Profile Photo
      </Btn>
      <Field label="Description (shown on bot info page)">
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Contact the admin, donate crypto or Stars..."
          rows={3}
          className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </Field>
      <Field label="Short description (shown before you start a chat)">
        <Inp value={shortDesc} onChange={setShortDesc} placeholder="Contact admin & donations" />
      </Field>
      <Btn onClick={updateDesc} loading={loading} className="w-full">Update Description</Btn>
      <Result data={result} />
    </Section>
  );
}

function MessageStreaming() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [chatId, setChatId] = useState("");
  const [text, setText] = useState("");
  const [speed, setSpeed] = useState("80");
  const [chunkSize, setChunkSize] = useState("3");
  const [parseMode, setParseMode] = useState<"" | "HTML" | "Markdown">("");
  const [streaming, setStreaming] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stream = async () => {
    if (!chatId.trim() || !text.trim()) { toast.error("Chat ID and message are required"); return; }
    setStreaming(true);
    setProgress(0);
    setResult(null);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body: Record<string, unknown> = {
        chat_id: chatId.trim(),
        text: text.trim(),
        speed: parseInt(speed) || 80,
        chunk_size: parseInt(chunkSize) || 3,
      };
      if (parseMode) body.parse_mode = parseMode;

      const res = await fetch(`${API_BASE}/admin/bot/stream`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error("Stream request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const match = line.match(/^data:\s*(.+)$/);
          if (!match) continue;
          try {
            const data = JSON.parse(match[1]);
            if (data.progress !== undefined) setProgress(data.progress);
            if (data.done) { setResult(data.result); toast.success("Message streamed and sent"); }
            if (data.error) { toast.error(data.error); }
          } catch {}
        }
      }
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") toast.error(e instanceof Error ? e.message : "Stream failed");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setStreaming(false);
    toast("Stream cancelled");
  };

  return (
    <Section icon={Radio} title="Message Streaming" description="Stream text character-by-character using sendMessageDraft (Bot API 9.5)">
      <p className="text-xs text-muted-foreground">
        Uses native <code className="text-[10px] bg-muted px-1 rounded">sendMessageDraft</code> to stream text in real-time like ChatGPT, then sends the final message.
      </p>
      <Field label="Chat / User ID">
        <Inp value={chatId} onChange={setChatId} placeholder="e.g. 123456789" />
      </Field>
      <Field label="Message text">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type the full message to stream..."
          rows={4}
          className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </Field>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Speed (ms)">
          <Inp value={speed} onChange={setSpeed} placeholder="80" type="number" />
        </Field>
        <Field label="Chunk size">
          <Inp value={chunkSize} onChange={setChunkSize} placeholder="3" type="number" />
        </Field>
        <Field label="Parse mode">
          <select
            value={parseMode}
            onChange={e => setParseMode(e.target.value as "" | "HTML" | "Markdown")}
            className="w-full h-9 rounded-xl border border-border bg-muted/30 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">None</option>
            <option value="HTML">HTML</option>
            <option value="Markdown">Markdown</option>
          </select>
        </Field>
      </div>
      {streaming && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Streaming...</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {!streaming ? (
        <Btn onClick={stream} className="w-full">
          <Zap className="h-3.5 w-3.5" />
          Stream Message
        </Btn>
      ) : (
        <Btn onClick={cancel} className="w-full bg-destructive/10 text-destructive hover:bg-destructive/20 border-destructive/20">
          <ShieldX className="h-3.5 w-3.5" />
          Cancel Stream
        </Btn>
      )}
      <Result data={result} />
    </Section>
  );
}

function SendPoll() {
  const apiFetch = useAdminFetch();
  const [chatId, setChatId] = useState("");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [type, setType] = useState<"regular" | "quiz">("regular");
  const [correctIdx, setCorrectIdx] = useState("0");
  const [anonymous, setAnonymous] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  const send = async () => {
    const filled = options.filter(o => o.trim());
    if (!chatId.trim() || !question.trim() || filled.length < 2) {
      toast.error("Fill in Chat ID, question and at least 2 options"); return;
    }
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        chat_id: chatId.trim(), question: question.trim(),
        options: filled, type, is_anonymous: anonymous,
      };
      if (type === "quiz") body.correct_option_id = parseInt(correctIdx) || 0;
      const data = await apiFetch("/admin/bot/poll", body);
      setResult(data);
      toast.success("Poll sent");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <Section icon={Bot} title="Send Poll" description="Native Telegram poll or quiz">
      <Field label="Chat / User ID">
        <Inp value={chatId} onChange={setChatId} placeholder="e.g. 123456789" />
      </Field>
      <Field label="Question">
        <Inp value={question} onChange={setQuestion} placeholder="What's your favorite feature?" />
      </Field>
      <Field label={`Options (${options.length})`}>
        <div className="space-y-1.5">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2">
              <Inp value={opt} onChange={v => setOptions(o => o.map((x, j) => j === i ? v : x))} placeholder={`Option ${i + 1}`} className="flex-1" />
              {options.length > 2 && (
                <button onClick={() => setOptions(o => o.filter((_, j) => j !== i))}
                  className="p-2 rounded-xl text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {options.length < 10 && (
            <button onClick={() => setOptions(o => [...o, ""])}
              className="w-full py-1.5 text-xs text-primary font-medium rounded-xl border border-dashed border-primary/40 hover:bg-primary/5 transition-colors">
              + Add option
            </button>
          )}
        </div>
      </Field>
      <div className="flex gap-3 items-center flex-wrap">
        <Field label="Type">
          <div className="flex rounded-xl overflow-hidden border border-border">
            {(["regular", "quiz"] as const).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={cn("px-3 py-1.5 text-xs font-medium transition-colors capitalize",
                  type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}>
                {t}
              </button>
            ))}
          </div>
        </Field>
        {type === "quiz" && (
          <Field label="Correct option (0-indexed)">
            <Inp value={correctIdx} onChange={setCorrectIdx} placeholder="0" type="number" className="w-20" />
          </Field>
        )}
        <Field label="Anonymous">
          <button onClick={() => setAnonymous(v => !v)}
            className={cn("w-10 h-6 rounded-full transition-colors relative",
              anonymous ? "bg-primary" : "bg-muted border border-border")}>
            <span className={cn("absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all",
              anonymous ? "left-4.5 translate-x-0" : "left-0.5")} />
          </button>
        </Field>
      </div>
      <Btn onClick={send} loading={loading} className="w-full">
        <Send className="h-3.5 w-3.5" />
        Send Poll
      </Btn>
      <Result data={result} />
    </Section>
  );
}

function ReactAndPin() {
  const apiFetch = useAdminFetch();
  const apiDelete = useAdminDelete();
  const [chatId, setChatId] = useState("");
  const [msgId, setMsgId] = useState("");
  const [emoji, setEmoji] = useState("❤️");
  const [isBig, setIsBig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  const react = async () => {
    if (!chatId.trim() || !msgId.trim()) { toast.error("Chat ID and Message ID required"); return; }
    setLoading(true);
    try {
      const data = await apiFetch("/admin/chat/react", {
        chat_id: chatId.trim(), message_id: parseInt(msgId),
        emoji: emoji || "❤️", is_big: isBig,
      });
      setResult(data); toast.success(`Reacted with ${emoji}`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const pin = async () => {
    if (!chatId.trim() || !msgId.trim()) { toast.error("Chat ID and Message ID required"); return; }
    setLoading(true);
    try {
      const data = await apiFetch("/admin/chat/pin", {
        chat_id: chatId.trim(), message_id: parseInt(msgId), disable_notification: true,
      });
      setResult(data); toast.success("Message pinned");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const unpin = async () => {
    if (!chatId.trim()) { toast.error("Chat ID required"); return; }
    setLoading(true);
    try {
      const data = await apiDelete("/admin/chat/pin", {
        chat_id: chatId.trim(),
        ...(msgId.trim() ? { message_id: parseInt(msgId) } : {}),
      });
      setResult(data); toast.success("Message unpinned");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const EMOJI_OPTIONS = ["❤️", "👍", "🔥", "🎉", "😍", "👀", "💯", "🤝", "😱", "🏆"];

  return (
    <Section icon={Smile} title="Reactions & Pin" description="React to messages or pin/unpin them">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Chat / User ID">
          <Inp value={chatId} onChange={setChatId} placeholder="123456789" />
        </Field>
        <Field label="Message ID">
          <Inp value={msgId} onChange={setMsgId} placeholder="42" type="number" />
        </Field>
      </div>
      <Field label="Reaction emoji">
        <div className="flex flex-wrap gap-1.5">
          {EMOJI_OPTIONS.map(e => (
            <button key={e} onClick={() => setEmoji(e)}
              className={cn("text-lg px-1.5 py-0.5 rounded-lg transition-all",
                emoji === e ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-muted")}>
              {e}
            </button>
          ))}
          <Inp value={emoji} onChange={setEmoji} placeholder="custom" className="w-20 text-center" />
        </div>
      </Field>
      <label className="flex items-center gap-2 text-xs text-muted-foreground select-none cursor-pointer">
        <input type="checkbox" checked={isBig} onChange={e => setIsBig(e.target.checked)} className="rounded" />
        Big reaction (animated)
      </label>
      <div className="flex gap-2">
        <Btn onClick={react} loading={loading} className="flex-1">
          <Smile className="h-3.5 w-3.5" />
          React
        </Btn>
        <Btn onClick={pin} loading={loading} variant="ghost" className="flex-1">
          <Pin className="h-3.5 w-3.5" />
          Pin
        </Btn>
        <Btn onClick={unpin} loading={loading} variant="ghost" className="flex-1">
          <PinOff className="h-3.5 w-3.5" />
          Unpin
        </Btn>
      </div>
      <Result data={result} />
    </Section>
  );
}

function StarsTransactions() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [offset, setOffset] = useState("0");
  const [limit, setLimit] = useState("20");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/stars/transactions?offset=${offset}&limit=${limit}`, { headers });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setResult(data.transactions);
      toast.success("Transactions loaded");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <Section icon={Star} title="Stars Transactions" description="View incoming Telegram Stars payments">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Offset"><Inp value={offset} onChange={setOffset} placeholder="0" type="number" /></Field>
        <Field label="Limit"><Inp value={limit} onChange={setLimit} placeholder="20" type="number" /></Field>
      </div>
      <Btn onClick={fetch_} loading={loading} className="w-full">
        <Star className="h-3.5 w-3.5" />
        Fetch Transactions
      </Btn>
      <Result data={result} />
    </Section>
  );
}

function MemberTag() {
  const apiFetch = useAdminFetch();
  const [chatId, setChatId] = useState("");
  const [userId, setUserId] = useState("");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  const setTag_ = async (remove = false) => {
    if (!chatId.trim() || !userId.trim()) { toast.error("Chat ID and User ID required"); return; }
    setLoading(true);
    try {
      const body: Record<string, unknown> = { chat_id: chatId.trim() };
      if (!remove && tag.trim()) body.tag = tag.trim();
      const data = await apiFetch(`/admin/users/${userId.trim()}/tag`, body);
      setResult(data);
      toast.success(remove ? "Tag removed" : `Tag "${tag}" set`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const PRESETS = ["Donor", "VIP", "Subscriber", "Staff", "Trusted"];

  return (
    <Section icon={Tag} title="Member Tag" description="Set a visible label on a chat member (Bot API 9.5)">
      <p className="text-xs text-muted-foreground">
        Tags appear as a badge next to the member's name in group chats. Requires the bot to be an admin with <code className="text-primary">can_manage_tags</code>.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Chat ID"><Inp value={chatId} onChange={setChatId} placeholder="Group / Channel ID" /></Field>
        <Field label="User ID"><Inp value={userId} onChange={setUserId} placeholder="e.g. 123456789" /></Field>
      </div>
      <Field label="Tag text">
        <Inp value={tag} onChange={setTag} placeholder="e.g. Donor, VIP, Staff" />
        <div className="flex gap-1.5 mt-1.5 flex-wrap">
          {PRESETS.map(p => (
            <button key={p} onClick={() => setTag(p)}
              className="px-2 py-0.5 rounded-full text-[10px] border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors">
              {p}
            </button>
          ))}
        </div>
      </Field>
      <div className="flex gap-2">
        <Btn onClick={() => setTag_(false)} loading={loading} className="flex-1">
          <Tag className="h-3.5 w-3.5" />
          Set Tag
        </Btn>
        <Btn onClick={() => setTag_(true)} loading={loading} variant="ghost" className="flex-1">
          <Trash2 className="h-3.5 w-3.5" />
          Remove Tag
        </Btn>
      </div>
      <Result data={result} />
    </Section>
  );
}

function PromoteMember() {
  const apiFetch = useAdminFetch();
  const [chatId, setChatId] = useState("");
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  const RIGHTS: { key: string; label: string }[] = [
    { key: "can_manage_tags",        label: "Manage Tags (9.5)" },
    { key: "can_manage_chat",        label: "Manage Chat" },
    { key: "can_delete_messages",    label: "Delete Messages" },
    { key: "can_restrict_members",   label: "Restrict Members" },
    { key: "can_invite_users",       label: "Invite Users" },
    { key: "can_pin_messages",       label: "Pin Messages" },
    { key: "can_change_info",        label: "Change Info" },
    { key: "can_promote_members",    label: "Promote Members" },
    { key: "can_manage_video_chats", label: "Manage Video Chats" },
    { key: "can_manage_topics",      label: "Manage Topics" },
  ];

  const [rights, setRights] = useState<Record<string, boolean>>({});

  const promote = async () => {
    if (!chatId.trim() || !userId.trim()) { toast.error("Chat ID and User ID required"); return; }
    const activeRights = Object.fromEntries(Object.entries(rights).filter(([, v]) => v !== undefined));
    if (!Object.keys(activeRights).length) { toast.error("Select at least one right"); return; }
    setLoading(true);
    try {
      const data = await apiFetch(`/admin/users/${userId.trim()}/promote`, {
        chat_id: chatId.trim(), ...activeRights,
      });
      setResult(data); toast.success("Member promoted");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <Section icon={ShieldCheck} title="Promote Member" description="Grant admin rights including can_manage_tags (Bot API 9.5)">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Chat ID"><Inp value={chatId} onChange={setChatId} placeholder="Group ID" /></Field>
        <Field label="User ID"><Inp value={userId} onChange={setUserId} placeholder="User ID" /></Field>
      </div>
      <Field label="Rights to grant">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-1">
          {RIGHTS.map(r => (
            <label key={r.key} className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!rights[r.key]}
                onChange={e => setRights(prev => ({ ...prev, [r.key]: e.target.checked }))}
                className="rounded"
              />
              <span className={r.key === "can_manage_tags" ? "text-primary font-medium" : ""}>{r.label}</span>
            </label>
          ))}
        </div>
      </Field>
      <Btn onClick={promote} loading={loading} className="w-full">
        <ShieldCheck className="h-3.5 w-3.5" />
        Promote Member
      </Btn>
      <Result data={result} />
    </Section>
  );
}

type AudioItem = {
  file_id: string;
  file_unique_id: string;
  access_hash?: string;
  file_reference?: string;
  duration: number;
  file_name?: string;
  title?: string;
  performer?: string;
  mime_type?: string;
  file_size?: number;
  thumbnail?: { file_id: string };
};

function AudioPlayer({ audio, headers }: { audio: AudioItem; headers: Record<string, string> }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const getStreamUrl = () => {
    if (audio.access_hash) {
      const params = new URLSearchParams();
      if (audio.file_reference) params.set("ref", audio.file_reference);
      if (audio.mime_type) params.set("mime", audio.mime_type);
      const qs = params.toString();
      return `${API_BASE}/admin/audio/${audio.file_id}/${audio.access_hash}${qs ? `?${qs}` : ""}`;
    }
    return `${API_BASE}/file/${audio.file_id}`;
  };

  const toggle = async () => {
    if (audioRef.current) {
      if (playing) { audioRef.current.pause(); setPlaying(false); }
      else { audioRef.current.play(); setPlaying(true); }
      return;
    }

    setLoadingAudio(true);
    try {
      const res = await fetch(getStreamUrl(), { headers });
      if (!res.ok) throw new Error("Failed to load audio");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setBlobUrl(url);

      const el = new Audio(url);
      audioRef.current = el;
      el.addEventListener("timeupdate", () => {
        if (el.duration) setProgress((el.currentTime / el.duration) * 100);
      });
      el.addEventListener("ended", () => { setPlaying(false); setProgress(0); });
      el.addEventListener("error", () => { toast.error("Failed to play audio"); setPlaying(false); });
      await el.play();
      setPlaying(true);
    } catch {
      toast.error("Failed to load audio");
    } finally {
      setLoadingAudio(false);
    }
  };

  useEffect(() => () => {
    audioRef.current?.pause();
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
  }, []);

  const formatDur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const sizeStr = audio.file_size ? `${(audio.file_size / 1024 / 1024).toFixed(1)} MB` : "";

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
      <button onClick={toggle} disabled={loadingAudio} className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors">
        {loadingAudio
          ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
          : playing
          ? <div className="flex items-center gap-0.5">{[1,2,3].map(i => <div key={i} className="w-0.5 bg-primary rounded-full animate-pulse" style={{ height: `${8 + i * 3}px`, animationDelay: `${i * 0.15}s` }} />)}</div>
          : <div className="w-0 h-0 border-l-[8px] border-l-primary border-y-[6px] border-y-transparent ml-0.5" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{audio.title || audio.file_name || "Untitled"}</p>
        {audio.performer && <p className="text-[11px] text-muted-foreground truncate">{audio.performer}</p>}
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">{formatDur(audio.duration)}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {sizeStr && <span className="text-[10px] text-muted-foreground">{sizeStr}</span>}
        {blobUrl ? (
          <a href={blobUrl} download={audio.file_name || "audio.mp3"} className="text-[10px] text-primary hover:underline">Download</a>
        ) : (
          <span className="text-[10px] text-muted-foreground">Play to load</span>
        )}
      </div>
    </div>
  );
}

function UserAudios() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [audios, setAudios] = useState<AudioItem[]>([]);

  const fetch_ = async () => {
    if (!userId.trim()) { toast.error("User ID required"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId.trim()}/audios`, { headers });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      const list = Array.isArray(data.audios) ? data.audios : [];
      setAudios(list);
      toast.success(`${list.length} audio(s) loaded`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <Section icon={Music2} title="User Profile Audios" description="Fetch & play audio files on a user's Telegram profile (MTProto)">
      <Field label="User ID">
        <Inp value={userId} onChange={setUserId} placeholder="e.g. 123456789" />
      </Field>
      <Btn onClick={fetch_} loading={loading} className="w-full">
        <Music2 className="h-3.5 w-3.5" />
        Fetch Audios
      </Btn>
      {audios.length > 0 && (
        <div className="space-y-2 mt-2">
          {audios.map((a) => <AudioPlayer key={a.file_unique_id} audio={a} headers={headers} />)}
        </div>
      )}
    </Section>
  );
}

// ── Section 10: Fetch Group Members ──────────────────────────────────────────

function FetchGroupMembers() {
  const af = useAdminFetch();
  const [chatId, setChatId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  const handleFetch = async () => {
    if (!chatId.trim()) { toast.error("Chat ID required"); return; }
    setLoading(true);
    try {
      const data = await af("/admin/chat/fetch-members", { chat_id: chatId.trim() });
      setResult(data);
      toast.success(`Fetched ${data.admins_fetched} admins · ${data.known_members?.length ?? 0} known total`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <Section icon={Users} title="Fetch Group Members" description="Seed DB with admins from any group/channel — then track new joiners automatically">
      <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
        Pulls the admin list via Bot API and saves them to the member database.
        New joins are tracked automatically when the bot is an admin.
      </div>
      <Field label="Chat ID">
        <Inp value={chatId} onChange={setChatId} placeholder="-100123456789" />
      </Field>
      <Btn onClick={handleFetch} loading={loading} className="w-full">
        <Users className="h-3.5 w-3.5" />
        Fetch Admins + Known Members
      </Btn>
      <Result data={result} />
    </Section>
  );
}

// ── Section 11: Tag All ───────────────────────────────────────────────────────

function TagAll() {
  const af = useAdminFetch();
  const [chatId, setChatId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);

  const handleTag = async () => {
    if (!chatId.trim()) { toast.error("Chat ID required"); return; }
    setLoading(true);
    try {
      const data = await af("/admin/chat/tag-all", { chat_id: chatId.trim() });
      setResult(data);
      toast.success(`Tagged ${data.tagged} members in ${data.messages_sent} message(s)`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <Section icon={Radio} title="Tag All Members" description="Mention every known member in a group with one tap">
      <Field label="Chat ID">
        <Inp value={chatId} onChange={setChatId} placeholder="-100123456789" />
      </Field>
      <Btn onClick={handleTag} loading={loading} className="w-full">
        <Radio className="h-3.5 w-3.5" />
        Tag All
      </Btn>
      {result && (
        <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
          <p>Tagged: <span className="text-foreground font-semibold">{(result as any).tagged ?? 0}</span></p>
          <p>Messages sent: <span className="text-foreground font-semibold">{(result as any).messages_sent ?? 0}</span></p>
          {(result as any).note && <p className="text-white/40">{(result as any).note}</p>}
        </div>
      )}
    </Section>
  );
}

// ── Section 12: Premium Management ───────────────────────────────────────────

function ManagePremium() {
  const af = useAdminFetch();
  const afDel = useAdminDelete();
  const [tab, setTab] = useState<"list" | "grant" | "revoke" | "invoice">("list");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [telegramId, setTelegramId] = useState("");
  const [days, setDays] = useState("30");

  const loadList = async () => {
    setLoading(true);
    try { setResult(await af("/admin/premium")); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const grant = async () => {
    if (!telegramId.trim()) { toast.error("Telegram ID required"); return; }
    setLoading(true);
    try {
      const data = await af("/admin/premium/grant", { telegram_id: telegramId.trim(), days: Number(days) });
      toast.success(`Premium granted for ${data.days} days`);
      setResult(data);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const revoke = async () => {
    if (!telegramId.trim()) { toast.error("Telegram ID required"); return; }
    setLoading(true);
    try {
      await afDel("/admin/premium/revoke", { telegram_id: telegramId.trim() });
      toast.success("Premium revoked");
      setResult({ revoked: telegramId });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const invoice = async () => {
    if (!telegramId.trim()) { toast.error("Telegram ID required"); return; }
    setLoading(true);
    try {
      const data = await af("/admin/premium/invoice", { telegram_id: telegramId.trim() });
      toast.success("Subscription invoice sent to user");
      setResult(data);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const TABS = [
    { id: "list",    label: "List" },
    { id: "grant",   label: "Grant" },
    { id: "revoke",  label: "Revoke" },
    { id: "invoice", label: "Invoice" },
  ] as const;

  return (
    <Section icon={Star} title="Premium Management" description="Grant / revoke / invoice $5 premium subscriptions per user ID">
      <div className="flex rounded-xl border border-border overflow-hidden">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResult(null); }}
            className={cn("flex-1 py-1.5 text-xs font-medium transition-colors",
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/40"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "list" && (
        <Btn onClick={loadList} loading={loading} className="w-full">
          <Star className="h-3.5 w-3.5" />
          Load Premium Users
        </Btn>
      )}

      {(tab === "grant" || tab === "revoke" || tab === "invoice") && (
        <>
          <Field label="Telegram ID">
            <Inp value={telegramId} onChange={setTelegramId} placeholder="e.g. 123456789" />
          </Field>
          {tab === "grant" && (
            <Field label="Days">
              <Inp value={days} onChange={setDays} type="number" placeholder="30" />
            </Field>
          )}
          {tab === "invoice" && (
            <div className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground leading-relaxed">
              Sends a Telegram subscription invoice (250 Stars/month, auto-renewing every 30 days) directly to the user's chat.
            </div>
          )}
          <Btn
            onClick={tab === "grant" ? grant : tab === "revoke" ? revoke : invoice}
            loading={loading}
            variant={tab === "revoke" ? "danger" : "primary"}
            className="w-full"
          >
            {tab === "grant" ? "Grant Premium" : tab === "revoke" ? "Revoke Premium" : "Send Subscription Invoice"}
          </Btn>
        </>
      )}

      <Result data={result} />
    </Section>
  );
}

// ── Section 12b: Widget Plan Management ──────────────────────────────────────

function ManageWidgetPlan() {
  const af = useAdminFetch();
  const afDel = useAdminDelete();
  const [tab, setTab] = useState<"grant" | "revoke">("grant");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [telegramId, setTelegramId] = useState("");
  const [days, setDays] = useState("30");
  const [plan, setPlan] = useState<"standard" | "pro">("pro");

  const grant = async () => {
    if (!telegramId.trim()) { toast.error("Telegram ID required"); return; }
    setLoading(true);
    try {
      const data = await af("/admin/widget-plan/grant", { telegram_id: telegramId.trim(), plan, days: Number(days) });
      toast.success(`Widget ${plan} plan granted for ${data.days} days`);
      setResult(data);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const revoke = async () => {
    if (!telegramId.trim()) { toast.error("Telegram ID required"); return; }
    setLoading(true);
    try {
      await afDel("/admin/widget-plan/revoke", { telegram_id: telegramId.trim() });
      toast.success("Widget plan revoked");
      setResult({ revoked: telegramId });
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const TABS = [
    { id: "grant",  label: "Grant" },
    { id: "revoke", label: "Revoke" },
  ] as const;

  return (
    <Section icon={Zap} title="Widget Plan Management" description="Grant or revoke widget subscription plans (Standard / Pro) for users">
      <div className="flex rounded-xl border border-border overflow-hidden">
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResult(null); }}
            className={cn("flex-1 py-1.5 text-xs font-medium transition-colors",
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/40"
            )}>
            {t.label}
          </button>
        ))}
      </div>

      <Field label="Telegram ID">
        <Inp value={telegramId} onChange={setTelegramId} placeholder="e.g. 123456789" />
      </Field>

      {tab === "grant" && (
        <>
          <Field label="Plan">
            <div className="flex gap-2">
              {(["standard", "pro"] as const).map(p => (
                <button key={p} onClick={() => setPlan(p)}
                  className={cn("flex-1 py-1.5 px-3 rounded-lg text-xs font-medium border transition-all capitalize",
                    plan === p ? "bg-white/15 text-white border-white/30" : "bg-muted text-muted-foreground border-border hover:border-white/30"
                  )}>
                  {p === "standard" ? "Standard (100⭐)" : "Pro (250⭐)"}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Days">
            <Inp value={days} onChange={setDays} type="number" placeholder="30" />
          </Field>
        </>
      )}

      <Btn
        onClick={tab === "grant" ? grant : revoke}
        loading={loading}
        variant={tab === "revoke" ? "danger" : "primary"}
        className="w-full"
      >
        {tab === "grant" ? `Grant ${plan === "pro" ? "Pro" : "Standard"} Plan` : "Revoke Widget Plan"}
      </Btn>

      <Result data={result} />
    </Section>
  );
}

// ── Section 13: Ban All Members ───────────────────────────────────────────────

function BanAllMembers() {
  const af = useAdminFetch();
  const [chatId, setChatId] = useState("");
  const [revoke, setRevoke] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleBan = async () => {
    if (!chatId.trim()) { toast.error("Chat ID required"); return; }
    if (!confirmed) { setConfirmed(true); toast("Tap again to confirm — this will ban everyone."); return; }
    setConfirmed(false);
    setLoading(true);
    try {
      const data = await af("/admin/chat/ban-all", {
        chat_id: chatId.trim().startsWith("-") ? chatId.trim() : `-${chatId.trim()}`,
        revoke_messages: revoke,
      });
      setResult(data);
      toast.success(`Done — ${data.banned} banned, ${data.failed} failed`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Section
      icon={ShieldX}
      title="Ban All Members"
      description="Ban every known user from a channel or group (bot must be admin)"
    >
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive/80 leading-relaxed">
        Bans all users in the database — including members who joined a group where the bot is admin (even if they never messaged the bot). The bot must have <strong>ban members</strong> permission. Your admin account is always skipped.
      </div>

      <Field label="Chat ID (group or channel)">
        <Inp value={chatId} onChange={setChatId} placeholder="-100123456789 or without the minus" />
      </Field>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
          onClick={() => setRevoke(v => !v)}
          className={cn(
            "relative h-5 w-9 rounded-full transition-colors",
            revoke ? "bg-primary" : "bg-muted border border-border",
          )}
        >
          <span className={cn(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
            revoke ? "translate-x-4" : "translate-x-0",
          )} />
        </div>
        <span className="text-xs text-muted-foreground">Delete their message history too</span>
      </label>

      <Btn
        onClick={handleBan}
        loading={loading}
        variant="danger"
        className="w-full"
      >
        <ShieldX className="h-3.5 w-3.5" />
        {confirmed ? "⚠️ Confirm — Ban All" : "Ban All Members"}
      </Btn>

      <Result data={result} />
    </Section>
  );
}

// ── String Sessions ────────────────────────────────────────────────────────────

type SessionRow = {
  id: number; telegram_id: string; phone: string | null;
  first_name: string | null; username: string | null;
  account_id: string | null; status: string;
  created_at: string; last_used: string;
};

function SessionCard({
  session, infoOpen, chatsOpen, infoData, chatsData, panelLoading, onInfo, onChats, onLogout,
}: {
  session: SessionRow;
  infoOpen: boolean; chatsOpen: boolean;
  infoData: Record<string, unknown> | undefined;
  chatsData: Array<{ id: string; name: string; type: string; unread: number }> | undefined;
  panelLoading: string | null;
  onInfo: () => void; onChats: () => void; onLogout: () => void;
}) {
  const displayName = session.first_name
    ? `${session.first_name}${session.username ? ` @${session.username}` : ""}`
    : session.phone ?? "Unknown";
  return (
    <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate">{displayName}</p>
          {session.phone && <p className="text-[10px] text-muted-foreground">{session.phone}</p>}
          {session.account_id && (
            <p className="text-[10px] text-muted-foreground font-mono">TG ID: {session.account_id}</p>
          )}
          <p className="text-[10px] text-muted-foreground">
            Added by: <span className="font-mono">{session.telegram_id}</span>
          </p>
        </div>
        <span className="text-[10px] bg-white/5 text-white/50 px-2 py-0.5 rounded-full shrink-0">active</span>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        <button onClick={onInfo} className={cn(
          "flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-colors",
          infoOpen ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted",
        )}>
          {panelLoading === `info-${session.id}` ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Info className="h-2.5 w-2.5" />}
          Info
        </button>
        <button onClick={onChats} className={cn(
          "flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border transition-colors",
          chatsOpen ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted",
        )}>
          {panelLoading === `chats-${session.id}` ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <MessageSquare className="h-2.5 w-2.5" />}
          Chats
        </button>
        <button onClick={onLogout} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-white/15 text-white/50 hover:bg-white/5 transition-colors">
          <LogOut className="h-2.5 w-2.5" />
          Logout
        </button>
      </div>

      {infoOpen && infoData && (
        <div className="rounded-lg bg-muted/30 border border-border p-2 space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Account Info</p>
          {Object.entries(infoData).map(([k, v]) => (
            <div key={k} className="flex justify-between text-[10px] gap-2">
              <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
              <span className="font-mono truncate">{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {chatsOpen && chatsData && (
        <div className="rounded-lg bg-muted/30 border border-border p-2 space-y-1 max-h-48 overflow-y-auto">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Recent Chats</p>
          {chatsData.length === 0 && <p className="text-[10px] text-muted-foreground">No chats found</p>}
          {chatsData.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-[10px] gap-2">
              <div className="min-w-0">
                <span className="truncate">{c.name ?? "Unknown"}</span>
                <span className="text-muted-foreground ml-1 capitalize">({c.type})</span>
              </div>
              {c.unread > 0 && (
                <span className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded-full shrink-0">{c.unread}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StringSessions() {
  const af = useAdminFetch();
  const ad = useAdminDelete();

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [apiConfig, setApiConfig] = useState<{ api_configured: boolean } | null>(null);

  const [showAdd, setShowAdd] = useState(false);
  const [step, setStep] = useState<"phone" | "code" | "twofa">("phone");
  const [phone, setPhone] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [code, setCode] = useState("");
  const [twofa, setTwofa] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  const [infoOpen, setInfoOpen] = useState<number | null>(null);
  const [chatsOpen, setChatsOpen] = useState<number | null>(null);
  const [infoData, setInfoData] = useState<Record<number, Record<string, unknown>>>({});
  const [chatsData, setChatsData] = useState<Record<number, Array<{ id: string; name: string; type: string; unread: number }>>>({});
  const [panelLoading, setPanelLoading] = useState<string | null>(null);

  const load = async (showToast = false) => {
    setListLoading(true);
    setListError(null);
    try {
      const [statusData, sessData] = await Promise.all([af("/sessions/status"), af("/sessions")]);
      setApiConfig(statusData);
      setSessions(sessData.sessions ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load sessions";
      setListError(msg);
      if (showToast) toast.error(msg);
    } finally { setListLoading(false); }
  };

  useEffect(() => { load(false); }, []);

  const resetOtp = () => { setStep("phone"); setPhone(""); setPendingId(""); setCode(""); setTwofa(""); setShowAdd(false); };

  const sendCode = async () => {
    setOtpLoading(true);
    try {
      const data = await af("/sessions/auth/start", { phone: phone.trim() });
      setPendingId(data.pending_id);
      setStep("code");
      toast.success(`Code sent to ${phone}`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setOtpLoading(false); }
  };

  const verifyCode = async (password?: string) => {
    setOtpLoading(true);
    try {
      const body: Record<string, string> = { pending_id: pendingId, code: code.trim() };
      if (password) body.password = password;
      const data = await af("/sessions/auth/verify", body);
      if (data.needs_password) {
        setStep("twofa");
        toast("2FA password required");
      } else {
        toast.success(`Session saved — ${data.first_name ?? ""}${data.username ? ` @${data.username}` : ""}`);
        resetOtp();
        load();
      }
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Verification failed"); }
    finally { setOtpLoading(false); }
  };

  const loadInfo = async (id: number) => {
    if (infoOpen === id) { setInfoOpen(null); return; }
    setInfoOpen(id); setChatsOpen(null);
    if (infoData[id]) return;
    setPanelLoading(`info-${id}`);
    try {
      const data = await af(`/sessions/${id}/info`);
      setInfoData(prev => ({ ...prev, [id]: data.info as Record<string, unknown> }));
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); setInfoOpen(null); }
    finally { setPanelLoading(null); }
  };

  const loadChats = async (id: number) => {
    if (chatsOpen === id) { setChatsOpen(null); return; }
    setChatsOpen(id); setInfoOpen(null);
    if (chatsData[id]) return;
    setPanelLoading(`chats-${id}`);
    try {
      const data = await af(`/sessions/${id}/chats`);
      setChatsData(prev => ({ ...prev, [id]: data.chats ?? [] }));
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); setChatsOpen(null); }
    finally { setPanelLoading(null); }
  };

  const logout = async (id: number) => {
    try {
      await ad(`/sessions/${id}`);
      toast.success("Session logged out");
      setSessions(prev => prev.filter(s => s.id !== id));
      if (infoOpen === id) setInfoOpen(null);
      if (chatsOpen === id) setChatsOpen(null);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <Section icon={KeyRound} title="String Sessions" description="MTProto user accounts — enables full member lists for ban-all">
      {apiConfig && !apiConfig.api_configured && (
        <div className="text-xs text-white/40 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          Add <code className="font-mono">TELEGRAM_API_ID</code> and <code className="font-mono">TELEGRAM_API_HASH</code> secrets to enable session generation.
        </div>
      )}

      {listError && (
        <div className="text-xs text-white/40 bg-white/5 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
          <span>{listError}</span>
          <button onClick={() => load(true)} className="shrink-0 underline hover:no-underline">Retry</button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {sessions.length} active session{sessions.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-3 items-center">
          <button onClick={() => load(true)} disabled={listLoading} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={cn("h-3 w-3", listLoading && "animate-spin")} />
          </button>
          {!showAdd && (
            <button onClick={() => setShowAdd(true)} className="text-xs text-primary hover:underline font-medium">
              + Add Session
            </button>
          )}
        </div>
      </div>

      {showAdd && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2.5">
          <p className="text-xs font-semibold">
            {step === "phone" && "Step 1 — Phone number"}
            {step === "code" && `Step 2 — Code sent to ${phone}`}
            {step === "twofa" && "Step 3 — 2FA password"}
          </p>

          {step === "phone" && (
            <>
              <Inp value={phone} onChange={setPhone} placeholder="+1234567890" type="tel" />
              <div className="flex gap-2">
                <Btn onClick={sendCode} loading={otpLoading} disabled={!phone.trim()} className="flex-1">Send Code</Btn>
                <Btn onClick={resetOtp} variant="ghost" className="px-4">Cancel</Btn>
              </div>
            </>
          )}
          {step === "code" && (
            <>
              <Inp value={code} onChange={setCode} placeholder="123456" />
              <div className="flex gap-2">
                <Btn onClick={() => verifyCode()} loading={otpLoading} disabled={!code.trim()} className="flex-1">Verify</Btn>
                <Btn onClick={resetOtp} variant="ghost" className="px-4">Cancel</Btn>
              </div>
            </>
          )}
          {step === "twofa" && (
            <>
              <Inp value={twofa} onChange={setTwofa} placeholder="2FA password" type="password" />
              <div className="flex gap-2">
                <Btn onClick={() => verifyCode(twofa)} loading={otpLoading} disabled={!twofa.trim()} className="flex-1">Submit</Btn>
                <Btn onClick={resetOtp} variant="ghost" className="px-4">Cancel</Btn>
              </div>
            </>
          )}
        </div>
      )}

      {listLoading && sessions.length === 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!listLoading && sessions.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No active sessions. Add one to enable full member fetching for ban-all.
        </p>
      )}

      <div className="space-y-2">
        {sessions.map(s => (
          <SessionCard key={s.id} session={s}
            infoOpen={infoOpen === s.id} chatsOpen={chatsOpen === s.id}
            infoData={infoData[s.id]} chatsData={chatsData[s.id]}
            panelLoading={panelLoading}
            onInfo={() => loadInfo(s.id)} onChats={() => loadChats(s.id)} onLogout={() => logout(s.id)}
          />
        ))}
      </div>
    </Section>
  );
}

// ── Tracked Groups ─────────────────────────────────────────────────────────────

type GroupChat = {
  chat_id: string; title: string; chat_type: string;
  bot_is_admin: number; tracked_members: number; updated_at: string;
};

function TrackedGroups() {
  const af = useAdminFetch();
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { headers } = useApiAuth() as { headers: Record<string, string> };

  const load = async (showToast = false) => {
    setLoading(true);
    try {
      const data = await af("/admin/group-chats");
      setGroups(data.chats ?? []);
    } catch (e: unknown) {
      if (showToast) toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(false); }, []);

  const handleTagAll = async (chatId: string) => {
    setActionLoading(`tag-${chatId}`);
    try {
      const data = await af("/admin/chat/tag-all", { chat_id: chatId });
      toast.success(`Tagged ${data.tagged} members in ${data.messages_sent} message(s)`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanAll = async (chatId: string, confirmed: boolean, setConfirmed: (v: boolean) => void) => {
    if (!confirmed) { setConfirmed(true); toast("Tap again to confirm — bans everyone."); return; }
    setConfirmed(false);
    setActionLoading(`ban-${chatId}`);
    try {
      const res = await fetch(`${API_BASE}/admin/chat/ban-all`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, revoke_messages: false }),
      });
      const data = await res.json();
      toast.success(`Banned ${data.banned} / ${data.total}`);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (chatId: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/group-chats/${chatId}`, {
        method: "DELETE", headers,
      });
      const data = await res.json();
      if (data.ok) { toast.success("Removed from tracking"); load(); }
      else toast.error(data.error ?? "Failed");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Section icon={Globe} title="Tracked Groups & Channels"
      description="All groups and channels where the bot is present, auto-populated when bot is added as admin">
      <div className="flex justify-end">
        <button onClick={() => load(true)} disabled={loading}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {loading && groups.length === 0 && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && groups.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3">
          No groups yet. Add the bot as admin to any group or channel — it will auto-register.
        </p>
      )}

      <div className="space-y-2">
        {groups.map(g => (
          <GroupRow key={g.chat_id} group={g}
            onTagAll={() => handleTagAll(g.chat_id)}
            onBanAll={handleBanAll}
            onRemove={() => handleRemove(g.chat_id)}
            actionLoading={actionLoading}
          />
        ))}
      </div>
    </Section>
  );
}

function GroupRow({ group, onTagAll, onBanAll, onRemove, actionLoading }: {
  group: GroupChat;
  onTagAll: () => void;
  onBanAll: (chatId: string, confirmed: boolean, setConfirmed: (v: boolean) => void) => void;
  onRemove: () => void;
  actionLoading: string | null;
}) {
  const [confirmBan, setConfirmBan] = useState(false);
  const isTagging = actionLoading === `tag-${group.chat_id}`;
  const isBanning = actionLoading === `ban-${group.chat_id}`;

  return (
    <div className="rounded-xl border border-border bg-muted/20 px-3 py-2.5 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate">{group.title || `Chat ${group.chat_id}`}</p>
          <p className="text-[10px] text-muted-foreground font-mono">{group.chat_id}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-muted-foreground capitalize">{group.chat_type}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">{group.tracked_members} tracked</span>
            {group.bot_is_admin ? (
              <span className="text-[10px] text-white/50 font-medium">● admin</span>
            ) : (
              <span className="text-[10px] text-muted-foreground">● not admin</span>
            )}
          </div>
        </div>
        <button onClick={onRemove} className="shrink-0 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={onTagAll}
          disabled={isTagging || isBanning || !group.bot_is_admin}
          className="flex-1 h-7 text-[11px] font-medium rounded-lg border border-border hover:bg-muted/60 disabled:opacity-40 transition-colors flex items-center justify-center gap-1"
        >
          {isTagging ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Tag All
        </button>
        <button
          onClick={() => onBanAll(group.chat_id, confirmBan, setConfirmBan)}
          disabled={isTagging || isBanning || !group.bot_is_admin}
          className={cn(
            "flex-1 h-7 text-[11px] font-medium rounded-lg border transition-colors flex items-center justify-center gap-1",
            confirmBan
              ? "border-destructive bg-destructive/10 text-destructive"
              : "border-border hover:bg-muted/60 disabled:opacity-40",
          )}
        >
          {isBanning ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          {confirmBan ? "Confirm Ban" : "Ban All"}
        </button>
      </div>
    </div>
  );
}

// ── Analytics stats ───────────────────────────────────────────────────────────

function AnalyticsStats() {
  const apiFetch = useAdminFetch();
  const [stats, setStats] = useState<{ total_users: number; daily_active: number; total_messages: number; banned_users: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);

  const load = async (showToast = false) => {
    setLoading(true);
    setStatsError(false);
    try {
      const d = await apiFetch("/admin/spam/stats");
      setStats(d.stats as typeof stats);
    } catch (e: unknown) {
      setStatsError(true);
      if (showToast) toast.error(e instanceof Error ? e.message : "Failed to load stats");
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(false); }, []);

  const tiles = [
    { label: "Total Users",    value: stats?.total_users,    color: "text-white/60",   bg: "bg-white/5" },
    { label: "Active Today",   value: stats?.daily_active,   color: "text-white/60",  bg: "bg-white/5" },
    { label: "Total Messages", value: stats?.total_messages, color: "text-white/60", bg: "bg-white/5" },
    { label: "Banned Users",   value: stats?.banned_users,   color: "text-white/60",    bg: "bg-white/5" },
  ];

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3.5 bg-background border-b border-border">
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Globe className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Analytics</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Live bot statistics</p>
        </div>
        <button onClick={() => load(true)} className="text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-px bg-border">
        {tiles.map(({ label, value, color, bg }) => (
          <div key={label} className={`flex flex-col items-center justify-center py-4 px-3 ${bg} bg-background`}>
            {loading ? (
              <div className="h-7 w-12 rounded-lg bg-muted animate-pulse mb-1" />
            ) : statsError ? (
              <p className="text-lg font-bold text-muted-foreground">—</p>
            ) : (
              <p className={`text-2xl font-bold ${color}`}>{value?.toLocaleString() ?? "—"}</p>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Manage App Notices ────────────────────────────────────────────────────────

function sanitizeHtml(raw: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");
  const allowed = new Set([
    "b", "strong", "i", "em", "u", "s", "br", "p", "div", "span",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "a", "code", "pre", "blockquote",
    "table", "thead", "tbody", "tr", "th", "td",
    "hr", "img", "sup", "sub", "small", "mark",
  ]);
  const allowedAttrs: Record<string, Set<string>> = {
    a: new Set(["href", "target", "rel"]),
    img: new Set(["src", "alt", "width", "height"]),
    "*": new Set(["class", "style"]),
  };
  const stripEntirely = new Set(["script", "style", "noscript", "iframe", "object", "embed", "form", "input", "textarea", "select", "button"]);
  function clean(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (stripEntirely.has(tag)) return "";
    if (!allowed.has(tag)) {
      let inner = "";
      el.childNodes.forEach(c => { inner += clean(c); });
      return inner;
    }
    const validAttrs = new Set([...(allowedAttrs[tag] ?? []), ...(allowedAttrs["*"] ?? [])]);
    let attrs = "";
    for (const attr of Array.from(el.attributes)) {
      if (validAttrs.has(attr.name)) {
        const val = attr.value.replace(/javascript:/gi, "").replace(/on\w+=/gi, "");
        attrs += ` ${attr.name}="${val.replace(/"/g, "&quot;")}"`;
      }
    }
    let inner = "";
    el.childNodes.forEach(c => { inner += clean(c); });
    const selfClosing = new Set(["br", "hr", "img"]);
    if (selfClosing.has(tag)) return `<${tag}${attrs} />`;
    return `<${tag}${attrs}>${inner}</${tag}>`;
  }
  let result = "";
  doc.body.childNodes.forEach(c => { result += clean(c); });
  return result;
}

function ManageNotices() {
  const apiFetch = useAdminFetch();
  const apiDelete = useAdminDelete();
  const { headers } = useApiAuth() as { headers: Record<string, string> };

  const [notices, setNotices] = useState<Array<{ id: number; title: string; message: string; type: string; active: number; created_at: string }>>([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("warning");
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const fetchNotices = async () => {
    try {
      const data = await apiFetch("/admin/notices");
      setNotices(data.notices ?? []);
    } catch {}
  };

  useEffect(() => { fetchNotices(); }, []);

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) { toast.error("Title and message required"); return; }
    setLoading(true);
    try {
      if (editId) {
        const res = await fetch(`${API_BASE}/admin/notices/${editId}`, {
          method: "PUT",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({ title, message, type, active: true }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as any).error || `HTTP ${res.status}`); }
        toast.success("Notice updated");
      } else {
        await apiFetch("/admin/notices", { title, message, type });
        toast.success("Notice published");
      }
      setTitle(""); setMessage(""); setType("warning"); setEditId(null);
      await fetchNotices();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiDelete(`/admin/notices/${id}`);
      toast.success("Notice deleted");
      await fetchNotices();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleToggle = async (id: number, currentActive: number) => {
    try {
      const res = await fetch(`${API_BASE}/admin/notices/${id}`, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ active: currentActive === 0 }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as any).error || `HTTP ${res.status}`); }
      toast.success(currentActive ? "Notice deactivated" : "Notice activated");
      await fetchNotices();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const startEdit = (n: typeof notices[0]) => {
    setEditId(n.id); setTitle(n.title); setMessage(n.message); setType(n.type);
  };

  const typeOptions = [
    { value: "warning", label: "⚠️ Warning" },
    { value: "info", label: "ℹ️ Info" },
    { value: "update", label: "🔄 Update" },
    { value: "maintenance", label: "🔧 Maintenance" },
  ];

  return (
    <Section icon={Bell} title="App Notices" description="Show notification banners to users on app open">
      <div className="space-y-3">
        <Field label="Title">
          <Inp value={title} onChange={setTitle} placeholder="e.g. Beta Version" />
        </Field>
        <Field label="Message (supports HTML)">
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Plain text or HTML — e.g. <b>bold</b>, <ul><li>item</li></ul>, <a href='...'>link</a>"
            rows={6}
            className={cn(
              "w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm resize-y font-mono",
              "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30",
            )}
          />
        </Field>
        {message.trim() && /<[a-z][\s\S]*>/i.test(message) && (
          <Field label="Preview">
            <div className="rounded-xl border border-border bg-muted/10 p-3">
              <div
                className="app-notice-html text-sm text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(message) }}
              />
            </div>
          </Field>
        )}
        <Field label="Type">
          <div className="flex gap-2 flex-wrap">
            {typeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                  type === opt.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="flex gap-2">
          <Btn onClick={handleSubmit} loading={loading} className="flex-1">
            {editId ? "Update Notice" : "Publish Notice"}
          </Btn>
          {editId && (
            <Btn variant="ghost" onClick={() => { setEditId(null); setTitle(""); setMessage(""); setType("warning"); }}>
              Cancel
            </Btn>
          )}
        </div>
      </div>

      {notices.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wide">History</p>
          {notices.map(n => (
            <div key={n.id} className={cn(
              "rounded-xl border p-3 space-y-1.5",
              n.active ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"
            )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {n.active === 1 && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
                    <p className="text-sm font-semibold truncate">{n.title}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">{n.type} · {n.created_at}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => startEdit(n)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => handleToggle(n.id, n.active)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Power className={cn("h-3.5 w-3.5", n.active ? "text-green-500" : "text-muted-foreground")} />
                  </button>
                  <button onClick={() => handleDelete(n.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminBotTools() {
  return (
    <Layout title="Bot Tools">
      <div className="h-full overflow-y-auto px-3 py-4 space-y-2.5">
        <ManageNotices />
        <AnalyticsStats />
        <StringSessions />
        <TrackedGroups />
        <BotSetup />
        <BotProfile />
        <MessageStreaming />
        <SendPoll />
        <ReactAndPin />
        <StarsTransactions />
        <MemberTag />
        <PromoteMember />
        <UserAudios />
        <FetchGroupMembers />
        <TagAll />
        <ManagePremium />
        <ManageWidgetPlan />
        <BanAllMembers />
      </div>
    </Layout>
  );
}
