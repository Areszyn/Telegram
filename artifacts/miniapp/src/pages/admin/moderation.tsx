import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { Loader2, ShieldBan, RefreshCw, ChevronLeft, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "").replace("/miniapp", "") + "/api";

type Log = {
  id: number; user_id: string; admin_id: string;
  action: string; scope: string; reason: string | null;
  created_at: string; first_name?: string; username?: string;
};

type ModRecord = {
  user_id: string; status: string;
  bot_banned: number; app_banned: number; global_banned: number;
  warnings_count: number; ban_reason: string | null; ban_until: string | null;
  first_name?: string; username?: string;
};

const ACTION_COLORS: Record<string, string> = {
  ban:      "bg-red-500/15 text-red-400 border-red-500/25",
  warn:     "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  restrict: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  unban:    "bg-green-500/15 text-green-400 border-green-500/25",
};

export function AdminModeration() {
  const reqOpts = useApiAuth();
  const headers = reqOpts.headers as Record<string, string>;
  const [logs, setLogs] = useState<Log[]>([]);
  const [records, setRecords] = useState<ModRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "logs">("active");
  const [, navigate] = useLocation();

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`${API_BASE}/moderation/logs`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/moderation/all`, { headers }).then(r => r.json()),
    ]).then(([logsData, recordsData]) => {
      if (Array.isArray(logsData)) setLogs(logsData);
      if (Array.isArray(recordsData)) setRecords(recordsData);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleUnban = async (telegramId: string) => {
    await fetch(`${API_BASE}/moderation/action`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: telegramId, action: "unban", scope: "global", reason: "" }),
    });
    load();
  };

  return (
    <Layout title="Moderation">
      <div className="h-full flex flex-col overflow-hidden">

        {/* Tab selector */}
        <div className="flex border-b border-border/50 bg-card">
          {(["active", "logs"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors border-b-2 ${
                tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              }`}>
              {t === "active" ? "Active Restrictions" : "Action Logs"}
            </button>
          ))}
          <button onClick={load} className="px-3 hover:bg-white/5 transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : tab === "active" ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!records.length ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <ShieldBan className="w-10 h-10 mx-auto mb-3 opacity-20" />
                No active restrictions.
              </div>
            ) : records.map(r => (
              <div key={r.user_id} className="bg-card border border-border/50 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{r.first_name ?? r.user_id}</p>
                    {r.username && <p className="text-xs text-muted-foreground">@{r.username}</p>}
                  </div>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {r.global_banned ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/25">GLOBAL</span> : null}
                    {r.bot_banned && !r.global_banned ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/25">BOT</span> : null}
                    {r.app_banned && !r.global_banned ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">APP</span> : null}
                    {r.status === "restricted" ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/25">RESTRICTED</span> : null}
                  </div>
                </div>
                {r.ban_reason && <p className="text-xs text-muted-foreground mb-2">Reason: {r.ban_reason}</p>}
                {r.warnings_count > 0 && (
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />
                    <p className="text-xs text-yellow-400">{r.warnings_count} warning{r.warnings_count !== 1 ? "s" : ""}</p>
                  </div>
                )}
                {r.ban_until && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Expires {formatDistanceToNow(new Date(r.ban_until), { addSuffix: true })}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/admin/chat/${r.user_id}`)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 transition-colors">
                    Open Chat
                  </button>
                  <button onClick={() => handleUnban(r.user_id)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Unban
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-border/30">
            {!logs.length ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No actions logged yet.</div>
            ) : logs.map(l => (
              <div key={l.id} className="px-4 py-3 flex items-start gap-3">
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase shrink-0 mt-0.5 ${ACTION_COLORS[l.action] ?? "bg-muted text-muted-foreground border-border/50"}`}>
                  {l.action}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{l.first_name ?? l.user_id} {l.username ? `@${l.username}` : ""}</p>
                  {l.reason && <p className="text-xs text-muted-foreground truncate">Reason: {l.reason}</p>}
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {format(new Date(l.created_at), "MMM d · HH:mm")} · scope: {l.scope ?? "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
