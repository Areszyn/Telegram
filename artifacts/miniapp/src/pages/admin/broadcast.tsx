import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { useBroadcastMessage } from "@workspace/api-client-react";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Radio, Send, Calendar, Clock, Trash2, Loader2,
  Users, CheckCircle2, RefreshCw, Bell,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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

function Btn({
  onClick, loading, disabled, children, variant = "primary", className = "",
}: {
  onClick?: () => void; loading?: boolean; disabled?: boolean;
  children: React.ReactNode; variant?: "primary" | "ghost" | "danger"; className?: string;
}) {
  const base = "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50";
  const v = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    ghost: "border border-border hover:bg-muted",
    danger: "border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950",
  };
  return (
    <button onClick={onClick} disabled={loading || disabled} className={cn(base, v[variant], className)}>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

// ── Instant Broadcast ─────────────────────────────────────────────────────────

function InstantTab() {
  const reqOpts = useApiAuth();
  const [text, setText] = useState("");
  const broadcastMut = useBroadcastMessage({
    request: reqOpts,
    mutation: {
      onSuccess: (res: { sent: number; total: number }) => {
        toast.success(`Broadcast sent to ${res.sent} of ${res.total} users`);
        setText("");
      },
      onError: () => toast.error("Failed to send broadcast"),
    },
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border">
        <Radio className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Sends immediately to all users who have interacted with the bot.
        </p>
      </div>
      <Textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type your announcement here…"
        className="min-h-[160px] resize-none text-[15px]"
      />
      <p className="text-xs text-muted-foreground text-right">{text.length} characters</p>
      <Btn
        onClick={() => broadcastMut.mutate({ data: { text: text.trim() } })}
        disabled={!text.trim() || broadcastMut.isPending}
        loading={broadcastMut.isPending}
        className="w-full"
      >
        <Send className="h-4 w-4" />
        {broadcastMut.isPending ? "Sending…" : "Send to All Users"}
      </Btn>
    </div>
  );
}

// ── Scheduled Broadcasts ──────────────────────────────────────────────────────

type ScheduledItem = { id: number; message: string; scheduled_at: string; sent: number; created_at: string };

function ScheduledTab() {
  const af = useAf();
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await af("/admin/spam/scheduled");
      setItems((d.scheduled ?? []) as ScheduledItem[]);
    } catch { toast.error("Failed to load scheduled broadcasts"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!text.trim() || !date || !time) { toast.error("Fill in message, date and time"); return; }
    setSaving(true);
    try {
      await af("/admin/spam/scheduled", { message: text.trim(), scheduled_at: `${date} ${time}:00` });
      toast.success("Broadcast scheduled");
      setText(""); setDate(""); setTime("");
      load();
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    try {
      await af(`/admin/spam/scheduled/${id}`, undefined, "DELETE");
      setItems(p => p.filter(x => x.id !== id));
      toast.success("Removed");
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Create form */}
      <div className="space-y-3 p-4 rounded-2xl border border-border bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Scheduled Broadcast</p>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Your broadcast message…"
          rows={4}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
        />
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Date (UTC)</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Time (UTC)</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
        </div>
        <Btn onClick={create} loading={saving} disabled={!text.trim() || !date || !time} className="w-full">
          <Calendar className="h-3.5 w-3.5" /> Schedule Broadcast
        </Btn>
      </div>

      {/* List */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Scheduled Queue</p>
        <button onClick={load} className="text-muted-foreground hover:text-foreground">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {loading && items.length === 0 && (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">No scheduled broadcasts</div>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className={cn(
            "rounded-2xl border p-3 space-y-1.5",
            item.sent ? "border-border/50 opacity-60 bg-muted/10" : "border-border bg-card",
          )}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-mono text-muted-foreground">#{item.id}</p>
              <div className="flex items-center gap-2">
                {item.sent
                  ? <span className="text-[10px] text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Sent</span>
                  : <span className="text-[10px] text-orange-500 flex items-center gap-1"><Clock className="h-3 w-3" />Pending</span>
                }
                {!item.sent && (
                  <button onClick={() => remove(item.id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-foreground line-clamp-2">{item.message}</p>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {item.scheduled_at} UTC
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Re-engagement ─────────────────────────────────────────────────────────────

function ReengageTab() {
  const af = useAf();
  const [days, setDays] = useState("3");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ sent: number; total: number } | null>(null);

  const notify = async () => {
    setLoading(true);
    try {
      const d = await af("/admin/spam/notify-inactive", { days: parseInt(days) || 3 });
      setResult({ sent: d.sent as number, total: d.total as number });
      toast.success(`Re-engagement messages sent to ${d.sent} users`);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/40 border border-border">
        <Bell className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Sends a friendly nudge to users who haven't sent a message in the specified number of days. Excludes banned users.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Inactive for more than (days)
        </label>
        <div className="flex gap-2 items-center">
          {["1", "3", "7", "14", "30"].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors",
                days === d ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted",
              )}>
              {d}d
            </button>
          ))}
          <input
            type="number" value={days} onChange={e => setDays(e.target.value)}
            min="1" max="365"
            className="w-16 rounded-xl border border-border bg-background px-2 py-1.5 text-xs text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      <Btn onClick={notify} loading={loading} className="w-full">
        <Users className="h-4 w-4" />
        Send Re-engagement Messages
      </Btn>

      {result && (
        <div className={cn(
          "rounded-xl p-3 border text-center",
          result.sent > 0 ? "border-green-200 bg-green-50 dark:bg-green-950/30" : "border-border bg-muted/20",
        )}>
          <p className="text-sm font-semibold">{result.sent} / {result.total} sent</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {result.total === 0 ? "No inactive users found" : `${result.total - result.sent} failed (blocked/deleted)`}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminBroadcast() {
  return (
    <Layout title="Broadcast">
      <div className="h-full overflow-y-auto">
        <Tabs defaultValue="instant" className="h-full flex flex-col">
          <div className="border-b border-border px-4 py-2">
            <TabsList className="h-8 w-full">
              <TabsTrigger value="instant"   className="flex-1 text-xs h-7"><Radio className="h-3 w-3 mr-1" />Instant</TabsTrigger>
              <TabsTrigger value="scheduled" className="flex-1 text-xs h-7"><Calendar className="h-3 w-3 mr-1" />Scheduled</TabsTrigger>
              <TabsTrigger value="reengage"  className="flex-1 text-xs h-7"><Bell className="h-3 w-3 mr-1" />Re-engage</TabsTrigger>
            </TabsList>
          </div>
          <div className="flex-1 overflow-y-auto">
            <TabsContent value="instant"   className="mt-0 h-full"><InstantTab /></TabsContent>
            <TabsContent value="scheduled" className="mt-0 h-full"><ScheduledTab /></TabsContent>
            <TabsContent value="reengage"  className="mt-0 h-full"><ReengageTab /></TabsContent>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
}
