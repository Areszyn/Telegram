import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  KeyRound, Loader2, RefreshCw, Info, MessageSquare, LogOut, ChevronDown, ChevronUp,
} from "lucide-react";

import { API_BASE } from "@/lib/api";

// ── Small helpers ──────────────────────────────────────────────────────────────

function useFetch() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  return async (path: string, body?: Record<string, unknown>) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: body !== undefined ? "POST" : "GET",
      headers: { ...headers, "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error((data.error as string) ?? `HTTP ${res.status}`);
    return data;
  };
}

function useDelete() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  return async (path: string) => {
    const res = await fetch(`${API_BASE}${path}`, { method: "DELETE", headers });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error((data.error as string) ?? `HTTP ${res.status}`);
    return data;
  };
}

function Inp({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
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
  const base = "flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50";
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    ghost: "border border-border hover:bg-muted text-foreground",
    danger: "border border-white/15 text-white/40 hover:bg-white/5",
  };
  return (
    <button onClick={onClick} disabled={loading || disabled} className={cn(base, variants[variant], className)}>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

type SessionRow = {
  id: number; telegram_id: string; phone: string | null;
  first_name: string | null; username: string | null; account_id: string | null;
  status: string; created_at: string; last_used: string;
};

// ── Session card ───────────────────────────────────────────────────────────────

function SessionCard({
  session, onLogout, af, del,
}: {
  session: SessionRow;
  onLogout: () => void;
  af: ReturnType<typeof useFetch>;
  del: ReturnType<typeof useDelete>;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [info, setInfo] = useState<Record<string, unknown> | null>(null);
  const [chats, setChats] = useState<Array<{ name: string; type: string; unread: number }> | null>(null);
  const [panelLoading, setPanelLoading] = useState<"info" | "chats" | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = session.first_name
    ? `${session.first_name}${session.username ? ` @${session.username}` : ""}`
    : session.phone ?? "Session";

  const toggleInfo = async () => {
    if (infoOpen) { setInfoOpen(false); return; }
    setInfoOpen(true); setChatsOpen(false);
    if (info) return;
    setPanelLoading("info");
    try {
      const d = await af(`/sessions/${session.id}/info`);
      setInfo(d.info as Record<string, unknown>);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); setInfoOpen(false); }
    finally { setPanelLoading(null); }
  };

  const toggleChats = async () => {
    if (chatsOpen) { setChatsOpen(false); return; }
    setChatsOpen(true); setInfoOpen(false);
    if (chats) return;
    setPanelLoading("chats");
    try {
      const d = await af(`/sessions/${session.id}/chats`);
      setChats((d.chats ?? []) as Array<{ name: string; type: string; unread: number }>);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); setChatsOpen(false); }
    finally { setPanelLoading(null); }
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await del(`/sessions/${session.id}`);
      toast.success("Session removed");
      onLogout();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoggingOut(false); }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{displayName}</p>
          {session.phone && <p className="text-xs text-muted-foreground mt-0.5">{session.phone}</p>}
          {session.account_id && (
            <p className="text-xs text-muted-foreground font-mono">ID: {session.account_id}</p>
          )}
        </div>
        <span className="text-xs bg-white/5 text-white/50 px-2.5 py-1 rounded-full font-medium shrink-0">
          Active
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={toggleInfo} className={cn(
          "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors",
          infoOpen ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted",
        )}>
          {panelLoading === "info" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Info className="h-3 w-3" />}
          Account Info
          {infoOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <button onClick={toggleChats} className={cn(
          "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors",
          chatsOpen ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted",
        )}>
          {panelLoading === "chats" ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageSquare className="h-3 w-3" />}
          Recent Chats
          {chatsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <Btn onClick={logout} loading={loggingOut} variant="danger" className="text-xs px-3 py-1.5">
          <LogOut className="h-3 w-3" />
          Remove
        </Btn>
      </div>

      {infoOpen && info && (
        <div className="rounded-xl bg-muted/40 border border-border p-3 space-y-1.5">
          {Object.entries(info).map(([k, v]) => (
            <div key={k} className="flex justify-between text-xs gap-4">
              <span className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</span>
              <span className="font-mono">{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {chatsOpen && chats && (
        <div className="rounded-xl bg-muted/40 border border-border p-3 space-y-1.5 max-h-52 overflow-y-auto">
          {chats.length === 0 && <p className="text-xs text-muted-foreground">No chats found</p>}
          {chats.map((c, i) => (
            <div key={i} className="flex items-center justify-between text-xs gap-2">
              <div className="min-w-0">
                <span className="truncate">{c.name ?? "Unknown"}</span>
                <span className="text-muted-foreground ml-1 capitalize">({c.type})</span>
              </div>
              {c.unread > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full shrink-0">
                  {c.unread}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function UserSessionPage() {
  const af = useFetch();
  const del = useDelete();

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // OTP flow state
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [code, setCode] = useState("");
  const [twofa, setTwofa] = useState("");
  const [step, setStep] = useState<"credentials" | "phone" | "code" | "twofa">("credentials");
  const [otpLoading, setOtpLoading] = useState(false);

  const load = async () => {
    setListLoading(true);
    try {
      const d = await af("/sessions");
      setSessions((d.sessions ?? []) as SessionRow[]);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to load"); }
    finally { setListLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const reset = () => {
    setStep("credentials");
    setPhone(""); setPendingId(""); setCode(""); setTwofa("");
  };

  const sendCode = async () => {
    if (!apiId.trim() || !apiHash.trim()) { toast.error("Enter your API ID and API Hash first"); return; }
    if (!phone.trim()) { toast.error("Enter your phone number"); return; }
    setOtpLoading(true);
    try {
      const d = await af("/sessions/auth/start", {
        phone: phone.trim(),
        api_id: parseInt(apiId.trim(), 10),
        api_hash: apiHash.trim(),
      });
      setPendingId(d.pending_id as string);
      setStep("code");
      toast.success(`Code sent to ${phone}`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setOtpLoading(false); }
  };

  const verify = async (password?: string) => {
    setOtpLoading(true);
    try {
      const body: Record<string, unknown> = { pending_id: pendingId, code: code.trim() };
      if (password) body.password = password;
      const d = await af("/sessions/auth/verify", body);
      if (d.needs_password) {
        setStep("twofa");
        toast("2FA password required");
      } else {
        toast.success(`Session saved — ${d.first_name ?? ""}${d.username ? ` @${d.username}` : ""}`);
        if (d.session_string) {
          toast(`Session String: ${d.session_string}`, { duration: 10000 });
        }
        reset();
        load();
      }
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Verification failed"); }
    finally { setOtpLoading(false); }
  };

  const hasSession = sessions.length > 0;

  return (
    <Layout title="Session Setup">
      <div className="h-full overflow-y-auto px-4 py-5 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">MTProto Session</h2>
              <p className="text-xs text-muted-foreground">Enables full member access for ban operations</p>
            </div>
          </div>
          <button onClick={load} disabled={listLoading} className="text-muted-foreground hover:text-foreground">
            <RefreshCw className={cn("h-4 w-4", listLoading && "animate-spin")} />
          </button>
        </div>

        {/* Active sessions */}
        {listLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasSession ? (
          <div className="space-y-3">
            {sessions.map(s => (
              <SessionCard key={s.id} session={s} af={af} del={del}
                onLogout={() => setSessions(prev => prev.filter(x => x.id !== s.id))}
              />
            ))}
          </div>
        ) : null}

        {/* Setup form — show if no session or always allow adding more */}
        {!hasSession && (
          <>
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
              <div className="space-y-0.5">
                <p className="text-sm font-semibold">Add Your Session</p>
                <p className="text-xs text-muted-foreground">
                  Get your API ID and Hash from{" "}
                  <a href="https://my.telegram.org" target="_blank" rel="noreferrer"
                    className="text-primary underline underline-offset-2">my.telegram.org</a>
                  {" "}→ API Development Tools
                </p>
              </div>

              {/* Step: credentials */}
              {step === "credentials" && (
                <div className="space-y-3">
                  <Inp label="API ID" value={apiId} onChange={setApiId} placeholder="12345678" />
                  <Inp label="API Hash" value={apiHash} onChange={setApiHash} placeholder="abcdef1234..." />
                  <Inp label="Phone Number" value={phone} onChange={setPhone} placeholder="+1234567890" type="tel" />
                  <Btn onClick={sendCode} loading={otpLoading}
                    disabled={!apiId.trim() || !apiHash.trim() || !phone.trim()}
                    className="w-full">
                    Send Code
                  </Btn>
                </div>
              )}

              {/* Step: code */}
              {step === "code" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Telegram sent a code to <span className="font-medium text-foreground">{phone}</span>
                  </p>
                  <Inp label="Verification Code" value={code} onChange={setCode} placeholder="12345" />
                  <div className="flex gap-2">
                    <Btn onClick={() => verify()} loading={otpLoading} disabled={!code.trim()} className="flex-1">
                      Verify
                    </Btn>
                    <Btn onClick={reset} variant="ghost" className="px-4">Cancel</Btn>
                  </div>
                </div>
              )}

              {/* Step: 2FA */}
              {step === "twofa" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    This account has Two-Step Verification enabled.
                  </p>
                  <Inp label="2FA Password" value={twofa} onChange={setTwofa} placeholder="Your password" type="password" />
                  <div className="flex gap-2">
                    <Btn onClick={() => verify(twofa)} loading={otpLoading} disabled={!twofa.trim()} className="flex-1">
                      Submit
                    </Btn>
                    <Btn onClick={reset} variant="ghost" className="px-4">Cancel</Btn>
                  </div>
                </div>
              )}
            </div>

            {/* Info box */}
            <div className="rounded-2xl bg-muted/40 border border-border p-4 space-y-2">
              <p className="text-xs font-semibold">Why is this needed?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The Telegram Bot API cannot list all group members. By adding your own account session,
                ban-all can fetch the full member list and ban everyone — not just tracked users.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your session is stored securely and only used when you trigger a ban in your group.
              </p>
            </div>
          </>
        )}

        {hasSession && (
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              Session active — ban-all will use it for full member access.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
