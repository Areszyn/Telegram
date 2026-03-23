import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  RefreshCw, ShieldBan, CheckCircle2, Clock, MessageCircle,
  AlertTriangle, Plus, Trash2, Link2, Loader2, X,
} from "lucide-react";
import { formatShortIST, relativeTime } from "@/lib/date";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { API_BASE } from "@/lib/api";

function useAf() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  return async (path: string, body?: Record<string, unknown>, method?: string) => {
    const m = method ?? (body !== undefined ? "POST" : "GET");
    const res = await fetch(`${API_BASE}${path}`, {
      method: m,
      headers: { ...headers, "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error((data.error as string) ?? `HTTP ${res.status}`);
    return data;
  };
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Btn({ onClick, loading, disabled, children, variant = "primary", className = "" }: {
  onClick: () => void; loading?: boolean; disabled?: boolean;
  children: React.ReactNode; variant?: "primary" | "ghost" | "danger"; className?: string;
}) {
  const base = "flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all disabled:opacity-50";
  const v = { primary: "bg-primary text-primary-foreground", ghost: "border border-border hover:bg-muted", danger: "border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950" };
  return (
    <button onClick={onClick} disabled={loading || disabled} className={cn(base, v[variant], className)}>
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      {children}
    </button>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Log = { id: number; user_id: string; admin_id: string; action: string; scope: string; reason: string | null; created_at: string; first_name?: string; username?: string };
type ModRecord = { user_id: string; status: string; bot_banned: number; app_banned: number; global_banned: number; warnings_count: number; ban_reason: string | null; ban_until: string | null; first_name?: string; username?: string };
type Keyword = { keyword: string; added_at: string };
type WhitelistEntry = { telegram_id: string; added_at: string; first_name?: string; username?: string };

const ACTION_BADGE: Record<string, string> = { ban: "border-red-500/30 bg-red-500/10 text-red-600", warn: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600", restrict: "border-orange-500/30 bg-orange-500/10 text-orange-600", unban: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" };
const avatarColors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500", "bg-pink-500"];
const avatarColor  = (name?: string) => avatarColors[(name?.charCodeAt(0) ?? 0) % avatarColors.length];
const getInitials  = (name?: string) => name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() ?? "?";

// ── Active bans tab ───────────────────────────────────────────────────────────

function ActiveTab({ records, loading, onUnban }: { records: ModRecord[]; loading: boolean; onUnban: (id: string) => void }) {
  const [, navigate] = useLocation();
  if (loading) return <div className="p-4 space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-2xl border p-4 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-48" /></div>)}</div>;
  if (!records.length) return <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3"><ShieldBan className="h-10 w-10 opacity-20" /><p className="text-sm">No active restrictions</p></div>;
  return (
    <div className="p-4 space-y-3">
      {records.map(r => (
        <div key={r.user_id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start gap-3 mb-3">
            <Avatar className={`shrink-0 ${avatarColor(r.first_name)}`}>
              <AvatarFallback className={`text-white font-semibold text-sm ${avatarColor(r.first_name)}`}>{getInitials(r.first_name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{r.first_name ?? r.user_id}</p>
              {r.username && <p className="text-xs text-muted-foreground">@{r.username}</p>}
            </div>
            <div className="flex flex-col gap-1 items-end">
              {r.global_banned ? <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-600 text-[10px]">GLOBAL BAN</Badge> : null}
              {r.bot_banned && !r.global_banned ? <Badge variant="outline" className="border-orange-500/30 bg-orange-500/10 text-orange-600 text-[10px]">BOT BAN</Badge> : null}
              {r.app_banned && !r.global_banned ? <Badge variant="outline" className="border-yellow-500/30 bg-yellow-500/10 text-yellow-600 text-[10px]">APP BAN</Badge> : null}
              {r.status === "restricted" ? <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-600 text-[10px]">RESTRICTED</Badge> : null}
            </div>
          </div>
          {r.ban_reason && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">Reason: {r.ban_reason}</p>}
          {r.warnings_count > 0 && <div className="flex items-center gap-1.5 mb-2"><AlertTriangle className="h-3.5 w-3.5 text-yellow-500" /><p className="text-xs text-yellow-600">{r.warnings_count} warning{r.warnings_count !== 1 ? "s" : ""}</p></div>}
          {r.ban_until && <div className="flex items-center gap-1.5 mb-3"><Clock className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-xs text-muted-foreground">Expires {relativeTime(r.ban_until)}</p></div>}
          <div className="flex gap-2">
            <Btn onClick={() => navigate(`/admin/chat/${r.user_id}`)} variant="ghost" className="flex-1"><MessageCircle className="h-3.5 w-3.5" /> Chat</Btn>
            <Btn onClick={() => onUnban(r.user_id)} variant="ghost" className="flex-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"><CheckCircle2 className="h-3.5 w-3.5" /> Unban</Btn>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Logs tab ──────────────────────────────────────────────────────────────────

function LogsTab({ logs, loading }: { logs: Log[]; loading: boolean }) {
  if (loading) return <div className="p-4 space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex items-center gap-3"><Skeleton className="h-5 w-16 rounded-full" /><div className="flex-1 space-y-1.5"><Skeleton className="h-3.5 w-28" /><Skeleton className="h-3 w-40" /></div></div>)}</div>;
  if (!logs.length) return <div className="py-16 text-center text-muted-foreground text-sm">No actions logged yet.</div>;
  return (
    <div>
      {logs.map((l, i) => (
        <div key={l.id}>
          <div className="flex items-start gap-3 px-4 py-3">
            <Badge variant="outline" className={`${ACTION_BADGE[l.action] ?? ""} uppercase text-[10px] shrink-0 mt-0.5`}>{l.action}</Badge>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{l.first_name ?? l.user_id}{l.username && <span className="text-muted-foreground font-normal ml-1">@{l.username}</span>}</p>
              {l.reason && <p className="text-xs text-muted-foreground truncate">Reason: {l.reason}</p>}
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">{formatShortIST(l.created_at)} · {l.scope ?? "—"}</p>
            </div>
          </div>
          {i < logs.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  );
}

// ── Keywords tab ──────────────────────────────────────────────────────────────

function KeywordsTab() {
  const af = useAf();
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWord, setNewWord] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await af("/admin/spam/keywords");
      setKeywords((d.keywords ?? []) as Keyword[]);
    } catch { toast.error("Failed to load keywords"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    const w = newWord.trim().toLowerCase();
    if (!w) return;
    setAdding(true);
    try {
      await af("/admin/spam/keywords", { keyword: w });
      setNewWord("");
      toast.success(`"${w}" added`);
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setAdding(false); }
  };

  const remove = async (kw: string) => {
    try {
      await af(`/admin/spam/keywords/${encodeURIComponent(kw)}`, undefined, "DELETE");
      setKeywords(p => p.filter(x => x.keyword !== kw));
      toast.success(`"${kw}" removed`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
          Messages containing any blocked keyword will be rejected and the user will receive a warning.
        </p>
      </div>

      {/* Add keyword */}
      <div className="flex gap-2">
        <input
          value={newWord}
          onChange={e => setNewWord(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          placeholder="Add keyword…"
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
        />
        <Btn onClick={add} loading={adding} disabled={!newWord.trim()} className="px-4">
          <Plus className="h-3.5 w-3.5" /> Add
        </Btn>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 rounded-xl" />)}</div>
      ) : keywords.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">No blocked keywords yet</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {keywords.map(({ keyword }) => (
            <div key={keyword} className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-full px-3 py-1">
              <span className="text-xs font-medium text-red-700 dark:text-red-400">{keyword}</span>
              <button onClick={() => remove(keyword)} className="text-red-400 hover:text-red-600 transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mx-auto">
        <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh
      </button>
    </div>
  );
}

// ── Whitelist tab ─────────────────────────────────────────────────────────────

function WhitelistTab() {
  const af = useAf();
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newId, setNewId] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await af("/admin/spam/whitelist");
      setEntries((d.whitelist ?? []) as WhitelistEntry[]);
    } catch { toast.error("Failed to load whitelist"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    const id = newId.trim();
    if (!id) return;
    setAdding(true);
    try {
      await af("/admin/spam/whitelist", { telegram_id: id });
      setNewId("");
      toast.success(`${id} whitelisted`);
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setAdding(false); }
  };

  const remove = async (id: string) => {
    try {
      await af(`/admin/spam/whitelist/${id}`, undefined, "DELETE");
      setEntries(p => p.filter(x => x.telegram_id !== id));
      toast.success("Removed from whitelist");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
        <Link2 className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
          Whitelisted users can send links (http/https/t.me) without being blocked or warned.
        </p>
      </div>

      <div className="flex gap-2">
        <input
          value={newId}
          onChange={e => setNewId(e.target.value)}
          onKeyDown={e => e.key === "Enter" && add()}
          placeholder="Telegram user ID…"
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
        />
        <Btn onClick={add} loading={adding} disabled={!newId.trim()} className="px-4">
          <Plus className="h-3.5 w-3.5" /> Add
        </Btn>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-2xl" />)}</div>
      ) : entries.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-6">No whitelisted users</p>
      ) : (
        <div className="space-y-2">
          {entries.map(e => (
            <div key={e.telegram_id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{e.first_name ?? e.telegram_id}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{e.telegram_id}{e.username ? ` · @${e.username}` : ""}</p>
              </div>
              <button onClick={() => remove(e.telegram_id)} className="text-muted-foreground hover:text-red-500 transition-colors shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={load} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mx-auto">
        <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} /> Refresh
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminModeration() {
  const af = useAf();
  const [logs, setLogs] = useState<Log[]>([]);
  const [records, setRecords] = useState<ModRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { headers } = useApiAuth() as { headers: Record<string, string> };

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/moderation/logs`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/moderation/all`,  { headers }).then(r => r.json()),
    ]).then(([logsData, recordsData]) => {
      if (Array.isArray(logsData))    setLogs(logsData);
      if (Array.isArray(recordsData)) setRecords(recordsData);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUnban = async (telegramId: string) => {
    const toastId = toast.loading("Unbanning…");
    try {
      const res = await fetch(`${API_BASE}/moderation/action`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: telegramId, action: "unban", scope: "global", reason: "" }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (data.ok) { toast.success("User unbanned", { id: toastId }); load(); }
      else toast.error(String(data.error ?? "Failed"), { id: toastId });
    } catch { toast.error("Network error", { id: toastId }); }
  };

  return (
    <Layout title="Moderation">
      <div className="h-full flex flex-col overflow-hidden">
        <Tabs defaultValue="active" className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background gap-2">
            <TabsList className="h-8 flex-1">
              <TabsTrigger value="active"    className="flex-1 text-[11px] h-7">Bans</TabsTrigger>
              <TabsTrigger value="logs"      className="flex-1 text-[11px] h-7">Logs</TabsTrigger>
              <TabsTrigger value="keywords"  className="flex-1 text-[11px] h-7">Keywords</TabsTrigger>
              <TabsTrigger value="whitelist" className="flex-1 text-[11px] h-7">Whitelist</TabsTrigger>
            </TabsList>
            <button onClick={load} className="text-muted-foreground hover:text-foreground shrink-0">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="active"    className="mt-0"><ActiveTab    records={records} loading={loading} onUnban={handleUnban} /></TabsContent>
            <TabsContent value="logs"      className="mt-0"><LogsTab      logs={logs}       loading={loading} /></TabsContent>
            <TabsContent value="keywords"  className="mt-0"><KeywordsTab /></TabsContent>
            <TabsContent value="whitelist" className="mt-0"><WhitelistTab /></TabsContent>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
}
