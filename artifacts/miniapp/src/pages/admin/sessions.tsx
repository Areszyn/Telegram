import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  KeyRound, Loader2, RefreshCw, Info, MessageSquare, LogOut,
  User, Lock, Send, Settings2, ChevronDown, ChevronUp, Plus,
} from "lucide-react";

import { API_BASE } from "@/lib/api";

// ── Tiny helpers ───────────────────────────────────────────────────────────────

function useFetch() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  return async (path: string, body?: Record<string, unknown>, method = body !== undefined ? "POST" : "GET") => {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: { ...headers, "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error((data.error as string) ?? `HTTP ${res.status}`);
    return data;
  };
}

function Inp({
  label, value, onChange, placeholder, type = "text", mono = false,
}: {
  label?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      {label && <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>}
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className={cn(
          "w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground",
          mono && "font-mono",
        )}
      />
    </div>
  );
}

function Textarea({
  label, value, onChange, placeholder, rows = 3,
}: {
  label?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <div className="space-y-1">
      {label && <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>}
      <textarea
        value={value} placeholder={placeholder} rows={rows}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground resize-none"
      />
    </div>
  );
}

function Btn({
  onClick, loading, disabled, children, variant = "primary", className = "",
}: {
  onClick: () => void; loading?: boolean; disabled?: boolean;
  children: React.ReactNode; variant?: "primary" | "ghost" | "danger"; className?: string;
}) {
  const base = "flex items-center justify-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50";
  const v = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost: "border border-border hover:bg-muted",
    danger: "border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950",
  };
  return (
    <button onClick={onClick} disabled={loading || disabled} className={cn(base, v[variant], className)}>
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      {children}
    </button>
  );
}

type Panel = "info" | "chats" | "profile" | "password" | "send" | "chat";

type SessionRow = {
  id: number; telegram_id: string; phone: string | null;
  first_name: string | null; username: string | null;
  account_id: string | null; status: string;
  created_at: string; last_used: string;
};

// ── Panel: Account Info ────────────────────────────────────────────────────────
function InfoPanel({ sessionId, af }: { sessionId: number; af: ReturnType<typeof useFetch> }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    af(`/sessions/${sessionId}/info`)
      .then(d => setData(d.info as Record<string, unknown>))
      .catch(e => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (!data) return null;
  return (
    <div className="space-y-1">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex justify-between text-xs gap-4 py-0.5">
          <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
          <span className="font-mono">{String(v)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Panel: Recent Chats ────────────────────────────────────────────────────────
function ChatsPanel({ sessionId, af }: { sessionId: number; af: ReturnType<typeof useFetch> }) {
  const [chats, setChats] = useState<Array<{ id: string; name: string; type: string; unread: number }> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    af(`/sessions/${sessionId}/chats`)
      .then(d => setChats((d.chats ?? []) as Array<{ id: string; name: string; type: string; unread: number }>))
      .catch(e => toast.error(e instanceof Error ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>;
  if (!chats) return null;
  return (
    <div className="max-h-44 overflow-y-auto space-y-1">
      {chats.length === 0 && <p className="text-xs text-muted-foreground">No chats found</p>}
      {chats.map((c, i) => (
        <div key={i} className="flex items-center justify-between text-xs gap-2 py-0.5">
          <div className="min-w-0">
            <span className="truncate">{c.name ?? "Unknown"}</span>
            <span className="text-muted-foreground ml-1 capitalize">({c.type})</span>
            {c.id && <span className="text-muted-foreground ml-1 font-mono text-[10px]">{c.id}</span>}
          </div>
          {c.unread > 0 && (
            <span className="bg-primary text-primary-foreground text-[9px] px-1.5 py-0.5 rounded-full shrink-0">{c.unread}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Panel: Edit Profile ────────────────────────────────────────────────────────
function ProfilePanel({ sessionId, session, af }: {
  sessionId: number; session: SessionRow; af: ReturnType<typeof useFetch>;
}) {
  const [firstName, setFirstName] = useState(session.first_name ?? "");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState(session.username ?? "");
  const [about, setAbout] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await af(`/sessions/${sessionId}/account/update`, {
        first_name: firstName, last_name: lastName, username, about,
      });
      toast.success("Profile updated");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        <Inp label="First Name" value={firstName} onChange={setFirstName} placeholder="John" />
        <Inp label="Last Name" value={lastName} onChange={setLastName} placeholder="Doe" />
      </div>
      <Inp label="Username" value={username} onChange={setUsername} placeholder="@username" />
      <Textarea label="Bio / About" value={about} onChange={setAbout} placeholder="Bio text..." rows={2} />
      <Btn onClick={save} loading={loading} className="w-full">Save Profile</Btn>
    </div>
  );
}

// ── Panel: Change Password ─────────────────────────────────────────────────────
function PasswordPanel({ sessionId, af }: { sessionId: number; af: ReturnType<typeof useFetch> }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      await af(`/sessions/${sessionId}/password`, {
        current_password: current || undefined,
        new_password: next,
        hint,
      });
      toast.success(next ? "Password changed" : "Password removed");
      setCurrent(""); setNext(""); setHint("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-2.5">
      <Inp label="Current Password (if set)" value={current} onChange={setCurrent} placeholder="Leave blank if none" type="password" />
      <Inp label="New Password" value={next} onChange={setNext} placeholder="New password (blank to remove)" type="password" />
      <Inp label="Hint (optional)" value={hint} onChange={setHint} placeholder="Password hint" />
      <Btn onClick={save} loading={loading} disabled={!next && !current} className="w-full">
        {next ? "Change Password" : "Remove Password"}
      </Btn>
    </div>
  );
}

// ── Panel: Send Message ────────────────────────────────────────────────────────
function SendPanel({ sessionId, af }: { sessionId: number; af: ReturnType<typeof useFetch> }) {
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    setLoading(true);
    try {
      await af(`/sessions/${sessionId}/send`, { to: to.trim(), text: text.trim() });
      toast.success("Message sent");
      setText("");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-2.5">
      <Inp label="Recipient (@username, user ID, or chat ID)" value={to} onChange={setTo} placeholder="@username or 123456789" />
      <Textarea label="Message" value={text} onChange={setText} placeholder="Type your message..." />
      <Btn onClick={send} loading={loading} disabled={!to.trim() || !text.trim()} className="w-full">
        <Send className="h-3 w-3" /> Send Message
      </Btn>
    </div>
  );
}

// ── Panel: Edit Group / Channel ────────────────────────────────────────────────
function ChatEditPanel({ sessionId, af }: { sessionId: number; af: ReturnType<typeof useFetch> }) {
  const [chatId, setChatId] = useState("");
  const [title, setTitle] = useState("");
  const [about, setAbout] = useState("");
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true);
    try {
      const d = await af(`/sessions/${sessionId}/chat`, {
        chat_id: chatId.trim(),
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(about !== "" ? { about: about.trim() } : {}),
      });
      const results = (d.results as string[] | undefined) ?? [];
      toast.success(results.join(", ") || "Updated");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-2.5">
      <Inp label="Group / Channel ID or @username" value={chatId} onChange={setChatId}
        placeholder="-100123456789 or @groupname" mono />
      <Inp label="New Title (optional)" value={title} onChange={setTitle} placeholder="Group title" />
      <Textarea label="New Description (optional)" value={about} onChange={setAbout} placeholder="Group description..." rows={2} />
      <Btn onClick={save} loading={loading} disabled={!chatId.trim() || (!title.trim() && about === "")} className="w-full">
        <Settings2 className="h-3 w-3" /> Apply Changes
      </Btn>
    </div>
  );
}

// ── Session Card ───────────────────────────────────────────────────────────────
const PANELS: { key: Panel; label: string; icon: React.ElementType }[] = [
  { key: "info",     label: "Info",     icon: Info         },
  { key: "chats",    label: "Chats",    icon: MessageSquare },
  { key: "profile",  label: "Profile",  icon: User         },
  { key: "password", label: "Password", icon: Lock         },
  { key: "send",     label: "Send",     icon: Send         },
  { key: "chat",     label: "Edit Chat",icon: Settings2    },
];

function SessionCard({
  session, af, onLogout,
}: { session: SessionRow; af: ReturnType<typeof useFetch>; onLogout: () => void }) {
  const [open, setOpen] = useState<Panel | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const toggle = (key: Panel) => setOpen(p => p === key ? null : key);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await af(`/sessions/${session.id}`, undefined, "DELETE");
      toast.success("Session removed");
      onLogout();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoggingOut(false); }
  };

  const displayName = session.first_name
    ? `${session.first_name}${session.username ? ` @${session.username}` : ""}`
    : session.phone ?? "Unknown";

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{displayName}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{session.phone ?? "—"}</p>
          {session.account_id && (
            <p className="text-[10px] font-mono text-muted-foreground">TG: {session.account_id}</p>
          )}
          <p className="text-[10px] text-muted-foreground">
            Added by <span className="font-mono">{session.telegram_id}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-[10px] bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full">active</span>
          <Btn onClick={logout} loading={loggingOut} variant="danger" className="text-[10px] px-2 py-1">
            <LogOut className="h-2.5 w-2.5" /> Remove
          </Btn>
        </div>
      </div>

      {/* Action tabs */}
      <div className="border-t border-border flex overflow-x-auto">
        {PANELS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => toggle(key)}
            className={cn(
              "flex-none flex flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-medium transition-colors border-b-2",
              open === key
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}>
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      {open && (
        <div className="p-4 border-t border-border bg-muted/20">
          {open === "info"     && <InfoPanel     sessionId={session.id} af={af} />}
          {open === "chats"    && <ChatsPanel    sessionId={session.id} af={af} />}
          {open === "profile"  && <ProfilePanel  sessionId={session.id} session={session} af={af} />}
          {open === "password" && <PasswordPanel sessionId={session.id} af={af} />}
          {open === "send"     && <SendPanel     sessionId={session.id} af={af} />}
          {open === "chat"     && <ChatEditPanel sessionId={session.id} af={af} />}
        </div>
      )}
    </div>
  );
}

// ── OTP Add-Session form ───────────────────────────────────────────────────────
function AddSession({ af, onDone }: { af: ReturnType<typeof useFetch>; onDone: () => void }) {
  const [step, setStep] = useState<"phone" | "code" | "twofa">("phone");
  const [phone, setPhone] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [code, setCode] = useState("");
  const [twofa, setTwofa] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => { setStep("phone"); setPhone(""); setPendingId(""); setCode(""); setTwofa(""); };

  const sendCode = async () => {
    setLoading(true);
    try {
      const d = await af("/sessions/auth/start", { phone: phone.trim() });
      setPendingId(d.pending_id as string);
      setStep("code");
      toast.success(`Code sent to ${phone}`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  const verify = async (password?: string) => {
    setLoading(true);
    try {
      const body: Record<string, unknown> = { pending_id: pendingId, code: code.trim() };
      if (password) body.password = password;
      const d = await af("/sessions/auth/verify", body);
      if (d.needs_password) { setStep("twofa"); toast("2FA password required"); }
      else {
        toast.success(`Session saved — ${d.first_name ?? ""}${d.username ? ` @${d.username}` : ""}`);
        reset(); onDone();
      }
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-semibold">
        {step === "phone" ? "Add Session — Phone" : step === "code" ? `Enter Code (${phone})` : "2FA Password"}
      </p>

      {step === "phone" && (
        <>
          <Inp value={phone} onChange={setPhone} placeholder="+1234567890" type="tel" />
          <div className="flex gap-2">
            <Btn onClick={sendCode} loading={loading} disabled={!phone.trim()} className="flex-1">Send Code</Btn>
          </div>
        </>
      )}
      {step === "code" && (
        <>
          <Inp value={code} onChange={setCode} placeholder="123456" />
          <div className="flex gap-2">
            <Btn onClick={() => verify()} loading={loading} disabled={!code.trim()} className="flex-1">Verify</Btn>
            <Btn onClick={reset} variant="ghost" className="px-4">Cancel</Btn>
          </div>
        </>
      )}
      {step === "twofa" && (
        <>
          <Inp value={twofa} onChange={setTwofa} placeholder="2FA password" type="password" />
          <div className="flex gap-2">
            <Btn onClick={() => verify(twofa)} loading={loading} disabled={!twofa.trim()} className="flex-1">Submit</Btn>
            <Btn onClick={reset} variant="ghost" className="px-4">Cancel</Btn>
          </div>
        </>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export function AdminSessions() {
  const af = useFetch();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await af("/sessions");
      setSessions((d.sessions ?? []) as SessionRow[]);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  return (
    <Layout title="String Sessions">
      <div className="h-full overflow-y-auto px-3 py-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">
              {sessions.length} active session{sessions.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
            <button onClick={() => setShowAdd(s => !s)}
              className="flex items-center gap-1 text-xs text-primary hover:underline font-medium">
              <Plus className="h-3 w-3" />{showAdd ? "Cancel" : "Add Session"}
            </button>
          </div>
        </div>

        {/* Add form */}
        {showAdd && <AddSession af={af} onDone={() => { setShowAdd(false); load(); }} />}

        {/* Loading */}
        {loading && sessions.length === 0 && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty */}
        {!loading && sessions.length === 0 && !showAdd && (
          <div className="text-center py-10 text-muted-foreground">
            <KeyRound className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No sessions yet</p>
            <p className="text-xs mt-1">Add a session to enable MTProto features</p>
          </div>
        )}

        {/* Session cards */}
        {sessions.map(s => (
          <SessionCard key={s.id} session={s} af={af}
            onLogout={() => setSessions(prev => prev.filter(x => x.id !== s.id))}
          />
        ))}
      </div>
    </Layout>
  );
}
