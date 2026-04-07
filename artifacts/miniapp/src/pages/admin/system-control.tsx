import { useState, useEffect, useRef, useCallback } from "react";
import { Layout } from "@/components/layout";
import { useApiAuth } from "@/lib/telegram-context";
import { API_BASE } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  RotateCcw, Activity, CheckCircle, XCircle, AlertTriangle,
  Loader2, Trash2, Filter, Pause, Play, Clock, Server,
  Database, Bot, Globe, Wifi, Shield, ChevronDown,
} from "lucide-react";

type LogEntry = {
  id: number;
  level: string;
  source: string;
  message: string;
  method?: string;
  path?: string;
  status?: number;
  latency_ms?: number;
  ip?: string;
  extra?: string;
  created_at: string;
};

type RestartResult = {
  step: string;
  ok: boolean;
  error?: string;
  details?: Record<string, unknown>;
};

type LogStats = {
  total: number;
  errors: number;
  warnings: number;
  today: number;
};

const LEVEL_STYLES: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  info:    { bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-400", icon: Activity },
  success: { bg: "bg-green-500/10 border-green-500/20", text: "text-green-400", icon: CheckCircle },
  warn:    { bg: "bg-yellow-500/10 border-yellow-500/20", text: "text-yellow-400", icon: AlertTriangle },
  error:   { bg: "bg-red-500/10 border-red-500/20", text: "text-red-400", icon: XCircle },
};

const STEP_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "Database schema": Database,
  "Webhook setup": Globe,
  "Bot API": Bot,
  "Database connection": Database,
  "MTProto backend": Server,
};

export function SystemControl() {
  const { headers } = useApiAuth() as { headers: Record<string, string> };
  const [restarting, setRestarting] = useState(false);
  const [restartResults, setRestartResults] = useState<RestartResult[] | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [liveMode, setLiveMode] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [clearing, setClearing] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastIdRef = useRef<number>(0);

  const fetchLogs = useCallback(async (append = false) => {
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (levelFilter !== "all") params.set("level", levelFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      const res = await fetch(`${API_BASE}/admin/system/logs?${params}`, { headers });
      if (!res.ok) return;
      const data = await res.json() as { logs: LogEntry[] };
      const sorted = (data.logs || []).sort((a, b) => a.id - b.id);
      if (append && sorted.length > 0) {
        const newLogs = sorted.filter(l => l.id > lastIdRef.current);
        if (newLogs.length > 0) {
          setLogs(prev => {
            const combined = [...prev, ...newLogs];
            return combined.slice(-500);
          });
        }
      } else {
        setLogs(sorted);
      }
      if (sorted.length > 0) {
        lastIdRef.current = sorted[sorted.length - 1].id;
      }
    } catch {}
  }, [headers, levelFilter, sourceFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/system/logs/stats`, { headers });
      if (!res.ok) return;
      const data = await res.json() as LogStats;
      setStats(data);
    } catch {}
  }, [headers]);

  useEffect(() => {
    lastIdRef.current = 0;
    fetchLogs(false);
    fetchStats();
  }, [levelFilter, sourceFilter]);

  useEffect(() => {
    if (liveMode) {
      pollRef.current = setInterval(() => {
        fetchLogs(true);
        fetchStats();
      }, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [liveMode, fetchLogs, fetchStats]);

  useEffect(() => {
    if (liveMode && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, liveMode]);

  const handleRestart = async () => {
    setRestarting(true);
    setRestartResults(null);
    try {
      const res = await fetch(`${API_BASE}/admin/system/restart`, {
        method: "POST",
        headers,
      });
      const data = await res.json() as { results: RestartResult[] };
      setRestartResults(data.results || []);
      setTimeout(() => {
        fetchLogs(false);
        fetchStats();
      }, 1000);
    } catch (e) {
      setRestartResults([{ step: "Network", ok: false, error: e instanceof Error ? e.message : "Failed" }]);
    } finally {
      setRestarting(false);
    }
  };

  const handleClearLogs = async () => {
    setClearing(true);
    try {
      await fetch(`${API_BASE}/admin/system/logs`, { method: "DELETE", headers });
      setLogs([]);
      lastIdRef.current = 0;
      fetchStats();
    } catch {}
    setClearing(false);
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso + "Z");
      return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch { return iso; }
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso + "Z");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch { return ""; }
  };

  return (
    <Layout title="System Control" showBack>
      <div className="space-y-4 pb-6">

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-foreground/70" />
              <h2 className="font-semibold text-sm">System Restart</h2>
            </div>
            <button
              onClick={handleRestart}
              disabled={restarting}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50 transition-all"
            >
              {restarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              {restarting ? "Restarting..." : "Restart All"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Re-initializes database schema, sets up webhook, verifies Bot API, checks DB connection, pings MTProto backend, and cleans old logs.
          </p>

          {restartResults && (
            <div className="space-y-2 mt-3">
              {restartResults.map((r, i) => {
                const Icon = STEP_ICONS[r.step] || Server;
                return (
                  <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border ${r.ok ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                    <Icon className={`w-4 h-4 shrink-0 ${r.ok ? "text-green-400" : "text-red-400"}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium">{r.step}</span>
                      {r.error && <p className="text-[10px] text-red-400 mt-0.5 truncate">{r.error}</p>}
                      {r.details && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{JSON.stringify(r.details)}</p>}
                    </div>
                    {r.ok ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  </div>
                );
              })}
              <div className={`text-center text-xs font-medium mt-2 py-1.5 rounded-lg ${restartResults.every(r => r.ok) ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                {restartResults.filter(r => r.ok).length}/{restartResults.length} steps passed
              </div>
            </div>
          )}
        </div>

        {stats && (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Total", value: stats.total, color: "text-foreground" },
              { label: "Today", value: stats.today, color: "text-blue-400" },
              { label: "Errors", value: stats.errors, color: "text-red-400" },
              { label: "Warns", value: stats.warnings, color: "text-yellow-400" },
            ].map(s => (
              <div key={s.label} className="p-2.5 rounded-lg border border-border bg-card text-center">
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-foreground/70" />
              <h2 className="font-semibold text-sm">Live System Logs</h2>
              {liveMode && (
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-[10px] text-green-400 font-medium">LIVE</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowFilters(f => !f)}
                className="p-1.5 rounded-md border border-border hover:bg-muted transition-colors"
                title="Filters"
              >
                <Filter className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setLiveMode(l => !l)}
                className={`p-1.5 rounded-md border transition-colors ${liveMode ? "border-green-500/30 bg-green-500/10 text-green-400" : "border-border hover:bg-muted"}`}
                title={liveMode ? "Pause" : "Resume"}
              >
                {liveMode ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleClearLogs}
                disabled={clearing}
                className="p-1.5 rounded-md border border-border hover:bg-red-500/10 hover:border-red-500/20 hover:text-red-400 transition-colors"
                title="Clear logs"
              >
                {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="flex gap-2 flex-wrap">
              <select
                value={levelFilter}
                onChange={e => setLevelFilter(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-md border border-border bg-background focus:outline-none"
              >
                <option value="all">All Levels</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warn">Warning</option>
                <option value="error">Error</option>
              </select>
              <select
                value={sourceFilter}
                onChange={e => setSourceFilter(e.target.value)}
                className="text-xs px-2 py-1.5 rounded-md border border-border bg-background focus:outline-none"
              >
                <option value="all">All Sources</option>
                <option value="request">Requests</option>
                <option value="system">System</option>
                <option value="restart">Restart</option>
                <option value="worker">Worker</option>
              </select>
            </div>
          )}

          <div className="rounded-xl border border-border bg-black/40 overflow-hidden">
            <div className="h-[420px] overflow-y-auto font-mono text-[11px] leading-relaxed p-3 space-y-0.5" id="log-container">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Activity className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-xs">No logs yet</p>
                  <p className="text-[10px] mt-1">Logs will appear here as the system runs</p>
                </div>
              ) : (
                logs.map(log => {
                  const style = LEVEL_STYLES[log.level] || LEVEL_STYLES.info;
                  const LevelIcon = style.icon;
                  return (
                    <div key={log.id} className={`flex items-start gap-2 px-2 py-1 rounded hover:bg-white/5 transition-colors group`}>
                      <LevelIcon className={`w-3 h-3 mt-0.5 shrink-0 ${style.text}`} />
                      <span className="text-muted-foreground shrink-0 w-[52px]">{formatTime(log.created_at)}</span>
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 shrink-0 border ${style.bg} ${style.text}`}>
                        {log.level}
                      </Badge>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0 text-muted-foreground">
                        {log.source}
                      </Badge>
                      <span className="text-foreground/80 break-all flex-1">
                        {log.message}
                        {log.latency_ms != null && (
                          <span className="text-muted-foreground ml-1">({log.latency_ms}ms)</span>
                        )}
                        {log.ip && (
                          <span className="text-muted-foreground/50 ml-1">[{log.ip}]</span>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={logEndRef} />
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
            <span>{logs.length} entries shown</span>
            <span>Auto-refresh: {liveMode ? "3s" : "paused"}</span>
          </div>
        </div>
      </div>
    </Layout>
  );
}
