import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Bot, ChevronDown, ChevronUp, Loader2, Send, Image, Trash2,
  Smile, Pin, PinOff, Star, Tag, ShieldCheck, Music2,
  Settings2, Radio, Zap, ShieldX, Users, Globe, RefreshCw,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/miniapp", "") + "/api";

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
      const data = await apiFetch("/admin/bot/setup");
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

function LiveDraft() {
  const apiFetch = useAdminFetch();
  const [chatId, setChatId] = useState("");
  const [draftId, setDraftId] = useState("1");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const draftIdRef = useRef(1);

  const send = async () => {
    if (!chatId.trim() || !text.trim()) return;
    setLoading(true);
    try {
      const data = await apiFetch("/admin/bot/draft", {
        chat_id: chatId.trim(),
        draft_id: parseInt(draftId) || (draftIdRef.current++),
        text: text.trim(),
      });
      setResult(data);
      toast.success("Draft sent — call again with same draft_id to update it live");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <Section icon={Radio} title="Live Message Draft" description="Stream text in real-time (typing animation)">
      <p className="text-xs text-muted-foreground">
        Sends a live-updating draft message. Call multiple times with the same Draft ID to animate the text in the user's chat — like an AI typing effect.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Chat / User ID">
          <Inp value={chatId} onChange={setChatId} placeholder="e.g. 123456789" />
        </Field>
        <Field label="Draft ID (reuse to update)">
          <Inp value={draftId} onChange={setDraftId} placeholder="1" type="number" />
        </Field>
      </div>
      <Field label="Message text">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Type message..."
          rows={3}
          className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
        />
      </Field>
      <Btn onClick={send} loading={loading} className="w-full">
        <Send className="h-3.5 w-3.5" />
        Send Draft
      </Btn>
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

function UserAudios() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);

  const fetch_ = async () => {
    if (!userId.trim()) { toast.error("User ID required"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${userId.trim()}/audios`, { headers });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed");
      setResult(data.audios);
      toast.success("Profile audios loaded");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <Section icon={Music2} title="User Profile Audios" description="Fetch audio files on a user's Telegram profile (Bot API 9.5)">
      <Field label="User ID">
        <Inp value={userId} onChange={setUserId} placeholder="e.g. 123456789" />
      </Field>
      <Btn onClick={fetch_} loading={loading} className="w-full">
        <Music2 className="h-3.5 w-3.5" />
        Fetch Audios
      </Btn>
      <Result data={result} />
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
  const [result, setResult] = useState<unknown>(null);

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
          {(result as any).note && <p className="text-amber-500">{(result as any).note}</p>}
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
      toast.success(`Premium granted for ${days} days`);
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
      const data = await af("/admin/premium/invoice", { telegram_id: telegramId.trim(), days: Number(days) });
      toast.success("Invoice created");
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
          {tab !== "revoke" && (
            <Field label="Days">
              <Inp value={days} onChange={setDays} type="number" placeholder="30" />
            </Field>
          )}
          <Btn
            onClick={tab === "grant" ? grant : tab === "revoke" ? revoke : invoice}
            loading={loading}
            variant={tab === "revoke" ? "danger" : "primary"}
            className="w-full"
          >
            {tab === "grant" ? "Grant Premium" : tab === "revoke" ? "Revoke Premium" : "Create Invoice Link"}
          </Btn>
        </>
      )}

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

// ── Tracked Groups ─────────────────────────────────────────────────────────────

type GroupChat = {
  chat_id: string; title: string; chat_type: string;
  bot_is_admin: number; member_count: number; updated_at: string;
};

function TrackedGroups() {
  const af = useAdminFetch();
  const [groups, setGroups] = useState<GroupChat[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { headers } = useApiAuth() as { headers: Record<string, string> };

  const load = async () => {
    setLoading(true);
    try {
      const data = await af("/admin/group-chats");
      setGroups(data.chats ?? []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleTagAll = async (chatId: string) => {
    setActionLoading(`tag-${chatId}`);
    try {
      const data = await af("/admin/chat/tag-all", { chat_id: chatId });
      toast.success(`Sent ${data.chunks_sent} message(s)`);
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
        <button onClick={load} disabled={loading}
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
            <span className="text-[10px] text-muted-foreground">{group.member_count} tracked</span>
            {group.bot_is_admin ? (
              <span className="text-[10px] text-green-600 font-medium">● admin</span>
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

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminBotTools() {
  return (
    <Layout title="Bot Tools">
      <div className="h-full overflow-y-auto px-3 py-4 space-y-2.5">
        <TrackedGroups />
        <BotSetup />
        <BotProfile />
        <LiveDraft />
        <SendPoll />
        <ReactAndPin />
        <StarsTransactions />
        <MemberTag />
        <PromoteMember />
        <UserAudios />
        <FetchGroupMembers />
        <TagAll />
        <ManagePremium />
        <BanAllMembers />
      </div>
    </Layout>
  );
}
